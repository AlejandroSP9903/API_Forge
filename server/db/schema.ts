/**
 * API Forge - Esquema Drizzle ORM (Fase 0)
 * Define las tablas SQLite iniciales y relaciones de claves foráneas.
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Tabla de Proyectos / Colecciones base
 */
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Tabla de Endpoints de API
 * Demuestra la relación de clave foránea con borrado en cascada
 */
export const apiEndpoints = sqliteTable('api_endpoints', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  method: text('method').notNull(), // GET, POST, PUT, DELETE, etc.
  path: text('path').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Tabla de Registro de Auditoría de Salud
 * Registra pings del sistema y verificaciones de integridad
 */
export const healthAuditLogs = sqliteTable('health_audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  checkedAt: text('checked_at').notNull(),
  status: text('status').notNull(),
  latencyMs: integer('latency_ms').notNull(),
  details: text('details'),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type ApiEndpoint = typeof apiEndpoints.$inferSelect;
export type NewApiEndpoint = typeof apiEndpoints.$inferInsert;

export type HealthAuditLog = typeof healthAuditLogs.$inferSelect;
export type NewHealthAuditLog = typeof healthAuditLogs.$inferInsert;

/* ==========================================================================
 * FASE 1D: TABLAS DE COLECCIONES Y SOLICITUDES GUARDADAS
 * ========================================================================== */

/**
 * Tabla de Colecciones de Solicitudes
 */
export const collections = sqliteTable('collections', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Tabla de Solicitudes Guardadas dentro de Colecciones
 * Incorpora clave foránea hacia collections con borrado en cascada
 */
export const savedRequests = sqliteTable('saved_requests', {
  id: text('id').primaryKey(),
  collectionId: text('collection_id')
    .notNull()
    .references(() => collections.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  method: text('method').notNull(),
  url: text('url').notNull(),
  headers: text('headers'),
  queryParams: text('query_params'),
  body: text('body'),
  contentType: text('content_type'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;

export type SavedRequest = typeof savedRequests.$inferSelect;
export type NewSavedRequest = typeof savedRequests.$inferInsert;

/* ==========================================================================
 * FASE 1E: TABLA DE ENTORNOS Y VARIABLES (ENVIRONMENTS)
 * ========================================================================== */

/**
 * Tabla de Entornos de Ejecución
 */
export const environments = sqliteTable('environments', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  variables: text('variables'), // JSON serializado de EnvironmentVariable[]
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type Environment = typeof environments.$inferSelect;
export type NewEnvironment = typeof environments.$inferInsert;


