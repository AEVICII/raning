# 📊 Deriv Trader Application

Aplicación web completa para trading de índices sintéticos usando la API de Deriv con **sistema de trading automatizado multi-contrato**.

## 🌟 Características

### Visualización en Tiempo Real
- ✅ Últimos 10 ticks en directo
- ✅ Modo de visualización: Ticks completos o solo último dígito
- ✅ Actualización automática en tiempo real vía WebSocket

### Estadísticas de Dígitos
- 📊 Contador de frecuencia para cada dígito (0-9)
- 📈 Porcentajes de aparición
- 🎯 Identificación visual de dígitos más y menos frecuentes

### Panel de Trading Manual
- 💰 Todos los tipos de contratos de dígitos:
  - **Differs**: Predecir que el último dígito será diferente
  - **Matches**: Predecir que el último dígito será igual
  - **Even**: Predecir que será par
  - **Odd**: Predecir que será impar
  - **Over**: Predecir que será mayor que X
  - **Under**: Predecir que será menor que X

### 🤖 **NUEVO: Sistema Multi-Contrato Automatizado**

#### Características Principales
- 🔥 **Hasta 20 contratos automatizados simultáneos**
- 🎯 **Patrones personalizables** por cada contrato
- ⚡ **Ejecución paralela**: Si 2+ patrones coinciden al mismo tiempo, se ejecutan todos
- 🔌 **WebSocket independiente** por cada bot
- 💾 **Guardado automático** de configuraciones
- 📊 **Estadísticas individuales y globales**

#### Constructor de Patrones
Crea patrones únicos usando:
- **Número Único (0-9)**: Detecta un dígito específico
- **Cualquier Número (*)**: Acepta cualquier dígito

**Ejemplos de Patrones:**
```
[5] → [*] → [*] → [5]  ✓ Detecta: 5-3-7-5, 5-0-2-5
[3] → [3] → [*]        ✓ Detecta: 3-3-8, 3-3-0
[*] → [7] → [*] → [7]  ✓ Detecta: 2-7-5-7, 9-7-0-7
```

#### Configuración por Contrato
Cada contrato automatizado puede tener:
- ✅ Nombre personalizado
- ✅ Índice sintético específico
- ✅ Tipo de contrato único
- ✅ Predicción (si aplica)
- ✅ Duración en ticks
- ✅ Cantidad de inversión
- ✅ Patrón de detección propio

#### Panel de Control
- ▶️ **Activar/Detener** bots individualmente
- ▶️ **Activar Todos** con un solo click
- ⏹️ **Detener Todos** instantáneamente
- ✏️ **Editar** configuraciones sin detener
- 🗑️ **Eliminar** contratos obsoletos

#### Estadísticas en Tiempo Real
Por cada contrato:
- Coincidencias de patrón detectadas
- Operaciones ejecutadas
- Operaciones ganadas/perdidas
- Balance individual

Globales:
- Total de contratos activos
- Total de operaciones
- Balance acumulado

### Configuración Flexible
- ⚙️ Selección de índice sintético
- 🎯 Número de predicción (0-9)
- ⏱️ Duración en ticks (1-10)
- 💵 Cantidad a invertir personalizable
- 📄 Cotización en tiempo real antes de comprar

### Historial
- 📜 Últimas 10 operaciones manuales
- ✅ Estado: Ganadas/Perdidas/En curso
- 💰 Ganancias/Pérdidas detalladas

## 📋 Requisitos Previos

- Python 3.8 o superior
- Navegador web moderno (Chrome, Firefox, Edge, Safari)
- **API Token de Deriv** (obligatorio para trading automatizado)

## 🚀 Instalación

### 1. Clonar o descargar el proyecto

```bash
cd deriv_trader
```

### 2. Instalar dependencias

```bash
pip install -r requirements.txt
```

O instalar manualmente:

```bash
pip install flask flask-cors
```

## 🎯 Uso

### 1. Iniciar el servidor

```bash
python app.py
```

Verás un mensaje como:

```
============================================================
🚀 Iniciando Deriv Trader Application
============================================================
📊 Websocket URL: wss://ws.derivws.com/websockets/v3?app_id=1089
🌐 Servidor: http://localhost:5000
============================================================

⚠️  IMPORTANTE:
   - Este proyecto usa el APP_ID de prueba (1089)
   - Para trading real, regístrate en https://api.deriv.com
   - Obtén tu propio APP_ID y API Token
============================================================

✨ Aplicación lista. Abre http://localhost:5000 en tu navegador
```

### 2. Abrir en el navegador

Abre tu navegador y ve a: **http://localhost:5000**

### 3. Configurar la aplicación

#### Modo Demo (Sin API Token)
1. Selecciona un índice sintético del menú desplegable
2. Haz click en "🔌 Conectar"
3. Podrás ver los ticks en tiempo real y las estadísticas
4. **No podrás realizar operaciones de trading**

#### Modo Trading Real (Con API Token)
1. Obtén tu API Token:
   - Ve a https://app.deriv.com/account/api-token
   - Crea un token con permisos de **Trading**
   - Copia el token generado

2. En la aplicación:
   - Pega tu API Token en el campo "🔑 API Token"
   - Selecciona un índice sintético
   - Haz click en "🔌 Conectar"
   - Ahora podrás realizar operaciones de trading

### 4. Realizar una operación

**Trading Manual:**

1. **Seleccionar tipo de contrato**:
   - Differs / Matches / Even / Odd / Over / Under

2. **Configurar parámetros**:
   - Número de predicción (si aplica): 0-9
   - Número de ticks: 1-10
   - Cantidad a invertir: Mínimo $0.35

3. **Obtener cotización**:
   - Haz click en "📊 Obtener Cotización"
   - Verás el pago potencial, ganancia y ROI

4. **Comprar contrato**:
   - Haz click en "✅ Comprar Contrato"
   - Espera el resultado
   - Se mostrará un modal con el resultado final

### 5. 🤖 Usar el Sistema de Trading Automatizado

**Paso 1: Crear un Contrato Automatizado**

1. Scroll down hasta la sección "🤖 Trading Automatizado Multi-Contrato"
2. Haz click en "➕ Nuevo Contrato Automatizado"
3. Completa el formulario:
   - **Nombre**: Ej. "Patrón 5-cualquiera-5"
   - **Índice**: Selecciona el mercado (R_100, R_50, etc.)
   - **Tipo de Contrato**: Differs, Matches, Even, Odd, Over, Under
   - **Predicción**: Solo si el tipo lo requiere (0-9)
   - **Ticks**: Duración del contrato (1-10)
   - **Inversión**: Cantidad en USD

**Paso 2: Construir el Patrón**

1. Haz click en "➕ Agregar Variable"
2. Selecciona tipo:
   - **Número Único**: Para un dígito específico (ej: 5)
   - **Cualquier Número**: Para cualquier dígito (*)
3. Si elegiste "Número Único", selecciona el dígito (0-9)
4. Repite para crear tu patrón completo

**Ejemplos de Patrones Efectivos:**

```
Patrón conservador:
[5] → [*] → [*] → [*] → [5]
Detecta cuando aparece un 5, seguido de cualquier cosa, y termina en 5

Patrón de repetición:
[3] → [3] → [3]
Detecta cuando aparece el mismo dígito 3 veces

Patrón mixto:
[*] → [7] → [*] → [7]
Detecta cuando aparece 7 en posiciones específicas
```

**Paso 3: Guardar y Activar**

1. Haz click en "✅ Guardar Contrato"
2. El contrato aparecerá en la lista
3. Haz click en el botón ▶️ para activar ese bot específico
4. O usa "▶️ Activar Todos" para iniciar todos los bots

**Paso 4: Monitorear**

El sistema mostrará:
- 🟢 **Estado**: Activo/Inactivo/Esperando
- 📊 **Estadísticas**: Coincidencias, operaciones, ganadas, perdidas
- 💰 **Balance**: Ganancia/pérdida del contrato
- 📝 **Log**: Actividad en tiempo real

**Múltiples Bots Simultáneos:**

- Puedes tener hasta 20 contratos automatizados
- Cada uno con su propio patrón y configuración
- Si 2 o más patrones coinciden al mismo tiempo, **se ejecutan todos**
- Cada bot tiene su propia conexión WebSocket independiente

**Ejemplo de Uso Avanzado:**

```
Bot 1: "Patrón Par-Impar"
Patrón: [0,2,4,6,8] → [1,3,5,7,9]
Contrato: Even
Inversión: $1.00

Bot 2: "Triple 7"
Patrón: [7] → [7] → [7]
Contrato: Matches (predicción: 7)
Inversión: $0.50

Bot 3: "Differs Conservador"
Patrón: [5] → [*] → [*] → [5]
Contrato: Differs (predicción: 5)
Inversión: $2.00
```

Todos estos bots trabajarán simultáneamente, detectando sus patrones y ejecutando operaciones automáticas.

## 📊 Índices Sintéticos Disponibles

- **R_10**: Volatility 10 Index
- **R_25**: Volatility 25 Index
- **R_50**: Volatility 50 Index
- **R_75**: Volatility 75 Index
- **R_100**: Volatility 100 Index
- **1HZ10V**: Volatility 10 (1s) Index
- **1HZ25V**: Volatility 25 (1s) Index
- **1HZ50V**: Volatility 50 (1s) Index
- **1HZ75V**: Volatility 75 (1s) Index
- **1HZ100V**: Volatility 100 (1s) Index
- **RDBEAR**: Bear Market Index
- **RDBULL**: Bull Market Index
- **JD10**: Jump 10 Index
- **JD25**: Jump 25 Index
- **JD50**: Jump 50 Index
- **JD75**: Jump 75 Index
- **JD100**: Jump 100 Index

## 🎨 Interfaz de Usuario

### Panel Izquierdo - Configuración
- Conexión al WebSocket
- Selección de índice
- Estadísticas de dígitos

### Panel Central - Visualización
- Ticks en tiempo real
- Dos modos de vista:
  - **Ticks Completos**: Tabla con todos los detalles
  - **Último Dígito**: Grid visual solo con dígitos

### Panel Derecho - Trading
- Configuración de contratos
- Información de cotización
- Botones de acción
- Historial de operaciones

## ⚙️ Tipos de Contratos

### 1. Differs
- Predice que el último dígito del último tick será **diferente** al número seleccionado
- Probabilidad: ~90% (9 de 10 posibilidades)
- Pago: Bajo (~10%)

### 2. Matches
- Predice que el último dígito del último tick será **igual** al número seleccionado
- Probabilidad: ~10% (1 de 10 posibilidades)
- Pago: Alto (~800%)

### 3. Even (Par)
- Predice que el último dígito será un número par (0, 2, 4, 6, 8)
- Probabilidad: 50%
- Pago: ~95%

### 4. Odd (Impar)
- Predice que el último dígito será un número impar (1, 3, 5, 7, 9)
- Probabilidad: 50%
- Pago: ~95%

### 5. Over (Mayor que)
- Predice que el último dígito será **mayor** que el número seleccionado
- Probabilidad: Variable según el número
- Pago: Variable

### 6. Under (Menor que)
- Predice que el último dígito será **menor** que el número seleccionado
- Probabilidad: Variable según el número
- Pago: Variable

## 🔧 Estructura del Proyecto

```
deriv_trader/
│
├── app.py                      # Servidor Flask
├── requirements.txt            # Dependencias Python
├── README.md                   # Este archivo
│
├── templates/
│   └── index.html             # Template HTML principal
│
└── static/
    ├── css/
    │   └── style.css          # Estilos CSS
    └── js/
        └── app.js             # Lógica JavaScript
```

## 🔐 Seguridad

⚠️ **IMPORTANTE**:

- **Nunca compartas tu API Token** con nadie
- El token tiene acceso a tu cuenta de trading
- Usa tokens de **solo lectura** para pruebas
- Para trading real, usa tokens con permisos limitados
- No publiques tu token en repositorios públicos

## 📱 Responsive Design

La aplicación está optimizada para:
- 💻 Escritorio (1920px+)
- 💻 Laptops (1400px+)
- 📱 Tablets (768px+)
- 📱 Móviles (< 768px)

## 🐛 Solución de Problemas

### No se conecta al WebSocket
- Verifica tu conexión a internet
- Asegúrate de que el APP_ID sea correcto
- Revisa la consola del navegador para errores

### No puedo realizar operaciones
- Asegúrate de haber ingresado un API Token válido
- Verifica que el token tenga permisos de **Trading**
- Confirma que tienes saldo en tu cuenta

### Los ticks no se actualizan
- Verifica la conexión WebSocket (indicador verde)
- Intenta desconectar y reconectar
- Recarga la página

### Error al comprar contrato
- Verifica que hayas obtenido una cotización primero
- Asegúrate de tener saldo suficiente
- Confirma que todos los parámetros sean válidos

## 📚 Recursos Adicionales

- **Documentación API Deriv**: https://developers.deriv.com
- **Crear APP_ID**: https://api.deriv.com
- **Crear API Token**: https://app.deriv.com/account/api-token
- **Comunidad Deriv**: https://community.deriv.com

## ⚠️ Advertencia de Riesgo

El trading de derivados financieros conlleva un alto nivel de riesgo y puede no ser adecuado para todos los inversores. Puedes perder todo tu capital invertido. Esta aplicación es solo para fines educativos y de demostración. Opera solo con dinero que puedas permitirte perder.

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Si encuentras algún bug o tienes sugerencias de mejora, por favor abre un issue o envía un pull request.

## 📧 Soporte

Para preguntas sobre la API de Deriv, contacta a su equipo de soporte oficial.

---

**Desarrollado con ❤️ usando la API de Deriv**

¡Disfruta del trading responsable! 📊💰
