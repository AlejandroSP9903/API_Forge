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
git clone https://github.com/AlejandroSP9903/API_Forge api-forge
cd api-forge
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Copia la plantilla `.env.example` en un archivo `.env`:

**En Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**En Windows (CMD):**
```cmd
copy .env.example .env
```

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
LOG_LEVEL="info"
```

---

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
