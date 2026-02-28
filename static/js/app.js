// ==========================================
// DERIV TRADER - FRONTEND (Solo UI)
// Los bots corren en el SERVIDOR.
// Este archivo solo muestra el estado y envía comandos.
// ==========================================

const API = {
    async get(path) {
        const r = await fetch(path);
        return r.json();
    },
    async post(path, body = {}) {
        const r = await fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return r.json();
    },
    async del(path) {
        const r = await fetch(path, { method: 'DELETE' });
        return r.json();
    }
};

// Estado local (solo para UI)
const UI = {
    contracts: [],
    globalStats: {},
    digitStats: {},
    meanReversion: {},
    ticks: [],
    slTp: {},
    digitLimit: {},
    telegram: {},
    log: [],
    centralConnected: false,
    apiTokenSet: false,
    symbol: 'R_100',
    decimals: 3,
    modalPattern: [],
    currentEditingId: null,
    pollInterval: null,
};

// ==========================================
// POLL DEL SERVIDOR (cada 1 segundo)
// ==========================================

async function pollState() {
    try {
        const state = await API.get('/api/state');
        applyState(state);
    } catch (e) {
        console.error('Poll error:', e);
    }
}

function applyState(state) {
    UI.contracts = state.contracts || [];
    UI.globalStats = state.global_stats || {};
    UI.digitStats = state.digit_stats || {};
    UI.meanReversion = state.mean_reversion || {};
    UI.ticks = state.ticks || [];
    UI.slTp = state.sl_tp || {};
    UI.digitLimit = state.digit_limit || {};
    UI.telegram = state.telegram || {};
    UI.log = state.log || [];
    UI.centralConnected = state.central_ws_connected || false;
    UI.apiTokenSet = state.api_token_set || false;
    UI.symbol = state.symbol || 'R_100';
    UI.decimals = state.decimals || 3;

    updateConnectionStatus();
    updateTicksDisplay();
    updateDigitsDisplay();
    updateStatsDisplay();
    updateMeanReversionDisplay();
    updateContractsList();
    updateGlobalStats();
    updateGlobalLog();
    updateDigitLimitStatus();
    updateSlTpStatus();
}

// ==========================================
// INICIALIZACIÓN
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Deriv Trader UI iniciada');
    setupEventListeners();
    initManualTrading();
    pollState();
    UI.pollInterval = setInterval(pollState, 1000);
});

function setupEventListeners() {
    // Guardar token
    document.getElementById('saveConfigBtn').addEventListener('click', saveConfig);
    document.getElementById('apiToken').addEventListener('change', function () {
        const t = this.value.trim();
        if (t) localStorage.setItem('derivApiToken', t);
    });

    // Cargar token guardado
    const saved = localStorage.getItem('derivApiToken');
    if (saved) {
        document.getElementById('apiToken').value = saved;
        const badge = document.getElementById('apiTokenSavedBadge');
        if (badge) badge.style.display = 'inline';
    }

    document.getElementById('clearTokenBtn').addEventListener('click', () => {
        localStorage.removeItem('derivApiToken');
        document.getElementById('apiToken').value = '';
        const badge = document.getElementById('apiTokenSavedBadge');
        if (badge) badge.style.display = 'none';
        showNotification('🗑️ API Token eliminado localmente', 'info');
    });

    // Cambio de símbolo: solo auto-sugerir decimales, no enviar al servidor todavía
    document.getElementById('symbolSelect').addEventListener('change', () => {
        const sym = document.getElementById('symbolSelect').value;
        const suggested = getSuggestedDecimals(sym);
        document.getElementById('decimalsSelect').value = suggested;
        const statusEl = document.getElementById('applySymbolStatus');
        if (statusEl) {
            statusEl.textContent = '⚠️ Haz clic en "Aplicar" para cargar el nuevo índice';
            statusEl.style.color = '#f39c12';
        }
    });

    // Botón Aplicar Índice y Decimales
    document.getElementById('applySymbolBtn').addEventListener('click', applySymbol);

    // Vista ticks/dígitos
    document.getElementById('viewTicksBtn').addEventListener('click', () => switchView('ticks'));
    document.getElementById('viewDigitsBtn').addEventListener('click', () => switchView('digits'));

    // Bots globales
    document.getElementById('startAllBotsBtn').addEventListener('click', startAllBots);
    document.getElementById('stopAllBotsBtn').addEventListener('click', stopAllBots);
    document.getElementById('resetStatsBtn').addEventListener('click', resetAllStats);

    // Nuevo contrato
    const addBtn = document.getElementById('addNewContractBtn');
    if (addBtn) addBtn.addEventListener('click', () => openContractModal());

    const createFirstBtn = document.getElementById('createFirstContractBtn');
    if (createFirstBtn) createFirstBtn.addEventListener('click', () => openContractModal());

    // Modal de contrato
    document.getElementById('closeContractModal').addEventListener('click', closeContractModal);
    document.getElementById('cancelContractBtn').addEventListener('click', closeContractModal);
    document.getElementById('saveContractBtn').addEventListener('click', saveContract);

    // SL/TP
    document.getElementById('enableStopLoss').addEventListener('change', syncSlTp);
    document.getElementById('enableTakeProfit').addEventListener('change', syncSlTp);
    document.getElementById('stopLossAmount').addEventListener('input', syncSlTp);
    document.getElementById('takeProfitAmount').addEventListener('input', syncSlTp);

    // Digit Limit
    document.getElementById('enableDigitLimit').addEventListener('change', syncDigitLimit);
    document.getElementById('digitLimitInput').addEventListener('input', syncDigitLimit);

    // Pattern builder
    document.getElementById('modalAddVariableBtn').addEventListener('click', showVariableSelector);
    document.getElementById('modalCancelVariableBtn').addEventListener('click', hideVariableSelector);
    document.getElementById('modalCancelNumberBtn').addEventListener('click', hideNumberSelector);

    document.querySelectorAll('.variable-option').forEach(btn => {
        btn.addEventListener('click', function () {
            handleVariableTypeSelection(this.getAttribute('data-type'));
        });
    });

    document.querySelectorAll('.number-btn[data-number]').forEach(btn => {
        btn.addEventListener('click', function () {
            addPatternVariable('specific', this.getAttribute('data-number'));
            hideNumberSelector();
        });
    });

    document.getElementById('modalContractType').addEventListener('change', handleModalContractTypeChange);
    document.getElementById('predictionMode').addEventListener('change', handlePredictionModeChange);
    document.getElementById('isDependentBot').addEventListener('change', function () {
        toggleDependentBotUI(this.checked);
    });
    document.getElementById('martingaleEnabled').addEventListener('change', function () {
        toggleMartingaleUI(this.checked);
    });

    // Telegram
    const tgSave = document.getElementById('telegramSaveBtn');
    if (tgSave) tgSave.addEventListener('click', saveTelegramSettings);
    const tgTest = document.getElementById('telegramTestBtn');
    if (tgTest) tgTest.addEventListener('click', testTelegramConnection);

    // Modal resultado
    document.querySelector('.close').addEventListener('click', closeModal);
    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
}

// ==========================================
// GUARDAR CONFIGURACIÓN AL SERVIDOR
// ==========================================

async function saveConfig() {
    const token = document.getElementById('apiToken').value.trim();
    const symbol = document.getElementById('symbolSelect').value;
    const decimals = parseInt(document.getElementById('decimalsSelect').value);

    if (token) localStorage.setItem('derivApiToken', token);

    const res = await API.post('/api/config', {
        api_token: token || null,
        symbol,
        decimals
    });

    if (res.ok) {
        showNotification('✅ Configuración guardada en el servidor', 'success');
        const badge = document.getElementById('apiTokenSavedBadge');
        if (badge && token) badge.style.display = 'inline';
        // Conectar trading manual con el nuevo token
        if (token) connectManual();
    } else {
        showNotification('❌ Error guardando configuración', 'danger');
    }
}

async function applySymbol() {
    const sym = document.getElementById('symbolSelect').value;
    const decimals = parseInt(document.getElementById('decimalsSelect').value);
    const btn = document.getElementById('applySymbolBtn');
    const statusEl = document.getElementById('applySymbolStatus');

    if (btn) { btn.disabled = true; btn.textContent = '⏳ Aplicando...'; }
    if (statusEl) { statusEl.textContent = '🔄 Reconectando al nuevo índice...'; statusEl.style.color = '#f39c12'; }

    try {
        const res = await API.post('/api/apply-symbol', { symbol: sym, decimals });
        if (res.ok) {
            if (statusEl) {
                statusEl.textContent = `✅ Aplicado: ${sym} (${decimals} decimales)`;
                statusEl.style.color = '#4caf50';
            }
            showNotification(`✅ Índice cambiado a ${sym}`, 'success');
            // Limpiar datos locales de ticks
            UI.ticks = [];
            UI.digitStats = {};
            updateTicksDisplay();
            updateDigitsDisplay();
            updateStatsDisplay();
        } else {
            if (statusEl) { statusEl.textContent = '❌ Error al aplicar'; statusEl.style.color = '#f44336'; }
            showNotification('❌ Error al cambiar índice', 'danger');
        }
    } catch (e) {
        if (statusEl) { statusEl.textContent = '❌ Error de red'; statusEl.style.color = '#f44336'; }
        showNotification('❌ Error de conexión', 'danger');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🔄 Aplicar Índice y Decimales'; }
    }
}

function getSuggestedDecimals(symbol) {
    const map = {
        'R_10': 3, 'R_25': 3, 'R_50': 3, 'R_75': 3, 'R_100': 3,
        '1HZ10V': 3, '1HZ25V': 3, '1HZ50V': 3, '1HZ75V': 3, '1HZ100V': 3,
        'RDBEAR': 4, 'RDBULL': 4,
        'JD10': 4, 'JD25': 4, 'JD50': 4, 'JD75': 4, 'JD100': 4
    };
    return map[symbol] || 3;
}

// ==========================================
// UI DE ESTADO
// ==========================================

function updateConnectionStatus() {
    const statusEl = document.getElementById('connectionStatus');
    if (UI.centralConnected) {
        statusEl.textContent = '🟢 Servidor Conectado';
        statusEl.style.color = '#4caf50';
    } else {
        statusEl.textContent = '🟡 Conectando...';
        statusEl.style.color = '#f39c12';
    }

    const symbolEl = document.getElementById('currentSymbol');
    if (symbolEl) {
        const sym = document.getElementById('symbolSelect').value || UI.symbol;
        symbolEl.textContent = `📊 ${sym}`;
    }
}

function updateTicksDisplay() {
    const tbody = document.getElementById('ticksTableBody');
    if (!tbody) return;
    if (UI.ticks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="no-data">📊 Esperando datos...</td></tr>';
        return;
    }
    tbody.innerHTML = UI.ticks.slice(0, 50).map((tick, i) => {
        const d = tick.digit;
        const isEven = d % 2 === 0;
        const q = parseFloat(tick.quote).toFixed(UI.decimals);
        return `<tr class="${i === 0 ? 'new-tick' : ''}">
            <td>${UI.ticks.length - i}</td>
            <td class="tick-value">${q}</td>
            <td><span class="digit-badge ${isEven ? 'even' : 'odd'}">${d}</span></td>
            <td>${tick.time}</td>
        </tr>`;
    }).join('');
}

function updateDigitsDisplay() {
    const grid = document.getElementById('digitsGrid');
    if (!grid) return;
    if (UI.ticks.length === 0) {
        grid.innerHTML = '<div class="no-data">📊 Esperando datos...</div>';
        return;
    }
    grid.innerHTML = UI.ticks.slice(0, 50).map((tick, i) => {
        const d = tick.digit;
        const isEven = d % 2 === 0;
        return `<div class="digit-card ${i === 0 ? 'latest' : ''}">
            <div class="digit-number">${d}</div>
            <div class="digit-info">
                <div>${isEven ? '📗 Par' : '📙 Impar'}</div>
                <div style="font-size:11px;margin-top:5px;">${tick.time}</div>
            </div>
        </div>`;
    }).join('');
}

function updateStatsDisplay() {
    const container = document.getElementById('digitStats');
    if (!container) return;
    const ds = UI.digitStats;
    const total = Object.values(ds).reduce((a, b) => a + Number(b), 0);
    if (total === 0) {
        container.innerHTML = '<div class="loading">Esperando datos...</div>';
        updateEvenOddStatsDisplay(0, 0, 0);
        return;
    }
    const counts = Object.values(ds).map(Number);
    const maxC = Math.max(...counts);
    const minC = Math.min(...counts.filter(c => c > 0));

    container.innerHTML = Object.keys(ds).sort((a, b) => Number(a) - Number(b)).map(d => {
        const count = Number(ds[d]);
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
        let cls = 'stat-item';
        if (count === maxC && count > 0) cls += ' highest';
        if (count === minC && count > 0) cls += ' lowest';
        return `<div class="${cls}">
            <div class="stat-digit">${d}</div>
            <div class="stat-count">${count}</div>
            <div class="stat-percent">${pct}%</div>
        </div>`;
    }).join('');

    let even = 0, odd = 0;
    for (let i = 0; i <= 9; i++) {
        if (i % 2 === 0) even += Number(ds[String(i)] || 0);
        else odd += Number(ds[String(i)] || 0);
    }
    updateEvenOddStatsDisplay(even, odd, total);
}

function updateEvenOddStatsDisplay(evenCount, oddCount, total) {
    const container = document.getElementById('evenOddStats');
    if (!container) return;
    if (total === 0) { container.innerHTML = '<div class="loading">Esperando datos...</div>'; return; }
    const ep = ((evenCount / total) * 100).toFixed(2);
    const op = ((oddCount / total) * 100).toFixed(2);
    const evenHot = evenCount >= oddCount;
    container.innerHTML = `
        <div class="eo-row">
            <div class="eo-card ${evenHot ? 'eo-hot' : 'eo-cold'}">
                <div class="eo-label">Par (0,2,4,6,8)</div>
                <div class="eo-count">${evenCount.toLocaleString()}</div>
                <div class="eo-percent">${ep}%</div>
                <div class="eo-bar-wrap"><div class="eo-bar" style="width:${ep}%"></div></div>
                <div class="eo-badge">${evenHot ? '🔥 Caliente' : '🧊 Frío'}</div>
            </div>
            <div class="eo-card ${!evenHot ? 'eo-hot' : 'eo-cold'}">
                <div class="eo-label">Impar (1,3,5,7,9)</div>
                <div class="eo-count">${oddCount.toLocaleString()}</div>
                <div class="eo-percent">${op}%</div>
                <div class="eo-bar-wrap"><div class="eo-bar" style="width:${op}%"></div></div>
                <div class="eo-badge">${!evenHot ? '🔥 Caliente' : '🧊 Frío'}</div>
            </div>
        </div>
        <div class="eo-diff">
            Diferencia: <strong>${Math.abs(ep - op).toFixed(2)}%</strong> &nbsp;•&nbsp;
            Total ticks: <strong>${total.toLocaleString()}</strong>
        </div>`;
}

function updateMeanReversionDisplay() {
    const container = document.getElementById('meanReversionPanel');
    if (!container) return;
    const mr = UI.meanReversion;
    if (!mr || mr.totalTicks === 0) {
        container.innerHTML = '<div class="mr-waiting">⏳ Esperando ticks...</div>';
        return;
    }
    const diff = mr.evenCount - mr.oddCount;
    const absDiff = Math.abs(diff);
    const threshold = mr.resetThreshold || 5;
    const toReset = threshold - absDiff;
    const dangerPct = Math.min((absDiff / threshold) * 100, 100);
    const laggingLabel = diff > 0 ? 'Impar' : diff < 0 ? 'Par' : null;

    let signalHtml = '';
    if (absDiff === 0) signalHtml = `<div class="mr-signal mr-equal">⚖️ <strong>Igualados</strong></div>`;
    else if (absDiff === 1) signalHtml = `<div class="mr-signal mr-alert">🎯 <strong>SEÑAL: operar ${laggingLabel}</strong><span class="mr-signal-sub"> falta 1</span></div>`;
    else signalHtml = `<div class="mr-signal mr-watch">👀 Faltan <strong>${absDiff}</strong> para señal</div>`;

    container.innerHTML = `
        <div class="mr-counts">
            <div class="mr-count-item ${diff <= 0 ? 'mr-leading' : ''}">
                <span class="mr-count-label">Par</span>
                <span class="mr-count-num">${mr.evenCount}</span>
            </div>
            <div class="mr-count-sep">vs</div>
            <div class="mr-count-item ${diff >= 0 ? 'mr-leading' : ''}">
                <span class="mr-count-label">Impar</span>
                <span class="mr-count-num">${mr.oddCount}</span>
            </div>
        </div>
        <div class="mr-diff-row">
            <span>Diferencia: <strong>${absDiff}</strong></span>
            <span style="color:#888;font-size:11px;">Reset en: <strong style="color:${toReset <= 1 ? '#e74c3c' : '#f39c12'}">${toReset}</strong> más</span>
        </div>
        <div class="mr-bar-wrap">
            <div class="mr-bar-fill" style="width:${dangerPct}%;background:${dangerPct >= 80 ? '#e74c3c' : dangerPct >= 50 ? '#f39c12' : '#4caf50'}"></div>
        </div>
        <div class="mr-bar-labels"><span>0</span><span>Reset (${threshold})</span></div>
        ${signalHtml}
        <div class="mr-threshold-row">
            <label style="font-size:11px;color:#888;">Umbral:</label>
            <input type="number" value="${threshold}" min="2" max="50"
                style="width:50px;padding:3px 6px;border-radius:4px;border:1px solid #444;background:#2a2a2a;color:#fff;font-size:12px;"
                onchange="fetch('/api/mean-reversion/threshold',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({threshold:Math.max(2,parseInt(this.value)||5)})})">
            <button onclick="fetch('/api/mean-reversion/reset',{method:'POST'})"
                style="padding:3px 8px;background:#555;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:11px;">🔄</button>
        </div>`;
}

function updateGlobalLog() {
    const logEl = document.getElementById('globalBotLog');
    if (!logEl) return;
    const lines = UI.log.map(e => `[${e.time}] ${e.msg}`).join('\n');
    if (logEl.value !== lines) {
        logEl.value = lines;
        logEl.scrollTop = 0;
    }
}

function updateDigitLimitStatus() {
    const el = document.getElementById('digitLimitStatus');
    if (!el) return;
    const dl = UI.digitLimit;
    if (dl.enabled) {
        const remaining = dl.limit - dl.currentCount;
        const pct = (dl.currentCount / dl.limit) * 100;
        let color = pct > 90 ? '#e74c3c' : pct > 75 ? '#f39c12' : '#4CAF50';
        el.innerHTML = `<span style="color:${color};font-weight:600;">✅ ${dl.currentCount}/${dl.limit} dígitos (${remaining} restantes)</span>`;
    } else {
        el.innerHTML = '⏸️ Límite desactivado';
        el.style.color = '#888';
    }

    // Sincronizar checkboxes sin disparar eventos
    const cb = document.getElementById('enableDigitLimit');
    const inp = document.getElementById('digitLimitInput');
    if (cb && cb.checked !== dl.enabled) cb.checked = dl.enabled;
    if (inp && dl.limit) inp.value = dl.limit;
}

function updateSlTpStatus() {
    const el = document.getElementById('slTpStatus');
    if (!el) return;
    const sl = UI.slTp;
    const parts = [];
    if (sl.stopLossEnabled && sl.stopLossAmount > 0) parts.push(`🔴 SL: -$${parseFloat(sl.stopLossAmount).toFixed(2)}`);
    if (sl.takeProfitEnabled && sl.takeProfitAmount > 0) parts.push(`🟢 TP: +$${parseFloat(sl.takeProfitAmount).toFixed(2)}`);
    el.textContent = parts.length > 0 ? `✅ Activo — ${parts.join(' | ')}` : '⏸️ Protección desactivada';
    el.style.color = parts.length > 0 ? '#4caf50' : '#888';

    // Sincronizar controles
    const slCb = document.getElementById('enableStopLoss');
    const tpCb = document.getElementById('enableTakeProfit');
    if (slCb && slCb.checked !== sl.stopLossEnabled) slCb.checked = sl.stopLossEnabled;
    if (tpCb && tpCb.checked !== sl.takeProfitEnabled) tpCb.checked = sl.takeProfitEnabled;
}

// ==========================================
// CONTRATOS Y BOTS
// ==========================================

function updateContractsList() {
    const container = document.getElementById('contractsList');
    if (!container) return;

    if (UI.contracts.length === 0) {
        container.innerHTML = `
            <div class="no-contracts">
                <div class="empty-state">
                    <div style="font-size:64px;margin-bottom:20px;">🤖</div>
                    <h3>No hay contratos automatizados</h3>
                    <p>Crea tu primer contrato automatizado con patrón personalizado</p>
                    <button class="btn btn-primary" onclick="openContractModal()">➕ Crear Primer Contrato</button>
                </div>
            </div>`;
        updateGlobalBotButtons();
        updateGlobalStats();
        return;
    }

    container.innerHTML = UI.contracts.map(contract => {
        const statusClass = contract.status === 'active' ? 'active' : contract.status === 'waiting' ? 'waiting' : 'inactive';
        const statusText = contract.status === 'active' ? '🟢 Activo' : contract.status === 'waiting' ? '🟡 Esperando' : '⚪ Inactivo';
        const depBadge = contract.isDependentBot
            ? `<span class="dependent-badge" title="Depende de: ${contract.dependsOn}">🔗 Depende de: <strong>${contract.dependsOn}</strong></span>`
            : '';
        const s = contract.stats || {};
        const ms_stake = contract.martingaleCurrentStake;

        return `
        <div class="contract-card ${statusClass}${contract.isDependentBot ? ' dependent-bot-card' : ''}" data-contract-id="${contract.id}">
            <div class="contract-header">
                <div class="contract-title">
                    <h4>${contract.isDependentBot ? '🔗 ' : '🤖 '}${contract.name}</h4>
                    <span class="contract-status ${statusClass}">${statusText}</span>
                    ${depBadge}
                </div>
                <div class="contract-actions">
                    <button class="btn btn-icon btn-success" onclick="toggleContract('${contract.id}')" title="${contract.status === 'active' ? 'Detener' : 'Iniciar'}">
                        ${contract.status === 'active' ? '⏸️' : '▶️'}
                    </button>
                    <button class="btn btn-icon btn-secondary" onclick="openContractModal('${contract.id}')" title="Editar">✏️</button>
                    <button class="btn btn-icon btn-danger" onclick="deleteContract('${contract.id}')" title="Eliminar">🗑️</button>
                </div>
            </div>
            <div class="contract-body">
                <div class="contract-config">
                    <h5>⚙️ Configuración</h5>
                    <div class="config-item"><span class="config-label">Símbolo:</span><span class="config-value">${contract.config.symbol}</span></div>
                    <div class="config-item"><span class="config-label">Contrato:</span><span class="config-value">${getContractTypeName(contract.config.contractType)}</span></div>
                    ${contract.config.prediction !== null ? `<div class="config-item"><span class="config-label">Predicción:</span><span class="config-value">${contract.config.prediction}</span></div>` : ''}
                    <div class="config-item"><span class="config-label">Ticks:</span><span class="config-value">${contract.config.duration}</span></div>
                    <div class="config-item"><span class="config-label">Inversión:</span><span class="config-value">
                        $${parseFloat(contract.config.stake).toFixed(2)}
                        ${contract.config.martingale?.enabled ? `<span style="color:#f39c12;font-size:10px;margin-left:4px;">📈 MG</span>` : ''}
                        ${(contract.config.martingale?.enabled && ms_stake) ? `<span style="color:#e74c3c;font-size:11px;margin-left:4px;">(→$${parseFloat(ms_stake).toFixed(2)})</span>` : ''}
                    </span></div>
                </div>
                <div class="contract-pattern">
                    <h5>🎯 Patrón</h5>
                    <div class="pattern-preview">
                        ${(contract.pattern || []).map((v, i) => {
                            let dv = '', cls = '';
                            if (v.type === 'repeat') { dv = `🔁${v.value}x`; cls = 'repeat'; }
                            else if (v.type === 'any') { dv = '*'; cls = 'any'; }
                            else if (v.type === 'even') { dv = '📗'; cls = 'even'; }
                            else if (v.type === 'odd') { dv = '📙'; cls = 'odd'; }
                            else if (v.type === 'hotdigit') { dv = '🔥'; cls = 'hotdigit'; }
                            else if (v.type === 'colddigit') { dv = '🧊'; cls = 'colddigit'; }
                            else if (v.type === 'hoteo') { dv = '🔥±'; cls = 'hoteo'; }
                            else if (v.type === 'coldeo') { dv = '🧊±'; cls = 'coldeo'; }
                            else { dv = v.value; }
                            return `<div class="pattern-item-mini ${cls}">${dv}</div>
                                    ${i < contract.pattern.length - 1 ? '<span class="pattern-arrow-mini">→</span>' : ''}`;
                        }).join('')}
                    </div>
                </div>
            </div>
            <div class="contract-stats">
                <div class="contract-stat"><div class="contract-stat-label">Coincidencias</div><div class="contract-stat-value">${s.matches || 0}</div></div>
                <div class="contract-stat"><div class="contract-stat-label">Operaciones</div><div class="contract-stat-value">${s.trades || 0}</div></div>
                <div class="contract-stat"><div class="contract-stat-label">Ganadas</div><div class="contract-stat-value success">${s.wins || 0}</div></div>
                <div class="contract-stat"><div class="contract-stat-label">Perdidas</div><div class="contract-stat-value danger">${s.losses || 0}</div></div>
                <div class="contract-stat"><div class="contract-stat-label">Balance</div>
                    <div class="contract-stat-value ${(s.balance || 0) >= 0 ? 'success' : 'danger'}">
                        ${(s.balance || 0) >= 0 ? '+' : ''}$${(s.balance || 0).toFixed(2)}
                    </div>
                </div>
            </div>
            <div class="contract-stats contract-stats-extended">
                <div class="contract-stat"><div class="contract-stat-label">📈 Máx. Ganancia</div>
                    <div class="contract-stat-value success">${(s.maxWin || 0) > 0 ? '+$' + s.maxWin.toFixed(2) : '$0.00'}</div></div>
                <div class="contract-stat"><div class="contract-stat-label">📉 Máx. Pérdida</div>
                    <div class="contract-stat-value danger">${(s.maxLoss || 0) < 0 ? '$' + s.maxLoss.toFixed(2) : '$0.00'}</div></div>
                <div class="contract-stat"><div class="contract-stat-label">📊 Promedio/Op.</div>
                    ${(() => { const avg = (s.trades || 0) > 0 ? (s.totalProfit || 0) / s.trades : 0; const cls = avg >= 0 ? 'success' : 'danger'; return `<div class="contract-stat-value ${cls}">${s.trades > 0 ? (avg >= 0 ? '+' : '') + '$' + avg.toFixed(3) : '$0.00'}</div>`; })()}
                </div>
            </div>
        </div>`;
    }).join('');

    updateGlobalBotButtons();
    updateGlobalStats();
}

function updateGlobalStats() {
    const gs = UI.globalStats;
    const totalTradesEl = document.getElementById('totalBotTrades');
    if (totalTradesEl) totalTradesEl.textContent = gs.totalTrades || 0;

    const balEl = document.getElementById('globalBotBalance');
    if (balEl) {
        const b = gs.totalBalance || 0;
        balEl.textContent = `${b >= 0 ? '+' : ''}$${b.toFixed(2)}`;
        balEl.style.color = b >= 0 ? '#4caf50' : '#f44336';
    }

    const mw = document.getElementById('globalMaxWin');
    if (mw) mw.textContent = (gs.globalMaxWin || 0) > 0 ? `+$${gs.globalMaxWin.toFixed(2)}` : '$0.00';
    const ml = document.getElementById('globalMaxLoss');
    if (ml) ml.textContent = (gs.globalMaxLoss || 0) < 0 ? `$${gs.globalMaxLoss.toFixed(2)}` : '$0.00';
    const ag = document.getElementById('globalAvgProfit');
    if (ag) {
        const avg = (gs.totalTrades || 0) > 0 ? (gs.globalTotalProfit || 0) / gs.totalTrades : 0;
        ag.textContent = gs.totalTrades > 0 ? `${avg >= 0 ? '+' : ''}$${avg.toFixed(3)}` : '$0.00';
        ag.style.color = avg >= 0 ? '#4caf50' : '#f44336';
    }

    const active = UI.contracts.filter(c => c.status === 'active').length;
    const activeEl = document.getElementById('activeContracts');
    if (activeEl) activeEl.textContent = active;
    const statusEl = document.getElementById('globalBotStatus');
    if (statusEl) {
        if (active > 0) {
            statusEl.textContent = `🟢 ${active} Activo${active > 1 ? 's' : ''}`;
            statusEl.classList.remove('inactive'); statusEl.classList.add('active');
        } else {
            statusEl.textContent = '⏸️ Todos Detenidos';
            statusEl.classList.remove('active'); statusEl.classList.add('inactive');
        }
    }
}

function updateGlobalBotButtons() {
    const hasC = UI.contracts.length > 0;
    const hasT = UI.apiTokenSet;
    const startAll = document.getElementById('startAllBotsBtn');
    const stopAll = document.getElementById('stopAllBotsBtn');
    if (startAll) startAll.disabled = !hasC || !hasT;
    if (stopAll) stopAll.disabled = !hasC;
}

// ==========================================
// ACCIONES DE BOTS
// ==========================================

async function toggleContract(cid) {
    const c = UI.contracts.find(c => c.id === cid);
    if (!c) return;
    if (c.status === 'active' || c.status === 'waiting') {
        await API.post(`/api/bots/${cid}/stop`);
    } else {
        const res = await API.post(`/api/bots/${cid}/start`);
        if (!res.ok) showNotification(res.error || 'Error al iniciar bot', 'danger');
    }
}

async function startAllBots() {
    const res = await API.post('/api/bots/start-all');
    if (!res.ok) showNotification(res.error || 'Error', 'danger');
    else showNotification('▶️ Todos los bots iniciados', 'success');
}

async function stopAllBots() {
    await API.post('/api/bots/stop-all');
    showNotification('⏹️ Todos los bots detenidos', 'info');
}

async function resetAllStats() {
    if (!confirm('⚠️ ¿Resetear todas las estadísticas?\n\nEsto borrará balance, operaciones e historial.')) return;
    await API.post('/api/stats/reset');
    showNotification('✅ Estadísticas reseteadas', 'success');
}

async function deleteContract(cid) {
    const c = UI.contracts.find(c => c.id === cid);
    if (!c) return;
    showCustomConfirm(
        `¿Eliminar el contrato "${c.name}"?`,
        async () => {
            await API.del(`/api/contracts/${cid}`);
            showNotification(`🗑️ Contrato eliminado`, 'success');
        },
        () => {}
    );
}

// ==========================================
// SL/TP Y DIGIT LIMIT
// ==========================================

function syncSlTp() {
    const data = {
        stopLossEnabled: document.getElementById('enableStopLoss').checked,
        stopLossAmount: parseFloat(document.getElementById('stopLossAmount').value) || 0,
        takeProfitEnabled: document.getElementById('enableTakeProfit').checked,
        takeProfitAmount: parseFloat(document.getElementById('takeProfitAmount').value) || 0,
    };
    API.post('/api/sltp', data);
}

function syncDigitLimit() {
    const enabled = document.getElementById('enableDigitLimit').checked;
    const limit = parseInt(document.getElementById('digitLimitInput').value) || 100;
    API.post('/api/digit-limit', { enabled, limit, currentCount: 0, lastCountedEpoch: null });
    document.getElementById('digitLimitInput').disabled = !enabled;
}

// ==========================================
// MODAL DE CONTRATO
// ==========================================

function openContractModal(contractId = null) {
    const modal = document.getElementById('contractModal');
    const title = document.getElementById('contractModalTitle');

    populateDependsOnDropdown(contractId);

    if (contractId) {
        const c = UI.contracts.find(c => c.id === contractId);
        if (!c) return;
        title.textContent = '✏️ Editar Contrato';
        UI.currentEditingId = contractId;

        document.getElementById('contractName').value = c.name;
        document.getElementById('modalSymbol').value = c.config.symbol;
        document.getElementById('modalContractType').value = c.config.contractType;
        document.getElementById('modalPrediction').value = c.config.prediction && !['hotdigit', 'colddigit', 'lastpattern'].includes(c.config.prediction) ? c.config.prediction : '0';
        document.getElementById('predictionMode').value = c.config.predictionMode || 'specific';
        document.getElementById('modalDuration').value = c.config.duration;
        document.getElementById('modalStake').value = c.config.stake;
        document.getElementById('maxConsecutiveRepeat').value = c.config.maxConsecutiveRepeat || 0;

        const mg = c.config.martingale || {};
        document.getElementById('martingaleEnabled').checked = mg.enabled || false;
        document.getElementById('martingalePayout').value = mg.payout ?? 0.95;
        document.getElementById('martingaleProfit').value = mg.desiredProfit || 0;
        document.getElementById('martingaleDepth').value = mg.depth || 5;
        toggleMartingaleUI(mg.enabled || false);

        const isDep = c.isDependentBot || false;
        document.getElementById('isDependentBot').checked = isDep;
        if (isDep) {
            document.getElementById('dependsOnBot').value = c.dependsOn || '';
            document.getElementById('triggerOnResult').value = c.triggerOn || 'win';
        }
        toggleDependentBotUI(isDep);

        UI.modalPattern = [...(c.pattern || [])];
    } else {
        title.textContent = '➕ Nuevo Contrato';
        UI.currentEditingId = null;

        document.getElementById('contractName').value = '';
        document.getElementById('modalSymbol').value = 'R_100';
        document.getElementById('modalContractType').value = 'DIGITDIFF';
        document.getElementById('modalPrediction').value = '0';
        document.getElementById('predictionMode').value = 'specific';
        document.getElementById('modalDuration').value = '5';
        document.getElementById('modalStake').value = '1.00';
        document.getElementById('maxConsecutiveRepeat').value = '0';
        document.getElementById('martingaleEnabled').checked = false;
        document.getElementById('martingalePayout').value = '0.95';
        document.getElementById('martingaleProfit').value = '0';
        document.getElementById('martingaleDepth').value = '5';
        toggleMartingaleUI(false);
        document.getElementById('isDependentBot').checked = false;
        toggleDependentBotUI(false);
        UI.modalPattern = [];
    }

    handleModalContractTypeChange();
    handlePredictionModeChange();
    updateModalPatternDisplay();
    modal.style.display = 'block';
}

function closeContractModal() {
    document.getElementById('contractModal').style.display = 'none';
    UI.currentEditingId = null;
    UI.modalPattern = [];
}

function populateDependsOnDropdown(excludeId = null) {
    const select = document.getElementById('dependsOnBot');
    const available = UI.contracts.filter(c => c.id !== excludeId);
    if (available.length === 0) {
        select.innerHTML = '<option value="">⚠️ No hay bots disponibles</option>';
    } else {
        select.innerHTML = available.map(c =>
            `<option value="${c.name}">${c.isDependentBot ? '🔗' : '🤖'} ${c.name}</option>`
        ).join('');
    }
}

async function saveContract() {
    const name = document.getElementById('contractName').value.trim();
    const symbol = document.getElementById('modalSymbol').value;
    const contractType = document.getElementById('modalContractType').value;
    const prediction = document.getElementById('modalPrediction').value;
    const duration = parseInt(document.getElementById('modalDuration').value);
    const stake = parseFloat(document.getElementById('modalStake').value);
    const isDependentBot = document.getElementById('isDependentBot').checked;
    const dependsOn = isDependentBot ? document.getElementById('dependsOnBot').value : null;
    const triggerOn = isDependentBot ? document.getElementById('triggerOnResult').value : null;

    if (!name) { showNotification('Ingresa un nombre', 'warning'); return; }
    if (UI.contracts.find(c => c.name === name && c.id !== UI.currentEditingId)) {
        showNotification('Ya existe un bot con ese nombre', 'warning'); return;
    }
    if (!isDependentBot && UI.modalPattern.length === 0) {
        showNotification('Crea al menos un patrón', 'warning'); return;
    }
    if (!stake || stake < 0.35) { showNotification('Inversión mínima $0.35', 'warning'); return; }

    const predictionMode = document.getElementById('predictionMode').value;
    const isEvenOddType = ['DIGITEVEN', 'DIGITODD', 'HOTEO', 'COLDEO', 'MEANREV'].includes(contractType);
    let finalPrediction = null;
    if (!isEvenOddType) {
        if (predictionMode === 'hotdigit') finalPrediction = 'hotdigit';
        else if (predictionMode === 'colddigit') finalPrediction = 'colddigit';
        else if (predictionMode === 'lastpattern') finalPrediction = 'lastpattern';
        else finalPrediction = prediction;
    }

    const payload = {
        name,
        isDependentBot,
        dependsOn,
        triggerOn,
        pattern: isDependentBot ? [] : [...UI.modalPattern],
        config: {
            symbol, contractType,
            prediction: finalPrediction,
            predictionMode,
            duration, stake,
            maxConsecutiveRepeat: parseInt(document.getElementById('maxConsecutiveRepeat').value) || 0,
            martingale: {
                enabled: document.getElementById('martingaleEnabled').checked,
                payout: parseFloat(document.getElementById('martingalePayout').value) || 0.95,
                desiredProfit: parseFloat(document.getElementById('martingaleProfit').value) || 0,
                depth: parseInt(document.getElementById('martingaleDepth').value) || 5,
            }
        }
    };

    if (UI.currentEditingId) payload.id = UI.currentEditingId;

    const res = await API.post('/api/contracts', payload);
    if (res.ok) {
        showNotification('✅ Contrato guardado', 'success');
        closeContractModal();
    } else {
        showNotification(res.error || 'Error al guardar', 'danger');
    }
}

// ==========================================
// CONSTRUCTOR DE PATRÓN
// ==========================================

function showVariableSelector() {
    document.getElementById('modalVariableSelector').style.display = 'block';
    document.getElementById('modalNumberSelector').style.display = 'none';
}
function hideVariableSelector() {
    document.getElementById('modalVariableSelector').style.display = 'none';
}
function hideNumberSelector() {
    document.getElementById('modalNumberSelector').style.display = 'none';
    const rs = document.getElementById('modalRepeatSelector');
    if (rs) rs.style.display = 'none';
}
function handleVariableTypeSelection(type) {
    if (type === 'specific') {
        hideVariableSelector();
        document.getElementById('modalNumberSelector').style.display = 'block';
    } else if (type === 'repeat') {
        hideVariableSelector();
        const rs = document.getElementById('modalRepeatSelector');
        if (rs) rs.style.display = 'block';
    } else {
        addPatternVariable(type, null);
        hideVariableSelector();
    }
}
function addPatternVariable(type, value) {
    if (UI.modalPattern.length >= 20) { showNotification('Máximo 20 variables', 'warning'); return; }
    UI.modalPattern.push({ type, value });
    updateModalPatternDisplay();
}
function removePatternVariable(index) {
    UI.modalPattern.splice(index, 1);
    updateModalPatternDisplay();
}
function updateModalPatternDisplay() {
    const container = document.getElementById('modalPatternDisplay');
    if (UI.modalPattern.length === 0) {
        container.innerHTML = `<div class="pattern-empty"><p>🎨 Agrega variables para crear tu patrón</p><p class="hint">Ejemplo: [5] → [*] → [*] → [5]</p></div>`;
        return;
    }
    container.innerHTML = `<div class="pattern-items">${UI.modalPattern.map((v, i) => {
        let dv = '', cls = '';
        if (v.type === 'any') { dv = '*'; cls = 'any'; }
        else if (v.type === 'even') { dv = '📗 Par'; cls = 'even'; }
        else if (v.type === 'odd') { dv = '📙 Impar'; cls = 'odd'; }
        else if (v.type === 'hotdigit') { dv = '🔥 Hot'; cls = 'hotdigit'; }
        else if (v.type === 'colddigit') { dv = '🧊 Cold'; cls = 'colddigit'; }
        else if (v.type === 'hoteo') { dv = '🔥 Par/Imp'; cls = 'hoteo'; }
        else if (v.type === 'coldeo') { dv = '🧊 Par/Imp'; cls = 'coldeo'; }
        else { dv = v.value; }
        return `<div class="pattern-item">
            <div class="pattern-box ${cls}">${dv}</div>
            <button class="pattern-remove" onclick="removePatternVariable(${i})">✕</button>
        </div>${i < UI.modalPattern.length - 1 ? '<div class="pattern-arrow">→</div>' : ''}`;
    }).join('')}</div>`;
}

function handleModalContractTypeChange() {
    const ct = document.getElementById('modalContractType').value;
    const pg = document.getElementById('modalPredictionGroup');
    if (['DIGITEVEN', 'DIGITODD', 'HOTEO', 'COLDEO', 'MEANREV'].includes(ct)) {
        pg.style.display = 'none';
    } else {
        pg.style.display = 'block';
        handlePredictionModeChange();
    }
}

function handlePredictionModeChange() {
    const mode = document.getElementById('predictionMode').value;
    const sg = document.getElementById('specificPredictionGroup');
    const hint = document.getElementById('predictionModeHint');
    if (['hotdigit', 'colddigit', 'lastpattern'].includes(mode)) {
        if (sg) sg.style.display = 'none';
        if (hint) {
            hint.style.display = 'block';
            hint.textContent = mode === 'hotdigit' ? '🔥 Usará el dígito más frecuente'
                : mode === 'colddigit' ? '🧊 Usará el dígito menos frecuente'
                : '🎯 Usará el último dígito del patrón';
        }
    } else {
        if (sg) sg.style.display = 'block';
        if (hint) hint.style.display = 'none';
    }
}

function toggleDependentBotUI(isDep) {
    document.getElementById('dependentBotConfig').style.display = isDep ? 'block' : 'none';
    document.getElementById('patternBuilderSection').style.display = isDep ? 'none' : 'block';
}

function toggleMartingaleUI(enabled) {
    const cfg = document.getElementById('martingaleConfig');
    if (cfg) cfg.style.display = enabled ? 'block' : 'none';
}

// ==========================================
// TELEGRAM
// ==========================================

async function saveTelegramSettings() {
    const token = document.getElementById('telegramBotToken').value.trim();
    const chatId = document.getElementById('telegramChatId').value.trim();
    const enabled = document.getElementById('telegramEnabled').checked;
    await API.post('/api/telegram', { botToken: token || null, chatId: chatId || null, enabled });
    showNotification(enabled ? '✅ Telegram activado' : '💾 Telegram guardado', enabled ? 'success' : 'info');
}

async function testTelegramConnection() {
    const token = document.getElementById('telegramBotToken').value.trim();
    const chatId = document.getElementById('telegramChatId').value.trim();
    if (!token || !chatId) { showNotification('Ingresa Bot Token y Chat ID', 'warning'); return; }
    const btn = document.getElementById('telegramTestBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Enviando...'; }
    try {
        const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: '🤖 <b>Deriv Trader</b>\n\n✅ Conexión exitosa!', parse_mode: 'HTML' })
        });
        const d = await r.json();
        if (d.ok) showNotification('✅ Mensaje enviado a Telegram', 'success');
        else showNotification(`❌ ${d.description}`, 'danger');
    } catch (e) {
        showNotification('❌ Error de red', 'danger');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '📤 Probar Conexión'; }
    }
}

// ==========================================
// UTILIDADES UI
// ==========================================

function switchView(view) {
    const tc = document.getElementById('ticksContainer');
    const dc = document.getElementById('digitsContainer');
    const tb = document.getElementById('viewTicksBtn');
    const db = document.getElementById('viewDigitsBtn');
    if (view === 'ticks') {
        tc.style.display = 'block'; dc.style.display = 'none';
        tb.classList.add('active'); db.classList.remove('active');
    } else {
        tc.style.display = 'none'; dc.style.display = 'block';
        tb.classList.remove('active'); db.classList.add('active');
    }
}

function getContractTypeName(type) {
    const names = {
        'DIGITDIFF': 'Differs', 'DIGITMATCH': 'Matches', 'DIGITEVEN': 'Even',
        'DIGITODD': 'Odd', 'DIGITOVER': 'Over', 'DIGITUNDER': 'Under',
        'HOTEO': 'Hot Par/Imp', 'COLDEO': 'Cold Par/Imp', 'MEANREV': 'Mean Reversion'
    };
    return names[type] || type;
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    if (!container) return;
    const n = document.createElement('div');
    n.className = `notification ${type}`;
    const icons = { success: '✅', warning: '⚠️', danger: '❌', error: '❌', info: 'ℹ️' };
    n.innerHTML = `
        <div class="notification-icon">${icons[type] || 'ℹ️'}</div>
        <div class="notification-content"><div class="notification-message">${message}</div></div>
        <button class="notification-close" onclick="closeNotification(this)">×</button>
        <div class="notification-progress"></div>`;
    container.appendChild(n);
    setTimeout(() => closeNotification(n), 5000);
}

function closeNotification(el) {
    const n = el.classList ? el : el.parentElement;
    n.classList.add('hiding');
    setTimeout(() => { if (n.parentElement) n.parentElement.removeChild(n); }, 300);
}

function showCustomConfirm(message, onConfirm, onCancel) {
    const overlay = document.createElement('div');
    overlay.className = 'custom-confirm-overlay';
    overlay.innerHTML = `
        <div class="custom-confirm-box">
            <div class="custom-confirm-icon">⚠️</div>
            <div class="custom-confirm-title">Confirmar Acción</div>
            <div class="custom-confirm-message">${message}</div>
            <div class="custom-confirm-buttons">
                <button class="custom-confirm-btn custom-confirm-btn-cancel" id="confirmCancel">Cancelar</button>
                <button class="custom-confirm-btn custom-confirm-btn-confirm" id="confirmOk">Confirmar</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    document.getElementById('confirmCancel').onclick = () => { document.body.removeChild(overlay); if (onCancel) onCancel(); };
    document.getElementById('confirmOk').onclick = () => { document.body.removeChild(overlay); if (onConfirm) onConfirm(); };
    overlay.onclick = (e) => { if (e.target === overlay) { document.body.removeChild(overlay); if (onCancel) onCancel(); } };
}

function showModal() {
    document.getElementById('resultModal').style.display = 'block';
}
function closeModal() {
    document.getElementById('resultModal').style.display = 'none';
}
window.onclick = function (e) {
    const rm = document.getElementById('resultModal');
    const cm = document.getElementById('contractModal');
    if (e.target === rm) rm.style.display = 'none';
    if (e.target === cm) cm.style.display = 'none';
};

console.log('📊 Deriv Trader UI cargada — Los bots corren en el servidor');

// ==========================================
// UTILIDADES
// ==========================================

function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// ==========================================
// TRADING MANUAL - WebSocket propio del navegador
// Independiente del servidor, igual que antes
// ==========================================

const MANUAL = {
    ws: null,
    isConnected: false,
    apiToken: null,
    symbol: 'R_100',
    proposalId: null,
    currentProposal: null,
    trades: [],
};

function initManualTrading() {
    document.getElementById('contractType').addEventListener('change', handleContractTypeChange);
    document.getElementById('getProposalBtn').addEventListener('click', getProposal);
    document.getElementById('buyContractBtn').addEventListener('click', buyContract);

    ['prediction', 'duration', 'stake'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', debounce(updateProposal, 500));
    });

    tryAutoConnectManual();
}

function tryAutoConnectManual() {
    const token = localStorage.getItem('derivApiToken');
    if (token) {
        MANUAL.apiToken = token;
        connectManual();
    }
}

function connectManual() {
    if (MANUAL.ws) {
        MANUAL.ws.close();
        MANUAL.ws = null;
    }
    MANUAL.symbol = document.getElementById('symbolSelect').value || UI.symbol || 'R_100';
    MANUAL.apiToken = document.getElementById('apiToken').value.trim() || localStorage.getItem('derivApiToken');

    if (!MANUAL.apiToken) return;

    const WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=1089`;
    MANUAL.ws = new WebSocket(WS_URL);

    MANUAL.ws.onopen = () => {
        MANUAL.ws.send(JSON.stringify({ authorize: MANUAL.apiToken }));
    };

    MANUAL.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const mt = data.msg_type;
        if (mt === 'authorize') {
            if (data.authorize) {
                MANUAL.isConnected = true;
                document.getElementById('getProposalBtn').disabled = false;
                updateManualStatus('🟢 Listo para operar', '#4caf50');
            } else {
                updateManualStatus('🔴 Token inválido', '#f44336');
            }
        } else if (mt === 'proposal') {
            handleProposalResponse(data);
        } else if (mt === 'buy') {
            handleBuyResponse(data);
        } else if (mt === 'proposal_open_contract') {
            handleContractUpdate(data);
        } else if (data.error) {
            handleManualError(data.error);
        }
    };

    MANUAL.ws.onerror = () => updateManualStatus('🔴 Error de conexión', '#f44336');
    MANUAL.ws.onclose = () => {
        MANUAL.isConnected = false;
        document.getElementById('getProposalBtn').disabled = true;
        document.getElementById('buyContractBtn').disabled = true;
        if (MANUAL.apiToken) {
            setTimeout(connectManual, 3000);
        }
    };

    updateManualStatus('🟡 Conectando...', '#f39c12');
}

function updateManualStatus(text, color) {
    const el = document.getElementById('manualTradingStatus');
    if (el) { el.textContent = text; el.style.color = color; }
}

function handleContractTypeChange() {
    const ct = document.getElementById('contractType').value;
    const pg = document.getElementById('predictionGroup');
    const dg = document.getElementById('durationGroup');
    const sg = document.getElementById('stakeGroup');

    if (!ct) {
        if (pg) pg.style.display = 'none';
        if (dg) dg.style.display = 'none';
        if (sg) sg.style.display = 'none';
        return;
    }
    if (dg) dg.style.display = 'block';
    if (sg) sg.style.display = 'block';
    if (pg) {
        if (['DIGITEVEN', 'DIGITODD'].includes(ct)) pg.style.display = 'none';
        else pg.style.display = 'block';
    }
    clearProposal();
}

function getProposal() {
    if (!MANUAL.isConnected || !MANUAL.apiToken) {
        showNotification('Configura y guarda tu API Token primero', 'warning');
        return;
    }
    const ct = document.getElementById('contractType').value;
    const duration = parseInt(document.getElementById('duration').value);
    const stake = parseFloat(document.getElementById('stake').value);
    if (!ct || !duration || !stake) { showNotification('Completa todos los campos', 'warning'); return; }

    if (MANUAL.proposalId) {
        MANUAL.ws.send(JSON.stringify({ forget: MANUAL.proposalId }));
        MANUAL.proposalId = null;
    }

    const req = {
        proposal: 1, subscribe: 1,
        amount: stake, basis: 'stake',
        contract_type: ct, currency: 'USD',
        duration: duration, duration_unit: 't',
        symbol: document.getElementById('symbolSelect').value || UI.symbol
    };
    if (['DIGITDIFF', 'DIGITMATCH', 'DIGITOVER', 'DIGITUNDER'].includes(ct)) {
        req.barrier = document.getElementById('prediction').value;
    }
    MANUAL.ws.send(JSON.stringify(req));
}

function handleProposalResponse(data) {
    if (data.error) { handleManualError(data.error); return; }
    if (!data.proposal) return;

    if (data.subscription?.id) MANUAL.proposalId = data.subscription.id;
    MANUAL.currentProposal = data.proposal;

    const payout = parseFloat(data.proposal.payout).toFixed(2);
    const profit = (parseFloat(data.proposal.payout) - parseFloat(data.proposal.ask_price)).toFixed(2);
    const roi = (((parseFloat(data.proposal.payout) - parseFloat(data.proposal.ask_price)) / parseFloat(data.proposal.ask_price)) * 100).toFixed(2);

    const pi = document.getElementById('proposalInfo');
    if (pi) pi.style.display = 'block';
    const pp = document.getElementById('potentialPayout');
    if (pp) pp.textContent = `$${payout}`;
    const ppr = document.getElementById('potentialProfit');
    if (ppr) ppr.textContent = `$${profit}`;
    const rp = document.getElementById('returnPercentage');
    if (rp) rp.textContent = `${roi}%`;
    document.getElementById('buyContractBtn').disabled = false;
}

function updateProposal() {
    if (!document.getElementById('getProposalBtn').disabled) getProposal();
}

function clearProposal() {
    const pi = document.getElementById('proposalInfo');
    if (pi) pi.style.display = 'none';
    document.getElementById('buyContractBtn').disabled = true;
    if (MANUAL.proposalId && MANUAL.ws) {
        MANUAL.ws.send(JSON.stringify({ forget: MANUAL.proposalId }));
        MANUAL.proposalId = null;
    }
    MANUAL.currentProposal = null;
}

function buyContract() {
    if (!MANUAL.currentProposal?.id) { showNotification('Primero obtén una cotización', 'warning'); return; }
    const stake = parseFloat(document.getElementById('stake').value);
    MANUAL.ws.send(JSON.stringify({ buy: MANUAL.currentProposal.id, price: stake }));
    document.getElementById('buyContractBtn').disabled = true;
    document.getElementById('buyContractBtn').textContent = '⏳ Procesando...';
}

function handleBuyResponse(data) {
    if (data.error) {
        handleManualError(data.error);
        document.getElementById('buyContractBtn').disabled = false;
        document.getElementById('buyContractBtn').textContent = '✅ Comprar Contrato';
        return;
    }
    if (!data.buy) return;

    MANUAL.ws.send(JSON.stringify({
        proposal_open_contract: 1,
        contract_id: data.buy.contract_id,
        subscribe: 1
    }));

    addToTradeHistory({
        contractId: data.buy.contract_id,
        type: document.getElementById('contractType').value,
        stake: parseFloat(document.getElementById('stake').value),
        time: new Date(), status: 'open'
    });
    clearProposal();
    document.getElementById('buyContractBtn').textContent = '✅ Comprar Contrato';
    showNotification('✅ Contrato comprado exitosamente', 'success');
}

function handleContractUpdate(data) {
    if (!data.proposal_open_contract) return;
    const c = data.proposal_open_contract;
    if (c.is_sold || c.status === 'sold') showContractResult(c);
}

function showContractResult(contract) {
    const isWin = parseFloat(contract.profit) > 0;
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    if (!modalTitle || !modalBody) return;
    modalTitle.textContent = isWin ? '🎉 ¡Ganaste!' : '😔 Perdiste';
    modalTitle.style.color = isWin ? '#4caf50' : '#f44336';
    modalBody.innerHTML = `
        <div style="text-align:center;padding:20px;">
            <div style="font-size:48px;margin-bottom:20px;">${isWin ? '✅' : '❌'}</div>
            <div style="font-size:24px;font-weight:bold;margin-bottom:10px;color:${isWin ? '#4caf50' : '#f44336'}">
                ${isWin ? '+' : ''}$${parseFloat(contract.profit).toFixed(2)}
            </div>
            <div style="font-size:14px;color:#b0b0b0;margin-top:15px;">
                <p>Pago: $${parseFloat(contract.payout).toFixed(2)}</p>
                <p>Precio de Compra: $${parseFloat(contract.buy_price).toFixed(2)}</p>
                <p>Precio de Venta: $${parseFloat(contract.sell_price || contract.payout).toFixed(2)}</p>
            </div>
        </div>`;
    showModal();
    updateTradeInHistory(contract.contract_id, {
        status: isWin ? 'win' : 'loss',
        profit: parseFloat(contract.profit),
        payout: parseFloat(contract.payout)
    });
}

function handleManualError(error) {
    showNotification(error.message || 'Error desconocido', 'danger');
    console.error('Manual trading error:', error);
}

function addToTradeHistory(trade) {
    MANUAL.trades.unshift(trade);
    if (MANUAL.trades.length > 10) MANUAL.trades.pop();
    updateTradesHistoryDisplay();
}

function updateTradeInHistory(contractId, updates) {
    const trade = MANUAL.trades.find(t => t.contractId === contractId);
    if (trade) { Object.assign(trade, updates); updateTradesHistoryDisplay(); }
}

function updateTradesHistoryDisplay() {
    const container = document.getElementById('tradesHistoryList');
    if (!container) return;
    if (MANUAL.trades.length === 0) {
        container.innerHTML = '<p class="no-data">No hay operaciones aún</p>';
        return;
    }
    container.innerHTML = MANUAL.trades.map(trade => {
        const sc = trade.status === 'win' ? 'win' : trade.status === 'loss' ? 'loss' : '';
        const st = trade.status === 'win' ? '✅ Ganada' : trade.status === 'loss' ? '❌ Perdida' : '⏳ En curso';
        return `<div class="trade-item ${sc}">
            <div class="trade-header">
                <span>${getContractTypeName(trade.type)}</span>
                <span>${st}</span>
            </div>
            <div class="trade-details">
                <div>Inversión: $${trade.stake.toFixed(2)}</div>
                ${trade.profit !== undefined ? `<div>Ganancia: $${trade.profit.toFixed(2)}</div>` : ''}
                <div>Hora: ${trade.time.toLocaleTimeString()}</div>
            </div>
        </div>`;
    }).join('');
}
