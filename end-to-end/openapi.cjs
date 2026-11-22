const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const RefParser = require('@apidevtools/json-schema-ref-parser').default;

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'bin', 'httpyac.js');
const example = path.join(root, 'examples', 'openapi', 'todo-crud.yaml');
const baseUrl = 'http://localhost:8089';
const packageVersion = require('../package.json').version;

function run(args, env = {}, expected = 0) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 30000,
  });
  if (result.error) {
    throw result.error;
  }
  assert.equal(result.status, expected, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

async function admin(route, options) {
  const response = await fetch(`${baseUrl}/__admin/${route}`, {
    ...options,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    assert.fail(`WireMock ${route}: ${response.status} ${await response.text()}`);
  }
  return response;
}

async function count(request) {
  const response = await admin('requests/count', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return (await response.json()).count;
}

function summary(output, requests) {
  const result = JSON.parse(output);
  assert.equal(result.summary.totalRequests, requests);
  assert.equal(result.summary.successRequests, requests);
  assert.equal(result.summary.failedTests, 0);
  assert.equal(result.summary.erroredTests, 0);
  assert.ok(result.summary.totalTests >= requests);
  return result;
}

async function main() {
  await admin('health');
  await admin('scenarios/OpenApiTodoWorkflow/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: 'Started' }),
  });
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'httpyac-openapi-e2e-'));
  const workflow = path.join(directory, 'workflow.http');
  const health = path.join(directory, 'health.http');
  const json = path.join(directory, 'private-spec.json');
  const credentials = {
    OAS_TODO_CLIENT_ID: 'httpyac-todo-client',
    OAS_TODO_CLIENT_SECRET: 'httpyac-todo-secret',
  };
  try {
    const tokenBefore = await count({ method: 'POST', urlPath: '/todo-oidc/token' });
    const discoveryBefore = await count({ method: 'GET', urlPath: '/todo-oidc/.well-known/openid-configuration' });
    run([
      'openapi',
      example,
      '--path',
      'GET /api/todos,POST /api/todos,GET /api/todos/{id},PATCH /api/todos/{id},DELETE /api/todos/{id},GET /health',
      '--output',
      workflow,
    ]);
    assert.equal(
      await count({ method: 'POST', urlPath: '/todo-oidc/token' }),
      tokenBefore,
      'Generation must not obtain a token'
    );
    assert.equal(
      await count({ method: 'GET', urlPath: '/todo-oidc/.well-known/openid-configuration' }),
      discoveryBefore + 1
    );
    const content = await fs.readFile(workflow, 'utf8');
    assert.equal(
      content.split('\n')[0],
      `# Generated from Todo CRUD API (1.0.0). Created by HttpYacZW (${packageVersion})`
    );
    assert.doesNotMatch(content, /^\{\{\s*$/m);
    assert.doesNotMatch(content, /exports\.|function\s+\w+\(/);
    assert.match(content, /\?\? status == 201/);
    assert.match(content, /\?\? body title isString/);
    assert.doesNotMatch(content, /^\?\? js /m);
    assert.equal((content.match(/\{\{oas_createTodo\.id\}\}/g) || []).length, 3);
    assert.doesNotMatch(content.slice(content.indexOf('# @name oas_health')), /Authorization:/);
    assert.match(content, /# @description Create a todo/);
    assert.match(content, /Authorization: openid client_credentials/);
    assert.equal((content.match(/^# @ref /gm) || []).length, 3);
    run(['openapi', example, '--output', workflow], {}, 1);
    assert.equal(await fs.readFile(workflow, 'utf8'), content, 'Output is unchanged without --force');
    const result = summary(run(['send', workflow, '--all', '--bail', '--json', '--timeout', '10000'], credentials), 6);
    assert.deepEqual(
      result.requests.map(request => request.name),
      ['oas_listTodos', 'oas_createTodo', 'oas_getTodo', 'oas_updateTodo', 'oas_deleteTodo', 'oas_health']
    );
    assert.equal(await count({ method: 'POST', urlPath: '/todo-oidc/token' }), tokenBefore + 1);
    const journal = await (
      await admin('requests/find', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urlPathPattern: '/api/todos(?:/.*)?' }),
      })
    ).json();
    const todoRequests = journal.requests.sort((a, b) => a.loggedDate - b.loggedDate).slice(-5);
    assert.deepEqual(
      todoRequests.map(request => [request.method, request.url]),
      [
        ['GET', '/api/todos'],
        ['POST', '/api/todos'],
        ['GET', '/api/todos/73'],
        ['PATCH', '/api/todos/73'],
        ['DELETE', '/api/todos/73'],
      ]
    );
    assert.ok(todoRequests.every(request => request.headers.Authorization === 'Bearer httpyac-todo-test-token'));
    const tokensAfterWorkflow = await count({ method: 'POST', urlPath: '/todo-oidc/token' });
    const discoveryAfterWorkflow = await count({
      method: 'GET',
      urlPath: '/todo-oidc/.well-known/openid-configuration',
    });
    run(['openapi', example, '--path', 'GET /health', '--output', health]);
    assert.doesNotMatch(await fs.readFile(health, 'utf8'), /Authorization:|tokenEndpoint/);
    summary(
      run(['send', health, '--all', '--bail', '--json', '--timeout', '10000'], {
        OAS_TODO_CLIENT_ID: '',
        OAS_TODO_CLIENT_SECRET: '',
      }),
      1
    );
    assert.equal(await count({ method: 'POST', urlPath: '/todo-oidc/token' }), tokensAfterWorkflow);
    assert.equal(
      await count({ method: 'GET', urlPath: '/todo-oidc/.well-known/openid-configuration' }),
      discoveryAfterWorkflow
    );
    await fs.writeFile(json, JSON.stringify(await new RefParser().parse(example)));
    run(['openapi', json, '--path', 'GET /health', '--output', health, '--force', '--detailed-asserts']);
    assert.match(await fs.readFile(health, 'utf8'), /^\?\? js /m);
    summary(run(['send', health, '--all', '--bail', '--json', '--timeout', '10000']), 1);
    const failure = JSON.parse(
      run(['send', health, '--all', '--bail', '--json', '--var', `baseUrl=${baseUrl}/openapi-bad`], {}, 20)
    );
    assert.ok(failure.summary.failedTests > 0, 'Bad schema response must fail generated assertions');
    assert.equal(failure.summary.erroredTests, 0, 'Expected an assertion failure, not a scripting error');
    console.info('OpenAPI E2E passed: generation, OpenID Todo CRUD, public health, and assertion failure.');
  } finally {
    await fs.rm(workflow, { force: true });
    await fs.rm(health, { force: true });
    await fs.rm(json, { force: true });
    await fs.rmdir(directory);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
