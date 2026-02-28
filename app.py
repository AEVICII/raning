"""
Deriv Trader - Backend con Bots Persistentes
Los bots corren en el servidor. El navegador solo muestra el estado.
"""

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import json
import asyncio
import websockets
import threading
import time
import logging
import os
import uuid
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
log = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

APP_ID = '1089'
WS_URL = f'wss://ws.derivws.com/websockets/v3?app_id={APP_ID}'
DATA_FILE = 'bot_state.json'

SYNTHETIC_INDICES = {
    'R_10': 'Volatility 10 Index', 'R_25': 'Volatility 25 Index',
    'R_50': 'Volatility 50 Index', 'R_75': 'Volatility 75 Index',
    'R_100': 'Volatility 100 Index', '1HZ10V': 'Volatility 10 (1s) Index',
    '1HZ25V': 'Volatility 25 (1s) Index', '1HZ50V': 'Volatility 50 (1s) Index',
    '1HZ75V': 'Volatility 75 (1s) Index', '1HZ100V': 'Volatility 100 (1s) Index',
    'RDBEAR': 'Bear Market Index', 'RDBULL': 'Bull Market Index',
    'JD10': 'Jump 10 Index', 'JD25': 'Jump 25 Index', 'JD50': 'Jump 50 Index',
    'JD75': 'Jump 75 Index', 'JD100': 'Jump 100 Index',
}

# ═══════════════════════════════════════════
# ESTADO GLOBAL DEL SERVIDOR
# ═══════════════════════════════════════════

SERVER_STATE = {
    'api_token': None,
    'symbol': 'R_100',
    'decimals': 3,
    'contracts': [],
    'global_stats': {
        'totalTrades': 0, 'totalWins': 0, 'totalLosses': 0,
        'totalBalance': 0.0, 'globalMaxWin': 0.0,
        'globalMaxLoss': 0.0, 'globalTotalProfit': 0.0
    },
    'sl_tp': {
        'stopLossEnabled': False, 'stopLossAmount': 0,
        'takeProfitEnabled': False, 'takeProfitAmount': 0
    },
    'digit_limit': {
        'enabled': False, 'limit': 0,
        'currentCount': 0, 'lastCountedEpoch': None
    },
    'telegram': {
        'enabled': False, 'botToken': None, 'chatId': None,
        'notify': {'globalBalance': True, 'tradeResult': True,
                   'patternDetected': False, 'botStartStop': True,
                   'stopLossTakeProfit': True, 'botBalance': {}}
    }
}

# Runtime de bots (no persiste, se reconstruye)
BOT_RUNTIME = {}  # id -> dict

# Ticks y stats
RECENT_TICKS = []
DIGIT_STATS = {str(i): 0 for i in range(10)}
MEAN_REVERSION = {'evenCount': 0, 'oddCount': 0, 'totalTicks': 0, 'resetThreshold': 5}

# Log
GLOBAL_LOG = []
MAX_LOG = 500

# Event loop asyncio
LOOP = None
LOOP_THREAD = None
CENTRAL_WS_CONNECTED = False
CENTRAL_WS_OBJ = None  # Referencia al WS central para forzar reconexión


def _ts():
    return datetime.now().strftime('%H:%M:%S')


def add_log(message, log_type='info'):
    entry = {'time': _ts(), 'msg': message, 'type': log_type}
    GLOBAL_LOG.insert(0, entry)
    if len(GLOBAL_LOG) > MAX_LOG:
        GLOBAL_LOG.pop()
    log.info(f"[{log_type}] {message}")


# ═══════════════════════════════════════════
# PERSISTENCIA
# ═══════════════════════════════════════════

def save_state():
    try:
        data = {k: SERVER_STATE[k] for k in
                ('api_token', 'symbol', 'decimals', 'contracts',
                 'global_stats', 'sl_tp', 'digit_limit', 'telegram')}
        with open(DATA_FILE, 'w') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        log.error(f"Error guardando estado: {e}")


def load_state():
    if not os.path.exists(DATA_FILE):
        return
    try:
        with open(DATA_FILE, 'r') as f:
            data = json.load(f)
        for k in ('api_token', 'symbol', 'decimals', 'contracts',
                  'global_stats', 'sl_tp', 'digit_limit', 'telegram'):
            if k in data:
                SERVER_STATE[k] = data[k]
        log.info(f"Estado cargado: {len(SERVER_STATE['contracts'])} contrato(s)")
    except Exception as e:
        log.error(f"Error cargando estado: {e}")


# ═══════════════════════════════════════════
# UTILIDADES
# ═══════════════════════════════════════════

def get_last_digit(quote, decimals):
    s = f"{float(quote):.{int(decimals)}f}"
    return int(s[-1])


def get_hot_digit():
    return max(range(10), key=lambda d: DIGIT_STATS.get(str(d), 0))


def get_cold_digit():
    return min(range(10), key=lambda d: DIGIT_STATS.get(str(d), 0))


def get_hot_even_odd():
    even = sum(DIGIT_STATS.get(str(d), 0) for d in range(0, 10, 2))
    odd  = sum(DIGIT_STATS.get(str(d), 0) for d in range(1, 10, 2))
    return 'DIGITEVEN' if even >= odd else 'DIGITODD'


def get_cold_even_odd():
    return 'DIGITODD' if get_hot_even_odd() == 'DIGITEVEN' else 'DIGITEVEN'


def get_mean_reversion_signal():
    mr = MEAN_REVERSION
    diff = mr['evenCount'] - mr['oddCount']
    if abs(diff) == 1:
        return 'DIGITODD' if diff > 0 else 'DIGITEVEN'
    return None


def update_digit_stats(quote, decimals):
    digit = get_last_digit(quote, decimals)
    DIGIT_STATS[str(digit)] = DIGIT_STATS.get(str(digit), 0) + 1
    mr = MEAN_REVERSION
    if digit % 2 == 0:
        mr['evenCount'] += 1
    else:
        mr['oddCount'] += 1
    mr['totalTicks'] += 1
    if abs(mr['evenCount'] - mr['oddCount']) >= mr['resetThreshold']:
        mr['evenCount'] = 0
        mr['oddCount'] = 0
        mr['totalTicks'] = 0


def evaluate_result(contract_type, prediction, last_digit):
    pred = int(prediction) if prediction is not None else 0
    if contract_type == 'DIGITEVEN':  return last_digit % 2 == 0
    if contract_type == 'DIGITODD':   return last_digit % 2 != 0
    if contract_type == 'DIGITMATCH': return last_digit == pred
    if contract_type == 'DIGITDIFF':  return last_digit != pred
    if contract_type == 'DIGITOVER':  return last_digit > pred
    if contract_type == 'DIGITUNDER': return last_digit < pred
    return False


def check_pattern(pattern, tick_buffer, decimals):
    if not pattern:
        return False
    expanded_len = sum(int(p['value']) if p['type'] == 'repeat' else 1 for p in pattern)
    if len(tick_buffer) < expanded_len:
        return False
    recent = tick_buffer[-expanded_len:]
    pos = 0
    for pvar in pattern:
        if pos >= len(recent):
            return False
        d = recent[pos]
        t = pvar['type']
        v = pvar.get('value')
        if t == 'specific':
            if d != int(v): return False
            pos += 1
        elif t == 'any':
            pos += 1
        elif t == 'even':
            if d % 2 != 0: return False
            pos += 1
        elif t == 'odd':
            if d % 2 == 0: return False
            pos += 1
        elif t == 'repeat':
            count = int(v)
            first = recent[pos]
            for r in range(count):
                if pos + r >= len(recent) or recent[pos + r] != first: return False
            pos += count
        else:
            pos += 1  # comodín (hotdigit, colddigit, hoteo, coldeo)
    return True


# ═══════════════════════════════════════════
# LÓGICA DE BOTS (asyncio)
# ═══════════════════════════════════════════

async def execute_trade(contract, rt, start_epoch=0):
    ws = rt.get('ws')
    if not ws:
        rt['trade_in_progress'] = False
        return

    cfg = contract['config']
    ms = rt.setdefault('martingale_state',
                       {'consecutiveLosses': 0, 'accumulatedLoss': 0.0, 'currentStake': None})

    stake = (ms['currentStake']
             if cfg.get('martingale', {}).get('enabled') and ms.get('currentStake')
             else cfg['stake'])

    # Tipo dinámico
    contract_type = cfg['contractType']
    if contract_type == 'HOTEO':
        contract_type = get_hot_even_odd()
    elif contract_type == 'COLDEO':
        contract_type = get_cold_even_odd()
    elif contract_type == 'MEANREV':
        sig = get_mean_reversion_signal()
        if not sig:
            rt['trade_in_progress'] = False
            return
        contract_type = sig

    # Predicción dinámica
    prediction = cfg.get('prediction')
    pred_mode = cfg.get('predictionMode', 'specific')
    if pred_mode == 'hotdigit':
        prediction = str(get_hot_digit())
    elif pred_mode == 'colddigit':
        prediction = str(get_cold_digit())
    elif pred_mode == 'lastpattern':
        prediction = str(rt.get('last_pattern_digit', 0))

    req = {
        'buy': 1,
        'price': stake,
        'parameters': {
            'contract_type': contract_type,
            'currency': 'USD',
            'duration': cfg['duration'],
            'duration_unit': 't',
            'symbol': cfg['symbol'],
            'amount': stake,
            'basis': 'stake'
        }
    }
    if prediction is not None and contract_type not in ('DIGITEVEN', 'DIGITODD'):
        req['parameters']['barrier'] = str(prediction)

    rt['pending_result'] = {
        'ticksRemaining': cfg['duration'],
        'startEpoch': start_epoch,
        'contractType': contract_type,
        'prediction': prediction,
        'dependentsTriggered': False
    }
    contract.setdefault('stats', {})
    contract['stats']['trades'] = contract['stats'].get('trades', 0) + 1
    rt['trade_in_progress'] = True

    add_log(f'💰 Comprando {contract_type} en {cfg["symbol"]} — "{contract["name"]}" ${stake:.2f}',
            'bot-action')
    try:
        await ws.send(json.dumps(req))
    except Exception as e:
        add_log(f'❌ Error enviando orden en "{contract["name"]}": {e}', 'error')
        rt['trade_in_progress'] = False


def handle_contract_result(data, contract, rt):
    poc = data.get('proposal_open_contract')
    if not poc or not (poc.get('is_sold') or poc.get('status') == 'sold'):
        return

    profit = float(poc.get('profit', 0))
    is_win = profit > 0
    name = contract['name']

    s = contract.setdefault('stats', {})
    s['balance'] = s.get('balance', 0.0) + profit
    s['totalProfit'] = s.get('totalProfit', 0.0) + profit
    s['trades'] = s.get('trades', 0)  # ya se incrementó en execute_trade
    if is_win:
        s['wins'] = s.get('wins', 0) + 1
        if s['balance'] > s.get('maxWin', 0): s['maxWin'] = s['balance']
    else:
        s['losses'] = s.get('losses', 0) + 1
        if s['balance'] < s.get('maxLoss', 0): s['maxLoss'] = s['balance']

    gs = SERVER_STATE['global_stats']
    gs['totalTrades'] += 1
    gs['totalBalance'] = gs.get('totalBalance', 0.0) + profit
    gs['globalTotalProfit'] = gs.get('globalTotalProfit', 0.0) + profit
    if is_win:
        gs['totalWins'] += 1
        if gs['totalBalance'] > gs.get('globalMaxWin', 0): gs['globalMaxWin'] = gs['totalBalance']
    else:
        gs['totalLosses'] += 1
        if gs['totalBalance'] < gs.get('globalMaxLoss', 0): gs['globalMaxLoss'] = gs['totalBalance']

    add_log(f'{"🎉 Ganancia" if is_win else "😔 Pérdida"} en "{name}": {("+" if is_win else "")}${profit:.2f}',
            'success' if is_win else 'error')

    # Martingala
    mg = contract['config'].get('martingale', {})
    ms = rt.setdefault('martingale_state',
                       {'consecutiveLosses': 0, 'accumulatedLoss': 0.0, 'currentStake': None})
    if mg.get('enabled'):
        if is_win:
            ms['consecutiveLosses'] = 0
            ms['accumulatedLoss'] = 0.0
            ms['currentStake'] = None
        else:
            ms['consecutiveLosses'] += 1
            ms['accumulatedLoss'] += abs(profit)
            if ms['consecutiveLosses'] > mg.get('depth', 5):
                ms['consecutiveLosses'] = 0
                ms['accumulatedLoss'] = 0.0
                ms['currentStake'] = None
                add_log(f'⚠️ "{name}": martingala reiniciada', 'warning')
            else:
                payout = mg.get('payout', 0.95)
                desired = mg.get('desiredProfit', 0)
                next_stake = (ms['accumulatedLoss'] + desired) / payout if payout > 0 else ms['accumulatedLoss']
                ms['currentStake'] = round(max(next_stake, 0.35), 2)
                add_log(f'📈 Martingala "{name}": próxima apuesta ${ms["currentStake"]:.2f}', 'warning')

    rt['trade_in_progress'] = False
    rt['pending_result'] = None

    # SL/TP
    sltp = SERVER_STATE['sl_tp']
    balance = gs['totalBalance']
    if sltp.get('stopLossEnabled') and sltp.get('stopLossAmount', 0) > 0:
        if balance <= -abs(sltp['stopLossAmount']):
            add_log(f'🔴 STOP-LOSS alcanzado (${balance:.2f})', 'error')
            _stop_all()
    elif sltp.get('takeProfitEnabled') and sltp.get('takeProfitAmount', 0) > 0:
        if balance >= abs(sltp['takeProfitAmount']):
            add_log(f'🟢 TAKE-PROFIT alcanzado (+${balance:.2f})', 'success')
            _stop_all()

    # Bots dependientes
    _trigger_dependents(contract, 'win' if is_win else 'loss')
    save_state()


def _trigger_dependents(parent, result):
    parent_name = parent['name']
    for c in SERVER_STATE['contracts']:
        if (c.get('isDependentBot') and c.get('dependsOn') == parent_name
                and c.get('status') == 'active'
                and (c.get('triggerOn') == result or c.get('triggerOn') == 'both')):
            cid = c['id']
            rt = BOT_RUNTIME.get(cid)
            if rt and not rt.get('trade_in_progress') and rt.get('ws') and rt.get('authorized'):
                add_log(f'⚡ "{c["name"]}" disparado por {result} de "{parent_name}"', 'success')
                c.setdefault('stats', {})['matches'] = c['stats'].get('matches', 0) + 1
                asyncio.run_coroutine_threadsafe(execute_trade(c, rt, 0), LOOP)


def _stop_all():
    for c in SERVER_STATE['contracts']:
        if c.get('status') in ('active', 'waiting'):
            _stop_bot(c)


async def run_bot(contract):
    cid = contract['id']
    name = contract['name']
    rt = BOT_RUNTIME.get(cid, {})

    while not rt.get('stop_requested'):
        try:
            async with websockets.connect(
                    WS_URL, ping_interval=30, ping_timeout=10,
                    close_timeout=5) as ws:
                rt['ws'] = ws
                rt['authorized'] = False

                await ws.send(json.dumps({'authorize': SERVER_STATE['api_token']}))
                resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=15))
                if resp.get('msg_type') != 'authorize' or not resp.get('authorize'):
                    err = resp.get('error', {}).get('message', 'Auth failed')
                    add_log(f'❌ "{name}": {err}', 'error')
                    rt['ws'] = None
                    await asyncio.sleep(5)
                    continue

                rt['authorized'] = True
                rt['status'] = 'active'
                contract['status'] = 'active'
                save_state()
                add_log(f'✅ Bot "{name}" activo', 'success')

                async for raw in ws:
                    if rt.get('stop_requested'):
                        break
                    data = json.loads(raw)
                    mtype = data.get('msg_type')
                    if mtype == 'buy':
                        if data.get('error'):
                            add_log(f'❌ Error buy "{name}": {data["error"]["message"]}', 'error')
                            rt['trade_in_progress'] = False
                        elif data.get('buy'):
                            cid_trade = data['buy']['contract_id']
                            add_log(f'✅ Trade comprado "{name}" ID:{cid_trade}', 'success')
                            await ws.send(json.dumps({
                                'proposal_open_contract': 1,
                                'contract_id': cid_trade,
                                'subscribe': 1
                            }))
                    elif mtype == 'proposal_open_contract':
                        handle_contract_result(data, contract, rt)
                    elif data.get('error'):
                        ec = data['error'].get('code', '')
                        if ec == 'AuthorizationRequired':
                            rt['authorized'] = False
                            await ws.send(json.dumps({'authorize': SERVER_STATE['api_token']}))
                        else:
                            add_log(f'❌ Error "{name}": {data["error"]["message"]}', 'error')
                            rt['trade_in_progress'] = False

        except asyncio.CancelledError:
            break
        except Exception as e:
            if not rt.get('stop_requested'):
                add_log(f'⚠️ Bot "{name}" reconectando... ({e})', 'warning')
                rt['ws'] = None
                rt['authorized'] = False
                await asyncio.sleep(3)
            else:
                break

    rt['ws'] = None
    rt['authorized'] = False
    rt['status'] = 'inactive'
    contract['status'] = 'inactive'
    save_state()
    add_log(f'⏹️ Bot "{name}" detenido', 'info')


async def central_tick_loop():
    global CENTRAL_WS_CONNECTED
    while True:
        symbol = SERVER_STATE.get('symbol', 'R_100')
        decimals = SERVER_STATE.get('decimals', 3)
        try:
            CENTRAL_WS_CONNECTED = False
            async with websockets.connect(
                    WS_URL, ping_interval=30, ping_timeout=10) as ws:
                global CENTRAL_WS_OBJ
                CENTRAL_WS_OBJ = ws
                CENTRAL_WS_CONNECTED = True
                if SERVER_STATE.get('api_token'):
                    await ws.send(json.dumps({'authorize': SERVER_STATE['api_token']}))
                    try:
                        await asyncio.wait_for(ws.recv(), timeout=10)
                    except Exception:
                        pass

                await ws.send(json.dumps({'ticks': symbol, 'subscribe': 1}))
                add_log(f'📡 WS central conectado — {symbol}', 'info')

                async for raw in ws:
                    data = json.loads(raw)
                    if data.get('msg_type') != 'tick' or not data.get('tick'):
                        continue

                    tick = data['tick']
                    quote = tick['quote']
                    epoch = tick['epoch']
                    decimals = SERVER_STATE.get('decimals', 3)
                    digit = get_last_digit(quote, decimals)
                    update_digit_stats(quote, decimals)

                    tick_entry = {
                        'quote': float(quote),
                        'epoch': epoch,
                        'symbol': tick.get('symbol', symbol),
                        'digit': digit,
                        'time': _ts()
                    }
                    RECENT_TICKS.insert(0, tick_entry)
                    if len(RECENT_TICKS) > 200:
                        RECENT_TICKS.pop()

                    # Digit limit
                    dl = SERVER_STATE['digit_limit']
                    if dl.get('enabled') and epoch != dl.get('lastCountedEpoch'):
                        dl['lastCountedEpoch'] = epoch
                        dl['currentCount'] = dl.get('currentCount', 0) + 1
                        if dl['currentCount'] >= dl.get('limit', 0):
                            add_log(f'🎯 Límite de dígitos ({dl["limit"]}) alcanzado', 'warning')
                            _stop_all()
                            dl['enabled'] = False
                            dl['currentCount'] = 0
                            continue

                    # Distribuir a bots
                    for contract in SERVER_STATE['contracts']:
                        if contract.get('status') != 'active':
                            continue
                        cid = contract['id']
                        rt = BOT_RUNTIME.get(cid)
                        if not rt:
                            continue

                        # Tick counting para resultado
                        pr = rt.get('pending_result')
                        if pr and not pr.get('dependentsTriggered'):
                            if epoch != pr['startEpoch']:
                                pr['ticksRemaining'] -= 1
                                if pr['ticksRemaining'] <= 0:
                                    is_win = evaluate_result(
                                        pr['contractType'], pr['prediction'], digit)
                                    pr['dependentsTriggered'] = True
                                    add_log(
                                        f'🔮 "{contract["name"]}": {"✅ GANA" if is_win else "❌ PIERDE"} (dígito: {digit})',
                                        'success' if is_win else 'error')
                                    _trigger_dependents(contract, 'win' if is_win else 'loss')

                        # Bots dependientes no tienen patrón propio
                        if contract.get('isDependentBot'):
                            continue

                        # ⏳ PADRE ESPERA TODA LA CADENA: si algún descendiente está ocupado, no operar
                        def is_any_descendant_busy(bot_name):
                            return any(
                                c for c in SERVER_STATE['contracts']
                                if c.get('isDependentBot') and c.get('dependsOn') == bot_name
                                and c.get('status') in ('active', 'waiting')
                                and (
                                    BOT_RUNTIME.get(c['id'], {}).get('trade_in_progress') or
                                    is_any_descendant_busy(c['name'])
                                )
                            )
                        if is_any_descendant_busy(contract['name']):
                            continue

                        if rt.get('trade_in_progress'):
                            continue

                        pattern = contract.get('pattern', [])
                        if not pattern:
                            continue

                        rt.setdefault('tick_buffer', []).append(digit)
                        if len(rt['tick_buffer']) > 200:
                            rt['tick_buffer'].pop(0)

                        if not check_pattern(pattern, rt['tick_buffer'], decimals):
                            continue

                        # Filtro de repetición
                        max_rep = contract['config'].get('maxConsecutiveRepeat', 0)
                        if max_rep >= 1:
                            buf = rt['tick_buffer']
                            max_streak = streak = 1
                            for i in range(1, len(buf)):
                                if buf[i] == buf[i - 1]:
                                    streak += 1
                                    max_streak = max(max_streak, streak)
                                else:
                                    streak = 1
                            if max_streak > max_rep:
                                add_log(f'🚫 "{contract["name"]}": ignorado ({max_streak}x)', 'warning')
                                rt['tick_buffer'] = []
                                continue

                        add_log(f'🎯 ¡PATRÓN DETECTADO en "{contract["name"]}"!', 'success')
                        contract.setdefault('stats', {})['matches'] = \
                            contract['stats'].get('matches', 0) + 1
                        rt['last_pattern_digit'] = digit
                        rt['trade_in_progress'] = True
                        rt['tick_buffer'] = []
                        asyncio.ensure_future(execute_trade(contract, rt, epoch))
                        save_state()

        except asyncio.CancelledError:
            CENTRAL_WS_CONNECTED = False
            break
        except Exception as e:
            CENTRAL_WS_CONNECTED = False
            log.error(f"WS central error: {e}")
            await asyncio.sleep(3)


def start_event_loop():
    global LOOP
    LOOP = asyncio.new_event_loop()
    asyncio.set_event_loop(LOOP)
    LOOP.run_until_complete(central_tick_loop())


def init_background():
    global LOOP_THREAD
    LOOP_THREAD = threading.Thread(target=start_event_loop, daemon=True)
    LOOP_THREAD.start()
    # Esperar a que el loop esté listo
    for _ in range(20):
        if LOOP is not None:
            break
        time.sleep(0.1)


# ═══════════════════════════════════════════
# CONTROL DE BOTS (thread-safe)
# ═══════════════════════════════════════════

def _start_bot(contract):
    cid = contract['id']
    rt = BOT_RUNTIME.get(cid, {})

    # Si ya hay una tarea corriendo, no duplicar
    task = rt.get('task')
    if task and not task.done():
        return

    BOT_RUNTIME[cid] = {
        'ws': None, 'task': None, 'authorized': False,
        'tick_buffer': [], 'trade_in_progress': False,
        'pending_result': None, 'stop_requested': False,
        'status': 'waiting',
        'martingale_state': {'consecutiveLosses': 0, 'accumulatedLoss': 0.0, 'currentStake': None},
        'last_pattern_digit': None
    }
    contract['status'] = 'waiting'

    future = asyncio.run_coroutine_threadsafe(run_bot(contract), LOOP)
    BOT_RUNTIME[cid]['task'] = future
    add_log(f'▶️ Bot "{contract["name"]}" iniciado', 'info')
    save_state()


def _stop_bot(contract):
    cid = contract['id']
    rt = BOT_RUNTIME.get(cid)
    if rt:
        rt['stop_requested'] = True
        rt['status'] = 'inactive'
        task = rt.get('task')
        if task and not task.done():
            LOOP.call_soon_threadsafe(task.cancel)
    contract['status'] = 'inactive'
    add_log(f'⏹️ Bot "{contract["name"]}" detenido', 'info')
    save_state()


# ═══════════════════════════════════════════
# FLASK ROUTES
# ═══════════════════════════════════════════

@app.route('/')
def index():
    return render_template('index.html', indices=SYNTHETIC_INDICES, websocket_url=WS_URL)


@app.route('/api/state')
def get_state():
    contracts_out = []
    for c in SERVER_STATE['contracts']:
        cid = c['id']
        rt = BOT_RUNTIME.get(cid, {})
        contracts_out.append({
            **c,
            'status': rt.get('status', c.get('status', 'inactive')),
            'martingaleCurrentStake': rt.get('martingale_state', {}).get('currentStake'),
        })

    return jsonify({
        'api_token_set': bool(SERVER_STATE.get('api_token')),
        'symbol': SERVER_STATE['symbol'],
        'decimals': SERVER_STATE['decimals'],
        'contracts': contracts_out,
        'global_stats': SERVER_STATE['global_stats'],
        'sl_tp': SERVER_STATE['sl_tp'],
        'digit_limit': SERVER_STATE['digit_limit'],
        'telegram': {
            'enabled': SERVER_STATE['telegram']['enabled'],
            'configured': bool(
                SERVER_STATE['telegram'].get('botToken') and
                SERVER_STATE['telegram'].get('chatId')
            ),
        },
        'ticks': RECENT_TICKS[:50],
        'digit_stats': DIGIT_STATS,
        'mean_reversion': MEAN_REVERSION,
        'log': GLOBAL_LOG[:150],
        'central_ws_connected': CENTRAL_WS_CONNECTED,
    })


@app.route('/api/config', methods=['POST'])
def set_config():
    d = request.get_json() or {}
    if 'api_token' in d:
        SERVER_STATE['api_token'] = d['api_token'] or None
    if 'symbol' in d:
        SERVER_STATE['symbol'] = d['symbol']
        RECENT_TICKS.clear()
        for k in DIGIT_STATS: DIGIT_STATS[k] = 0
        MEAN_REVERSION.update({'evenCount': 0, 'oddCount': 0, 'totalTicks': 0})
    if 'decimals' in d:
        SERVER_STATE['decimals'] = int(d['decimals'])
    save_state()
    return jsonify({'ok': True})


@app.route('/api/contracts', methods=['POST'])
def save_contract_route():
    d = request.get_json() or {}
    cid = d.get('id')
    if cid:
        for i, c in enumerate(SERVER_STATE['contracts']):
            if c['id'] == cid:
                was_active = c.get('status') in ('active', 'waiting')
                SERVER_STATE['contracts'][i] = {
                    **c, **d,
                    'status': c.get('status', 'inactive'),
                    'stats': c.get('stats', {})
                }
                if was_active:
                    _stop_bot(SERVER_STATE['contracts'][i])
                    time.sleep(0.5)
                    _start_bot(SERVER_STATE['contracts'][i])
                save_state()
                return jsonify({'ok': True, 'id': cid})
        return jsonify({'ok': False, 'error': 'Not found'}), 404
    else:
        new_id = 'contract_' + str(int(time.time())) + '_' + uuid.uuid4().hex[:8]
        d['id'] = new_id
        d['status'] = 'inactive'
        d.setdefault('stats', {
            'matches': 0, 'trades': 0, 'wins': 0, 'losses': 0,
            'balance': 0.0, 'totalProfit': 0.0, 'maxWin': 0.0, 'maxLoss': 0.0
        })
        SERVER_STATE['contracts'].append(d)
        save_state()
        return jsonify({'ok': True, 'id': new_id})


@app.route('/api/contracts/<cid>', methods=['DELETE'])
def delete_contract_route(cid):
    contract = next((c for c in SERVER_STATE['contracts'] if c['id'] == cid), None)
    if not contract:
        return jsonify({'ok': False}), 404
    if contract.get('status') in ('active', 'waiting'):
        _stop_bot(contract)
    SERVER_STATE['contracts'] = [c for c in SERVER_STATE['contracts'] if c['id'] != cid]
    BOT_RUNTIME.pop(cid, None)
    save_state()
    return jsonify({'ok': True})


@app.route('/api/bots/<cid>/start', methods=['POST'])
def start_bot_route(cid):
    contract = next((c for c in SERVER_STATE['contracts'] if c['id'] == cid), None)
    if not contract:
        return jsonify({'ok': False, 'error': 'Not found'}), 404
    if not SERVER_STATE.get('api_token'):
        return jsonify({'ok': False, 'error': 'No hay API token configurado'}), 400
    _start_bot(contract)
    return jsonify({'ok': True})


@app.route('/api/bots/<cid>/stop', methods=['POST'])
def stop_bot_route(cid):
    contract = next((c for c in SERVER_STATE['contracts'] if c['id'] == cid), None)
    if not contract:
        return jsonify({'ok': False, 'error': 'Not found'}), 404
    _stop_bot(contract)
    return jsonify({'ok': True})


@app.route('/api/bots/start-all', methods=['POST'])
def start_all_route():
    if not SERVER_STATE.get('api_token'):
        return jsonify({'ok': False, 'error': 'No hay API token'}), 400
    for c in SERVER_STATE['contracts']:
        if c.get('status') not in ('active', 'waiting'):
            _start_bot(c)
    add_log('▶️ Todos los bots iniciados', 'info')
    return jsonify({'ok': True})


@app.route('/api/bots/stop-all', methods=['POST'])
def stop_all_route():
    _stop_all()
    add_log('⏹️ Todos los bots detenidos', 'info')
    return jsonify({'ok': True})


@app.route('/api/stats/reset', methods=['POST'])
def reset_stats_route():
    SERVER_STATE['global_stats'] = {
        'totalTrades': 0, 'totalWins': 0, 'totalLosses': 0,
        'totalBalance': 0.0, 'globalMaxWin': 0.0,
        'globalMaxLoss': 0.0, 'globalTotalProfit': 0.0
    }
    for c in SERVER_STATE['contracts']:
        c['stats'] = {
            'matches': 0, 'trades': 0, 'wins': 0, 'losses': 0,
            'balance': 0.0, 'totalProfit': 0.0, 'maxWin': 0.0, 'maxLoss': 0.0
        }
    GLOBAL_LOG.clear()
    save_state()
    add_log('🔄 Estadísticas reseteadas', 'info')
    return jsonify({'ok': True})


@app.route('/api/sltp', methods=['POST'])
def set_sltp_route():
    d = request.get_json() or {}
    SERVER_STATE['sl_tp'].update(d)
    save_state()
    return jsonify({'ok': True})


@app.route('/api/digit-limit', methods=['POST'])
def set_digit_limit_route():
    d = request.get_json() or {}
    SERVER_STATE['digit_limit'].update(d)
    save_state()
    return jsonify({'ok': True})


@app.route('/api/telegram', methods=['GET'])
def get_telegram_route():
    return jsonify(SERVER_STATE['telegram'])


@app.route('/api/telegram', methods=['POST'])
def set_telegram_route():
    d = request.get_json() or {}
    SERVER_STATE['telegram'].update(d)
    save_state()
    return jsonify({'ok': True})


@app.route('/api/mean-reversion/reset', methods=['POST'])
def reset_mr_route():
    MEAN_REVERSION.update({'evenCount': 0, 'oddCount': 0, 'totalTicks': 0})
    return jsonify({'ok': True})


@app.route('/api/mean-reversion/threshold', methods=['POST'])
def set_mr_threshold_route():
    d = request.get_json() or {}
    MEAN_REVERSION['resetThreshold'] = max(2, int(d.get('threshold', 5)))
    return jsonify({'ok': True})


@app.route('/api/apply-symbol', methods=['POST'])
def apply_symbol_route():
    """Cambia el símbolo/decimales y fuerza reconexión del WS central."""
    global CENTRAL_WS_OBJ
    d = request.get_json() or {}
    if 'symbol' in d:
        SERVER_STATE['symbol'] = d['symbol']
        RECENT_TICKS.clear()
        for k in DIGIT_STATS: DIGIT_STATS[k] = 0
        MEAN_REVERSION.update({'evenCount': 0, 'oddCount': 0, 'totalTicks': 0})
    if 'decimals' in d:
        SERVER_STATE['decimals'] = int(d['decimals'])
    save_state()
    # Cerrar el WS central actual — el loop se reconecta automáticamente con el nuevo símbolo
    if CENTRAL_WS_OBJ:
        try:
            asyncio.run_coroutine_threadsafe(CENTRAL_WS_OBJ.close(), LOOP)
        except Exception as e:
            log.warning(f"Error cerrando WS central: {e}")
    add_log(f"🔄 Símbolo cambiado a {SERVER_STATE['symbol']} ({SERVER_STATE['decimals']} decimales)", 'info')
    return jsonify({'ok': True})


# ═══════════════════════════════════════════
# INICIO
# ═══════════════════════════════════════════

def auto_restart_active_bots():
    actives = [c for c in SERVER_STATE['contracts']
               if c.get('status') in ('active', 'waiting')]
    if not actives:
        return
    if not SERVER_STATE.get('api_token'):
        add_log(f'⚠️ {len(actives)} bot(s) activos sin API token. Detenidos.', 'warning')
        for c in actives: c['status'] = 'inactive'
        save_state()
        return
    add_log(f'🔄 Reiniciando {len(actives)} bot(s) activos...', 'info')
    for c in actives:
        c['status'] = 'inactive'  # reset antes de iniciar
        _start_bot(c)


if __name__ == '__main__':
    print("=" * 60)
    print("🚀 Deriv Trader - Bots Persistentes en Servidor")
    print("=" * 60)

    load_state()
    init_background()
    time.sleep(1)
    auto_restart_active_bots()

    print(f"🌐 http://localhost:5000")
    print("💡 Los bots siguen corriendo aunque cierres el navegador")
    print("=" * 60)

    app.run(debug=False, host='0.0.0.0', port=5000, threaded=True)
