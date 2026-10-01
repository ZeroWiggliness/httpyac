The plugin API exposes the current `.http` file, environment configuration, providers and hook collections to a plugin. A plugin registers callbacks with these hooks to participate in parsing, execution, logging and assertion handling. See [Plugins](Plugins) for packaging and loading.

## API object

The hook configuration function receives a `HttpyacHooksApi` object. It is defined in [`src/models/httpHooksApi.ts`](https://github.com/ZeroWiggliness/httpyac/blob/main/src/models/httpHooksApi.ts):

```ts
export interface HttpyacHooksApi {
  readonly version: string;
  readonly rootDir?: PathLike;
  readonly httpFile: Readonly<HttpFile>;
  readonly config: EnvironmentConfig;
  readonly hooks: HttpFileHooks;
  readonly log: LogHandler;
  readonly fileProvider: FileProvider;
  readonly sessionStore: SessionStore;
  readonly userInteractionProvider: UserInteractionProvider;
  readonly httpClientProvider: HttpClientProvider;
  readonly javascriptProvider: JavascriptProvider;
  readonly utils: typeof utils;
  getHookCancel(): typeof HookCancel;
}
```

## API properties

| Property | Type | Use |
| --- | --- | --- |
| `version` | `string` | Hook API version for the running HttpYac instance. |
| `rootDir` | `PathLike \| undefined` | Project root found for the current `.http` file. |
| `httpFile` | `Readonly<HttpFile>` | The file currently being prepared. It has hooks and parsed regions. |
| `config` | `EnvironmentConfig` | Resolved configuration for this run, including `config.plugins`. |
| `hooks` | `HttpFileHooks` | File-level hook collection. Most plugins register here. |
| `log` | `LogHandler` | Routed logging for CLI, library and editor use. |
| `fileProvider` | `FileProvider` | File access abstraction. Prefer this to direct `fs` calls. |
| `sessionStore` | `SessionStore` | User-session storage for persistent connection state. |
| `userInteractionProvider` | `UserInteractionProvider` | Prompts, warnings and trust checks where supported. |
| `httpClientProvider` | `HttpClientProvider` | Registry for request clients. |
| `javascriptProvider` | `JavascriptProvider` | JavaScript execution and module-loading support. |
| `utils` | `typeof utils` | Utility functions used by the core implementation. |
| `getHookCancel()` | `HookCancel` symbol | Symbol a hook can return to cancel supported hook chains. |

> [!NOTE]
> **ZW edition:** import types from `@zerowiggliness/httpyac` when authoring plugins for this fork. See [ZW edition differences](ZW-Edition-Differences).

## Registering hooks

Every hook supports `addHook(id, callback, options?)`. The `id` should be unique in the hook collection. `options.before` and `options.after` can place a hook relative to another hook id:

```js
module.exports = function configureHooks(api) {
  api.hooks.onRequest.addHook(
    'exampleHeader',
    request => {
      request.headers = {
        ...request.headers,
        'x-example-plugin': 'true',
      };
    },
    { before: ['setDefaultHttpyacHeaders'] }
  );
};
```

Hooks may be synchronous or async. Return `api.getHookCancel()` only for hooks where cancellation is meaningful, such as request, response and logging hooks.

## `HttpFileHooks`

The file-level hooks are defined in [`src/models/hooks.ts`](https://github.com/ZeroWiggliness/httpyac/blob/main/src/models/hooks.ts):

```ts
export interface HttpFileHooks {
  readonly parse: ParseHook;
  readonly parseMetaData: ParseMetaDataHook;
  readonly parseEndRegion: ParseEndRegionHook;
  readonly replaceVariable: ReplaceVariableHook;
  readonly provideEnvironments: ProvideEnvironmentsHook;
  readonly provideVariables: ProvideVariablesHook;
  readonly provideAssertValue: ProvideAssertValue;

  readonly execute: ExecuteHook;
  readonly onStreaming: OnStreaming;
  readonly onRequest: OnRequestHook;
  readonly onResponse: OnResponseHook;
  readonly responseLogging: ResponseLoggingHook;
}
```

## Parsing hooks

### `parse`

```ts
(getLineReader: getHttpLineGenerator, context: ParserContext) =>
  HttpRegionParserResult | false | Promise<HttpRegionParserResult | false>
```

Parses one logical line or block. Return a parser result when your hook handled the current line; return `false` to let later parsers try. Register custom request-line parsers before the built-in `request` parser and custom body parsers before `requestBody`:

```js
api.hooks.parse.addHook('myProtocol', parseMyProtocol, { before: ['request'] });
```

### `parseMetaData`

```ts
(key: string, value: string | undefined, context: ParserContext) =>
  boolean | Promise<boolean>
```

Runs after metadata such as `# @name` has been parsed into the current region. Use it to react to custom metadata keys.

### `parseEndRegion`

```ts
(context: ParserContext) => void | Promise<void>
```

Runs when parsing finishes a region. Built-in plugins use this to finalize region-dependent state.

## Variable and environment hooks

### `replaceVariable`

```ts
(value: unknown, type: VariableType | string, context: ProcessorContext) =>
  unknown | Promise<unknown>
```

Transforms text while variables are resolved. `type` is a `VariableType` such as body, URL or file path, or a header name when the value came from a header.

```js
api.hooks.replaceVariable.addHook('companyVars', value => {
  if (typeof value !== 'string') {
    return value;
  }
  return value.replace(/\{\{\$company\}\}/gu, 'Zero Wiggliness');
});
```

### `provideVariables`

```ts
(activeEnvironment: string[] | undefined, context: VariableProviderContext) =>
  Variables | Promise<Variables>
```

Provides variables for the current run. Returned objects are merged with variables from other providers.

```js
api.hooks.provideVariables.addHook('ciVariables', () => ({
  ci: {
    buildId: process.env.BUILD_BUILDID,
  },
}));
```

### `provideEnvironments`

```ts
(context: VariableProviderContext) => string[] | Promise<string[]>
```

Provides environment names that can be selected with the CLI or editor.

## Assertion hooks

### `provideAssertValue`

```ts
(
  type: string,
  value: string | undefined,
  response: HttpResponse,
  context: ProcessorContext
) => unknown | Promise<unknown>
```

Provides the left-hand value for an assertion line:

```http
?? status == 200
?? header content-type includes application/json
```

The built-in assert plugin asks this hook for `status`, `header`, `body`, JavaScript values and duration values. Return `false` when your hook does not handle the requested `type`.

```js
api.hooks.provideAssertValue.addHook('requestHeaderAssertValue', (type, name, response) => {
  if (type !== 'requestHeader' || !name) {
    return false;
  }
  return response.request?.headers?.[name.toLowerCase()];
});
```

### Assert predicates

Assert predicates are the operators in `??` lines, such as `==`, `includes`, `matches`, `matchesFile` and `matchesJsonFile`.

> [!NOTE]
> **ZW edition:** file comparison asserts extend the internal predicate interface. `TestPredicate.match(value, expected, context?: ProcessorContext)` may return `boolean | TestPredicateResult | Promise<boolean | TestPredicateResult>`, where `TestPredicateResult = { valid: boolean; message?: string }`; `message` replaces the default assert message, and predicate ids are matched longest-first so `matchesFile` is not shadowed by `matches`. See [ZW edition differences](ZW-Edition-Differences).

The final ZW predicate shape is:

```ts
export interface TestPredicateResult {
  valid: boolean;
  message?: string;
}

export interface TestPredicate {
  readonly id: Array<string>;
  readonly noAutoConvert?: boolean;
  match(
    value: unknown,
    expected: unknown,
    context?: ProcessorContext
  ): boolean | TestPredicateResult | Promise<boolean | TestPredicateResult>;
}
```

The assert parser has an internal `predicates` array, but the package entry point does not expose the `plugins` module as part of the public `@zerowiggliness/httpyac` API. Do not rely on deep imports to register custom predicate operators. Public plugins can add new assertion value types with `provideAssertValue`; custom predicate registration is not currently a supported public extension point.

## Execution hooks

### `execute`

```ts
(context: ProcessorContext) => boolean | Promise<boolean>
```

Runs a region. Protocol plugins use this hook to execute a request client. Return `true` when execution succeeded. Returning `false` makes the region execution fail.

### `onStreaming`

```ts
(context: ProcessorContext) => void | Promise<void>
```

Runs during streaming setup. Streaming protocols use this to attach handlers before responses arrive.

### `onRequest`

```ts
(request: Request, context: ProcessorContext) => void | Promise<void>
```

Runs before a request is sent. You can mutate headers, body or request options.

```js
api.hooks.onRequest.addHook('buildHeader', request => {
  request.headers = {
    ...request.headers,
    'x-build-id': process.env.BUILD_BUILDID || 'local',
  };
});
```

### `onResponse`

```ts
(response: HttpResponse, context: ProcessorContext) => void | Promise<void>
```

Runs after a response is received and before it is stored on the region. The response is passed through a proxy so changing `response.body` also refreshes cached body fields.

```js
api.hooks.onResponse.addHook('normalizeJsonBody', response => {
  if (typeof response.body === 'string') {
    response.body = response.body.trim();
  }
});
```

### `responseLogging`

```ts
(response: HttpResponse, context: ProcessorContext) => void | typeof HookCancel | Promise<void | typeof HookCancel>
```

Runs before a response is written to the configured log output. Mutate the proxied response to redact or format it. Return `api.getHookCancel()` to skip normal logging for that response.

## File and provider guidance

Use API providers instead of process globals where possible:

- Use `api.fileProvider` for file reads, path joins and directory checks.
- Use `api.log` for diagnostics instead of `console`.
- Store connection state in `api.sessionStore` when a protocol keeps persistent connections.
- Check `api.userInteractionProvider` before loading untrusted code or prompting.
- Read plugin options from `api.config.plugins?.<pluginName>`.

This keeps plugins usable in CLI, library, editor and virtual-document scenarios.
