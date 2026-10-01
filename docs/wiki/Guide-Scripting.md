Scripts let a `.http` file prepare data before a request, inspect responses after a request, and register event handlers around the request pipeline. They work well with [Variables](Guide-Variables), [Assert](Guide-Assert), [Hooks](Guide-Hooks), and protocol pages such as [Guide-Kafka](Guide-Kafka).

- [Node.js script blocks](#nodejs-script-blocks)
- [Variables exported by scripts](#variables-exported-by-scripts)
- [Built-in globals](#built-in-globals)
- [Asynchronous scripts](#asynchronous-scripts)
- [Importing code](#importing-code)
- [Event scripts](#event-scripts)
- [Cancelling a request](#cancelling-a-request)
- [IntelliJ HTTP Client scripts](#intellij-http-client-scripts)
- [Debugging](#debugging)

## Node.js script blocks

Use `{{` and `}}` to add JavaScript. A script before the request line runs before the request is sent; a script after the request line runs after the response is received.

```http
@host = https://httpbin.org

{{
  const token = Buffer.from("demo:secret").toString("base64");
  exports.authHeader = `Basic ${token}`;
}}
GET {{host}}/basic-auth/demo/secret
Authorization: {{authHeader}}

{{
  test.status(200);
  test("authenticated", () => {
    if (!response.parsedBody.authenticated) {
      throw new Error("expected authenticated response");
    }
  });
}}
```

Keep the line break after `{{`. It distinguishes a script block from inline variable replacement such as `{{host}}`.

Inline JavaScript expressions can also be used wherever variables are replaced:

```http
GET https://httpbin.org/anything/{{$random.uuid()}}
X-Today: {{new Date().toISOString().slice(0, 10)}}
```

Scripts run in a Node.js `vm` context. The context is designed to behave like normal Node.js code, but `require` is the most reliable way to use Node APIs or installed dependencies.

## Variables exported by scripts

Assign values to `exports` to make them available as variables in later request processing.

```http
{{
  exports.user = { id: 42, name: "Ada" };
}}
GET https://example.test/users/{{user.id}}
```

If a script sets an existing variable to `undefined`, httpyac removes that variable from the current context. Variables share the script global scope, so use clear names that do not collide with JavaScript keywords or built-in httpyac names.

## Built-in globals

The JavaScript context contains variables from the active environments plus these helper values.

| Name | Available when | Purpose |
| --- | --- | --- |
| `$global` | Always | Object persisted in the user session for the active environment. |
| `$httpyac` | Always | Helper API for importing files, finding named regions, setting variables, and executing regions. |
| `$random` | Always | Random data helpers such as `uuid()`, `integer()`, `email()`, and `date()`. |
| `$context` | Always | The current processor context. Prefer documented helpers unless you need low-level access. |
| `$requestClient` | Streaming clients | Request client for sending client-streaming messages. |
| `httpFile` | Always | Current parsed HTTP file model. |
| `httpRegion` | Always | Current request region model. |
| `request` | Request execution | The request that is about to be sent. |
| `response` | Response scripts | The last or current response. |
| `sleep(ms)` | Always | Promise-based delay helper. |
| `test(name, fn)` | Always | Adds a test result; also exposes helpers such as `test.status(200)`. |
| `console` | Always | Logs to the httpyac script console/output channel. |
| `__dirname`, `__filename` | Always | Standard CommonJS-style script location values. |
| `oauth2Session` | OAuth/OpenID flows | OAuth2/OpenID response details when those features are used. |

Useful `$httpyac` examples:

```http
### login
POST https://example.test/login

### use the login response first
{{
  const login = $httpyac.findHttpRegionInContext("login");
  await $httpyac.execute(login);
  exports.sessionId = response.headers["set-cookie"];
}}
GET https://example.test/profile
Cookie: {{sessionId}}
```

## Asynchronous scripts

Scripts may use `await` directly. If a script exports a promise or exports properties that are promises, httpyac waits for them before continuing.

```http
{{
  exports.startedAt = Promise.resolve(Date.now());
  await sleep(50);
  exports.ready = true;
}}
GET https://example.test/ping?ready={{ready}}
```

## Importing code

Use `require` for Node.js modules, local files, or packages installed in your project. The ZW edition package is `@zerowiggliness/httpyac`; examples that refer to upstream package names can be adapted to that package when you need the fork as a dependency.

```http
{{
  const crypto = require("crypto");
  exports.signature = crypto.createHash("sha256").update("payload").digest("hex");
}}
POST https://example.test/signed
X-Signature: {{signature}}
```

Dependencies must usually be installed by the project. The runtime also ships the dependencies used by httpyac itself, including packages such as `dayjs`, `got`, `uuid`, `ws`, `xpath`, `@xmldom/xmldom`, `eventsource`, `mqtt`, `@grpc/grpc-js`, and `@cloudamqp/amqp-client`.

Node caches required modules. In long-running hosts such as the VS Code extension, clear the require cache or restart the host when iterating on an imported helper file.

## Event scripts

Use an event marker after `{{` to bind a script to a request phase.

| Marker | Phase |
| --- | --- |
| `{{@request` | Before the request is sent, after variable replacement hooks start preparing it. |
| `{{@streaming` | During client-streaming processing. |
| `{{@response` | When a response is received. |
| `{{@responseLogging` | While preparing the response object used for output/logging. |
| `{{@after` | After the request execution loop finishes. |
| `{{` | Default execute phase before sending the request. |

```http
{{@request
  request.headers["x-trace-id"] = $random.uuid();
}}
GET https://example.test/audit

{{@response
  test("content-type is json", () => {
    if (!String(response.headers["content-type"]).includes("json")) {
      throw new Error("not json");
    }
  });
}}
```

Prefix the event with `+` to register the script globally for every request in the file. Without an event, a global script runs before every request.

```http
{{+request
  request.headers["x-suite"] = "smoke";
}}

GET https://example.test/one

###
GET https://example.test/two
```

## Cancelling a request

Set `exports.$cancel = true` to skip the rest of the current region. httpyac records a skipped test result and does not send the request.

```http
{{
  if (!process.env.RUN_DESTRUCTIVE_TESTS) {
    exports.$cancel = true;
  }
}}
DELETE https://example.test/dangerous-resource
```

## IntelliJ HTTP Client scripts

HttpYac also understands IntelliJ-style HTTP Client scripts:

- `< {% ... %}` before a request is a pre-request script.
- `> {% ... %}` after a request is a response handler script.
- `< ./script.js` and `> ./script.js` load script code from a file.

```http
< {%
  request.variables.set("name", "Ada")
%}
GET https://example.test/users/{{name}}

> {%
  client.test("status", function () {
    client.assert(response.status === 200, "expected HTTP 200");
  });
  client.global.set("lastUser", response.body.id);
%}
```

The implemented IntelliJ globals include `client`, `request`, `response`, `crypto`, `$random`, `$env`, and `Window`. Important API points are:

| Object | Supported members |
| --- | --- |
| `client` | `test(name, fn)`, `assert(condition, message)`, `global`, `log(...)`, `exit()` (logs a warning; it does not stop execution). |
| `request` before send | `url`, `method`, `body`, `headers`, `environment`, `variables`; request variables can be set for substitution. |
| `request` after response | `url()`, `body()`, `method`, `headers`, `environment`, `variables`. |
| `response` | `body`, `status`, `headers.valueOf(name)`, `headers.valuesOf(name)`, `contentType`. |
| Streaming `response.body` | `onEachLine` and `onEachMessage` for streaming clients. |

> [!NOTE]
> **ZW edition:** IntelliJ script file load errors keep the original error as `cause`, so callers can inspect the wrapped reason. See [ZW edition differences](ZW-Edition-Differences).

The execution environment is Node.js-based, not JetBrains Nashorn, so edge cases can differ from IntelliJ itself.

## Debugging

For CLI debugging, install the forked CLI and run the request from a JavaScript Debug Terminal:

```shell
npm install -g @zerowiggliness/httpyac
httpyac path\to\requests.http -l 12
```

Then add a `debugger;` statement inside the script block you want to inspect.
