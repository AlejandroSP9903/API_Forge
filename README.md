<<<<<<< HEAD
# API FORGE — GUÍA DE INSTALACIÓN Y EJECUCIÓN EN WINDOWS

Esta guía describe el procedimiento paso a paso para clonar, configurar, ejecutar y probar **API Forge (Fase 0)** en un entorno con sistema operativo Windows (PowerShell, CMD o WSL2).

---

## 1. Requisitos Previos

- **Node.js**: Versión `>= 20.x` o `>= 22.x LTS` recomendada.
  - Para verificar tu versión:
    ```powershell
    node --version
    npm --version
    ```
- **Git** para Windows.
- No se requieren Visual Studio C++ Build Tools ni Python, gracias al uso de `@libsql/client` (controlador de SQLite en TypeScript/Wasm puro).

---

## 2. Instalación Paso a Paso

### Paso 2.1: Clonar o descargar el repositorio
Abre PowerShell o Windows Terminal y sitúate en el directorio de trabajo:
```powershell
cd C:\proyectos
git clone https://github.com/AlejandroSP9903/API_Forge
cd API_forge
```

### Paso 2.2: Instalar dependencias
Ejecuta la instalación limpia de paquetes:
```powershell
npm install
```

### Paso 2.3: Configurar variables de entorno
Crea el archivo `.env` a partir de `.env.example`:

**En PowerShell:**
=======
# API Forge — Plataforma de Pruebas y Observabilidad de APIs REST

API Forge es una plataforma modular y de código abierto para pruebas, inspección y observabilidad de APIs REST, diseñada para operar en desarrollo local con 0 costos adicionales (0 COP) y sin servicios de facturación externos.

---

## Estado Actual: Fase 0 (Cimientos y Arquitectura)

La **Fase 0** establece las bases estructurales y de verificación del sistema:
- **Backend**: Node.js + Express en TypeScript estricto.
- **Frontend**: React 19 + Vite + Tailwind CSS.
- **Persistencia**: SQLite local con Drizzle ORM y claves foráneas habilitadas (`PRAGMA foreign_keys = ON;`).
- **Pruebas Automatizadas**: Vitest + Supertest con suites de persistencia real en disco y aislamiento en memoria.
- **Observabilidad Inicial**: Endpoint estructurado `GET /api/health` con diagnóstico en vivo de la base de datos y métricas de latencia.

> **Nota:** La Fase 0 no requiere servicios de pago ni `GEMINI_API_KEY`. Funciona de forma 100% autónoma y local.

---

## Requisitos del Sistema

- **Node.js**: Versión `>= 20.x` o `>= 22.x LTS` recomendada.
- **npm** o gestor de paquetes compatible.
- **Sistema Operativo**: Windows (PowerShell, CMD, WSL2), Linux o macOS.
  - *No requiere compiladores de C++ (`node-gyp`)* gracias al uso del controlador `@libsql/client`.

---

## Instalación y Configuración

### 1. Clonar el repositorio
```bash
git clone <URL_DEL_REPOSITORIO> api-forge
cd api-forge
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Copia la plantilla `.env.example` en un archivo `.env`:

**En Windows (PowerShell):**
>>>>>>> f42f589 (chore: initialiaze API forge Pahe 0.1)
```powershell
Copy-Item .env.example .env
```

<<<<<<< HEAD
**En Símbolo del Sistema (CMD):**
=======
**En Windows (CMD):**
>>>>>>> f42f589 (chore: initialiaze API forge Pahe 0.1)
```cmd
copy .env.example .env
```

<<<<<<< HEAD
El contenido por defecto de `.env` ya está listo para desarrollo local:
```env
PORT=3000
HOST="0.0.0.0"
NODE_ENV="development"
DATABASE_URL="file:api_forge.db"
=======
**En Linux / macOS:**
```bash
cp .env.example .env
```

#### Variables disponibles en `.env`:
```env
# Puerto del servidor (por defecto 3000)
PORT=3000
HOST="0.0.0.0"
NODE_ENV="development"

# Ubicación del archivo SQLite local
# Puede ser relativo (file:./data/api_forge.db) o absoluto.
DATABASE_URL="file:./data/api_forge.db"

# Nivel de registro
>>>>>>> f42f589 (chore: initialiaze API forge Pahe 0.1)
LOG_LEVEL="info"
```

---

<<<<<<< HEAD
## 3. Ejecución del Proyecto

### 3.1 Modo Desarrollo (Full-Stack en Puerto 3000)
Para iniciar el servidor Express con Vite integrado:
```powershell
npm run dev
```

La consola mostrará:
```text
[API Forge] Inicializando servicio en entorno: development
[Database] SQLite inicializado correctamente. Tablas verificadas: api_endpoints, health_audit_logs, projects
[Database] Claves foráneas activas: SÍ
[Frontend] Vite montado en modo middleware de desarrollo.
====================================================
🚀 API Forge Servidor activo en: http://0.0.0.0:3000
🩺 Endpoint de salud: http://0.0.0.0:3000/api/health
====================================================
```

Abre tu navegador web en:
- Interfaz gráfica: [http://localhost:3000](http://localhost:3000)
- Endpoint de salud: [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

## 4. Resolución de Conflictos de Puerto en Windows

Si al ejecutar `npm run dev` recibes el error `EADDRINUSE: address already in use :::3000`:

### Opción A: Liberar el puerto 3000
1. Identifica qué proceso está utilizando el puerto:
   ```powershell
   Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess
   ```
   *(O en CMD: `netstat -ano | findstr :3000`)*

2. Detén el proceso que bloquea el puerto:
   ```powershell
   Stop-Process -Id <PID_DEL_PROCESO> -Force
   ```

### Opción B: Cambiar el puerto en `.env`
Edita tu archivo `.env` y especifica un puerto libre alternativo, por ejemplo 3001:
```env
PORT=3001
```
Luego vuelve a ejecutar `npm run dev` y accede a [http://localhost:3001](http://localhost:3001).

---

## 5. Ejecución de Pruebas y Verificación

### 5.1 Comprobación Estricta de Tipos (TypeScript)
Para verificar que no existen errores de sintaxis ni de tipado:
```powershell
npm run lint
```
*(O de forma directa: `npx tsc --noEmit`)*

### 5.2 Suite de Pruebas Automatizadas (Vitest + Supertest)
Para ejecutar todas las pruebas unitarias y de integración:
```powershell
npm test
```
*(O `npx vitest run`)*

Las 7 pruebas se ejecutarán en milisegundos con base de datos SQLite en memoria, sin alterar tu archivo de base de datos local `api_forge.db`.

---

## 6. Construcción para Producción
=======
## Ejecución

### Modo Desarrollo (Full-Stack en puerto 3000)
```bash
npm run dev
```
Inicia el servidor Express en el puerto `3000` con Vite integrado en modo middleware.
- **Panel Web**: [http://localhost:3000](http://localhost:3000)
- **Endpoint de Salud**: [http://localhost:3000/api/health](http://localhost:3000/api/health)

### Compilación y Ejecución en Producción
```bash
npm run build
npm start
```
Compila los activos del frontend a `dist/` y los sirve optimizados mediante Express.

---

## Resolución de Conflictos de Puerto en Windows

Si el puerto 3000 está en uso (`EADDRINUSE`):

1. **Liberar el puerto desde PowerShell:**
   ```powershell
   Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
   ```
2. **O configurar un puerto alternativo en `.env`:**
   ```env
   PORT=3001
   ```

---

## Pruebas y Validación

```bash
# Verificación de tipos estricta con TypeScript
npm run lint

# Ejecución de la suite completa de pruebas automatizadas (Vitest + Supertest)
npm test
```

### Cobertura de las pruebas:
- Contrato del endpoint `GET /api/health` y códigos de estado HTTP.
- Manejo centralizado y seguro de excepciones sin fuga de datos sensibles.
- Creación automática de directorios padres para almacenamiento SQLite.
- Persistencia real en disco comprobada (inserción, cierre, reapertura y verificación de datos).
- Verificación de integridad referencial (`PRAGMA foreign_keys = ON;`) y borrado en cascada.
- Detección explícita de rutas de base de datos inválidas sin fallbacks silenciosos.

---

## Hoja de Ruta de Fases

- **Fase 0 (Actual)**: Arquitectura base, Express, SQLite, Drizzle ORM, pruebas de persistencia y observabilidad inicial.
- **Fase 1 (Próxima)**: Motor de solicitudes HTTP (GET, POST, PUT, DELETE, PATCH), gestión de cabeceras y parámetros.
- **Fase 2**: Colecciones de endpoints, variables de entorno dinámicas y sincronización en SQLite.
- **Fase 3**: Aserciones automatizadas, métricas de rendimiento y registro de auditoría de APIs.
>>>>>>> f42f589 (chore: initialiaze API forge Pahe 0.1)
