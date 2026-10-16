/**
 * API Forge - Pruebas Automatizadas del Sistema de Colecciones (Fase 1D)
 * Valida operaciones CRUD, claves foráneas, borrado en cascada,
 * sanitización de secretos en solicitudes guardadas y endpoints REST.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.ts';
import { initDatabase, closeDatabase, getDb } from '../server/db/index.ts';
import { runMigrations } from '../server/db/migrate.ts';
import {
  createCollection,
  listCollections,
  getCollectionById,
  updateCollection,
  deleteCollection,
  createSavedRequest,
  updateSavedRequest,
  deleteSavedRequest,
  CollectionError,
} from '../server/services/collectionsService.ts';
import { REDACTED_MARKER } from '../src/services/historySecurityService.ts';

describe('Sistema de Colecciones (Fase 1D) - Pruebas de Servicio y Base de Datos', () => {
  beforeEach(async () => {
    // Usar base de datos SQLite en memoria aislada para cada prueba
    await initDatabase(':memory:');
    const mig = await runMigrations();
    expect(mig.success).toBe(true);
    expect(mig.foreignKeysActive).toBe(true);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('1. debe crear una colección con nombre y descripción opcional', async () => {
    const col = await createCollection({
      name: 'Misiones de Autenticación',
      description: 'Colección de endpoints OAuth2 y tokens',
    });

    expect(col.id).toBeDefined();
    expect(col.name).toBe('Misiones de Autenticación');
    expect(col.description).toBe('Colección de endpoints OAuth2 y tokens');
    expect(col.requestsCount).toBe(0);
    expect(col.createdAt).toBeDefined();
  });

  it('2. debe rechazar nombres vacíos o excesivamente largos al crear colecciones', async () => {
    await expect(createCollection({ name: '   ' })).rejects.toThrow(
      /El nombre de la colección es obligatorio/i
    );

    const longName = 'A'.repeat(101);
    await expect(createCollection({ name: longName })).rejects.toThrow(
      /no puede superar los 100 caracteres/i
    );
  });

  it('3. debe listar colecciones y reflejar el conteo real de solicitudes guardadas', async () => {
    const col1 = await createCollection({ name: 'Colección Alfa' });
    const col2 = await createCollection({ name: 'Colección Beta' });

    // Añadir solicitudes a col1
    await createSavedRequest(col1.id, {
      name: 'Ping 1',
      method: 'GET',
      url: 'https://example.com/ping1',
    });
    await createSavedRequest(col1.id, {
      name: 'Ping 2',
      method: 'POST',
      url: 'https://example.com/ping2',
    });

    const list = await listCollections();
    expect(list.length).toBe(2);

    const foundCol1 = list.find((c) => c.id === col1.id);
    const foundCol2 = list.find((c) => c.id === col2.id);

    expect(foundCol1?.requestsCount).toBe(2);
    expect(foundCol2?.requestsCount).toBe(0);
  });

  it('4. debe obtener los detalles completos de una colección con sus solicitudes', async () => {
    const col = await createCollection({ name: 'Colección Detallada' });

    await createSavedRequest(col.id, {
      name: 'Solicitud con Parámetros y Cabeceras',
      method: 'GET',
      url: 'https://api.example.com/users',
      headers: { Accept: 'application/json' },
      queryParams: { page: 1, limit: 10 },
    });

    const full = await getCollectionById(col.id);
    expect(full).not.toBeNull();
    expect(full?.id).toBe(col.id);
    expect(full?.requests.length).toBe(1);
    expect(full?.requests[0].name).toBe('Solicitud con Parámetros y Cabeceras');
    expect(full?.requests[0].queryParams).toEqual({ page: 1, limit: 10 });
    expect(full?.requests[0].headers).toEqual({ Accept: 'application/json' });
  });

  it('5. debe actualizar el nombre y descripción de una colección existente', async () => {
    const col = await createCollection({ name: 'Nombre Viejo', description: 'Desc Vieja' });

    const updated = await updateCollection(col.id, {
      name: 'Nombre Nuevo',
      description: 'Desc Nueva',
    });

    expect(updated.name).toBe('Nombre Nuevo');
    expect(updated.description).toBe('Desc Nueva');

    const fresh = await getCollectionById(col.id);
    expect(fresh?.name).toBe('Nombre Nuevo');
  });

  it('6. debe sanitizar credenciales sensibles al guardar una solicitud en una colección', async () => {
    const col = await createCollection({ name: 'Colección Segura' });

    const saved = await createSavedRequest(col.id, {
      name: 'Petición con Credenciales',
      method: 'POST',
      url: 'https://usuario:MiPasswordUltraSecreto123@api.destino.com/v1/auth?token=SuperSecretToken777',
      headers: {
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.topsecret',
        'x-api-key': 'live_key_999988887777',
        'Custom-Header': 'PublicValue',
      },
      queryParams: {
        api_key: 'secret_query_key_123',
        normal_filter: 'active',
      },
      body: JSON.stringify({
        password: 'PlainTextPassword!',
        username: 'hunter_cazador',
      }),
    });

    // Validar redacción en URL
    expect(saved.url).toContain(REDACTED_MARKER);
    expect(saved.url).not.toContain('MiPasswordUltraSecreto123');
    expect(saved.url).not.toContain('SuperSecretToken777');

    // Validar redacción en Cabeceras
    expect(saved.headers?.['Authorization']).toBe(REDACTED_MARKER);
    expect(saved.headers?.['x-api-key']).toBe(REDACTED_MARKER);
    expect(saved.headers?.['Custom-Header']).toBe('PublicValue');

    // Validar redacción en Query Params
    expect(saved.queryParams?.['api_key']).toBe(REDACTED_MARKER);
    expect(saved.queryParams?.['normal_filter']).toBe('active');

    // Validar detección de bandera de seguridad
    expect(saved.hasProtectedSecrets).toBe(true);
  });

  it('7. debe actualizar una solicitud guardada conservando la sanitización', async () => {
    const col = await createCollection({ name: 'Colección Modificaciones' });

    const saved = await createSavedRequest(col.id, {
      name: 'Solicitud Inicial',
      method: 'GET',
      url: 'https://example.com/api',
    });

    const updated = await updateSavedRequest(col.id, saved.id, {
      name: 'Solicitud Actualizada con Token Nuevo',
      url: 'https://example.com/api?secret=NuevoSecreto999',
    });

    expect(updated.name).toBe('Solicitud Actualizada con Token Nuevo');
    expect(updated.url).toContain(REDACTED_MARKER);
    expect(updated.url).not.toContain('NuevoSecreto999');
    expect(updated.hasProtectedSecrets).toBe(true);
  });

  it('8. debe eliminar una solicitud individual de una colección', async () => {
    const col = await createCollection({ name: 'Colección para Eliminar Ítem' });

    const req1 = await createSavedRequest(col.id, {
      name: 'Solicitud A',
      method: 'GET',
      url: 'https://example.com/a',
    });
    const req2 = await createSavedRequest(col.id, {
      name: 'Solicitud B',
      method: 'GET',
      url: 'https://example.com/b',
    });

    await deleteSavedRequest(col.id, req1.id);

    const full = await getCollectionById(col.id);
    expect(full?.requests.length).toBe(1);
    expect(full?.requests[0].id).toBe(req2.id);
  });

  it('9. debe aplicar borrado en cascada (ON DELETE CASCADE) al eliminar una colección', async () => {
    const col = await createCollection({ name: 'Colección a Eliminar en Cascada' });

    const req = await createSavedRequest(col.id, {
      name: 'Hija en Cascada',
      method: 'GET',
      url: 'https://example.com/cascade',
    });

    // Eliminar la colección padre
    await deleteCollection(col.id);

    // Verificar que la colección ya no existe
    const missingCol = await getCollectionById(col.id);
    expect(missingCol).toBeNull();

    // Intentar acceder o actualizar la solicitud hija debe arrojar 404
    await expect(deleteSavedRequest(col.id, req.id)).rejects.toThrow(
      /No se encontró la solicitud/i
    );
  });

  it('10. debe rechazar métodos HTTP inválidos al guardar solicitudes', async () => {
    const col = await createCollection({ name: 'Colección Validación' });

    await expect(
      createSavedRequest(col.id, {
        name: 'Método Raro',
        method: 'CONNECT' as any,
        url: 'https://example.com',
      })
    ).rejects.toThrow(/Método HTTP 'CONNECT' no admitido/i);
  });
});

describe('Sistema de Colecciones (Fase 1D) - Endpoints REST Express', () => {
  const app = createApp();

  beforeEach(async () => {
    await initDatabase(':memory:');
    await runMigrations();
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('11. GET /api/collections y POST /api/collections vía HTTP', async () => {
    const postRes = await request(app)
      .post('/api/collections')
      .send({ name: 'Colección API REST', description: 'Prueba HTTP' });

    expect(postRes.status).toBe(201);
    expect(postRes.body.name).toBe('Colección API REST');

    const getRes = await request(app).get('/api/collections');
    expect(getRes.status).toBe(200);
    expect(Array.isArray(getRes.body)).toBe(true);
    expect(getRes.body.length).toBe(1);
  });

  it('12. Flujo completo de Solicitud en Colección vía HTTP (POST, PUT, DELETE)', async () => {
    // 1. Crear colección
    const colRes = await request(app)
      .post('/api/collections')
      .send({ name: 'Proyecto Clientes' });
    const colId = colRes.body.id;

    // 2. Guardar solicitud con credencial sensible
    const reqRes = await request(app)
      .post(`/api/collections/${colId}/requests`)
      .send({
        name: 'Listar Clientes',
        method: 'GET',
        url: 'https://api.empresa.com/clientes?token=secreto_auth_123',
        headers: { Authorization: 'Bearer token_real_privado' },
      });

    expect(reqRes.status).toBe(201);
    expect(reqRes.body.url).toContain(REDACTED_MARKER);
    expect(reqRes.body.headers['Authorization']).toBe(REDACTED_MARKER);
    expect(reqRes.body.hasProtectedSecrets).toBe(true);

    const reqId = reqRes.body.id;

    // 3. Modificar nombre de solicitud vía PUT
    const putRes = await request(app)
      .put(`/api/collections/${colId}/requests/${reqId}`)
      .send({ name: 'Listar Clientes VIP' });

    expect(putRes.status).toBe(200);
    expect(putRes.body.name).toBe('Listar Clientes VIP');

    // 4. Eliminar solicitud vía DELETE
    const delReqRes = await request(app).delete(`/api/collections/${colId}/requests/${reqId}`);
    expect(delReqRes.status).toBe(200);
    expect(delReqRes.body.success).toBe(true);

    // 5. Eliminar colección vía DELETE
    const delColRes = await request(app).delete(`/api/collections/${colId}`);
    expect(delColRes.status).toBe(200);
    expect(delColRes.body.success).toBe(true);
  });
});
