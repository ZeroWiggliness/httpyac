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
- [Authentication](Guide-Authentication)
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
