import { send } from '../../httpYacApi';
import { initFileProvider, initHttpClientProvider, parseHttp } from '../../test/testUtils';
import { JsonObject, OpenApi } from './document';
import { generateHttp } from './generate';

function fixture(operation: JsonObject): OpenApi {
  return {
    root: { info: { title: 'Test', version: '1' }, servers: [{ url: 'http://example.test' }] },
    files: [],
    resolveReference: () => undefined,
    operations: [{ name: 'test', path: '/test', method: 'post', item: {}, operation }],
  };
}

describe('OpenAPI generation regressions', () => {
  beforeEach(() => initFileProvider());
  afterEach(() => jest.restoreAllMocks());

  it('allocates distinct names even when normalized names and suffixes collide', async () => {
    const api = fixture({
      parameters: [
        { name: 'a-b', in: 'query', example: 'first' },
        { name: 'a_b', in: 'query', example: 'second' },
        { name: 'a_b_2', in: 'query', example: 'third' },
        { name: 'a-b_file', in: 'query', example: 'parameter' },
      ],
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: { properties: { query_a_b: { type: 'string', format: 'binary' } } },
            example: { query_a_b: '' },
          },
        },
      },
      responses: { '204': { description: 'OK' } },
    });
    api.root.servers = [
      {
        url: 'http://{a-b}.{a_b}.{a_b_2}',
        variables: { 'a-b': { default: 'one' }, a_b: { default: 'two' }, a_b_2: { default: 'three' } },
      },
    ];
    const { content } = await generateHttp(api, api.operations);
    const declarations = [...content.matchAll(/^@(\w+) = (.*)$/gmu)].map(match => [match[1], match[2]]);
    expect(new Set(declarations.map(([name]) => name)).size).toBe(declarations.length);
    expect(content).toContain('@oas_server1_a_b = one');
    expect(content).toContain('@oas_server1_a_b_2 = two');
    expect(content).toContain('@oas_server1_a_b_2_2 = three');
    expect(content).toContain('@oas_test_query_a_b = {"value":"first"}');
    expect(content).toContain('@oas_test_query_a_b_2 = {"value":"second"}');
    expect(content).toContain('@oas_test_query_a_b_2_2 = {"value":"third"}');
    expect(content).toContain('@oas_test_query_a_b_file = {"value":"parameter"}');
    expect(content).toContain('@oas_test_query_a_b_file_2 = ./query_a_b.bin');
    expect(content).toContain('< {{oas_test_query_a_b_file_2}}');
  });

  it('renders arrays as separate multipart parts using the item schema and encoding', async () => {
    const api = fixture({
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                files: { type: 'array', items: { type: 'string', format: 'binary' } },
                tags: { type: 'array', items: { type: 'string' } },
                objects: { type: 'array', items: { type: 'object' } },
                colors: { type: 'array', items: { type: 'string' } },
              },
            },
            example: { files: ['', ''], tags: ['one', 'two'], objects: [{ id: 1 }], colors: ['red', 'dark blue'] },
            encoding: {
              files: { contentType: 'image/png' },
              tags: { explode: false },
              colors: { style: 'pipeDelimited' },
              objects: { explode: false },
            },
          },
        },
      },
      responses: { '204': { description: 'OK' } },
    });
    const { content, warnings } = await generateHttp(api, api.operations);
    expect(content.match(/name="files"; filename="files\.bin"/gu)).toHaveLength(2);
    expect(content.match(/Content-Type: image\/png/gu)).toHaveLength(2);
    expect(content).toContain('< {{oas_test_files_file}}');
    expect(content).toContain('< {{oas_test_files_file_2}}');
    expect(content.match(/name="tags"/gu)).toHaveLength(1);
    expect(content).toContain('name="tags"\n\none,two');
    expect(content).toContain('name="colors"\n\nred|dark%20blue');
    expect(content).toContain('name="objects"\nContent-Type: application/json\n\n{"id":1}');
    expect(warnings).toContain('Multipart encoding for objects cannot be fully serialized; review its parts manually');
  });

  it('reserves authentication and response names before allocating parameter variables', async () => {
    const api = fixture({
      parameters: [{ name: 'apiKey', in: 'query', example: 'not-a-credential' }],
      security: [{ foo_query: [] }],
      responses: { '204': { description: 'OK' } },
    });
    api.operations[0].name = 'auth_foo';
    api.operations.push({
      name: 'oas_auth_foo_query_apiKey_2',
      path: '/other',
      method: 'get',
      item: {},
      operation: { responses: { '204': { description: 'OK' } } },
    });
    api.root.components = { securitySchemes: { foo_query: { type: 'apiKey', name: 'X-Key', in: 'header' } } };
    const { content } = await generateHttp(api, api.operations);
    expect(content).toContain('@oas_auth_foo_query_apiKey = {{$processEnv OAS_FOO_QUERY_API_KEY}}');
    expect(content).toContain('@oas_auth_foo_query_apiKey_3 = {"value":"not-a-credential"}');
    expect(content).toContain('apiKey={{encodeURIComponent(JSON.parse(oas_auth_foo_query_apiKey_3).value)}}');
  });

  it('warns when multipart binary arrays cannot use non-exploded serialization', async () => {
    const api = fixture({
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: { properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } } },
            example: { files: ['', ''] },
            encoding: { files: { style: 'form', explode: false } },
          },
        },
      },
      responses: { '204': { description: 'OK' } },
    });
    const { content, warnings } = await generateHttp(api, api.operations);
    expect(content.match(/name="files"; filename="files\.bin"/gu)).toHaveLength(2);
    expect(warnings).toContain('Multipart encoding for files cannot be fully serialized; review its parts manually');
  });

  it('accepts boolean parameter schemas and keeps editable values usable', async () => {
    const api = fixture({
      parameters: [
        { name: 'enabled', in: 'query', schema: true, example: false },
        { name: 'blocked', in: 'query', schema: false, example: 'editable' },
      ],
      responses: { '204': { description: 'OK' } },
    });
    const { content, warnings } = await generateHttp(api, api.operations);
    expect(warnings).toContain('Parameter blocked on test has a false schema; no value is valid');
    const requests = initHttpClientProvider(async () => ({ statusCode: 204, body: '' }));
    await send({ httpFile: await parseHttp(content) });
    expect(requests[0].url).toBe('http://example.test/test?enabled=false&blocked=editable');
  });
});
