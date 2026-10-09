Variables let one `.http` file describe reusable request data, environment-specific settings, generated values, and values captured while a run is in progress. A variable reference uses double curly braces, for example `{{host}}`, and names are case-sensitive.

- [Where variables work](Guide-Variables#where-variables-work)
- [Scope and precedence](Guide-Variables#scope-and-precedence)
- [Defining variables in `.http` files](Guide-Variables#defining-variables-in-http-files)
- [Using JavaScript expressions](Guide-Variables#using-javascript-expressions)
- [Escaping substitution](Guide-Variables#escaping-substitution)
- [Imports and references](Guide-Variables#imports-and-references)
- [Host shortcut](Guide-Variables#host-shortcut)
- [Prompt variables](Guide-Variables#prompt-variables)
- [Dynamic values](Guide-Variables#dynamic-values)
- [OAuth 2.0 and OpenID Connect](Guide-Variables#oauth-20-and-openid-connect)
- [Authentication helpers](Guide-Variables#authentication-helpers)
- [XML XPath variables](Guide-Variables#xml-xpath-variables)
- [CLI variables](Guide-Variables#cli-variables)

## Where variables work

HttpYac replaces variables before it sends a request. Replacement is available in the request line, URLs, headers, request bodies, variable definitions, file paths, and many protocol-specific options.

```http
@host = https://httpbin.org
@user = ada

GET {{host}}/anything/{{user}}
X-Trace-Id: {{$uuid}}
```

Variable values can reference other variables. Nested replacements are resolved repeatedly, so environment values such as `auth_tokenEndpoint={{authHost}}/token` work when `authHost` is available.

## Scope and precedence

Variables are collected from several providers:

- Environment providers, including configuration environments, dotenv files, IntelliJ `http-client.env.json`, the last response, plugins, and CLI options.
- File-global variables, defined in regions that are not a named request.
- Request variables, defined in the current request region.
- Global variables stored in the JavaScript global variable store.

Request-local values override broader values. CLI variables from `--var` are added to the initial context and override environment provider values. Variables provided by [Guide-Environments](Guide-Environments) are available to every selected request.

You can widen the visible scope by importing files or referencing named requests with `# @import`, `# @ref`, and `# @forceRef`; see [Guide-MetaData](Guide-MetaData).

The previous response is exposed as `response` when a run has one cached, so later expressions can read values such as `{{response.statusCode}}` or use the object in scripts.

## Defining variables in `.http` files

Use `@name = value` for an eager variable. Eager variables are evaluated when the variable definition executes.

```http
@host = https://httpbin.org
@path = anything

GET {{host}}/{{path}}
```

Use `@name := value` for a lazy variable. Lazy values are evaluated later, just before the request or Node.js execution uses them.

```http
@id := {{$uuid}}

GET https://httpbin.org/anything/{{id}}
```

If a required value is not defined yet, HttpYac keeps the variable lazy so it can be resolved later.

Use the `global.` prefix when a variable should be written to the shared global store:

```http
@global.token = abc123
```

Global variables are kept per active environment selection.

## Using JavaScript expressions

Anything inside `{{...}}` can be evaluated as a JavaScript expression when no earlier replacer handles it. Current variables are exposed in the script context, so simple values can be referenced directly.

```http
@base = 40

GET https://httpbin.org/anything?id={{base + 2}}
X-Date: {{new Date().toISOString()}}
```

For longer logic, prefer request scripts and hooks described in [Guide-Scripting](Guide-Scripting).

## Escaping substitution

Prefix both braces with backslashes when you want literal curly-brace text:

```http
POST https://example.test/template

\{\{notReplaced\}\}
```

HttpYac sends the body as:

```text
{{notReplaced}}
```

## Imports and references

`# @import` imports file-global variables from another file. To reuse request variables or response data from another request, name that request with `# @name` and refer to it with `# @ref` or `# @forceRef`.

```http
# @import ./common.http

###
# @name login
POST {{host}}/login

###
# @ref login
GET {{host}}/me
Authorization: Bearer {{login.response.body.token}}
```

See [Guide-MetaData](Guide-MetaData) for the complete reference syntax.

File imports can also be used where a value is replaced. `< file` reads a file as bytes, and `<@ file` injects variables inside the imported content before use. An optional encoding may follow `@`.

```http
POST https://example.test/upload
Content-Type: application/json

<@ ./payload.json
```

## Host shortcut

If a request URL starts with `/`, HttpYac prepends a host from the request `Host` header or from a variable named `host`.

```http
@host = https://api.example.test

GET /users
```

When a `Host` header is present, the scheme is inferred from the port: `443` and `8443` use `https`; other ports use `http`.

## Prompt variables

Prompt variables ask for input at replacement time.

| Variable | Description |
| --- | --- |
| `$input <label> [$value: <default>]` | Text input prompt. |
| `$prompt <label> [$value: <default>]` | Alias for `$input`. |
| `$password <label> [$value: <default>]` | Password prompt. |
| `$pick <label> $value: a,b,c` | Pick one value from a comma-separated list. |
| `$pick <label> $value: <js expression>` | If the expression returns an array, pick from that array. |

```http
@username = {{$input user name $value: demo}}
@password = {{$password password}}
@region = {{$pick region $value: eu,us,ap}}
```

Add `-askonce` to reuse the answer for the same label.

```http
@tenant = {{$input-askonce tenant $value: local}}
@region = {{$pick-askonce region $value: eu,us,ap}}
```

For `$input-askonce`, an already defined variable with the same placeholder name is reused before prompting.

## Dynamic values

HttpYac supports dynamic variables from its core replacers plus IntelliJ and VS Code REST Client compatible names.

### Common and IntelliJ-style variables

| Variable | Result |
| --- | --- |
| `$uuid` | UUID v4. |
| `$random.uuid` | UUID v4. |
| `$timestamp` | Current timestamp in milliseconds. |
| `$isoTimestamp` | Current timestamp as an ISO string. |
| `$randomInt` | Random integer from `0` up to `999`. |
| `$random.integer(from,to)` | Random integer between the two bounds. |
| `$random.float(from,to)` | Random floating-point number between the two bounds. |
| `$random.alphabetic(length)` | Random alphabetic string. |
| `$random.alphanumeric(length)` | Random alphanumeric string. |
| `$random.hexadecimal(length)` | Random hexadecimal string. |
| `$random.email()` | Random email-like value. |
| `$projectRoot` | Current project root path. |

```http
GET https://httpbin.org/anything/{{$uuid}}
X-Run-At: {{$isoTimestamp}}
X-Project: {{$projectRoot}}
```

### REST Client-style variables

| Variable | Result |
| --- | --- |
| `$guid` | UUID v4. |
| `$randomInt min max` | Random integer from `min` up to, but not including, `max`; reversed bounds are swapped. Both numbers are required. |
| `$timestamp [offset unit]` | Current UTC Unix timestamp in seconds. |
| `$datetime rfc1123\|iso8601\|"format"\|'format' [offset unit]` | UTC date/time string. |
| `$localDatetime rfc1123\|iso8601\|"format"\|'format' [offset unit]` | Local date/time string. |
| `$processEnv name` | Value from `process.env`, or an empty string. |
| `$dotenv name` | Value from the current dotenv/environment variables, or an empty string. |

Offset units are `y`, `Q`, `M`, `w`, `d`, `h`, `m`, `s`, and `ms`.

```http
GET https://httpbin.org/anything
X-Guid: {{$guid}}
X-Expires: {{$datetime iso8601 1 h}}
X-Local-Day: {{$localDatetime "YYYY-MM-DD"}}
X-From-Env: {{$processEnv HOME}}
X-From-Dotenv: {{$dotenv apiKey}}
```

## OAuth 2.0 and OpenID Connect

OAuth 2.0 and OpenID Connect are handled through the `Authorization` header. There is no `{{$oauth2}}` or `{{$openidconnect}}` dynamic variable; use the `oauth2` or `openid` authorization helper, or call the script helper `$getOAuth2Response` from JavaScript.

```http
GET https://api.example.test/secured
Authorization: oauth2 client_credentials local
```

The header format is:

```http
Authorization: oauth2 [flow] [prefix] [token_exchange <exchangePrefix>]
Authorization: openid [flow] [prefix] [token_exchange <exchangePrefix>]
```

If `flow` is omitted, `client_credentials` is used. If `prefix` is omitted, `oauth2` is used.

Supported flows and aliases:

| Flow | Aliases |
| --- | --- |
| `client_credentials` | `client` |
| `authorization_code` | `code` |
| `device_code` | `device` |
| `password` | |
| `implicit` | `hybrid` |

Configure a flow with variables named `<prefix>_<setting>` or nested values such as `<prefix>.<setting>`.

```http
@local_tokenEndpoint = https://id.example.test/realms/demo/protocol/openid-connect/token
@local_clientId = httpyac
@local_clientSecret = secret
@local_scope = openid profile

GET https://api.example.test/secured
Authorization: openid client_credentials local
```

Common settings:

| Setting | Description |
| --- | --- |
| `tokenEndpoint` | Token endpoint URL. |
| `authorizationEndpoint` | Authorization endpoint URL for browser-based flows. |
| `deviceCodeEndpoint` | Device authorization endpoint URL. |
| `clientId` | OAuth client ID. |
| `clientSecret` | OAuth client secret. |
| `scope` | Requested scope. Browser and device flows default to `openid` where needed. |
| `resource` | Resource indicator; may be a string or array. |
| `audience` | Audience; may be a string or array. |
| `username`, `password` | Resource owner password flow credentials. |
| `responseType`, `responseMode` | Optional implicit/hybrid authorization parameters. |
| `redirectUri` | Redirect URI; default is `http://localhost:3000/callback`. |
| `serverPort` | Local listener port for browser-based flows; otherwise the redirect URI port is used. |
| `keepAlive` | Refresh cached tokens in the background when possible; default is `true`. |
| `useAuthorizationHeader` | Send client credentials with the authorization header; default is `true`. |
| `useDeviceCodeClientSecret` | Include the client secret in the device-code request. |
| `usePkce` | Enable PKCE for the authorization-code flow. |
| `proxy` | Proxy for token requests. |
| `subjectIssuer` | Subject issuer used by token exchange. |
| `interceptRequest` | Function that can modify token requests. |

Required settings by flow:

| Flow | Required settings |
| --- | --- |
| `client_credentials` | `tokenEndpoint`, `clientId`, `clientSecret` |
| `authorization_code` | `tokenEndpoint`, `authorizationEndpoint`, `clientId` |
| `implicit` / `hybrid` | `tokenEndpoint`, `authorizationEndpoint`, `clientId` |
| `password` | `tokenEndpoint`, `clientId`, `username`, `password` |
| `device_code` | `tokenEndpoint`, `deviceCodeEndpoint`, `clientId` |
| `token_exchange` target | `tokenEndpoint`, `clientId`, `clientSecret` |

Authorization-code and implicit/hybrid flows start a temporary local HTTP server and open the browser. Configure the identity provider to allow the selected `redirectUri`.

IntelliJ `Security.Auth` entries in `http-client.env.json` are also understood by the IntelliJ dynamic variables:

```http
GET https://api.example.test/secured
Authorization: Bearer {{$auth.token("keycloak")}}
```

Use `$auth.idToken("name")` to retrieve the ID token instead.

## Authentication helpers

Several replacers transform compact authorization forms into real request credentials.

### Basic authentication

```http
GET https://example.test/private
Authorization: basic demo secret
```

If the username or password contains spaces, separate them with a colon.

```http
GET https://example.test/private
Authorization: basic demo user:secret with spaces
```

### Digest authentication

```http
GET https://example.test/private
Authorization: digest demo secret
```

The digest helper waits for a `401` digest challenge and retries the request with the computed digest header. The colon form is also supported for values containing spaces.

### AWS Signature Version 4

```http
GET https://service.region.amazonaws.com/resource
Authorization: aws {{accessKeyId}} {{secretAccessKey}} token: {{sessionToken}} region: eu-central-1 service: execute-api
```

`token:`, `region:`, and `service:` are optional. The helper signs the request and adds the AWS headers.

### SSL client certificates

Client certificates can be configured globally with `clientCertificates` in [Configuration](Configuration), keyed by host.

```json
{
  "clientCertificates": {
    "client.badssl.com": {
      "pfx": "./client.p12",
      "passphrase": "secret"
    }
  }
}
```

Paths are resolved relative to the `.http` file when the request runs. A request can also attach a certificate with a `ClientCert` or `X-ClientCert` header; that header is removed before the request is sent.

```http
GET https://client.badssl.com/
ClientCert: cert: ./client.crt key: ./client.key

###
GET https://client.badssl.com/
X-ClientCert: pfx: ./client.p12 passphrase: secret
```

Use `# @noClientCert` when a request should skip configured certificates.

## XML XPath variables

When the XML plugin is active, `{{$xpath ...}}` extracts a value from XML. If no variable name is supplied and the previous response is XML, the last response body is used.

```http
GET https://example.test/data.xml

###
GET https://example.test/next/{{$xpath //item/@id}}
```

Use the `@xpath_ns` metadata to provide namespaces; see [Guide-Assert](Guide-Assert) for XML assertion examples.

## CLI variables

The CLI accepts variables with `--var`. Values are split at the first `=`, so additional equals signs stay in the value.

```shell
httpyac send api.http --var host=https://api.example.test token=abc=123
```

Select environments with `--env`; see [Guide-Environments](Guide-Environments).
