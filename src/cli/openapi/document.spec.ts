import { promises as fs } from 'fs';
import { createServer, Server } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';

import { loadOpenApi, object, selectOperations } from './document';

describe('OpenAPI loading and selection', () => {
  let directory: string;
  let files: string[];
  beforeEach(async () => {
    directory = await fs.mkdtemp(join(tmpdir(), 'httpyac-openapi-unit-'));
    files = [];
  });
  afterEach(async () => {
    await Promise.all(files.map(file => fs.rm(file, { force: true })));
    await fs.rmdir(directory);
  });
  async function write(name: string, content: string) {
    const file = join(directory, name);
    files.push(file);
    await fs.writeFile(file, content);
    return file;
  }
  const root = { openapi: '3.1.0', info: { title: 'Test', version: '1' } };
  const operation = { responses: { '204': { description: 'OK' } } };

  it('preserves ordered exact/wildcard/method selectors and deliberate repeated operations', async () => {
    const api = await loadOpenApi(
      await write(
        'api.json',
        JSON.stringify({
          ...root,
          paths: {
            '/api/v2/calendars': { get: operation, post: operation },
            '/api/v2/calendars/{id}': { get: operation, delete: operation },
            '/api/v2/calendars-archive': { get: operation },
          },
        })
      )
    );
    expect(selectOperations(api, '/api/v2/calendars/*').map(value => value.path)).toEqual([
      '/api/v2/calendars/{id}',
      '/api/v2/calendars/{id}',
    ]);
    expect(selectOperations(api, '/api/v2/calendars*')).toHaveLength(5);
    const selected = selectOperations(
      api,
      'POST /api/v2/calendars,GET /api/v2/calendars/{id},GET /api/v2/calendars/{id}'
    );
    expect(selected.map(value => value.method)).toEqual(['post', 'get', 'get']);
    expect(new Set(selected.map(value => value.name)).size).toBe(3);
    expect(selectOperations(api, '/api/v2/calendars')).toHaveLength(2);
  });

  it('keeps regex commas, escaped slashes and character classes inside a selector', async () => {
    const api = await loadOpenApi(
      await write(
        'api.json',
        JSON.stringify({
          ...root,
          paths: { '/api/v22/items': { get: operation }, '/api/v3/items': { get: operation } },
        })
      )
    );
    expect(selectOperations(api, 'GET regex:/^\\/api\\/v[23]{1,2}[/]items$/u')).toHaveLength(2);
    for (const selector of ['regex:/x/g', 'regex:/[/u', '/missing', '/api/v3/items,', 'BOGUS /api/v3/items']) {
      expect(() => selectOperations(api, selector)).toThrow();
    }
  });

  it('loads YAML with local references and recursive schemas without losing object identity', async () => {
    await write('schemas.json', JSON.stringify({ Todo: { type: 'object', properties: { next: { $ref: '#/Todo' } } } }));
    const api = await loadOpenApi(
      await write(
        'api.yaml',
        `openapi: 3.0.3
info: {title: Test, version: '1'}
paths:
  /todos:
    get:
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: './schemas.json#/Todo'
`
      )
    );
    expect(api.files).toHaveLength(2);
    expect(api.operations).toHaveLength(1);
    const todo = object(api.resolveReference('./schemas.json#/Todo'), 'Todo');
    expect(object(todo.properties, 'Todo properties').next).toBe(todo);
  });

  it('resolves remote HTTP references and reports unavailable references', async () => {
    const server: Server = createServer((request, response) => {
      if (request.url === '/schema') {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ type: 'string' }));
      } else {
        response.writeHead(404).end();
      }
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Missing test server address');
      }
      const reference = `http://127.0.0.1:${address.port}/schema`;
      const file = await write(
        'remote.json',
        JSON.stringify({
          ...root,
          paths: {
            '/test': {
              get: {
                responses: {
                  '200': { description: 'OK', content: { 'application/json': { schema: { $ref: reference } } } },
                },
              },
            },
          },
        })
      );
      const api = await loadOpenApi(file);
      expect(object(api.resolveReference(reference), 'remote schema').type).toBe('string');
      const missing = await write(
        'missing.json',
        JSON.stringify({ ...root, paths: { '/test': { $ref: `${reference}-missing` } } })
      );
      await expect(loadOpenApi(missing)).rejects.toThrow();
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
    }
  });

  it('rejects Swagger and malformed operations', async () => {
    await expect(
      loadOpenApi(await write('swagger.json', JSON.stringify({ swagger: '2.0', info: root.info, paths: {} })))
    ).rejects.toThrow('OpenAPI 3.x');
    await expect(
      loadOpenApi(await write('bad.json', JSON.stringify({ ...root, paths: { '/x': { get: {} } } })))
    ).rejects.toThrow('responses');
  });
});
