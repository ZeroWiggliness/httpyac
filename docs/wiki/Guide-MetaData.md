Metadata lines attach behavior to the next request region. They can name responses, wire request dependencies, change transport options, control streaming, and carry hints used by editor integrations.

- [Syntax](#syntax)
- [Region metadata](#region-metadata)
- [Execution metadata](#execution-metadata)
- [Transport metadata](#transport-metadata)
- [Streaming and logging metadata](#streaming-and-logging-metadata)
- [Editor and response-view metadata](#editor-and-response-view-metadata)
- [Plugin-specific metadata](#plugin-specific-metadata)
- [Environment alternatives](#environment-alternatives)

## Syntax

Place metadata before the request it belongs to. HttpYac accepts hash comments and IntelliJ-style line comments:

```http
# @name getUser
# @timeout 5000
// @noRedirect
GET https://api.example.test/users/1
```

The parser stores `# @key value` as `httpRegion.metaData.key`. If the key contains hyphenated words, they are normalized to camel case, so `# @no-redirect` becomes `noRedirect`. A metadata line without a value stores `true`.

Region separators also carry metadata. `### Get user` sets the region title, and, if no `@name` was already set, the request name.

```http
### Get user
GET https://api.example.test/users/1
```

## Region metadata

| Tag | Syntax | Description | Example |
| --- | --- | --- | --- |
| `@name` | `# @name <name>` | Names the request. The response body is stored in a variable with that name, and the full response is stored as `<name>Response`. Whitespace and hyphenated words are converted to camel case when the variable is set. Use stable, JavaScript-friendly names for requests referenced from [Scripting](Guide-Scripting) or [Variables](Guide-Variables). | `# @name login`<br>`POST https://api.example.test/login` |
| `@title` | `# @title <text>` | Sets the display title used in output and outline views. `### <title>` is the shorthand and also becomes the name when no `@name` is present. | `# @title Create invoice`<br>`POST https://api.example.test/invoices` |
| `@description` | `# @description <text>` | Sets the request description. If omitted, the first plain comment in a region is used as the description. | `# @description Creates a draft invoice`<br>`POST https://api.example.test/invoices` |
| `@tag` | `# @tag <tag>[, <tag>...]` | Adds comma-separated tags. The CLI can run only matching regions with `--tag`. | `# @tag smoke, billing`<br>`GET https://api.example.test/health` |
| `@forceRegionDelimiter` | `# @forceRegionDelimiter` | Requires an explicit `###` separator before another request line can start a new region. Useful when the body can contain text that looks like a request. | `# @forceRegionDelimiter`<br>`POST https://api.example.test/raw` |

## Execution metadata

| Tag | Syntax | Description | Example |
| --- | --- | --- | --- |
| `@disabled` | `# @disabled` or `# @disabled <javascript-expression>` | Skips the request. With an expression, HttpYac evaluates it at execution time and skips only when the result is truthy. Skipped requests are reported as skipped tests. | `# @disabled environment !== "dev"`<br>`DELETE https://api.example.test/users/1` |
| `@note` | `# @note [message]` | Shows a confirmation prompt before sending. If no message is supplied, HttpYac asks whether to send the current request. | `# @note This request changes production data`<br>`POST https://api.example.test/release` |
| `@import` | `# @import <file>` | Imports another `.http` file so its named requests can be referenced. Imports are resolved when the request executes. | `# @import ./auth.http` |
| `@ref` | `# @ref <request-name>` | Ensures another named request has been executed before this request. Cached variables from the referenced request are reused when available. | `# @ref login`<br>`GET https://api.example.test/me` |
| `@forceRef` | `# @forceRef <request-name>` | Executes the referenced request every time, even if a response or variables already exist. | `# @forceRef refreshToken`<br>`GET https://api.example.test/me` |
| `@responseRef` | `# @responseRef <file>` | Records a response reference file on the region. The shorthand parser also accepts `<> <file>`. Tools that consume response references can use these files as examples. | `# @responseRef ./responses/user.json` |
| `@loop` | `# @loop for <count>`, `# @loop for <name> of <expression>`, or `# @loop while <expression>` | Runs the request multiple times. `$index` is injected on every iteration; `for ... of ...` also injects the named item. A named looped request becomes `<name>0`, `<name>1`, and so on, and the original name receives the first response while `<name>List` receives all responses. | `# @loop for user of users`<br>`POST https://api.example.test/users` |
| `@sleep` | `# @sleep <javascript-expression>` | Waits before the request continues. The expression must evaluate to a safe integer number of milliseconds. | `# @sleep 1000`<br>`GET https://api.example.test/status` |
| `@timeout` | `# @timeout <milliseconds>` | Sets the request timeout. HTTP passes it to `got`; WebSocket uses it for the handshake/session timeout; MQTT uses it as connect timeout; gRPC uses it as a deadline; Kafka uses it as connection timeout. | `# @timeout 10000`<br>`GET https://api.example.test/slow` |
| `@ratelimit` | `# @ratelimit [slot <name>] [minIdleTime <ms>] max <count> [expire <ms>]` | Throttles execution. `minIdleTime` enforces a pause since the previous request in the slot. `max` with `expire` limits requests per time window. `slot` lets independent request groups have separate counters. Write the key in lower case: `# @rateLimit` and `# @rate-limit` are ignored. The `max` keyword is required, so `# @ratelimit minIdleTime 1000` alone has no effect (use `# @ratelimit minIdleTime 1000 max 0`). | `# @ratelimit slot auth max 5 expire 60000` |
| `@jwt` | `# @jwt [property-name]` | Decodes JWT-looking string properties in an object response. Parsed tokens are added as `<property>_parsed` and the pretty response body is updated. If a value is supplied, only matching property names are considered. | `# @jwt access_token`<br>`POST https://api.example.test/token` |
| `@injectVariables` | `# @injectVariables` | Forces imported request-body files to be read as text and have variables injected. Without it, files are injected only for configured extensions or explicit file-import syntax. | `# @injectVariables`<br>`< ./payload.json` |

### Loop examples

```http
# @name createUser
# @loop for user of users
POST https://api.example.test/users
content-type: application/json

{{user}}

### Poll while a condition is true
# @loop while response?.statusCode !== 200 && $index < 5
GET https://api.example.test/jobs/{{jobId}}
```

## Transport metadata

| Tag | Syntax | Description | Example |
| --- | --- | --- | --- |
| `@noRedirect` | `# @noRedirect` | Prevents redirect following where the client supports it. In this source it is applied by HTTP and WebSocket clients. | `# @noRedirect`<br>`GET https://example.test/redirect` |
| `@postRedirectGet` | `# @postRedirectGet` | HTTP-only. On redirects, changes the redirected request method to `GET` and clears the redirected body. | `# @postRedirectGet`<br>`POST https://example.test/form` |
| `@noRejectUnauthorized` | `# @noRejectUnauthorized` | Disables TLS certificate verification for clients that use the request flag. Source support includes HTTP, WebSocket, MQTT, SSE in this ZW edition, and Kafka in the ZW Kafka implementation. | `# @noRejectUnauthorized`<br>`GET https://self-signed.example.test` |
| `@proxy` | `# @proxy <proxy-url>` | Sets a per-request proxy. Supported URL schemes include HTTP(S) and SOCKS where the underlying client supports them. Source support includes HTTP, WebSocket, and SSE in this ZW edition. | `# @proxy socks://localhost:1080`<br>`GET https://api.example.test` |
| `@noProxy` | `# @noProxy` | Removes the configured or environment proxy for this request. This is applied by the core proxy interceptor before the request is sent. | `# @noProxy`<br>`GET https://intranet.example.test` |
| `@noCookieJar` | `# @noCookieJar` | HTTP-only. Disables the configured cookie jar for the request, so stored cookies are neither attached nor updated for it. | `# @noCookieJar`<br>`GET https://api.example.test/public` |
| `@noClientCert` | `# @noClientCert` | HTTP-only. Prevents client certificates from configuration or `*clientCert` variables from being attached to this request. | `# @noClientCert`<br>`GET https://api.example.test/no-mtls` |

> [!NOTE]
> **ZW edition:** `# @keepStreaming` and `# @noRejectUnauthorized` also apply to [Kafka](Guide-Kafka) requests. `# @noRejectUnauthorized` and `# @proxy` are honoured by the reworked SSE/EventSource client. See [ZW edition differences](ZW-Edition-Differences).

## Streaming and logging metadata

| Tag | Syntax | Description | Example |
| --- | --- | --- | --- |
| `@keepStreaming` | `# @keepStreaming` | Keeps a streaming request alive until the session is cancelled or the request client disconnects. This is useful with MQTT, WebSocket, SSE, gRPC, AMQP consume-style requests, and Kafka consume in the ZW edition. | `# @keepStreaming`<br>`SSE https://api.example.test/events` |
| `@noLog` | `# @noLog` | Suppresses normal response logging for the request. The response still exists for variables, assertions, and scripts. | `# @noLog`<br>`GET https://api.example.test/secret` |
| `@noStreamingLog` | `# @noStreamingLog` | Suppresses intermediate streaming message output while still allowing the stream to run. | `# @noStreamingLog`<br>`WS wss://api.example.test/socket` |
| `@metaDataLogging` | `# @metaDataLogging` | Logs streaming metadata events such as WebSocket upgrade/ping/close, MQTT connection events, gRPC stream lifecycle events, and SSE open events. This tag is handled directly by the request-client utilities. | `# @metaDataLogging`<br>`MQTT mqtt://localhost:1883` |
| `@debug` | `# @debug` | Sets the log level to debug for this request execution. | `# @debug`<br>`GET https://api.example.test/debug` |
| `@verbose` | `# @verbose` | Sets the log level to trace for this request execution. | `# @verbose`<br>`GET https://api.example.test/trace` |

## Editor and response-view metadata

These tags are parsed and listed by the metadata completions in this repository. They are primarily useful for editor integrations that display or save responses; CLI/library execution in this source does not add a transport hook for them.

| Tag | Syntax | Description | Example |
| --- | --- | --- | --- |
| `@save` | `# @save` | In supporting response viewers, saves the response directly instead of opening a preview. | `# @save`<br>`GET https://api.example.test/report.pdf` |
| `@openWith` | `# @openWith <view-type>` | Requests a specific custom editor/view type for a saved or previewed response. | `# @openWith vscode.markdown.preview.editor`<br>`GET https://api.example.test/report.md` |
| `@extension` | `# @extension <extension>` | Supplies or overrides the file extension used with `@save` or `@openWith`. | `# @extension pdf`<br>`GET https://api.example.test/report` |
| `@language` | `# @language <language-id>` | Supplies the language id for a response view in supporting editors. | `# @language json`<br>`GET https://api.example.test/data` |
| `@noResponseView` | `# @noResponseView` | Suppresses opening the response in an editor document in supporting editor integrations. | `# @noResponseView`<br>`GET https://api.example.test/ping` |

## Plugin-specific metadata

| Tag | Syntax | Description | Example |
| --- | --- | --- | --- |
| `@grpcReflection` | `# @grpcReflection <host:port>` | gRPC-only. Uses server reflection to load service definitions for the current gRPC request. Reflection errors are logged at debug level and do not stop parsing. | `# @grpcReflection localhost:50051`<br>`GRPC localhost:50051 my.package.Service/Get` |
| `@noGqlParsing` | `# @noGqlParsing` | GraphQL plugin. Disables `gql` block parsing for the region, leaving content to be handled as a normal request body. | `# @noGqlParsing`<br>`POST https://api.example.test/graphql` |

### GraphQL naming

When a `gql` operation has a name and no `@name` is set, the GraphQL parser uses the operation name as the request name.

```http
POST https://api.example.test/graphql

query Viewer {
  viewer { login }
}
```

## Environment alternatives

Several transport options also have variable-based equivalents, which are often better for environment-specific behavior:

```ini
request_rejectUnauthorized=false
request_noRedirect=true
request_proxy=socks://localhost:1080
request_timeout=5000
```

`request_rejectUnauthorized=false` maps to the same request flag as `# @noRejectUnauthorized`; `request_proxy` maps to `# @proxy`; `request_timeout` maps to `# @timeout`; and `request_noRedirect=true` maps to `# @noRedirect`.