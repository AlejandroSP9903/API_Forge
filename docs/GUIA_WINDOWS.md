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
git clone <URL_DEL_REPOSITORIO> api-forge
cd api-forge
```

### Paso 2.2: Instalar dependencias
Ejecuta la instalación limpia de paquetes:
```powershell
npm install
```

### Paso 2.3: Configurar variables de entorno
Crea el archivo `.env` a partir de `.env.example`:

**En PowerShell:**
```powershell
Copy-Item .env.example .env
```

**En Símbolo del Sistema (CMD):**
```cmd
copy .env.example .env
```

El contenido por defecto de `.env` ya está listo para desarrollo local:
```env
PORT=3000
HOST="0.0.0.0"
NODE_ENV="development"
DATABASE_URL="file:api_forge.db"
LOG_LEVEL="info"
```

---

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

Para compilar el frontend y preparar la aplicación para producción:
```powershell
npm run build
npm start
```
El servidor Express servirá la carpeta optimizada `dist/` con latencia mínima y sin el servidor de desarrollo de Vite.
