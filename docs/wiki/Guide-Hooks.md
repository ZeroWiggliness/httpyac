Hooks are the extension points behind most HttpYac features. Use them from configuration or plugins when script blocks are not enough, for example to add default behavior for a whole project, provide variables, alter responses before logging, or add custom parsers.

- [Where hooks are configured](#where-hooks-are-configured)
- [Minimal example](#minimal-example)
- [Hook API](#hook-api)
- [Available hooks](#available-hooks)
- [Ordering and cancellation](#ordering-and-cancellation)
- [Project patterns](#project-patterns)
- [When to use scripts instead](#when-to-use-scripts-instead)

## Where hooks are configured

Project-local hooks can be added in `.httpyac.js` through `configureHooks`. The same API is used by bundled plugins and by plugins loaded from the project root or the `HTTPYAC_PLUGIN` environment variable.

```js
module.exports = {
  configureHooks(api) {
    api.hooks.onRequest.addHook("projectHeaders", request => {
      request.headers["x-project"] = "docs";
    });
  },
};
```

For reusable packages and deeper integration details, see [Plugin-API](Plugin-API) and [Configuration](Configuration).

## Minimal example

This hook removes sensitive request headers from the response object used for logging/output:

```js
module.exports = {
  configureHooks(api) {
    api.hooks.responseLogging.addHook("redactAuthorization", response => {
      if (response.request?.headers) {
        delete response.request.headers.authorization;
        delete response.request.headers.Authorization;
      }
    });
  },
};
```

## Hook API

`configureHooks(api)` receives an object with:

| Property | Purpose |
| --- | --- |
| `version` | Hook API version string. |
| `rootDir` | Detected project root, when available. |
| `httpFile` | Current parsed HTTP file. |
| `config` | Resolved environment/configuration object. |
| `hooks` | The hook collection described below. |
| `log` | Logger. |
| `fileProvider` | File-system abstraction used by httpyac. |
| `sessionStore` | User-session storage. |
| `userInteractionProvider` | Trust prompts and user interaction abstraction. |
| `httpClientProvider` | Registered request clients. |
| `javascriptProvider` | JavaScript execution/provider integration. |
| `utils` | Utility functions exported by httpyac. |
| `getHookCancel()` | Returns the hookpoint cancellation sentinel. |

Hook functions may be synchronous or asynchronous.

## Available hooks

| Hook | Signature | When it runs |
| --- | --- | --- |
| `parse` | `(getLineReader, parserContext)` | Parses `.http` lines into regions, metadata, bodies, scripts, assertions, and protocol-specific requests. |
| `parseMetaData` | `(key, value, parserContext)` | Handles metadata lines such as `# @name` or plugin metadata. |
| `parseEndRegion` | `(parserContext)` | Finalizes a parsed region after line parsing. |
| `replaceVariable` | `(value, type, processorContext)` | Replaces `{{...}}` variables and expressions. |
| `provideEnvironments` | `(variableProviderContext)` | Adds available environment names. |
| `provideVariables` | `(activeEnvironment, variableProviderContext)` | Adds variables for the active environment. |
| `provideAssertValue` | `(type, value, response, processorContext)` | Supplies values for `??` assertions. |
| `execute` | `(processorContext)` | Drives execution of a region. Returning `false` or the hook cancel sentinel stops that region. |
| `onRequest` | `(request, processorContext)` | Before the request client sends a request. |
| `onStreaming` | `(processorContext)` | During streaming request/client processing. |
| `onResponse` | `(response, processorContext)` | After a response is received and before it is stored on the region. |
| `responseLogging` | `(response, processorContext)` | Before the response is logged or exposed for output formatting. |

Examples:

```js
module.exports = {
  configureHooks(api) {
    api.hooks.provideVariables.addHook("buildVariables", () => ({
      buildNumber: process.env.BUILD_BUILDNUMBER,
    }));

    api.hooks.provideAssertValue.addHook("responseSize", (type, _value, response) => {
      if (type === "size") {
        return Buffer.byteLength(String(response.body ?? ""));
      }
      return false;
    });
  },
};
```

```http
GET https://example.test/data

?? size < 10000
```

## Ordering and cancellation

Hooks are identified by an id. Most registrations use:

```js
api.hooks.onRequest.addHook("myHookId", handler);
```

Many hooks also accept ordering options, as bundled plugins do:

```js
api.hooks.parse.addHook("customProtocol", parseCustomProtocol, { before: ["request"] });
api.hooks.replaceVariable.addHook("customVariables", replaceCustomVariables, { before: ["name"] });
```

Use the hook cancel sentinel for hooks where cancellation is meaningful:

```js
module.exports = {
  configureHooks(api) {
    const HookCancel = api.getHookCancel();

    api.hooks.onRequest.addHook("blockProductionDeletes", request => {
      if (request.method === "DELETE" && String(request.url).includes("prod")) {
        return HookCancel;
      }
    });
  },
};
```

For `execute`, returning `false` also causes the current region to stop. For `onRequest` and `onResponse`, returning the cancel sentinel prevents the request or response flow from continuing.

## Project patterns

### Add default request headers

```js
const crypto = require("crypto");

module.exports = {
  configureHooks(api) {
    api.hooks.onRequest.addHook("traceHeaders", request => {
      if (!request.headers["x-trace-id"]) {
        request.headers["x-trace-id"] = crypto.randomUUID();
      }
    });
  },
};
```

### Provide environment variables

```js
module.exports = {
  configureHooks(api) {
    api.hooks.provideVariables.addHook("ci", activeEnvironment => {
      if (activeEnvironment?.includes("ci")) {
        return {
          baseUrl: process.env.SERVICE_URL,
          token: process.env.SERVICE_TOKEN,
        };
      }
      return {};
    });
  },
};
```

### Transform logged responses

```js
module.exports = {
  configureHooks(api) {
    api.hooks.responseLogging.addHook("maskTokens", response => {
      if (typeof response.body === "string") {
        response.body = response.body.replace(/"token"\s*:\s*"[^"]+"/g, '"token":"***"');
      }
    });
  },
};
```

## When to use scripts instead

Use [Guide-Scripting](Guide-Scripting) for request-local setup, ad hoc response checks, and per-file event handlers. Use hooks when behavior should apply to a project or plugin, when you need to participate in parsing or variable resolution, or when you are adding a new assert value provider or protocol integration.
