# 🚀 GUÍA RÁPIDA - Deriv Trader

## ⚡ Inicio Rápido

### Windows
1. Doble click en `start.bat`
2. Espera a que se instalen las dependencias
3. Se abrirá el servidor automáticamente
4. Abre tu navegador en: http://localhost:5000

### Linux / Mac
1. Abre una terminal en esta carpeta
2. Ejecuta: `./start.sh`
3. Abre tu navegador en: http://localhost:5000

### Alternativa Manual
```bash
pip install -r requirements.txt
python app.py
```

## 🎯 Primeros Pasos

### 1️⃣ Modo Demo (Sin API Token)
- Solo visualización de ticks
- NO puedes hacer trading
- Perfecto para familiarizarte con la interfaz

**Pasos:**
1. Selecciona un índice (ej: "Volatility 100 Index")
2. Click en "🔌 Conectar"
3. Observa los ticks en tiempo real

### 2️⃣ Modo Trading (Con API Token)
- Visualización + Trading Real
- Necesitas cuenta en Deriv

**Pasos:**
1. Regístrate en: https://deriv.com
2. Obtén tu API Token en: https://app.deriv.com/account/api-token
   - Marca la opción "Trading" al crear el token
3. Copia el token
4. Pégalo en el campo "🔑 API Token"
5. Selecciona un índice
6. Click en "🔌 Conectar"
7. ¡Listo para operar!

## 💰 Cómo Hacer una Operación

### Paso 1: Seleccionar Tipo de Contrato
Elige uno de estos:
- **Differs**: El último dígito será diferente a tu predicción (Alta probabilidad, bajo pago)
- **Matches**: El último dígito será igual a tu predicción (Baja probabilidad, alto pago)
- **Even**: El último dígito será par (50%, ~95% ROI)
- **Odd**: El último dígito será impar (50%, ~95% ROI)
- **Over**: El último dígito será mayor que X
- **Under**: El último dígito será menor que X

### Paso 2: Configurar
- **Predicción**: Número del 0 al 9 (solo para Differs/Matches/Over/Under)
- **Ticks**: Cuántos ticks esperar (1-10)
- **Inversión**: Cantidad en USD (mínimo $0.35)

### Paso 3: Obtener Cotización
- Click en "📊 Obtener Cotización"
- Revisa el pago potencial y ROI

### Paso 4: Comprar
- Click en "✅ Comprar Contrato"
- Espera el resultado
- ¡Aparecerá un modal con el resultado!

## 📊 Entendiendo las Estadísticas

### Panel de Estadísticas de Dígitos
- Muestra cuántas veces ha aparecido cada dígito (0-9)
- **Verde**: Dígito más frecuente
- **Rojo**: Dígito menos frecuente
- Útil para estrategias de trading

### Modos de Visualización
1. **Ticks Completos**: Tabla detallada con todos los datos
2. **Último Dígito**: Vista visual solo de los dígitos

## 💡 Consejos de Trading

### Para Principiantes
1. Empieza con contratos **Even/Odd** (50% probabilidad)
2. Usa cantidades pequeñas ($0.35 - $1.00)
3. Observa las estadísticas antes de operar
4. No te dejes llevar por las emociones

### Estrategia "Differs"
- Selecciona el dígito **MENOS frecuente** (rojo)
- Alta probabilidad de ganar (~90%)
- Ganancias pequeñas pero consistentes
- Pago típico: 8-10% ROI

### Estrategia "Matches"
- Selecciona el dígito **MÁS frecuente** (verde)
- Baja probabilidad (~10%)
- Ganancias grandes cuando aciertas
- Pago típico: 700-900% ROI
- ⚠️ **Alto riesgo**

### Estrategia "Even/Odd"
- Observa las últimas 10-20 apariciones
- Si hay racha de pares, considera apostar por impar
- Probabilidad equilibrada
- Pago típico: ~95% ROI

## ⚠️ Advertencias Importantes

### ❌ NO hagas esto:
- No inviertas dinero que no puedas perder
- No aumentes tu apuesta después de perder (Martingala)
- No operes con emociones
- No ignores las estadísticas

### ✅ SÍ haz esto:
- Establece un límite diario de pérdidas
- Toma descansos entre operaciones
- Lleva registro de tus operaciones
- Opera con cabeza fría

## 🔧 Solución Rápida de Problemas

### "No se conecta"
- Verifica tu internet
- Recarga la página
- Intenta con otro índice

### "No puedo operar"
- ¿Ingresaste el API Token?
- ¿El token tiene permisos de "Trading"?
- ¿Tienes saldo en tu cuenta?

### "Error al comprar"
- Primero obtén una cotización
- Verifica tu saldo
- Asegúrate de estar conectado

### "Los ticks no se actualizan"
- Verifica el indicador: debe estar 🟢 Verde
- Desconecta y reconecta
- Recarga la página

## 📞 Ayuda y Recursos

- **Documentación Deriv**: https://developers.deriv.com
- **Crear API Token**: https://app.deriv.com/account/api-token
- **Soporte Deriv**: https://deriv.com/contact-us

## 🎓 Aprende Más

### Índices Sintéticos
Los índices sintéticos son instrumentos que simulan mercados reales pero están disponibles 24/7. Los más populares:

- **Volatility 100**: Alta volatilidad, movimientos rápidos
- **Volatility 10**: Menor volatilidad, más predecible
- **Volatility (1s)**: Tick cada segundo, super rápido

### Tipos de Dígitos
- **Pares**: 0, 2, 4, 6, 8
- **Impares**: 1, 3, 5, 7, 9
- Los pagos varían según la probabilidad

## ⚖️ Gestión de Riesgo

### Regla del 1%
- No arriesgues más del 1% de tu capital en una operación
- Ejemplo: Si tienes $100, máximo $1 por operación

### Límite Diario
- Establece un límite de pérdidas diarias
- Ejemplo: Si pierdes $10 en el día, para de operar

### Diversifica
- No uses siempre el mismo tipo de contrato
- Alterna entre diferentes estrategias
- Varía los índices

## 🎯 Objetivos Realistas

### Principiante
- Meta: No perder dinero
- Enfócate en aprender
- Opera con mínimos ($0.35)

### Intermedio  
- Meta: 5-10% ganancia mensual
- Usa estrategias probadas
- Mantén registro detallado

### Avanzado
- Meta: 15-20% ganancia mensual
- Combina múltiples estrategias
- Usa análisis estadístico

---

## ✨ ¡Comienza Ahora!

1. Inicia la aplicación
2. Conéctate en modo demo
3. Observa 10-20 ticks
4. Analiza las estadísticas
5. Haz tu primera operación (demo o real)

**¡Buena suerte y opera responsablemente! 🍀📊**

---

💡 **Consejo Final**: La paciencia y la disciplina son más importantes que la suerte en el trading.
