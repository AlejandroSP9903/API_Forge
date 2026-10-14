/**
 * API Forge - Servidor Principal Full-Stack (Fase 0)
 * Integra Express en el puerto 3000 con soporte para Vite en desarrollo
 * y servicio de estáticos en producción.
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from './server/app.ts';
import { config } from './server/config.ts';
import { initDatabase } from './server/db/index.ts';
import { runMigrations } from './server/db/migrate.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer(): Promise<void> {
  console.log(`[API Forge] Inicializando servicio en entorno: ${config.nodeEnv}`);

  // 1. Inicializar base de datos SQLite y aplicar migraciones
  try {
    await initDatabase();
    const migrationResult = await runMigrations();
    if (migrationResult.success) {
      console.log(`[Database] SQLite inicializado correctamente. Tablas verificadas: ${migrationResult.appliedTables.join(', ')}`);
      console.log(`[Database] Claves foráneas activas: ${migrationResult.foreignKeysActive ? 'SÍ' : 'NO'}`);
    } else {
      console.error(`[Database] Advertencia al aplicar migraciones: ${migrationResult.error}`);
    }
  } catch (dbError) {
    console.error('[Database] Error crítico inicializando SQLite:', dbError);
  }

  // 2. Crear instancia de Express
  const app = createApp();

  // 3. Configurar Frontend (Vite en desarrollo o estáticos en producción)
  if (config.nodeEnv !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
    console.log('[Frontend] Vite montado en modo middleware de desarrollo.');
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    console.log(`[Frontend] Sirviendo archivos estáticos de producción desde: ${distPath}`);
  }

  // 4. Iniciar escucha HTTP
  app.listen(config.port, config.host, () => {
    console.log(`====================================================`);
    console.log(`🚀 API Forge Servidor activo en: http://${config.host}:${config.port}`);
    console.log(`🩺 Endpoint de salud: http://${config.host}:${config.port}/api/health`);
    console.log(`====================================================`);
  });
}

startServer().catch((err) => {
  console.error('[API Forge] Error fatal arrancando el servidor:', err);
  process.exit(1);
});
