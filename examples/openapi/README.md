# Todo CRUD OpenAPI example

[todo-crud.yaml](todo-crud.yaml) is the single documented specification example. Its generated [todo-crud.http](todo-crud.http) includes the five Todo operations and public health check. It describes:

- OpenID Connect client-credentials authentication for Todo list/create/read/update/delete.
- Explicit links from the create response to read/update/delete, carrying the returned ID.
- Request/response examples, descriptions, tags, schemas, and an empty delete response.
- Public `GET /health`, usable for Kubernetes liveness and readiness probes.

The default server is local WireMock at `http://localhost:8089`. It is a test stub, **not** a production API or identity provider. No Kubernetes cluster is needed.

## Start the local example server

From the repository root, with the supported Node.js version, installed dependencies, Docker, and Docker Compose:

```shell
npm run build
docker compose -f end-to-end/compose.yaml up --detach --wait --wait-timeout 120
```

Discovery must be reachable **before generation** when selecting authenticated operations. The generator reads the OpenID discovery document; it does not request a token. Health-only generation does not use discovery.

## Generate Todo CRUD requests

Select the collection and its descendants:

```shell
node bin/httpyac.js openapi examples/openapi/todo-crud.yaml --path "/api/todos,/api/todos/*" --output todo.http --auth todo --auth-flow todo=client_credentials
```

To regenerate the complete checked-in example, including public health:

```shell
node bin/httpyac.js openapi examples/openapi/todo-crud.yaml --path "GET /api/todos,POST /api/todos,GET /api/todos/{id},PATCH /api/todos/{id},DELETE /api/todos/{id},GET /health" --auth todo --auth-flow todo=client_credentials --force
```

Bare paths are exact. `/api/todos/*` excludes `/api/todos`; `/api/todos*` would include similarly named paths too. To explicitly order an end-to-end workflow:

```shell
node bin/httpyac.js openapi examples/openapi/todo-crud.yaml --path "POST /api/todos,GET /api/todos/{id},PATCH /api/todos/{id},DELETE /api/todos/{id}" --output todo.http --force
```

The specification's ID example is deliberately different from the server's ID. Simple explicit links use named-response references such as `{{oas_createTodo.id}}` with `# @ref oas_createTodo`. Links, not guessed relationships or hand-entered IDs, supply the correct value. Missing linked fields remain unresolved and can make the target request fail; they do not silently fall back to the example ID. Inspect the output before running it: requests include mutations and deletion.

By default, output is `todo-crud.http` beside the specification. `--output` changes its location. Existing output requires `--force`; source/reference files cannot be overwritten. Scalar parameter variables use JSON `{"value": ...}` to preserve types and empty values. Complex parameters use pre-serialized editable values with warnings; edit their serialization manually.

The header identifies the generating package, for example `Created by HttpYacZW (6.18.1)`. By default, assertions use only native syntax such as `?? status == 200` and `?? body title isString`. Add `--detailed-asserts` to the regeneration command to include structural and conditional `?? js` checks without an equivalent native assertion. This adds checks for object shape, own-property presence, integer/finite-number values, array items, and nullable/alternative schemas; the native assertions remain. See [CLI assertion output examples](../../docs/wiki/Installation-CLI.md#assertion-output-examples) for both modes. Request generation emits no standalone script blocks or embedded serialization functions; short inline expressions handle straightforward encoding and JSON body substitution.

## Authenticate and execute

The generated file expects `OAS_TODO_CLIENT_ID` and `OAS_TODO_CLIENT_SECRET`. For **this local stub only**, the public test credentials are `httpyac-todo-client` and `httpyac-todo-secret`.

PowerShell:

```powershell
$env:OAS_TODO_CLIENT_ID = 'httpyac-todo-client'
$env:OAS_TODO_CLIENT_SECRET = 'httpyac-todo-secret'
node bin/httpyac.js send todo.http --all --bail
```

Bash:

```shell
export OAS_TODO_CLIENT_ID=httpyac-todo-client
export OAS_TODO_CLIENT_SECRET=httpyac-todo-secret
node bin/httpyac.js send todo.http --all --bail
```

The native `Authorization: openid client_credentials ...` helper obtains and sends a token. The stub checks client credentials, grant type, scopes, bearer token, request bodies, and workflow order. It is not a full OpenID provider and does not implement JWT verification or browser login.

The WireMock workflow is stateful. Before repeating the workflow, reset only its scenario:

```powershell
Invoke-RestMethod -Method Put -Uri http://localhost:8089/__admin/scenarios/OpenApiTodoWorkflow/state -ContentType application/json -Body '{"state":"Started"}'
```

For a real API, edit the specification's server URL and `openIdConnectUrl` before generation and use that provider's credentials. Never put real secrets into the YAML or generated file. A generated server variable can be overridden when executing, for example `--var baseUrl=https://api.example.test`; this does not change the identity-provider configuration.

## Public Kubernetes health endpoint

Generate and execute just the health endpoint, without credentials:

```shell
node bin/httpyac.js openapi examples/openapi/todo-crud.yaml --path "GET /health" --output health.http
node bin/httpyac.js send health.http --all --bail
```

The endpoint overrides inherited security with `security: []`. It documents `200` for healthy and `503` for unhealthy; generated assertions expect a healthy response.

Example Kubernetes container probe settings for an application exposing the endpoint on its **own port 8080** (not WireMock's host port 8089):

```yaml
ports:
  - name: http
    containerPort: 8080
livenessProbe:
  httpGet:
    path: /health
    port: http
readinessProbe:
  httpGet:
    path: /health
    port: http
```

Adapt the port to your application. Both probes share this endpoint, so an unhealthy response affects readiness and can cause liveness restarts; avoid making liveness depend on transient downstream outages. This example documents the HTTP contract, not a Kubernetes deployment.

## Automated coverage and cleanup

```shell
npm run test:e2e:all
docker compose -f end-to-end/compose.yaml down --volumes
```

The OpenAPI E2E runner generates files in its own temporary directory, executes protected CRUD and public health, checks discovery/token use and returned-ID chaining, verifies that a bad response fails generated assertions, and removes its temporary files. See [the E2E guide](../../end-to-end/README.md).

## Generation boundaries

Use trusted specifications: references can read local files and access remote or private-network HTTP(S) URLs. Remote references and discovery have bounded requests; generation never obtains credentials or sends API operations.

Status, media-type, and supported response structure/type checks are generated, not literal comparisons with changing example values. Native-only generation omits checks that require JavaScript; enable `--detailed-asserts` for fuller supported validation. Only matching top-level response fields bind scalar request parameters directly. Complex, mismatched, or ambiguous links warn and retain the target's editable OpenAPI value; an example value is not linked and may fail or address a different resource. Simple whole-body or top-level JSON body links use inline JSON serialization; unsupported body links retain the request example with a warning. Advanced schema/serialization/link limitations are reported explicitly; this is not a complete JSON Schema validator. Workflow selectors never invent operations or infer relationships absent from OpenAPI links. See [CLI usage](../../docs/wiki/Installation-CLI.md#httpyac-openapi).
