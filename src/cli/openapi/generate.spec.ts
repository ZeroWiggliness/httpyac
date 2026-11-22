import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { send } from '../../httpYacApi';
import { TestResultStatus } from '../../models';
import { initFileProvider, initHttpClientProvider, parseHttp } from '../../test/testUtils';
import { JsonObject, loadOpenApi, object, OpenApi, selectOperations } from './document';
import { generateHttp } from './generate';
import { writeOpenApi } from './index';
import { getPackageVersion } from '../version';

function fixture(operation: JsonObject): OpenApi {
  return {
    root: { info: { title: 'Test', version: '1' }, servers: [{ url: 'http://example.test' }] },
    files: [],
    resolveReference: () => undefined,
    operations: [{ name: 'test', path: '/test', method: 'get', item: {}, operation }],
  };
}

describe('OpenAPI generation integration', () => {
  beforeEach(() => initFileProvider());
  afterEach(() => jest.restoreAllMocks());

  it.each([undefined, false, true])('makes detailed JavaScript assertions opt-in: %s', async detailedAsserts => {
    const api = fixture({
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'id'],
                properties: { title: { type: 'string' }, id: { type: 'integer' } },
              },
            },
          },
        },
      },
    });
    const generated = await generateHttp(api, api.operations, { detailedAsserts });
    expect(generated.content).toContain('?? status == 200');
    expect(generated.content).toContain('?? header content-type matches');
    expect(generated.content).toContain('?? body title isString');
    expect(/^\?\? js /mu.test(generated.content)).toBe(detailedAsserts === true);
    initHttpClientProvider(async () => ({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      parsedBody: { title: '', id: 'not an integer' },
    }));
    const file = await parseHttp(generated.content);
    await send({ httpFile: file });
    expect(
      file.httpRegions
        .flatMap(region => region.testResults || [])
        .every(result => result.status === TestResultStatus.SUCCESS)
    ).toBe(detailedAsserts !== true);
  });

  it('executes a generated Todo workflow with a returned ID rather than the example ID', async () => {
    const api = await loadOpenApi(join(process.cwd(), 'examples', 'openapi', 'todo-crud.yaml'));
    api.root.security = [];
    const generated = await generateHttp(
      api,
      selectOperations(api, 'POST /api/todos,GET /api/todos/{id},PATCH /api/todos/{id},DELETE /api/todos/{id}')
    );
    expect(generated.content.split('\n')[0]).toBe(
      `# Generated from Todo CRUD API (1.0.0). Created by HttpYacZW (${await getPackageVersion()})`
    );
    expect(generated.content).toContain('?? status == 201');
    expect(generated.content).toContain('?? body title isString');
    expect(generated.content).toContain('?? body completed isBoolean');
    expect(generated.content.match(/\{\{oas_createTodo\.id\}\}/gu)).toHaveLength(3);
    expect(generated.content).not.toMatch(/^\{\{\s*$/mu);
    expect(generated.content).not.toContain('exports.');
    const requests = initHttpClientProvider(async request => {
      let statusCode = 200;
      if (request.method === 'POST') {
        statusCode = 201;
      } else if (request.method === 'DELETE') {
        statusCode = 204;
      }
      return {
        statusCode,
        headers: request.method === 'DELETE' ? {} : { 'content-type': 'application/json' },
        parsedBody:
          request.method === 'DELETE' ? undefined : { id: 91, title: 'Different from example', completed: false },
        body: request.method === 'DELETE' ? '' : undefined,
      };
    });
    const httpFile = await parseHttp(generated.content);
    await send({ httpFile });
    expect(
      httpFile.httpRegions
        .flatMap(region => region.testResults || [])
        .filter(result => result.status === TestResultStatus.ERROR)
    ).toEqual([]);
    expect(requests.map(request => request.url)).toEqual([
      'http://localhost:8089/api/todos',
      'http://localhost:8089/api/todos/91',
      'http://localhost:8089/api/todos/91',
      'http://localhost:8089/api/todos/91',
    ]);
    const regions = httpFile.httpRegions.filter(region => region.request);
    expect(regions).toHaveLength(4);
    expect(
      regions.every(
        region =>
          region.testResults?.length && region.testResults.every(test => test.status === TestResultStatus.SUCCESS)
      )
    ).toBe(true);
    expect(regions[0].metaData.description).toContain('Response links');
    expect(JSON.parse(String(requests[2].body))).toEqual({ title: 'Verify generated workflow', completed: true });
  });

  it.each([
    [{ id: 7, title: 'different' }, 200, 'application/json', true],
    [{ id: 0, title: '', note: null }, 201, 'application/json; charset=utf-8', true],
    [{ id: 7 }, 200, 'application/json', false],
    [{ id: '7', title: 'title' }, 200, 'application/json', false],
    [{ id: 7, title: 'title', note: 1 }, 200, 'application/json', false],
    [{ id: 7, title: 'title' }, 500, 'application/json', false],
    [{ id: 7, title: 'title' }, 200, 'text/plain', false],
  ])(
    'checks statuses/content/required and optional nullable fields: %j %s %s',
    async (body, status, contentType, passes) => {
      const response = {
        description: 'OK',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['id', 'title'],
              properties: {
                id: { type: 'integer' },
                title: { type: 'string' },
                note: { type: ['string', 'null'] },
              },
            },
          },
        },
      };
      const api = fixture({ responses: { '200': response, '201': response } });
      const generated = await generateHttp(api, api.operations, { detailedAsserts: true });
      initHttpClientProvider(async () => ({
        statusCode: status,
        headers: { 'content-type': contentType },
        parsedBody: body,
      }));
      const httpFile = await parseHttp(generated.content);
      await send({ httpFile });
      const results = httpFile.httpRegions.flatMap(region => region.testResults || []);
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(result => result.status === TestResultStatus.SUCCESS)).toBe(passes);
    }
  );

  it('serializes path/query/header/cookie parameters while preserving false, zero and empty examples', async () => {
    const api = fixture({
      parameters: [
        { name: 'id', in: 'path', required: true, example: 0 },
        { name: 'q', in: 'query', example: '' },
        { name: 'enabled', in: 'query', example: false },
        { name: 'tag', in: 'query', schema: { type: 'array' }, example: ['one two', 'three'] },
        { name: 'filter', in: 'query', style: 'deepObject', example: { role: 'reader' } },
        { name: 'X-Test', in: 'header', example: 'one two' },
        { name: 'session', in: 'cookie', example: 'test' },
      ],
      responses: { '204': { description: 'OK' } },
    });
    api.operations[0].path = '/test/{id}';
    const generated = await generateHttp(api, api.operations);
    const requests = initHttpClientProvider(async () => ({ statusCode: 204, body: '' }));
    const httpFile = await parseHttp(generated.content);
    await send({ httpFile });
    expect(
      httpFile.httpRegions
        .flatMap(region => region.testResults || [])
        .filter(result => result.status === TestResultStatus.ERROR)
    ).toEqual([]);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(
      'http://example.test/test/0?q=&enabled=false&tag=one%20two&tag=three&filter[role]=reader'
    );
    expect(requests[0].headers?.['X-Test']).toBe('one two');
    expect(requests[0].headers?.Cookie).toBe('session=test');
  });

  it('renders form, multipart, XML and binary bodies with native syntax', async () => {
    for (const [kind, schema, example, expected] of [
      [
        'application/x-www-form-urlencoded',
        { type: 'object' },
        { title: 'a b', completed: false },
        'title=a%20b\n&completed=false',
      ],
      [
        'multipart/form-data',
        { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
        { title: 'hello', file: '' },
        'Content-Disposition: form-data; name="file"; filename="file.bin"',
      ],
      [
        'application/xml',
        { type: 'string' },
        '<todo><title>Example</title></todo>',
        '<todo><title>Example</title></todo>',
      ],
      ['application/octet-stream', { type: 'string', format: 'binary' }, undefined, '< {{test_bodyFile}}'],
    ]) {
      const api = fixture({
        requestBody: { content: { [String(kind)]: { schema, ...(example === undefined ? {} : { example }) } } },
        responses: { '204': { description: 'OK' } },
      });
      api.operations[0].method = 'post';
      const generated = await generateHttp(api, api.operations);
      expect(generated.content).toContain(expected);
      const parsed = await parseHttp(generated.content);
      expect(parsed.httpRegions.filter(region => region.request)).toHaveLength(1);
    }
  });

  it('does not turn multiline metadata into extra request regions', async () => {
    const api = fixture({
      summary: 'Title\n### Injected\nGET http://bad.test',
      description: 'Description\n# @disabled\n{{\nthrow new Error("bad")\n}}',
      responses: { '204': { description: 'OK' } },
    });
    const generated = await generateHttp(api, api.operations);
    const parsed = await parseHttp(generated.content);
    const requests = parsed.httpRegions.filter(region => region.request);
    expect(requests).toHaveLength(1);
    expect(requests[0].metaData.disabled).toBeUndefined();
  });

  it('uses operation parameter overrides and omits response-body checks for HEAD', async () => {
    const api = fixture({
      parameters: [{ name: 'q', in: 'query', example: 'operation' }],
      responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } } },
    });
    api.operations[0].item.parameters = [{ name: 'q', in: 'query', example: 'path' }];
    api.operations[0].method = 'head';
    const generated = await generateHttp(api, api.operations);
    expect(generated.content).not.toContain('response.parsedBody');
    const requests = initHttpClientProvider(async () => ({ statusCode: 200, body: '' }));
    const httpFile = await parseHttp(generated.content);
    await send({ httpFile });
    expect(
      httpFile.httpRegions
        .flatMap(region => region.testResults || [])
        .filter(result => result.status === TestResultStatus.ERROR)
    ).toEqual([]);
    expect(requests[0].url).toBe('http://example.test/test?q=operation');
  });

  it('honors operation server variables and an execution-time baseUrl override', async () => {
    const api = fixture({
      responses: { '204': { description: 'OK' } },
      servers: [
        {
          url: 'https://{region}.example.test/v1',
          variables: { region: { default: 'eu' } },
        },
      ],
    });
    const generated = await generateHttp(api, [api.operations[0], { ...api.operations[0], name: 'second' }]);
    expect(generated.content).not.toContain('@baseUrl2');
    const requests = initHttpClientProvider(async () => ({ statusCode: 204, body: '' }));
    await send({ httpFile: await parseHttp(generated.content) });
    expect(requests[0].url).toBe('https://eu.example.test/v1/test');
    requests.length = 0;
    await send({ httpFile: await parseHttp(generated.content), variables: { baseUrl: 'https://override.example' } });
    expect(requests[0].url).toBe('https://override.example/test');
  });

  it('warns and uses editable examples for complex links instead of generating extraction scripts', async () => {
    const api = fixture({
      responses: {
        '201': {
          description: 'OK',
          links: {
            next: {
              operationRef: '#/paths/~1target/post',
              parameters: { id: '$response.body#/a~1b/~0id' },
              requestBody: '$response.body#/payload',
            },
          },
        },
      },
    });
    const source = api.operations[0];
    source.name = 'oas_source';
    source.method = 'post';
    const target = {
      name: 'next',
      path: '/target/{id}',
      method: 'post',
      item: {},
      operation: {
        parameters: [{ name: 'id', in: 'path', required: true, example: 1 }],
        requestBody: { content: { 'application/json': { example: { title: 'default' } } } },
        responses: { '204': { description: 'OK' } },
      },
    };
    api.operations.push(target);
    api.resolveReference = () => target.operation;
    const requests = initHttpClientProvider(async request =>
      request.url?.endsWith('/test')
        ? { statusCode: 201, parsedBody: { 'a/b': { '~id': 0 }, payload: { title: 'linked' } } }
        : { statusCode: 204, body: '' }
    );
    const generated = await generateHttp(api, api.operations);
    const httpFile = await parseHttp(generated.content);
    await send({ httpFile });
    expect(generated.warnings.join(' ')).toContain('editable OpenAPI value');
    expect(generated.content).not.toMatch(/^\{\{\s*$/mu);
    expect(requests.map(request => request.url)).toEqual(['http://example.test/test', 'http://example.test/target/1']);
    expect(JSON.parse(String(requests[1].body))).toEqual({ title: 'linked' });
  });

  it.each([0, 91])('uses direct operationRef links with a returned ID of %s', async id => {
    const api = fixture({
      responses: {
        '201': {
          description: 'Created',
          links: { next: { operationRef: '#/target', parameters: { id: '$response.body#/id' } } },
        },
      },
    });
    api.operations[0].name = 'oas_source';
    const target = {
      name: 'next',
      path: '/target/{id}',
      method: 'get',
      item: {},
      operation: {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 1 }],
        responses: { '204': { description: 'OK' } },
      },
    };
    api.operations.push(target);
    api.resolveReference = () => target.operation;
    const generated = await generateHttp(api, api.operations);
    const requests = initHttpClientProvider(async request =>
      request.url?.endsWith('/test') ? { statusCode: 201, parsedBody: { id } } : { statusCode: 204, body: '' }
    );
    await send({ httpFile: await parseHttp(generated.content) });
    expect(generated.content).toContain('/target/{{oas_source.id}}');
    expect(generated.content).not.toMatch(/^\{\{\s*$/mu);
    expect(requests[1].url).toBe(`http://example.test/target/${id}`);
  });

  it('encodes linked string IDs inline and warns about mismatched response fields', async () => {
    const api = fixture({
      operationId: 'source',
      responses: {
        '200': {
          description: 'OK',
          links: { next: { operationId: 'target', parameters: { id: '$response.body#/other' } } },
        },
      },
    });
    api.operations[0].name = 'oas_source';
    const target = {
      name: 'next',
      path: '/target/{id}',
      method: 'get',
      item: {},
      operation: {
        operationId: 'target',
        parameters: [{ name: 'id', in: 'path', schema: { type: 'string' }, example: 'a b' }],
        responses: { '204': { description: 'OK' } },
      },
    };
    api.operations.push(target);
    const fallback = await generateHttp(api, api.operations);
    expect(fallback.warnings.join(' ')).toContain('editable OpenAPI value');
    object(object(object(api.operations[0].operation.responses, 'responses')['200'], 'response').links, 'links').next =
      {
        operationId: 'target',
        parameters: { id: '$response.body#/id' },
      };
    const generated = await generateHttp(api, api.operations);
    const requests = initHttpClientProvider(async request =>
      request.url?.endsWith('/test') ? { statusCode: 200, parsedBody: { id: 'a/b ?' } } : { statusCode: 204, body: '' }
    );
    await send({ httpFile: await parseHttp(generated.content) });
    expect(generated.content).toContain('encodeURIComponent(oas_source.id.toString())');
    expect(requests[1].url).toBe('http://example.test/target/a%2Fb%20%3F');
  });

  it('does not replace a missing linked response field with the example ID', async () => {
    const api = await loadOpenApi(join(process.cwd(), 'examples', 'openapi', 'todo-crud.yaml'));
    api.root.security = [];
    const selected = selectOperations(api, 'POST /api/todos,GET /api/todos/{id}');
    const created = object(object(selected[0].operation.responses, 'responses')['201'], 'response');
    delete object(object(created.content, 'content')['application/json'], 'media').schema;
    const generated = await generateHttp(api, selected);
    const requests = initHttpClientProvider(async request => ({
      statusCode: request.url?.endsWith('/api/todos') ? 201 : 404,
      headers: { 'content-type': 'application/json' },
      parsedBody: { title: 'missing ID', completed: false },
    }));
    const file = await parseHttp(generated.content);
    await send({ httpFile: file });
    expect(requests.some(request => request.url?.endsWith('/api/todos/1'))).toBe(false);
    expect(requests).toHaveLength(2);
    expect(requests[1].url).toContain('{{oas_createTodo.id}}');
    expect(file.httpRegions[0].testResults?.every(result => result.status === TestResultStatus.SUCCESS)).toBe(true);
    expect(
      file.httpRegions
        .flatMap(region => region.testResults || [])
        .some(result => result.status !== TestResultStatus.SUCCESS)
    ).toBe(true);
  });

  it('uses native MIME matching without accepting an unrelated type', async () => {
    const api = fixture({
      responses: { '200': { description: 'OK', content: { 'application/json': {} } } },
    });

    const generated = await generateHttp(api, api.operations);
    expect(generated.content).toContain('?? header content-type matches ');
    expect(generated.content).not.toContain('?? js');
    for (const [contentType, passes] of [
      ['Application/JSON; charset=utf-8', true],
      ['application/json-other', false],
    ] as const) {
      initHttpClientProvider(async () => ({ statusCode: 200, headers: { 'content-type': contentType } }));
      const file = await parseHttp(generated.content);
      await send({ httpFile: file });
      expect(
        file.httpRegions
          .flatMap(region => region.testResults || [])
          .every(result => result.status === TestResultStatus.SUCCESS)
      ).toBe(passes);
    }
  });

  it('encodes authentication query values without request scripts', async () => {
    const api = fixture({ responses: { '204': { description: 'OK' } } });
    api.root.security = [{ key: [] }];
    api.root.components = { securitySchemes: { key: { type: 'apiKey', in: 'query', name: 'api key' } } };
    jest.replaceProperty(process, 'env', { ...process.env, OAS_KEY_API_KEY: 'a/b ?' });
    const generated = await generateHttp(api, api.operations);
    const requests = initHttpClientProvider(async () => ({ statusCode: 204, body: '' }));
    await send({
      httpFile: await parseHttp(generated.content),
    });
    expect(generated.content).not.toMatch(/^\{\{\s*$/mu);
    expect(requests[0].url).toBe('http://example.test/test?api%20key=a%2Fb%20%3F');
  });

  it.each([
    [{ type: ['object', 'string'], properties: { id: { type: 'string' } }, required: ['id'] }, 'valid string'],
    [{ type: 'object', nullable: true, properties: { id: { type: 'string' } }, required: ['id'] }, null],
  ])('keeps conditional fields out of unconditional native assertions', async (schema, body) => {
    const api = fixture({
      responses: { '200': { description: 'OK', content: { 'application/json': { schema } } } },
    });
    const generated = await generateHttp(api, api.operations, { detailedAsserts: true });
    expect(generated.content).not.toContain('?? body id isString');
    initHttpClientProvider(async () => ({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      parsedBody: body,
    }));
    const file = await parseHttp(generated.content);
    await send({ httpFile: file });
    expect(
      file.httpRegions
        .flatMap(region => region.testResults || [])
        .every(result => result.status === TestResultStatus.SUCCESS)
    ).toBe(true);
  });

  it.each([
    [{ nested: { title: '' }, items: [{ id: 0 }] }, true],
    [{ nested: {}, items: [{ id: 0 }] }, false],
    [{ nested: null, items: [{ id: 0 }] }, false],
    [{ items: [{ id: 0 }] }, false],
    [{ nested: { title: '' }, items: [{}] }, false],
    [{ nested: { title: '' }, items: 'invalid' }, false],
  ])('validates required nested fields and array items without redundant guards', async (body, passes) => {
    const api = fixture({
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nested', 'items'],
                properties: {
                  nested: { type: 'object', required: ['title'], properties: { title: { type: 'string' } } },
                  items: {
                    type: 'array',
                    items: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
                  },
                },
              },
            },
          },
        },
      },
    });
    const generated = await generateHttp(api, api.operations, { detailedAsserts: true });
    initHttpClientProvider(async () => ({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      parsedBody: body,
    }));
    const file = await parseHttp(generated.content);
    await send({ httpFile: file });
    expect(
      file.httpRegions
        .flatMap(region => region.testResults || [])
        .every(result => result.status === TestResultStatus.SUCCESS)
    ).toBe(passes);
  });

  it('warns rather than inventing bindings for conflicting, backward or unselected links', async () => {
    const api = fixture({
      operationId: 'source',
      responses: {
        '201': {
          description: 'OK',
          links: {
            first: { operationId: 'target', parameters: { id: '$response.body#/id' } },
            second: { operationId: 'target', parameters: { id: '$response.body#/other' } },
          },
        },
      },
    });
    const target = {
      name: 'next',
      method: 'get',
      path: '/target/{id}',
      item: {},
      operation: {
        operationId: 'target',
        parameters: [{ name: 'id', in: 'path', example: 1 }],
        responses: { '204': { description: 'OK' } },
      },
    };
    api.operations.push(target);
    expect((await generateHttp(api, api.operations)).warnings.join(' ')).toContain('Ambiguous link binding');
    expect((await generateHttp(api, [...api.operations].reverse())).warnings.join(' ')).toContain('backward/cyclic');
    expect((await generateHttp(api, [api.operations[0]])).warnings.join(' ')).toContain('outside the selection');
  });

  it('removes read-only example fields and supports empty success-range responses', async () => {
    const api = fixture({
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { id: { type: 'integer', readOnly: true }, title: { type: 'string' } },
            },
            example: { id: 73, title: 'editable' },
          },
        },
      },
      responses: { '2XX': { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } } },
    });
    api.operations[0].method = 'post';
    const requests = initHttpClientProvider(async () => ({ statusCode: 204, body: '' }));
    const generated = await generateHttp(api, api.operations);
    const httpFile = await parseHttp(generated.content);
    await send({ httpFile });
    expect(JSON.parse(String(requests[0].body))).toEqual({ title: 'editable' });
    expect(
      httpFile.httpRegions
        .flatMap(region => region.testResults || [])
        .every(result => result.status === TestResultStatus.SUCCESS)
    ).toBe(true);
  });
});

describe('OpenAPI output safety', () => {
  let directory: string;
  let files: string[];
  beforeEach(async () => {
    directory = await fs.mkdtemp(join(tmpdir(), 'httpyac-openapi-output-'));
    files = [];
  });
  afterEach(async () => {
    await Promise.all(files.map(file => fs.rm(file, { force: true })));
    await fs.rmdir(directory);
  });
  it('does not overwrite existing output or input, and leaves no output after failed selection', async () => {
    const input = join(directory, 'api.json');
    const output = join(directory, 'api.http');
    files.push(input, output);
    await fs.writeFile(
      input,
      JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Test', version: '1' },
        servers: [{ url: 'http://example.test' }],
        paths: { '/health': { get: { responses: { '204': { description: 'OK' } } } } },
      })
    );
    await expect(writeOpenApi(input, { path: '/missing' })).rejects.toThrow('No OpenAPI operations');
    await expect(fs.stat(output)).rejects.toMatchObject({ code: 'ENOENT' });
    await writeOpenApi(input, {});
    const content = await fs.readFile(output, 'utf8');
    await expect(writeOpenApi(input, {})).rejects.toThrow('--force');
    expect(await fs.readFile(output, 'utf8')).toBe(content);
    await expect(writeOpenApi(input, { output: input, force: true })).rejects.toThrow('must not overwrite');
    await writeOpenApi(input, { force: true });
    expect(await fs.readdir(directory)).toEqual(expect.arrayContaining(['api.json', 'api.http']));
    expect(await fs.readdir(directory)).toHaveLength(2);
  });

  it('protects a referenced input even through a hard link', async () => {
    const input = join(directory, 'api.json');
    const reference = join(directory, 'response.json');
    const output = join(directory, 'reference.http');
    files.push(input, reference, output);
    await fs.writeFile(reference, JSON.stringify({ description: 'OK' }));
    await fs.writeFile(
      input,
      JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Test', version: '1' },
        paths: { '/health': { get: { responses: { '204': { $ref: './response.json' } } } } },
      })
    );
    await fs.link(reference, output);
    await expect(writeOpenApi(input, { output, force: true })).rejects.toThrow('referenced file');
    expect(object(JSON.parse(await fs.readFile(reference, 'utf8')), 'response').description).toBe('OK');
  });
});
