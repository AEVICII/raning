#!/bin/bash
# ================================================
#  Deriv Trader - Inicio con Screen
#  El servidor sigue corriendo aunque cierres CMD
# ================================================

# Instalar screen si no está
if ! command -v screen &> /dev/null; then
    echo "Instalando screen..."
    sudo apt-get install -y screen 2>/dev/null || pip install --break-system-packages -q 2>/dev/null
fi

SESSION="deriv_trader"

# Si ya hay una sesión corriendo, mostrar opciones
if screen -list | grep -q "$SESSION"; then
    echo ""
    echo "================================================"
    echo "  ✅ El servidor ya está corriendo en segundo plano"
    echo "================================================"
    echo ""
    echo "  Opciones:"
    echo "  [1] Ver el servidor en vivo (Ctrl+A luego D para salir sin cerrar)"
    echo "  [2] Reiniciar el servidor"
    echo "  [3] Detener el servidor"
    echo "  [4] Solo abrir http://localhost:5000 y salir"
    echo ""
    read -p "  Elige una opción (1/2/3/4): " opt
    case $opt in
        1) screen -r $SESSION ;;
        2) screen -S $SESSION -X quit
           sleep 1
           pip install -r requirements.txt --quiet
           screen -dmS $SESSION python app.py
           echo "✅ Servidor reiniciado en segundo plano"
           echo "   Abre: http://localhost:5000" ;;
        3) screen -S $SESSION -X quit
           echo "⏹️  Servidor detenido" ;;
        4) echo "🌐 Abre: http://localhost:5000" ;;
    esac
else
    echo ""
    echo "================================================"
    echo "  🚀 Deriv Trader - Iniciando en segundo plano"
    echo "================================================"
    echo ""
    pip install -r requirements.txt --quiet
    screen -dmS $SESSION python app.py
    sleep 1
    if screen -list | grep -q "$SESSION"; then
        echo "  ✅ Servidor iniciado correctamente"
        echo ""
        echo "  🌐 Abre en tu navegador: http://localhost:5000"
        echo ""
        echo "  📋 Comandos útiles:"
        echo "     Ver logs en vivo:    screen -r $SESSION"
        echo "     Salir sin cerrar:    Ctrl+A, luego D"
        echo "     Volver a este menú:  bash start.sh"
        echo "     Detener servidor:    screen -S $SESSION -X quit"
        echo ""
    else
        echo "  ❌ Error al iniciar. Iniciando en modo visible..."
        python app.py
    fi
fi
