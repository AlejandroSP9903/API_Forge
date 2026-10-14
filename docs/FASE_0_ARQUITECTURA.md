# API FORGE — ARQUITECTURA TÉCNICA (FASE 0)

## 1. Resumen Ejecutivo

La **Fase 0** de **API Forge** sienta las bases de ingeniería de software para una plataforma personal de pruebas y observabilidad de APIs REST. El objetivo primordial de esta fase es la **calidad estructural, modularidad y verificabilidad**, sin incurrir en costos (0 COP), sin herramientas de pago y sin añadir componentes ficticios o prematuros de fases posteriores.

---

## 2. Decisiones Técnicas y Adaptación al Entorno

### 2.1 Driver de SQLite: `@libsql/client` vs `better-sqlite3`
Durante la inspección de dependencias en el entorno de ejecución, se intentó instalar `better-sqlite3`. La instalación falló con código 127 debido a que `better-sqlite3` requiere compilación de código C++ nativo vía `node-gyp`, el cual no está instalado en entornos de contenedor ligeros ni en muchas instalaciones estándar de Windows sin Visual C++ Build Tools.

* **Decisión de Arquitectura**: Se seleccionó `@libsql/client` en combinación con `drizzle-orm/libsql`.
* **Beneficios**:
  - 100% compatible con la sintaxis y tipos de SQLite estándar.
  - Cero requisitos de compilador C++ (`node-gyp`).
  - Funciona de forma transparente tanto en archivos locales (`file:api_forge.db`) como en memoria para pruebas unitarias (`file::memory:?cache=shared`).
  - Pleno soporte en Drizzle ORM.
  - Ejecutable en Windows, Linux y macOS sin librerías externas.

### 2.2 Integración Express + Vite en Puerto 3000
Para respetar tanto el requerimiento de un backend Express nativo como la restricción del entorno web de puerto único 3000:
- El punto de entrada `server.ts` arranca Express.
- En desarrollo (`NODE_ENV !== 'production'`), monta Vite en modo middleware (`createViteServer({ server: { middlewareMode: true } })`), canalizando todas las solicitudes web al cliente React y las rutas `/api/*` al backend Express.
- En producción, Express sirve la carpeta construida `dist/`.
- La factoría `createApp()` en `server/app.ts` está desacoplada del listener HTTP, permitiendo a `supertest` realizar pruebas de integración de endpoints sin necesidad de ocupar puertos TCP del sistema.

---

## 3. Estructura del Proyecto

```text
/
├── .env.example                  # Plantilla segura de variables de entorno
├── .gitignore                    # Exclusión de node_modules, .env, *.db y logs
├── index.html                    # Entry point HTML sincronizado
├── package.json                  # Scripts (dev, build, start, lint, test)
├── tsconfig.json                 # TypeScript con comprobación estricta
├── vite.config.ts                # Configuración de Vite con Tailwind CSS
├── server.ts                     # Punto de entrada HTTP y montaje Vite/Express
│
├── packages/
│   └── shared/
│       └── types.ts              # Tipos compartidos y contratos TypeScript
│
├── server/
│   ├── app.ts                    # Factoría de Express (createApp)
│   ├── config.ts                 # Carga y validación de variables de entorno
│   ├── db/
│   │   ├── index.ts              # Inicialización SQLite y verificación PRAGMA
│   │   ├── schema.ts             # Esquema Drizzle ORM (projects, api_endpoints, etc.)
│   │   └── migrate.ts            # Módulo independiente de migraciones reproducibles
│   ├── middleware/
│   │   └── errorHandler.ts       # Manejador centralizado de errores sanitizado
│   └── routes/
│       └── health.ts             # Router GET /api/health y diagnóstico
│
├── src/                          # Frontend React SPA
│   ├── App.tsx                   # Panel de observabilidad y estado de Fase 0
│   ├── main.tsx                  # Montaje React 19
│   └── index.css                 # Importación Tailwind CSS
│
├── tests/                        # Pruebas automatizadas (Vitest + Supertest)
│   ├── health.test.ts            # Pruebas de integración HTTP
│   └── db.test.ts                # Pruebas unitarias de SQLite y Drizzle
│
└── docs/                         # Documentación técnica
    ├── FASE_0_ARQUITECTURA.md    # Este documento
    └── GUIA_WINDOWS.md           # Guía de instalación y ejecución en Windows
```

---

## 4. Esquema de Base de Datos y Claves Foráneas

Se definieron 3 tablas principales para la Fase 0:

1. **`projects`**:
   - `id`: TEXT PRIMARY KEY
   - `name`: TEXT NOT NULL
   - `description`: TEXT
   - `created_at`: INTEGER NOT NULL

2. **`api_endpoints`**:
   - `id`: TEXT PRIMARY KEY
   - `project_id`: TEXT NOT NULL, referenciando `projects.id` con `ON DELETE CASCADE`
   - `method`: TEXT NOT NULL (GET, POST, PUT, DELETE, etc.)
   - `path`: TEXT NOT NULL
   - `created_at`: INTEGER NOT NULL

3. **`health_audit_logs`**:
   - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
   - `checked_at`: TEXT NOT NULL
   - `status`: TEXT NOT NULL
   - `latency_ms`: INTEGER NOT NULL
   - `details`: TEXT

### Regla de Integridad Referencial
En SQLite las claves foráneas están deshabilitadas por defecto. El módulo `server/db/index.ts` ejecuta de manera obligatoria:
```sql
PRAGMA foreign_keys = ON;
```
Esto asegura que cualquier intento de asociar un endpoint a un proyecto inexistente es bloqueado a nivel de motor de base de datos. Asimismo, al eliminar un proyecto padre, sus endpoints hijos se eliminan automáticamente en cascada.

---

## 5. Contrato de la API: `GET /api/health`

### Respuesta Exitosa (`200 OK`)
```json
{
  "status": "ok",
  "service": "api-forge",
  "version": "0.1.0",
  "uptimeSeconds": 142,
  "timestamp": "2026-10-14T22:15:00.000Z",
  "environment": "development",
  "nodeVersion": "v22.23.3",
  "database": {
    "status": "connected",
    "foreignKeys": true,
    "dialect": "sqlite",
    "driver": "@libsql/client (pure TS/Wasm & local file)",
    "databaseUrl": "file:api_forge.db",
    "tablesVerified": [
      "api_endpoints",
      "health_audit_logs",
      "projects"
    ],
    "latencyMs": 1
  }
}
```

---

## 6. Pruebas Automatizadas

Se configuró **Vitest** con **Supertest** para ejecutar pruebas automatizadas completas sin dependencias externas:
1. `tests/health.test.ts`:
   - Código 200 y JSON válido con estado `"ok"`.
   - Diagnóstico de SQLite y verificación de claves foráneas activas.
   - Manejo centralizado de excepciones sin fuga de datos sensibles.
2. `tests/db.test.ts`:
   - Inicialización correcta de SQLite.
   - Ejecución de migraciones reproducibles sin errores.
   - Comprobación de que una inserción con clave foránea inválida es rechazada (`rejects.toThrow()`).
   - Inserción relacional válida y prueba de borrado en cascada.

Resultado verificado: **7/7 pruebas pasadas** (100% de éxito).
