The CLI is the main way to use HttpYac (ZW edition). It runs `.http` and `.rest` files from a terminal, works well in CI, and exposes the fork package directly.

## Install

Install the ZW edition package from npm:

```shell
npm install -g @zerowiggliness/httpyac
httpyac --version
```

To upgrade an existing global install:

```shell
npm update -g @zerowiggliness/httpyac
```

The package declares Node.js `>=24`.

> [!NOTE]
> **ZW edition:** install the fork package `@zerowiggliness/httpyac`; upstream examples that install `httpyac` use the upstream package instead. See [ZW edition differences](ZW-Edition-Differences).

## Basic usage

Run one file:

```shell
httpyac send example.http
```

Run every request in matching files:

```shell
httpyac send "**/*.http" --all
```

The `send` command is also registered as the default command, so `httpyac example.http` is equivalent to `httpyac send example.http`.

## `httpyac --help`

```shell
Usage: httpyac [options] [command]

httpYac - Quickly and easily send REST, SOAP, GraphQL and gRPC requests

Options:
  -V, --version                 output the version number
  -h, --help                    display help for command

Commands:
  oauth2 [options]              generate oauth2 token
  openapi [options] <fileName>  generate http files from OpenAPI 3.x JSON or YAML
  send <fileName...> [options]  send/ execute http files
  help [command]                display help for command
```

## `httpyac send --help`

```shell
Usage: httpyac send <fileName...> [options]

send/ execute http files

Arguments:
  fileName                  path to file or glob pattern

Options:
  -a, --all                 execute all http requests in a http file
  --bail                    stops when a test case fails
  -e, --env <env...>        list of environments
  --filter <filter>         filter requests output (only-failed)
  --insecure                allow insecure server connections when using ssl
  -i --interactive          do not exit the program after request, go back to selection
  --json                    use json output
  --junit                   use junit xml output
  -l, --line <line>         line of the http requests
  -n, --name <name>         name of the http requests
  --no-color                disable color support
  -o, --output <output>     output format of response (short, body, headers, response, exchange, none)
  --output-failed <output>  output format of failed response (short, body, headers, response, exchange, none)
  --raw                     prevent formatting of response body
  --quiet
  --repeat <count>          repeat count for requests
  --repeat-mode <mode>      repeat mode: sequential, parallel (default)
  --parallel <count>        send parallel requests
  -s, --silent              log only request
  -t, --tag <tag...>        list of tags to execute
  --timeout <timeout>       maximum time allowed for connections
  --var <variables...>      list of variables (e.g foo="bar")
  -v, --verbose             make the operation more talkative
  -h, --help                display help for command
```

`--var` entries are split at the first `=`, for example `--var token="abc"`. The source type also accepts `timings` as an output mode, although the help text lists the traditional output modes.

## `httpyac openapi`

Generate an editable `.http` file from a local OpenAPI 3.x JSON or YAML document:

```shell
httpyac openapi api.yaml --path "/api/todos,/api/todos/*" --output todos.http
httpyac openapi api.yaml --path "POST /api/todos,GET /api/todos/{id},PATCH /api/todos/{id},DELETE /api/todos/{id}" --output workflow.http
httpyac openapi api.yaml --path 'GET regex:/^\/api\/v[23]{1,2}\/todos$/u' --output selected.http
```

| Option | Behavior |
| --- | --- |
| `--path <selectors>` | Ordered comma-separated selectors; omission includes all operations in document order. Bare paths are exact. `*` spans path separators. Optional `METHOD ` restricts methods. Regex syntax is `regex:/pattern/flags`, with `i`, `m`, `u` allowed; commas inside regex are preserved. Deliberate repeated operations are kept with distinct names. |
| `-o, --output <file>` | Defaults to `<spec-name>.http` beside the specification. |
| `--force` | Allows replacing output, never the input specification or a referenced file. |
| `--auth <selection...>` | Security alternative(s): scheme name, combined `scheme+scheme`, or `none` when public access is allowed. Multiple alternatives with the same schemes but different scopes are labelled `scheme[scope ...]`. |
| `--auth-flow <selection...>` | Flow name or scheme-specific choice such as `todo=client_credentials`. |

`/api/todos/*` selects descendants, not `/api/todos` itself. `/api/todos*` also matches similarly named paths. Quote selector lists to preserve spaces, wildcards, and shell-special characters.

The generator includes names, titles, descriptions, tags, parameter values, supported request examples, and status/content-type/response structure assertions. It prefers JSON bodies when available; forms, multipart, text/XML examples, and editable binary file imports are also supported. Example values are not assumed to be immutable response values. Edit parameter variables inside their JSON `{"value": ...}` wrapper; server variables support execution-time `--var` overrides.

Authentication respects global security, operation overrides, AND combinations, OR alternatives, and public operations. Ambiguous alternatives/flows prompt interactively; without a terminal, provide explicit options or generation fails. Basic/Digest/Bearer, API keys, OAuth2, and OpenID discovery use native httpyac helpers and environment-backed credentials. Unsupported schemes or incompatible combinations fail explicitly. Generation may read discovery but never obtains a token; credentials are needed only when executing generated requests.

OpenAPI implicit flows need not declare a token URL, but the native implicit/hybrid helper requires one. In that case generation emits an explicit `OAS_<SCHEME>_TOKEN_ENDPOINT` placeholder and warning rather than guessing a URL.

Workflow order follows selectors. Only explicit links from preceding selected operations bind request parameters or JSON bodies. Missing/ambiguous/unsupported links require review; the generator does not guess IDs, add unselected requests, or invent CRUD operations.

Internal, local-file, and HTTP(S) references are supported. **Only use trusted specifications**: reference loading can access local files and private-network URLs. Remote reference/discovery failures are explicit. Recursive/advanced schema and serialization limitations are reported in console output and generated comments; structural assertions are not full JSON Schema conformance validation.

See the single documented [Todo CRUD YAML example](../../examples/openapi/README.md), including OpenID client credentials, workflow links, public Kubernetes `/health`, runnable commands, and E2E coverage.

## `httpyac oauth2 --help`

```shell
Usage: httpyac oauth2 [options]

generate oauth2 token

Options:
  -f, --flow <flow>        flow used for oauth2 token generation (default: "client_credentials")
  --prefix <prefix>       variable prefix used for variables
  -e, --env <env...>      list of environments
  -o, --output <output>   output format of response (access_token, refresh_token, response) (default: "access_token")
  --var <variables...>    list of variables (e.g foo="bar")
  -h, --help              display help for command
```

The command reads the same environment and variable sources as normal request processing, then prints the selected OAuth2 value.

## CI output

Use `--json` for a JSON summary or `--junit` for JUnit XML output. Both modes suppress the normal request logger so CI can consume the machine-readable output directly.

Use `--filter only-failed` to keep collected output focused on failed requests.

> [!NOTE]
> **ZW edition:** CLI test exits are `0` when all executed requests and tests pass, `10` for unexpected execution errors, `19` when at least one test errors, and `20` when at least one test fails. See [ZW edition differences](ZW-Edition-Differences).

## Kafka optional dependency

> [!NOTE]
> **ZW edition:** Kafka requests use the optional native dependency `@confluentinc/kafka-javascript`; it ships prebuilt binaries for Linux glibc and musl on x64 and arm64, macOS x64 and arm64, and Windows x64. If no binary fits, npm builds from source; if that fails, httpyac still works and only Kafka requests fail. See [Kafka](Guide-Kafka). See [ZW edition differences](ZW-Edition-Differences).
