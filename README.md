# API Forge — Plataforma Hunter para Pruebas y Observabilidad de APIs REST

**API Forge** es una plataforma moderna, modular y de código abierto para componer, inspeccionar, organizar y probar solicitudes HTTP y APIs REST. Está diseñada para operar de forma 100% autónoma en desarrollo local con 0 costos adicionales (0 COP) y sin servicios de facturación externos.

Inspirada temáticamente en el sistema de cazadores de *Solo Leveling*, API Forge combina una interfaz de usuario inmersiva y de alto rendimiento con un motor HTTP robusto respaldado por defensas avanzadas de seguridad contra SSRF, protección activa contra fugas de credenciales en historial, colecciones persistentes y un sistema dinámico de entornos y variables.

---

## Estado Actual del Proyecto: FASE 1F

El repositorio ha completado y validado exhaustivamente las siguientes fases de desarrollo:

- **Fase 0 (Cimientos y Arquitectura):** Servidor Express en TypeScript estricto, Vite, SQLite con Drizzle ORM, pruebas de persistencia en disco y en memoria con Vitest + Supertest, y observabilidad con `GET /api/health`.
- **Fase 1A (Motor HTTP y Seguridad SSRF):** Ejecución de solicitudes `GET`, `POST`, `PUT`, `PATCH` y `DELETE`, escudo de red SSRF contra IPs privadas/loopback, límites estrictos de tamaño y timeout, y soporte de redirecciones seguras.
- **Fase 1C (Historial y Sistema de Audio):** Registro local de misiones con filtros de estado, inspección en ventana modal y retroalimentación auditiva sintetizada mediante la Web Audio API (sin archivos de audio externos).
- **Fase 1C-R (Auditoría y Sanitización del Historial):** Escudo criptográfico y de patrones regex para rediseñar y enmascarar automáticamente tokens, contraseñas y claves de API (`[VALOR_PROTEGIDO]`) en cabeceras, parámetros y cuerpos antes de guardarse en el almacenamiento local.
- **Fase 1D (Sistema de Colecciones Persistentes):** Organización de solicitudes en colecciones persistidas en SQLite mediante Drizzle ORM con operaciones CRUD completas, claves foráneas, borrado en cascada y sanitización automática de credenciales.
- **Fase 1E (Variables y Entornos):** Creación y gestión de entornos de ejecución (Desarrollo, Pruebas, Producción), variables normales y confidenciales (`isSecret`), interpolación inmutable con sintaxis `{{VARIABLE}}` y bloqueo preventivo de variables no resueltas.
- **Fase 1F (Mejoras de Request Builder y Documentación):** Vista previa en tiempo real de la URL efectiva con parámetros tras `?`, separación estricta entre query params y encabezados HTTP, validación previa del cuerpo JSON antes de emitir tráfico, exclusión de cuerpo en peticiones GET y documentación integral del proyecto.

> **114 pruebas automatizadas aprobadas** en 10 archivos de prueba.

---

## Tecnologías Utilizadas

### Frontend
- **React 19:** Biblioteca base para la interfaz de usuario modular y reactiva.
- **TypeScript (modo estricto):** Tipado estático de punta a punta entre frontend, backend y contratos compartidos.
- **Vite:** Empaquetador ultrarrápido y servidor de desarrollo con Hot Module Replacement.
- **Tailwind CSS v4:** Diseño de interfaz temático Hunter System con paneles holográficos y paleta cian, violeta y ámbar.
- **Lucide React:** Iconografía moderna para controles, métodos y estados del sistema.
- **Web Audio API:** Sistema de audio nativo del navegador que genera efectos sonoros mediante osciladores matemáticos sin dependencias externas.

### Backend y Persistencia
- **Node.js (LTS):** Entorno de ejecución en el servidor.
- **Express 4.x:** Servidor HTTP RESTful con middlewares de seguridad, CORS y manejo de errores estructurado.
- **SQLite Local con Drizzle ORM:** Persistencia relacional local determinista con claves foráneas activas (`PRAGMA foreign_keys = ON;`).
- **@libsql/client:** Controlador ligero de SQLite multiplataforma (no requiere compiladores C++ como `node-gyp`).

### Pruebas y Validación
- **Vitest:** Marco de pruebas moderno, rápido y compatible con TypeScript nativo.
- **Supertest:** Pruebas de integración sobre los endpoints HTTP de Express.

---

## Funcionalidades Implementadas y Verificadas

### 1. Motor HTTP Seguro
- Métodos admitidos: `GET`, `POST`, `PUT`, `PATCH` y `DELETE`.
- Medición precisa de latencia en milisegundos (`durationMs`) y fechas ISO de inicio y finalización.
- **Escudo SSRF Activo:** Bloqueo automático de destinos loopback (`127.0.0.1`, `localhost`, `::1`), rangos privados (RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), direcciones link-local (`169.254.169.254`), metadatos de proveedores en la nube y protocolos no autorizados (solo admite `http:` y `https:`).
- Cancelación en vuelo mediante `AbortController` (botón **CANCELAR**).

### 2. Request Builder (Consola de Disparo)
- Selector de método con codificación visual de colores distintiva (Cian para `GET`, Índigo para `POST`, Ámbar para `PUT`, Púrpura para `PATCH`, Rosa para `DELETE`).
- **Vista Previa de URL Efectiva:** Muestra en tiempo real la URL resultante combinando la URL base con los parámetros de consulta habilitados tras el signo `?`, así como su resolución con variables de entorno.
- **Pestaña Parámetros (Query Params):** Control individual de habilitación/deshabilitación mediante casillas de verificación, adición dinámica de pares clave-valor y separación estricta respecto a los encabezados HTTP.
- **Pestaña Encabezados (Headers):** Configuración de metadatos RFC 7230 con botones rápidos de inserción (`+ Content-Type`, `+ Bearer Token`, `+ Accept`), y distintivo visual de protección para cabeceras confidenciales.
- **Pestaña Cuerpo (Body JSON):** Editor con validación de sintaxis en tiempo real, botón para formatear/embellecer JSON (`FORMATEAR`), detección de variables interpoladas y deshabilitación educativa explicativa cuando el método es `GET`.
- **Pestaña Límites & Ajustes:** Configuración ajustable de tiempo límite (`timeoutMs` entre 100 ms y 30 000 ms) y límite de redirecciones seguras.

### 3. Sistema de Colecciones Persistentes (SQLite)
- Creación, listado, renombrado y eliminación de colecciones en SQLite local.
- Conteo automático de solicitudes por colección.
- Guardado de solicitudes desde el Request Builder directamente a una colección nueva o existente con un solo clic.
- Carga instantánea de solicitudes guardadas hacia el Request Builder.
- Edición del nombre de solicitudes guardadas y actualización de su configuración con los valores actuales del Request Builder.

### 4. Sistema de Variables y Entornos
- Creación, edición y eliminación de entornos (ej. *Desarrollo*, *Staging*, *Producción*).
- Declaración de variables clave-valor con soporte para variables normales y confidenciales (`isSecret`).
- **Sintaxis estándar:** `{{NOMBRE_VARIABLE}}`.
- **Resolución dinámica:** Aplica en URL, valores de encabezados, parámetros de consulta y cuerpos JSON.
- **Inmutabilidad:** La interpolación ocurre en memoria al ejecutar la petición; la plantilla original guardada en la colección permanece intacta.
- **Bloqueo preventivo:** Si una solicitud tiene variables pero no hay un entorno activo, o si una variable no existe en el entorno seleccionado, el sistema detiene la petición antes de emitir tráfico y muestra un error claro.

### 5. Historial de Misiones y Audio
- Registro cronológico de misiones ejecutadas con estado HTTP, código de error y latencia.
- Inspección detallada en modal con capacidad de reinyectar la solicitud en el Request Builder.
- Limpieza selectiva o total del historial.
- Generador de audio local mediante Web Audio API con volumen graduable y modo silencioso (silenciado / activo).

---

## Requisitos del Sistema

- **Node.js:** Versión `>= 20.x` o `>= 22.x LTS` recomendada.
- **npm:** Gestor de paquetes incluido con Node.js.
- **Sistema Operativo:** Windows (PowerShell, CMD, WSL2), Linux o macOS.
  - *No requiere compiladores C++ ni Python (`node-gyp`).*

---

## Instalación y Ejecución Local

### 1. Clonar el repositorio
```bash
git clone https://github.com/AlejandroSP9903/API_Forge
cd API-Forge
```

### 2. Instalar dependencias
```bash
npm install
```
*(Si encuentras advertencias de resolución en entornos locales específicos, puedes utilizar `npm install --legacy-peer-deps`).*

### 3. Configurar variables de entorno
Copia la plantilla `.env.example` en un archivo `.env`:

**En Linux / macOS:**
```bash
cp .env.example .env
```

**En Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**En Windows (CMD):**
```cmd
copy .env.example .env
```

#### Variables configurables en `.env`:
```env
# Puerto del servidor backend y frontend unificados
PORT=3000
HOST="0.0.0.0"
NODE_ENV="development"

# Ubicación del archivo de base de datos SQLite
DATABASE_URL="file:./data/api_forge.db"

# Nivel de registro
LOG_LEVEL="info"
```

### 4. Iniciar en Modo Desarrollo (Full-Stack en puerto 3000)
```bash
npm run dev
```
Inicia el servidor Express en el puerto `3000` con Vite montado en modo middleware.
- **Consola Web API Forge:** [http://localhost:3000](http://localhost:3000)
- **Diagnóstico del Núcleo:** [http://localhost:3000/api/health](http://localhost:3000/api/health)

### 5. Compilación y Ejecución en Producción
```bash
# Compilar frontend optimizado a dist/
npm run build

# Iniciar servidor Node.js sirviendo la aplicación compilada
npm start
```

### 6. Ejecución de Pruebas y Linteo
```bash
# Verificación estricta de tipos de TypeScript
npm run lint

# Ejecutar la suite completa de pruebas unitarias e integrales (Vitest)
npm test
```

---

## Ejemplo Práctico de Uso Paso a Paso

Aprende a ejecutar una solicitud con variables de entorno en menos de 2 minutos:

### Paso 1: Crear o Seleccionar un Entorno
1. En el menú lateral izquierdo, haz clic en **ENTORNOS**.
2. Haz clic en **+ NUEVO ENTORNO** y nómbralo `Desarrollo Público`.
3. Agrega dos variables:
   - Nombre: `BASE_URL` | Valor: `https://jsonplaceholder.typicode.com` | Confidencial: *Desmarcado*
   - Nombre: `POST_ID` | Valor: `1` | Confidencial: *Desmarcado*
4. Haz clic en el botón verde **ACTIVAR ENTORNO**. Verás el indicador verde encendido: `ENTORNO ACTIVO`.

### Paso 2: Configurar la Solicitud en el Request Builder
1. Regresa a **REQUEST BUILDER** en el menú lateral.
2. Selecciona el método `GET`.
3. En el campo de URL escribe:
   ```text
   {{BASE_URL}}/posts/{{POST_ID}}
   ```
4. Observa la sección inferior **URL EFECTIVA RESULTANTE**:
   - Plantilla: `{{BASE_URL}}/posts/{{POST_ID}}`
   - Resuelta con Desarrollo Público: `https://jsonplaceholder.typicode.com/posts/1`

### Paso 3: Añadir Parámetros de Consulta (Query Params)
1. Ve a la pestaña **PARÁMETROS**.
2. Escribe una clave `_expand` con valor `comments`.
3. Observa cómo la URL efectiva se actualiza en vivo a:
   ```text
   https://jsonplaceholder.typicode.com/posts/1?_expand=comments
   ```

### Paso 4: Disparar la Misión
1. Haz clic en el botón principal **DISPARAR MISIÓN**.
2. Se reproducirá el sonido de confirmación y verás la respuesta con código `200 OK`, el tiempo de respuesta en milisegundos y el JSON devuelto por la API remota.
3. Nota que en tu campo de texto la URL original `{{BASE_URL}}/posts/{{POST_ID}}` se conservó intacta para que puedas reutilizarla en otros entornos.

---

## Seguridad y Protección de Credenciales

API Forge incorpora un modelo de seguridad por capas para proteger al desarrollador:

### 1. ¿Cómo se detectan los valores confidenciales?
El sistema evalúa continuamente los nombres de los encabezados HTTP (`Authorization`, `X-Api-Key`, `Cookie`, `X-Auth-Token`), las claves de parámetros (`token`, `api_key`, `secret`, `password`) y los formatos reconocibles de secretos (tokens Bearer, JWTs, hashes).

### 2. ¿Por qué algunos valores se enmascaran como `[VALOR_PROTEGIDO]`?
Para evitar la fuga accidental de credenciales en el almacenamiento local del navegador (`localStorage`), registros de consola, capturas de pantalla o repositorios de código. Cuando una solicitud se almacena en el historial, los valores sensibles se redactan automáticamente.

### 3. ¿Qué significa la advertencia "Valores Confidenciales Protegidos"?
Cuando cargas una solicitud desde el historial que contenía un token o secreto, API Forge detecta la marca `[VALOR_PROTEGIDO]` y muestra una advertencia en color ámbar. Esto te indica que, por tu propia seguridad, el valor ficticio protegido no se enviará al servidor real y debes volver a ingresar tu token legítimo antes de ejecutar la misión.

### 4. Precauciones recomendadas con Tokens y API Keys:
- **Usa variables de entorno:** Almacena tus tokens en entornos y márcalos como **Confidencial / Secreto**. De esta forma, el valor se mantiene protegido con máscara (`••••••••`).
- **No coloques tokens reales en la URL:** Siempre que sea posible, envía las credenciales en encabezados (`Authorization: Bearer {{TOKEN}}`), ya que las URLs quedan registradas en servidores proxy y cachés intermedias.
- **Nunca incluyas archivos `.env` en repositorios públicos:** Mantén `.env` dentro de tu `.gitignore`.

---

## Resolución de Problemas Frecuentes

### Conflicto de Puerto (`EADDRINUSE: 3000`) en Windows
Si el puerto 3000 está ocupado por otro proceso:
1. **Liberar el puerto desde PowerShell:**
   ```powershell
   Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
   ```
2. **O configurar un puerto alternativo en `.env`:**
   ```env
   PORT=3001
   ```

### Error: "La solicitud contiene variables sin resolver"
Este mensaje aparece cuando la URL, los parámetros o el cuerpo contienen la sintaxis `{{...}}` pero:
- No has seleccionado ningún entorno activo. Solución: Ve a la pestaña **ENTORNOS** y haz clic en **ACTIVAR ENTORNO**, o selecciónalo en el desplegable superior del Request Builder.
- La variable utilizada no está definida en el entorno activo. Solución: Agrega la variable en la lista de variables del entorno correspondiente.

---

## Licencia
Proyecto educativo y de desarrollo personal bajo licencia MIT. Diseñado para pruebas locales seguras y observabilidad de APIs REST.
