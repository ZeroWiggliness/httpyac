Plugins extend HttpYac (ZW edition) by registering hooks that run while `.http` files are parsed, variables are resolved, requests are sent, responses are logged, and assertions are evaluated. They are ordinary npm packages loaded by the `@zerowiggliness/httpyac` CLI or library. See [Plugin API](Plugin-API) for the hook signatures.

## What plugins can do

A plugin can:

- add variables or environments from another source
- rewrite variable placeholders
- add or parse request syntax
- add request or response behavior
- mask, transform, or suppress response logging
- add custom assertion values
- integrate a protocol or transport

Plugins run in the same process as HttpYac, so treat them as trusted code.

## Package shape

A service plugin is a Node package with a `package.json` and a CommonJS entry point:

```shell
httpyac-plugin-example
├── README.md
├── index.js
└── package.json
```

Example `package.json`:

```json
{
  "name": "httpyac-plugin-example",
  "version": "1.0.0",
  "description": "HttpYac plugin that adds example variables",
  "main": "index.js",
  "keywords": ["httpyac", "httpyac-plugin"],
  "peerDependencies": {
    "@zerowiggliness/httpyac": "^6.16.8"
  },
  "devDependencies": {
    "@zerowiggliness/httpyac": "^6.16.8"
  }
}
```

> [!NOTE]
> **ZW edition:** plugin packages for this fork should depend on `@zerowiggliness/httpyac`. Community plugins written for upstream `httpyac` generally work because the hook API is unchanged. See [ZW edition differences](ZW-Edition-Differences).

## Naming and discovery

Project plugins are discovered from the nearest project `package.json`. HttpYac loads dependencies and devDependencies whose package names match one of these forms:

- `httpyac-plugin-<name>`
- `@scope/httpyac-plugin-<name>`

Install the plugin in the project that contains the `.http` files:

```shell
npm install --save-dev httpyac-plugin-example
```

The exported module must be the hook configuration function:

```js
/**
 * @param {import('@zerowiggliness/httpyac').HttpyacHooksApi} api
 */
module.exports = function configureHooks(api) {
  api.log.info(`loaded plugin for ${api.httpFile.fileName}`);
};
```

The current implementation loads discovered plugin packages with Node `require`, so CommonJS is the safest output format for published plugins.

## Local and global hooks

In addition to package discovery, a project configuration can provide `configureHooks` directly, for example from `.httpyac.js`:

```js
module.exports = {
  configureHooks(api) {
    api.hooks.provideVariables.addHook('localVariables', () => ({
      localPluginEnabled: true,
    }));
  },
};
```

A global plugin can be pointed to with `HTTPYAC_PLUGIN`. This path is required directly and must export a `configureHooks` property:

```js
module.exports.configureHooks = function configureHooks(api) {
  api.hooks.onRequest.addHook('globalHeader', request => {
    request.headers = {
      ...request.headers,
      'x-from-global-plugin': 'true',
    };
  });
};
```

```shell
$env:HTTPYAC_PLUGIN = "C:\tools\httpyac-global-plugin.js"
httpyac send requests.http
```

## Minimal plugin examples

Add variables:

```js
module.exports = function configureHooks(api) {
  api.hooks.provideVariables.addHook('buildVariables', () => ({
    build: {
      id: process.env.BUILD_BUILDID,
      sourceBranch: process.env.BUILD_SOURCEBRANCH,
    },
  }));
};
```

Use them in a request:

```http
GET https://example.test/build/{{build.id}}
```

Add or change request headers:

```js
module.exports = function configureHooks(api) {
  api.hooks.onRequest.addHook('traceHeader', request => {
    request.headers = {
      ...request.headers,
      'x-trace-source': 'httpyac-plugin-example',
    };
  });
};
```

Mask response output before it is logged:

```js
module.exports = function configureHooks(api) {
  api.hooks.responseLogging.addHook('maskSecrets', response => {
    if (typeof response.body === 'string') {
      response.body = response.body.replace(/"token"\s*:\s*"[^"]+"/gu, '"token":"***"');
    }
  });
};
```

Cancel normal response logging:

```js
module.exports = function configureHooks(api) {
  api.hooks.responseLogging.addHook('skipHealthLog', response => {
    if (response.request?.url?.includes('/health')) {
      return api.getHookCancel();
    }
    return undefined;
  });
};
```

## Built-in plugins

HttpYac itself is composed from built-in plugins registered during startup. They use the same hook API as external plugins.

| Plugin key | Area |
| --- | --- |
| `core` | core parsing, metadata, variable handling, request execution and test result handling |
| `dotenv` | variables and environments from dotenv files |
| `eventSource` | Server-Sent Events / EventSource requests |
| `graphql` | GraphQL request parsing and request conversion |
| `grpc` | gRPC requests, proto imports and reflection metadata |
| `http` | HTTP transport, authentication, certificates, redirects and cookies |
| `intellij` | compatibility with IntelliJ-style dynamic variables and script behavior |
| `injection` | injected-language support for editors and tooling |
| `javascript` | JavaScript variables, scripts and global script hooks |
| `mqtt` | MQTT requests |
| `oauth2` | OAuth2 variable replacement and token variables |
| `rabbitMQ` | AMQP / RabbitMQ requests |
| `assert` | `??` assertions and assertion value providers |
| `websocket` | WebSocket requests |
| `xml` | XPath variables and assertion values |
| `kafka` | Kafka requests |

> [!NOTE]
> **ZW edition:** Kafka is a ZW-only built-in plugin. It uses the optional native dependency `@confluentinc/kafka-javascript` and is documented on [Kafka](Guide-Kafka). See [ZW edition differences](ZW-Edition-Differences).

## Loading order

For a parsed `.http` file, HttpYac builds one hook set in this order:

1. built-in plugins
2. plugins registered programmatically on the service
3. project package plugins discovered from dependencies and devDependencies
4. `configureHooks` from the project configuration
5. `HTTPYAC_PLUGIN`

Each hook also has its own ordering. Use stable hook ids and `before` or `after` options when order matters:

```js
module.exports = function configureHooks(api) {
  api.hooks.parse.addHook('myParser', parseMySyntax, { before: ['request'] });
};
```

Parser hooks for request lines and request bodies are registered by the built-in plugins and usually claim a line. If a plugin needs to parse new request syntax, register its parser before the built-in `request` or `requestBody` parser.

## Development tips

- Prefer `api.fileProvider` over direct `fs` access so plugins also work with virtual documents.
- Use `api.log` instead of `console` so output is routed correctly in CLI, library and editor scenarios.
- Use `api.config.plugins` for plugin-specific configuration.
- Keep plugin hook ids unique and descriptive.
- Make hook callbacks async only when they actually need I/O.
- Avoid depending on internal source paths. The public package exports the API models from `@zerowiggliness/httpyac`.
