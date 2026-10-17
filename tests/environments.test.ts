/**
 * API Forge - Pruebas Automatizadas de Entornos y Variables (Fase 1E)
 * Valida operaciones CRUD en SQLite, endpoints REST, motor de interpolación {{VARIABLE}}
 * y mecanismos de seguridad de secretos.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.ts';
import { initDatabase, closeDatabase } from '../server/db/index.ts';
import { runMigrations } from '../server/db/migrate.ts';
import {
  createEnvironment,
  listEnvironments,
  getEnvironmentById,
  updateEnvironment,
  deleteEnvironment,
  EnvironmentError,
} from '../server/services/environmentsService.ts';
import {
  interpolateRequest,
  interpolateString,
  VariableInterpolationError,
} from '../src/services/environmentService.ts';
import type { ExecuteRequestPayload, EnvironmentVariable } from '../packages/shared/types.ts';

describe('Sistema de Entornos y Variables (Fase 1E) - Pruebas de Backend y SQLite', () => {
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

  it('1. debe crear un entorno con nombre, descripción y variables', async () => {
    const env = await createEnvironment({
      name: 'Desarrollo Local',
      description: 'Variables para pruebas en entorno de staging',
      variables: [
        { id: '1', name: 'BASE_URL', value: 'https://jsonplaceholder.typicode.com', isSecret: false },
        { id: '2', name: 'API_KEY', value: 'secret_dev_key_123', isSecret: true },
      ],
    });

    expect(env.id).toBeDefined();
    expect(env.name).toBe('Desarrollo Local');
    expect(env.description).toBe('Variables para pruebas en entorno de staging');
    expect(env.variables).toHaveLength(2);
    expect(env.variables[0].name).toBe('BASE_URL');
    expect(env.variables[1].isSecret).toBe(true);
  });

  it('2. debe rechazar nombres vacíos o excesivamente largos al crear entornos', async () => {
    await expect(createEnvironment({ name: '   ' })).rejects.toThrow(
      /El nombre del entorno es obligatorio/i
    );

    const longName = 'A'.repeat(101);
    await expect(createEnvironment({ name: longName })).rejects.toThrow(
      /no puede superar los 100 caracteres/i
    );
  });

  it('3. debe listar los entornos con el conteo correcto de variables', async () => {
    await createEnvironment({
      name: 'Entorno A',
      variables: [
        { id: '1', name: 'V1', value: '1', isSecret: false },
        { id: '2', name: 'V2', value: '2', isSecret: false },
      ],
    });
    await createEnvironment({
      name: 'Entorno B',
      variables: [],
    });

    const list = await listEnvironments();
    expect(list.length).toBe(2);
    const envA = list.find((e) => e.name === 'Entorno A');
    const envB = list.find((e) => e.name === 'Entorno B');
    expect(envA?.variablesCount).toBe(2);
    expect(envB?.variablesCount).toBe(0);
  });

  it('4. debe actualizar el nombre, descripción y variables de un entorno', async () => {
    const env = await createEnvironment({
      name: 'Original',
      description: 'Desc original',
      variables: [{ id: '1', name: 'PORT', value: '3000', isSecret: false }],
    });

    const updated = await updateEnvironment(env.id, {
      name: 'Actualizado',
      description: 'Desc actualizada',
      variables: [
        { id: '1', name: 'PORT', value: '8080', isSecret: false },
        { id: '2', name: 'TOKEN', value: 'top_secret', isSecret: true },
      ],
    });

    expect(updated.name).toBe('Actualizado');
    expect(updated.description).toBe('Desc actualizada');
    expect(updated.variables).toHaveLength(2);
    expect(updated.variables[0].value).toBe('8080');
    expect(updated.variables[1].isSecret).toBe(true);
  });

  it('5. debe eliminar un entorno de SQLite', async () => {
    const env = await createEnvironment({ name: 'Para Eliminar' });
    await deleteEnvironment(env.id);

    const found = await getEnvironmentById(env.id);
    expect(found).toBeNull();
  });

  it('6. debe responder adecuadamente en los endpoints REST /api/environments', async () => {
    const app = createApp();

    // Crear entorno vía API
    const resCreate = await request(app)
      .post('/api/environments')
      .send({
        name: 'Producción',
        description: 'Servidores finales',
        variables: [
          { id: '1', name: 'HOST', value: 'https://api.example.com', isSecret: false },
        ],
      });
    expect(resCreate.status).toBe(201);
    expect(resCreate.body.id).toBeDefined();

    const envId = resCreate.body.id;

    // Obtener lista
    const resList = await request(app).get('/api/environments');
    expect(resList.status).toBe(200);
    expect(Array.isArray(resList.body)).toBe(true);
    expect(resList.body.length).toBeGreaterThan(0);

    // Obtener detalle
    const resGet = await request(app).get(`/api/environments/${envId}`);
    expect(resGet.status).toBe(200);
    expect(resGet.body.name).toBe('Producción');
    expect(resGet.body.variables[0].name).toBe('HOST');

    // Actualizar entorno
    const resPut = await request(app)
      .put(`/api/environments/${envId}`)
      .send({
        name: 'Producción v2',
      });
    expect(resPut.status).toBe(200);
    expect(resPut.body.name).toBe('Producción v2');

    // Eliminar entorno
    const resDel = await request(app).delete(`/api/environments/${envId}`);
    expect(resDel.status).toBe(200);
    expect(resDel.body.success).toBe(true);

    // Verificar que ya no existe (404)
    const resGetAfterDel = await request(app).get(`/api/environments/${envId}`);
    expect(resGetAfterDel.status).toBe(404);
  });
});

describe('Motor de Interpolación de Variables (Fase 1E)', () => {
  const sampleVariables: EnvironmentVariable[] = [
    { id: '1', name: 'BASE_URL', value: 'https://jsonplaceholder.typicode.com', isSecret: false },
    { id: '2', name: 'POST_ID', value: '42', isSecret: false },
    { id: '3', name: 'AUTH_TOKEN', value: 'hunter_s_rank_token_secret', isSecret: true },
    { id: '4', name: 'AUTHOR_NAME', value: 'Sung Jin-Woo', isSecret: false },
  ];

  it('7. debe interpolar variables en la URL correctamente', () => {
    const original: ExecuteRequestPayload = {
      url: '{{BASE_URL}}/posts/{{POST_ID}}',
      method: 'GET',
    };

    const { interpolatedPayload, resolvedCount } = interpolateRequest(original, sampleVariables);
    expect(interpolatedPayload.url).toBe('https://jsonplaceholder.typicode.com/posts/42');
    expect(resolvedCount).toBe(2);
    // El original no debe ser mutado
    expect(original.url).toBe('{{BASE_URL}}/posts/{{POST_ID}}');
  });

  it('8. debe interpolar variables en encabezados y parámetros de consulta', () => {
    const original: ExecuteRequestPayload = {
      url: '{{BASE_URL}}/search',
      method: 'GET',
      queryParams: {
        id: '{{POST_ID}}',
        author: '{{AUTHOR_NAME}}',
      },
      headers: {
        Authorization: 'Bearer {{AUTH_TOKEN}}',
        'X-Client': 'API-Forge',
      },
    };

    const { interpolatedPayload, secretVarsUsed } = interpolateRequest(original, sampleVariables);
    expect(interpolatedPayload.url).toBe('https://jsonplaceholder.typicode.com/search');
    expect(interpolatedPayload.queryParams?.id).toBe('42');
    expect(interpolatedPayload.queryParams?.author).toBe('Sung Jin-Woo');
    expect(interpolatedPayload.headers?.Authorization).toBe('Bearer hunter_s_rank_token_secret');
    expect(interpolatedPayload.headers?.['X-Client']).toBe('API-Forge');
    expect(secretVarsUsed).toContain('AUTH_TOKEN');
  });

  it('9. debe interpolar variables en cuerpos JSON sin romper la estructura', () => {
    const original: ExecuteRequestPayload = {
      url: 'https://api.example.com/items',
      method: 'POST',
      body: {
        title: 'Reporte para {{AUTHOR_NAME}}',
        postId: '{{POST_ID}}',
        nested: {
          secretToken: '{{AUTH_TOKEN}}',
        },
      },
    };

    const { interpolatedPayload, secretVarsUsed } = interpolateRequest(original, sampleVariables);
    const body = interpolatedPayload.body as Record<string, unknown>;
    expect(body.title).toBe('Reporte para Sung Jin-Woo');
    expect(body.postId).toBe('42');
    expect((body.nested as Record<string, unknown>).secretToken).toBe('hunter_s_rank_token_secret');
    expect(secretVarsUsed).toContain('AUTH_TOKEN');
  });

  it('10. debe arrojar VariableInterpolationError cuando una variable no existe en el entorno activo', () => {
    const original: ExecuteRequestPayload = {
      url: '{{UNDEFINED_HOST}}/resource/1',
      method: 'GET',
    };

    expect(() => interpolateRequest(original, sampleVariables)).toThrow(VariableInterpolationError);
    expect(() => interpolateRequest(original, sampleVariables)).toThrow(/UNDEFINED_HOST/);
  });

  it('11. no debe alterar la plantilla original al cambiar de entorno', () => {
    const templatePayload: ExecuteRequestPayload = {
      url: '{{BASE_URL}}/posts/{{POST_ID}}',
      method: 'GET',
      headers: {
        Authorization: 'Bearer {{AUTH_TOKEN}}',
      },
    };

    const devVars: EnvironmentVariable[] = [
      { id: '1', name: 'BASE_URL', value: 'https://dev.api.com', isSecret: false },
      { id: '2', name: 'POST_ID', value: '1', isSecret: false },
      { id: '3', name: 'AUTH_TOKEN', value: 'dev_token', isSecret: true },
    ];

    const prodVars: EnvironmentVariable[] = [
      { id: '1', name: 'BASE_URL', value: 'https://prod.api.com', isSecret: false },
      { id: '2', name: 'POST_ID', value: '99', isSecret: false },
      { id: '3', name: 'AUTH_TOKEN', value: 'prod_token', isSecret: true },
    ];

    const resDev = interpolateRequest(templatePayload, devVars);
    const resProd = interpolateRequest(templatePayload, prodVars);

    expect(resDev.interpolatedPayload.url).toBe('https://dev.api.com/posts/1');
    expect(resDev.interpolatedPayload.headers?.Authorization).toBe('Bearer dev_token');

    expect(resProd.interpolatedPayload.url).toBe('https://prod.api.com/posts/99');
    expect(resProd.interpolatedPayload.headers?.Authorization).toBe('Bearer prod_token');

    // Plantilla sigue intacta
    expect(templatePayload.url).toBe('{{BASE_URL}}/posts/{{POST_ID}}');
    expect(templatePayload.headers?.Authorization).toBe('Bearer {{AUTH_TOKEN}}');
  });
});
