# End-to-end tests

These tests exercise the locally built httpyac CLI against WireMock, without external services or real credentials. Requirements: the Node.js version declared in the root package, installed npm dependencies, Docker, and Docker Compose with `up --wait` support.

Run from the repository root:

```shell
npm run build
docker compose -f end-to-end/compose.yaml up --detach --wait --wait-timeout 120
npm run test:e2e:all
docker compose -f end-to-end/compose.yaml down --volumes
```

`npm run test:e2e:all` runs the existing request suite (`test:e2e`) and OpenAPI generation suite (`test:e2e:openapi`). Both invoke `bin/httpyac.js`, which loads `dist/index.js`; they do not download or use a globally installed httpyac. Build first after changing source code. Failed requests or assertions produce a nonzero exit code.

WireMock is available only on the local interface at `http://localhost:8089`. Compose waits for its admin health check before tests start. To inspect startup or matching failures:

```shell
docker compose -f end-to-end/compose.yaml logs --no-color
```

## Endpoints and assertions

| Endpoint | Coverage |
| --- | --- |
| `GET /health` | JSON response, status, content type |
| `GET /api/users?role=reader` | Query matching, array length, user fields |
| `POST /api/users` | JSON request matching, 201, Location header, response fields |
| `DELETE /api/users/43` | 204 and empty body |
| `GET /api/greeting` | Plain text body and content type |
| `GET /api/users/999` | Expected 404 and error body |
| `POST /oauth/token` | JWT signature/claims, token metadata, rejected client authentication |
| `GET /api/protected` | Missing/invalid bearer rejection and automatic OAuth2 client-credentials authorization |

The `.http` files in [requests](requests) are independent and repeatable. They use the shared `baseUrl` in [.httpyac.json](.httpyac.json). For an existing WireMock instance on another port, pass `npm run test:e2e -- --var baseUrl=http://localhost:8090`.

## Mock authentication

The token provider is a **WireMock stub**, not a production identity provider. It requires HTTP Basic client authentication (`httpyac-e2e-client` / `httpyac-e2e-secret`), `grant_type=client_credentials`, and `scope=api.read`. All credentials and keys in this folder are public, test-only fixtures.

The endpoint returns a fixed HS256 JWT with subject `1234567890`, signed with the public example key `your-256-bit-secret`. The token tests verify its signature and subject. WireMock accepts only that exact bearer token on `/api/protected`; it does not perform JWT signature, expiry, or scope validation. The fixture has no JWT expiry claim; the OAuth response supplies `expires_in`. Keep the token response and protected mapping synchronized if replacing it.

[oauth.http](requests/oauth.http) uses httpyac's `Authorization: oauth2 client_credentials` helper to obtain and send the token, rather than copying the fixture into the request. Token refresh timers are disabled so the CLI exits normally.

## CI

The build workflow starts Compose after `npm run build`, runs `npm run test:e2e:all`, prints WireMock logs on failure, and always tears down Compose.

## OpenAPI generation E2E

[openapi.cjs](openapi.cjs) uses the single documented [Todo CRUD YAML](../examples/openapi/todo-crud.yaml), which includes a public Kubernetes `/health` endpoint. See [example setup and usage](../examples/openapi/README.md).

The runner spawns the built CLI to generate a selected `.http` file in a temporary directory, then spawns `send` to execute that file over real HTTP. It checks:

- Metadata and output non-overwrite behavior.
- OpenID discovery during generation, with no token request until execution.
- Native OpenID client-credentials login and bearer-authenticated Todo list/create/read/update/delete.
- Explicit response links carrying ID `73` instead of the path parameter's example ID `1`.
- Request order and payloads through an isolated WireMock scenario and request journal.
- Public `/health`-only generation/execution without discovery, tokens, or credentials.
- A deliberately wrong health response schema producing assertion failures and exit code `20`, not a scripting error.

The runner resets only `OpenApiTodoWorkflow`, leaves the other test scenarios/journal entries alone, and removes only its own temporary files on completion or failure. It uses WireMock on `localhost:8089`; the existing `test:e2e -- --var baseUrl=...` override remains available for the original request suite.

The Todo identity provider is also a **stub**. `httpyac-todo-client` / `httpyac-todo-secret` and `httpyac-todo-test-token` are public test-only fixtures, not real credentials. WireMock checks the client-credentials grant, `todo.read todo.write` scope, and exact bearer token; it does not implement full OpenID/JWT validation.

Unit tests cover parsing, selection and authentication decisions; integration tests parse/execute generated files with mock clients. This E2E suite additionally tests actual subprocesses, filesystem output, discovery, token requests and HTTP transport.
