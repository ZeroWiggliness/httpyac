## v6.17.0

### Features
* *(#796)* add support for better Buffer JSON stringify ([10d03fd](https://github.com/ZeroWiggliness/httpyac/commit/10d03fdf478d3a172835eb58d0dd0dca2acb2cde))
* add https_proxy support ([cdd78e2](https://github.com/ZeroWiggliness/httpyac/commit/cdd78e24544105ca48c4e84bc9df684c1f1d24f3))
* Add Kafka protocol support ([#11](https://github.com/ZeroWiggliness/httpyac/issues/11)) ([f1e297e](https://github.com/ZeroWiggliness/httpyac/commit/f1e297e358388869470ca075f80a956f54c65bef))
* add QUERY method support and related tests ([fdc9b9b](https://github.com/ZeroWiggliness/httpyac/commit/fdc9b9bdbe3b914fb52c532df448749aba06cb0c))
* add some logging to $auth replacement (Anweber/vscode-httpyac[#309](https://github.com/ZeroWiggliness/httpyac/issues/309)) ([d1628a5](https://github.com/ZeroWiggliness/httpyac/commit/d1628a5eef9f2a6f8468f5bb9b597b705cca46f0))
* changed behaviour from `@ref` (AnWeber/vscode-httpyac[#336](https://github.com/ZeroWiggliness/httpyac/issues/336)) ([7339667](https://github.com/ZeroWiggliness/httpyac/commit/733966796efa95bbf9c6a7dac5adf4aa959b036b))
* ignore all xml parse exceptions with undefined and log statement ([#821](https://github.com/ZeroWiggliness/httpyac/issues/821)) ([e7c272e](https://github.com/ZeroWiggliness/httpyac/commit/e7c272e76d4415342b9ceebd382caf8b821ae34b))
* logger supports call to parent logger (AnWeber/vscode-httpyac[#347](https://github.com/ZeroWiggliness/httpyac/issues/347)) ([3174b19](https://github.com/ZeroWiggliness/httpyac/commit/3174b1945a9717d1f761916e70745e8fc1cdf105))
* prefix output with name as fallback for title (AnWeber/vscode-httpyac[#318](https://github.com/ZeroWiggliness/httpyac/issues/318)) ([620ef48](https://github.com/ZeroWiggliness/httpyac/commit/620ef487008fdf7a4485705a5ae514eba368254c))
* remove `unexpected-response` listener to support abortHandshake in ws ([#816](https://github.com/ZeroWiggliness/httpyac/issues/816)) ([5827f89](https://github.com/ZeroWiggliness/httpyac/commit/5827f89f2af94f295c87509476078c2e69669579))
* remove file output if assert ?? is used (AnWeber/vscode-httpyac[#335](https://github.com/ZeroWiggliness/httpyac/issues/335)) ([0fdfe16](https://github.com/ZeroWiggliness/httpyac/commit/0fdfe162dfeb0dfe52586c1590c70c0245813fae))
* remove types of tough-cookie ([e21452d](https://github.com/ZeroWiggliness/httpyac/commit/e21452d3519deedaa7f0f7f72e309df77eb481e6))
* revert testUtils test change ([6e24065](https://github.com/ZeroWiggliness/httpyac/commit/6e24065b8ff1faf2e43937f386a5e7677ce7d8c4))
* support `http_proxy` environment variable ([a66ac9f](https://github.com/ZeroWiggliness/httpyac/commit/a66ac9f530178f04e3c9bf8fa13f18384de26e89))
* support $env intellij environment variables access ([#811](https://github.com/ZeroWiggliness/httpyac/issues/811)) ([96d311d](https://github.com/ZeroWiggliness/httpyac/commit/96d311dad8d2395785455064fec9e6d56f930802))
* support client certificates on OAuth2 Requests ([#802](https://github.com/ZeroWiggliness/httpyac/issues/802)) ([b39a474](https://github.com/ZeroWiggliness/httpyac/commit/b39a4742e9a8d65191e8c9692a1b0e95b1888139))
* update changelog and add some logs ([1b9d06f](https://github.com/ZeroWiggliness/httpyac/commit/1b9d06fbcba32c4573857b18b21cfe4d0785cbfe))
* Update cloudamqp/amqp-client to v3.4.1 to make AMQP work again. ([22faaee](https://github.com/ZeroWiggliness/httpyac/commit/22faaee1baa7e67066c7c13d8600a0f42ae82e6d))
* update inquirer ([322f54c](https://github.com/ZeroWiggliness/httpyac/commit/322f54c2475c7767b52ed39e50ff00f221372526))
* update Intellij d.ts Stubs and add Window.btoa/atob ([#839](https://github.com/ZeroWiggliness/httpyac/issues/839)) ([3f12e64](https://github.com/ZeroWiggliness/httpyac/commit/3f12e64fcef9fab162f8d35dfa2068f3f1f2cfe2))
* update uuid ([be8f0bf](https://github.com/ZeroWiggliness/httpyac/commit/be8f0bfd41510852ac2b0292ec7064aaa4d37438))
* update uuid ([b122103](https://github.com/ZeroWiggliness/httpyac/commit/b122103dddbee7b48eb414c363bfd1ccc174446a))
* update version ([498fa39](https://github.com/ZeroWiggliness/httpyac/commit/498fa39ee7efd479379ad631a76d49e83d88f99b))
* update xmldom ([f63bbd0](https://github.com/ZeroWiggliness/httpyac/commit/f63bbd0ab9ab148287a3d158d42c458e9053824b))

### Bug Fixes
* *(#813)* update tough-cookie to remove punycode deprecation warning ([e457ab5](https://github.com/ZeroWiggliness/httpyac/commit/e457ab536db6b8feb8876dd9c3ae1721fa3d33a0))
* *(#821)* handle dom parser exception for invalid xml ([c34481c](https://github.com/ZeroWiggliness/httpyac/commit/c34481ce477a75fadf282dae32587e1de89d04e6))
* *(AnWeber/vscode-httpyac#323)* add skipped test result on user cancellation ([7905f2d](https://github.com/ZeroWiggliness/httpyac/commit/7905f2d316ab66db6f93480973775d6834e479a9))
* *(AnWeber/vscode-httpyac#338)* do not log stack on assertions error ([e8851dc](https://github.com/ZeroWiggliness/httpyac/commit/e8851dc54736f8bd830954063cd8c64ff5a37058))
* *(AnWeber/vscode-httpyac#338)* do not log stack on assertions error ([55e0867](https://github.com/ZeroWiggliness/httpyac/commit/55e08676c2462292a4b984319eef2495fddd8665))
* add skip test result if `@ref` is skipped (AnWeber/vscode-httpyac[#297](https://github.com/ZeroWiggliness/httpyac/issues/297)) ([0b562f2](https://github.com/ZeroWiggliness/httpyac/commit/0b562f24d19cbad226c46c1c44bc3a200b1d5449))
* allow proxy for oauth2 using `oauth2_proxy` ([#841](https://github.com/ZeroWiggliness/httpyac/issues/841)) ([1889adf](https://github.com/ZeroWiggliness/httpyac/commit/1889adff93d66beb0fb543915c92bad5e8903bbf))
* change log message to warn (AnWeber/vscode-httpyac[#357](https://github.com/ZeroWiggliness/httpyac/issues/357)) ([7355702](https://github.com/ZeroWiggliness/httpyac/commit/7355702b78d5985d0f122355d83c6b8924a820f8))
* ensure correct order if cli args are used ([#773](https://github.com/ZeroWiggliness/httpyac/issues/773)) ([f7c692b](https://github.com/ZeroWiggliness/httpyac/commit/f7c692bf5eca80d3cc2df392099f6fb703d707a9))
* errored or skipped referenced httpregion also skips current http region ([#842](https://github.com/ZeroWiggliness/httpyac/issues/842), AnWeber/vscode-httpyac[#339](https://github.com/ZeroWiggliness/httpyac/issues/339)) ([d9e932e](https://github.com/ZeroWiggliness/httpyac/commit/d9e932e26f5afa04ab78790c6cc07d05cd519340))
* failed tests in reference skips request (AnWeber/vscode-httpyac[#335](https://github.com/ZeroWiggliness/httpyac/issues/335)) ([443b84a](https://github.com/ZeroWiggliness/httpyac/commit/443b84a2d48a67d703d174ad13e68de45d8f1bab))
* ignore whitespace before & in formurlencoded ([#699](https://github.com/ZeroWiggliness/httpyac/issues/699)) ([466f92d](https://github.com/ZeroWiggliness/httpyac/commit/466f92d36778612bc482a03ddcd699751984c7d3))
* junit testcase failure message ([89a439d](https://github.com/ZeroWiggliness/httpyac/commit/89a439dfd99841f4d6874472b8782261b5430c06))
* logic issue if testResults is only success ([69609d2](https://github.com/ZeroWiggliness/httpyac/commit/69609d2c11e1fcb81d66f59e774b520d4d534dd2))
* named response is only set, if all testResults are valid ([c7d9f78](https://github.com/ZeroWiggliness/httpyac/commit/c7d9f7857ca842e9b43144228d405cf232cbf862))
* remove xpath property ([c0c16d9](https://github.com/ZeroWiggliness/httpyac/commit/c0c16d9451925bfa4e6bdab52ceaa197077699b1))
* return non-zero exit code for errored test ([f2663e5](https://github.com/ZeroWiggliness/httpyac/commit/f2663e50202adb54b6f5c705b58572de12b421ce))
* state parameter validation ([4807e18](https://github.com/ZeroWiggliness/httpyac/commit/4807e181c22208bf29f44e386c9c8fe9229348c2))
* test without signature ([460db94](https://github.com/ZeroWiggliness/httpyac/commit/460db941799c09daa7ca66a582decc68aaae4f22))
* tsc error after update ([1526d8f](https://github.com/ZeroWiggliness/httpyac/commit/1526d8fea6d71160ed8cf3a11d9248b1275cc841))
* typo in environment ([#767](https://github.com/ZeroWiggliness/httpyac/issues/767)) ([42e3fcd](https://github.com/ZeroWiggliness/httpyac/commit/42e3fcdc45659d0db0bae7efc63cf7ddbf857ca0))
* typo in summary ([#762](https://github.com/ZeroWiggliness/httpyac/issues/762)) ([03543ec](https://github.com/ZeroWiggliness/httpyac/commit/03543ec716d6b2b35d62a9d38d3a2704dcad9bdd))
* use different exit codes for errored and failed tests ([4e3b601](https://github.com/ZeroWiggliness/httpyac/commit/4e3b601651d044e53caef77e7a80df2bc4d3c61d))
* use only valid mimetype in parseFromString ([b8639c0](https://github.com/ZeroWiggliness/httpyac/commit/b8639c014b88418d3ab367ae4d4df6664e1cbddf))
* use regex in test for date match ([9e93c80](https://github.com/ZeroWiggliness/httpyac/commit/9e93c806d2f7640e83b130cdb9abe3cbce1981f2))

### Documentation
* add example to variables to cli ([#767](https://github.com/ZeroWiggliness/httpyac/issues/767)) ([87d71c8](https://github.com/ZeroWiggliness/httpyac/commit/87d71c8a756962adcb98e8d34fdb5025e6194c83))
* update changelog ([5365c80](https://github.com/ZeroWiggliness/httpyac/commit/5365c8072f9182680456332514f600ef04e0248c))
* update changelog ([8cbc1ea](https://github.com/ZeroWiggliness/httpyac/commit/8cbc1ea01d3c5a2049d9df1295bfde76ff9073f9))
* update changelog ([37ddfff](https://github.com/ZeroWiggliness/httpyac/commit/37ddfff3df9e812ab19fa64b1affe939d3969912))
* update changelog ([dd913bd](https://github.com/ZeroWiggliness/httpyac/commit/dd913bd5e8971f5974355d859531af3445e4cc5f))

---
_Generated on 2026-10-05_


## [Unreleased]

### Features
- Kafka support (`KAFKA`, `kafka://` and `kafkas://` requests) with the methods `produce`, `consume`, `commit` and `seek`, using the optional dependency `@confluentinc/kafka-javascript` (see [Kafka guide](docs/kafka.md))
- set Kafka message headers with request headers and read consumed message headers as response headers

### Chore
- removed unused dependency `kafkajs`

## [6.16.7] (2025-03-30)

### Fix
- ignore whitespace before & in formurlencoded (#699)
- Invalid state error with authorization code flow when the state parameter is percent-encoded (#871)

## [6.16.6] (2025-01-11)

### Fix
- allow proxy for oauth2 using `oauth2_proxy` (#841)

## [6.16.5] (2025-01-06)

### Features
- logger supports call to parent logger (AnWeber/vscode-httpyac#347)
- update Intellij d.ts Stubs and add Window.btoa/atob (#839)

### Fix
- ensure correct order if cli args are used (#773)
- errored or skipped referenced httpregion also skips current http region (#842, AnWeber/vscode-httpyac#339)


## [6.16.4] (2024-11-03)

### Features
- add support for better Buffer JSON stringify (#796)

### Fix
- handle dom parser exception for invalid xml (#821)
- do not log stack on assertions error (AnWeber/vscode-httpyac#338)
- only clear output channel for test runs (AnWeber/vscode-httpyac#337)
- add skipped test result on user cancellation (AnWeber/vscode-httpyac#323)

## [6.16.3] (2024-10-30)

### Fix
- revert: named response is only set, if all testResults are valid
- changed behaviour from `@ref` (AnWeber/vscode-httpyac#336)
  - negative test results from reference does not stop dependent request
  - errored reference is not executed multiple times if it is referenced multiple times


## [6.16.2] (2024-10-29)

### Fix
- named response is only set, if all testResults are valid


## [6.16.1] ( 2024-10-29)

### Fix
- support `http_proxy` environment variable
- support html mimetype for dom parser and use only valid mimetype in parseFromString


## [6.16.0] ( 2024-10-28)
### Features
- support client certificates on OAuth2 Requests (#802)
- update tough-cookie to remove punycode deprecation warning (#813)
- support $env intellij environment variables access (#811)
- failed tests in reference skips request (AnWeber/vscode-httpyac#335)
- support `http_proxy` environment variable
- remove `unexpected-response` listener to support abortHandshake in ws (#816)

## [6.15.1] ( 2024-08-22)
### Features
- prefix output with name as fallback for title (AnWeber/vscode-httpyac#318)

### Fix

- ensure valid names of parsed symbols (AnWeber/vscode-httpyac#297)
- copy header for aws signing (#769)
- add skip test result if `@ref` is skipped (AnWeber/vscode-httpyac#297)

## [6.15.0] ( 2024-08-04)
### Features
- add support to define timeout per request using `request.timeout` or setting variable `request_timeout`

### Fix
- variables in gql Query body are replaced (AnWeber/vscode-httpyac#303)
- allow defaultHeaders to overwrite accept or user-agent header
- only try loading grpc reflection if no other protodefinition file is imported or it is explicitly triggerd using grpcReflection (#757)
- add better handling for disabled and error tests (Anweber/vscode-httpyac#297, #760)
- support empty passwords for Basic auth  (#751)
- error do not bail test runs and instead just set error for this httpRegion (#708)

## [6.14.0] ( 2024-06-01)
### Features
- add `--tag` support to cli to only execute httpRegion with defined tag (#693)

### Fix
- prevent readFile Error log output on package.json search (Anweber/vscode-httpyac#293)
- disabled MetaData Handler checks disabled State on occurence of line in execution order (AnWeber/vscode-httpyac#292)
- support Intellij Multiline FormUrlEncoded Syntax (#699)
- better match .env files to ignore false positive like `.envrc` (#700)

## [6.13.3]
### Fix
- Aws Signing use query params in signing request (#684)
- allow check for floats (Anweber/vscode-httpyac#283)

## [6.13.2] ( 2024-05-01)
### Fix
- ensureUniqueId on merge (Anweber/vscode-httpyac#280)
- replace header variables after body variables to allow valide Request Signing (#684)

## [6.13.1] ( 2024-04-29)

### Fix
- `$random.integer() returns valid integer (Anweber/vscode-httpyac#277)

## [6.13.0]
### Features
- update to new API Changes of Intellij Http Client
- add support for OAuth2 Intellij API (AnWeber/vscode-httpyac#275)

### Fix
- JUnit Test Output conforms to Junit 5 XSD (#673)

## [6.12.2]
### Fix
- test results generated by `@loop` override previous test results for junit output(#664)

## [6.12.1]
### Fix
- provide no duplicate symbols on filter call (Anweber/vscode-httpyac#269)
- request count ignores disabled region (#663)
- show replaced expected value in test results to improve user experience (#663)

## [6.12.0] (2023-03-17)

### Features
- add current symbol to filter result if symbol matches predicate (AnWeber/vscode-httpyac#265)

### Fix
- call `end()` instead of `cancel()`on successful GRPC Client Streaming (Anweber/vscode-httpyac#264)

## [6.11.5] (2023-02-27)

### Fix
- replace grpc-reflection-js with grpc-js-reflection-client
- fix order of log output in cli (#644)

## [6.11.4] (2023-02-25)

### Fix
- Assertsions for Zero are working (AnWeber/vscode-httpyac#260)
- typo in junit report.xml generation (#642)

## [6.11.3] (2023-02-02)

### Fix
- Variable is replaced in multipart/form-data when file is injected (AnWeber/vscode-httpyac#258)

## [6.11.2] (2023-01-31)

### Fix
- hide password answer in sessionStore (AnWeber/httpbook#111)
- add Content-Type if protocol `GRAPHQL` is used to support same API as Intellij HTTP Client (AnWeber/vscode-httpyac#257)

## [6.11.1] (2023-01-14)

### Fix
- Intellij store variables independent from current env in global cache (#612)
- always use GRPC Reflection to support same Behaviour as Intellij (Anweber/vscode-httpyac#254)

## [6.11.0] (2023-12-29)

### Feature

- add `audience` and `resource` to OAuth2 token exchange flow (AnWeber/vscode-httpyac#248)
- allow intercepting and modification of OAuth2 Request before sending using `oauht2_interceptRequest` (#605)

### Fix

- escaping of `\{\{2\}\}` did not work (Anweber/vscode-httpyac#244)
- support only `http-client.env.json` and `http-client.private.env.json` files for intellij environments (Anweber/vscode-httpyac#245)
- add support to set requestUnauthorized to OAuth2 Requests (#605)
- allow empty string in input and list provider (AnWeber/vscode-httpyac#247)
- parsing issue with multiline url parsing with only variable content (Anweber/vscode-httpyac#249)

## [6.10.0] (2023-11-13)

### Feature

- add support for dynamic `# @ref` (#585)

### Fix

- device code flow uses correct interval
- `expires_in` is not required in OAuth2Response (AnWeber/vscode-httpyac#240

## [6.9.3] (2023-11-05)

### Fix

- add [npm package provenance](https://github.blog/2023-04-19-introducing-npm-package-provenance/) (2nd try)


## [6.9.2] (2023-11-05)

### Fix

- improve junit output with updated testcase node
- add [npm package provenance](https://github.blog/2023-04-19-introducing-npm-package-provenance/)


## [6.9.1] (2023-11-01)

### Fix

- improve junit output using nested testsuite for httpFile and httpRegion

## [6.9.0] (2023-11-01)

### Feature

- junit export using '--junit'  args

### Fix

- do not fail on javascript assert (#572)

## [6.8.2] (2023-10-23)

### Feature

- add new meta data `# @post-redirect-get` to always use method `GET` for redirects (#563)

### Fix

- use grpc Stream cancel method if available

## [6.8.1] (2023-10-16)

### Fix

- allow import of `.httpyac.cjs` or `.httpyac.config.cjs` file
- Memory Leak in grpc client, because grpc client is not closed (#231)

## [6.8.0] (2023-10-15)

### Feature

- add support for grpc-reflection (#566)

### Fix
- only use default scope `opendid` if no scope is defined (#560)
- use repeat only in mainContext and not in forceRef calls (#562)
- store all connections as session in userStorage to allow disconnect (#565)
- new amqp client does not disconnect previous amqp client (#565)

## [6.7.1] (2023-10-02)

### Fix

- complete activeEnvironment refactor (Anweber/vscode-httpyac#230)
- add filename to processedHttpRegion

## [6.7.0] (2023-10-01)

### Feature

- allow change of active Environment in provided context (Anweber/vscode-httpyac#225)
- allow setting channelCredentials in header using `string` (#553)
- support using require in inline template

### Fixes

- improvements to completionItem API (AnWeber/vscode-httpyac#224)


## [6.6.7]  (2023-09-18)

### Fixes

- reenable Http Header completion (AnWeber/vscode-httpyac#223)


## [6.6.6]  (2023-09-15)

### Fixes

- resolve connect Promise in Websocket Requests on close before open Connection (AnWeber/httpbook#96)

## [6.6.5]  (2023-09-06)

### Fixes

- support of `--bail` does also work in referenced http files (#540)

## [6.6.4]  (2023-09-02)

### Fixes

- support return of null in variable replacement (#513)
- allow for variable use in $pick picklists: `{{ $pick ask-variable? $value: data }}` (#537)
- pre request in intellij format is executed before variable replacer (#534)
- allow removal of UserAgent Header (httpyac/httpyac.github.io#70) using script
```
{{@request
  request.headers["User-Agent"] = undefined
}}
```

## [6.6.3]  (2023-07-25)

### Fixes

- support multiple `# @import` of the same file from different httpFiles (#508)

## [6.6.2]  (2023-07-24)

### Fixes

- support OData Batch Processing (#507)

## [6.6.1]  (2023-07-23)

### Fixes

- improve stability of asserts using objects/arrays (#503)

## [6.6.0]  (2023-07-17)

### Features

- add method `$getOAuth2Response` to javascript context (#499)
- add `HttpClientProvider` and `JavascriptProvider` to httpyac API
- allow global Asserts and `onRequest`/ `onResponse` hooks and import global Asserts from other Http Files (#488) 
- support xpath namespaces using `@xpath_ns` (#493)

### Fixes

- always log current `httpRegion` and `response` on exception (#275)

## [6.5.1]  (2023-06-13)

### Fixes

- `output=none` is respected in CLI (#477)
- `$input-askonce` does not ask again for existing variables (#477)

## [6.5.0]  (2023-06-11)

### Features

- support configuration of output request logger options in .httpyac config (#467)
- calculate average of timings for repeat (httpyac/httpyac.github.io#69)
- `--output exchange` displays timings in cli (httpyac/httpyac.github.io#69)

### Fixes

- use `env` as default env dirname (Anweber/vscode-httpyac#198)

## [6.4.6]  (2023-06-09)

### Fixes

- default headers do not overwrite headers with other casing (Anweber/vscode-httpyac#200)
- env dir is resolved correctly (Anweber/vscode-httpyac#198)

## [6.4.5]

### Fixes

- output-failed did not work, if output none is used (460)
- prefer httpyac config files for root determination (AnWeber/vscode-httpyac#194)
- unresolved `# @ref` throws error (AnWeber/vscode-httpyac#197)
- after script is not triggered too much while using `@loop` (#463)

## [6.4.4] (2023-05-23)

### Fixes

- `# @jwt` metadata parsedBody matches body (#454)
- allow comment in last line of script (#454)
- ignore region names which are not valid Javascript Variables (#455)

## [6.4.3] (2023-05-16)

### Fixes

- request method detection supports only uppercase character to prevent false positives (#447)

## [6.4.2] (2023-05-07)

### Fixes

- reuse current NodeJS Context instead of creating custom Context to allow use of crypto in NodeJS@20 (#437)

## 6.4.1 (2023-05-01)

### Fixes

- using askonce modifier is optional (AnWeber/vscode-httpyac#190)

## 6.4.0 (2023-04-29)

### Features

- add support for custom plugins in httpFileStore initialization (AnWeber/vscode-httpyac#186)
- add modifier `$input-askonce` to ask only once for $input (#436)

### Fixes

- ensure deletion of additional body properties (prettyPrintBody, parsedBody, rawBody), if `body` property is modified (AnWeber/httpbook#84)

## 6.3.4 (2023-03-30)

### Fixes

- response is correctly parsed with HttpSymbolKind.Response
- Markdown and Asciidoctor Files are parsed correctly in CLI (#425)

## 6.3.3 (2023-03-23)

### Fixes

- allow async/await syntax in code snippets (#398)
- unable to use variable as graphql input (#421)

## 6.3.2 (2023-03-17)

### Fixes

- `# @import` imports variables of \*.http files (AnWeber/vscode-httpyac#184)
- setSource uses correct startOffset (AnWeber/httpbook#82)

## 6.3.1 (2023-03-16)

### Fixes

- add activeEnvironment to HttpFile (#415)

## 6.3.0 (2023-03-15)

### Breaking Changes

- some utils functions are removed and added directly to httpRegion (e.g isGlobalHttpRegion)

### Features

- add Additional orchestration capabilities by providing [`$httpyac`](https://github.com/ZeroWiggliness/httpyac/blob/main/src/plugins/javascript/httpyacJsApi.ts) in Script (#405)

### Fixes

- fix Maximum call stack size exceeded when remove AMQP Session from store (#410)
- add missing request to GRPC, AMQP, Websocket and EventSource Responses (#413)

## 6.2.1 (2023-03-07)

### Fixes

- no infinite loop using cli with selection (#409)

## 6.2.0 (2023-03-05)

### Features

- allow sending body in GET Request (AnWeber/vscode-httpyac#179)
- allow import of files into variable (AnWeber/vscode-httpyac#180)
- allow setting global var with variable notation (AnWeber/vscode-httpyac#180)

### Fixes

- GRPC Request needs to be object instead of Buffer/string (Anweber/httpyac#407)

## 6.1.0 (2023-02-13)

#### Features

- add code completion for tests

## 6.0.0 (2023-02-12)

#### Breaking Changes

- Protocol Specific Request Clients are replaced with generic interface RequestClient (`$requestClient`).
- to access previous Client you can use `$requestClient.nativeClient`
- removed Variables: amqpClient, amqpChannel, grpcStream, mqttClient, websocketClient
- requireUncached is removed

#### Features

- use `$requestClient.send(<body>)` to send string or Buffer with current client. Add EventListener `$requestClient.on('message', (response) => ...)` to access respones of client

```
MQTT tcp://broker.hivemq.com
topic: httpyac

{{@streaming
  async function writeStream(){
    await sleep(1000);
    $requestClient.on("message", (response) => {
      console.info(response);
    });
    $requestClient.send("find me");
    await sleep(1000);
    $requestClient.send("wait for response");
    await sleep(1000);
  }
  exports.waitPromise = writeStream();
}}
```

- extended and simpler assert logic ([docs](https://httpyac.github.io/guide/assert.html))

```
GET https://httpbin.org/anything

?? status == 200
```

- multiple specification of request body per response (like Intellij Request Body separator)

```
MQTT tcp://broker.hivemq.com
topic: httpyac

Send one
===
Send two
=== wait-for-server
=== wait-for-server
Send three
```

- websocket requests with same url as a websocket request are requested with the same url. You can keep a WebSocket Client open and send additional requests.

```
# @keepStreaming
wss://scrumpoker.foo

###
wss://scrumpoker.foo
["CONNECT\naccept-version:1.1,1.0\nheart-beat:10000,10000\n\n\u0000"]
===
["SUBSCRIBE\nid:sub-0\ndestination:/user/topic/username\n\n\u0000"]
===
["SUBSCRIBE\nid:sub-1\ndestination:/user/topic/notification\n\n\u0000"]
===
["SUBSCRIBE\nid:sub-3\ndestination:/topic/setting/cardset/{{roomId}}\n\n\u0000"]
===
["SEND\ndestination:/ws/room/register\n\n{\"roomID\":\"{{roomId}}\"}\u0000"]
===
["SEND\ndestination:/ws/user/username\n\n{\"username\":\"httpyac\"}\u0000"]
###
wss://scrumpoker.foo
["SEND\ndestination:/ws/room/{{roomId}}/estimate\n\n{\"estimation\":\"5\"}\u0000"]

```

- add parallel option to cli and test runner to execute requests in parallel.
- process each line of an event stream like Intellij ([see](https://www.jetbrains.com/help/idea/http-response-handling-examples.html#stream_scripting))
- add `proxyExcludeList` config to exclude some url from proxy calls (AnWeber/vscode-httpyac#176)

#### Fixes

- no-redirect did not prevent redirect (AnWeber/vscode-httpyac#171)
- `private.env.json` settings overrides other `env.json` settings to be Intellij compatible (AnWeber/vscode-httpyac#175)

## 5.10.2 (2023-01-21)

#### Fix

- xmldom warnings and errors are redirected to log.debug (#383)

## 5.10.1 (2023-01-09)

#### Fix

- variables in request body import are replaced (#377)

## 5.10.0 (2023-01-08)

#### Features

- add Intellijj Http Graphql Method support (AnWeber/vscode-httpyac#165)
- update Intellijj Dynamic Variables
- add Intellij PreRequest Script Support
- add `$random` Utils to create Mock Data

## 5.9.0 (2023-01-03)

#### Features

- provide Global Variable Cache (#358)
- add XPath Variable Replacer (httpyac/httpyac.github.io#62)

#### Fixes

- replace header variables before body (httpyac/httpyac.github.io#63)

## 5.8.2 (2022-11-16)

#### Fixes

- allow whitespace around variable definition (#354)

## 5.8.1 (2022-11-13)

#### Fixes

- allow set of MQTT Username and Password with Request Headers (httpyac/httpyac.github.io#58)
- display correct version in docker command

## 5.8.0 (2022-11-06)

#### Features

- add docker image for httpyac

#### Fixes

- Cookie Header support variable replacment (#352)
- Parsing Issue with non HTTP responses

## 5.7.5 (2022-10-30)

#### Fixes

- support protocol with multiline urls (AnWeber/vscode-httpyac#159)
- prevent issue with string.replace special replacement patterns (httpyac/httpyac.github.io#57)

## 5.7.4 (2022-10-21)

#### Fixes

- fix missing jwt data (httpyac/httpyac.github.io#56)

## 5.7.3 (2022-10-08)

#### Fixes

- update inquirer and filesize
- parser error on `/* ... */` comment directly after header

## 5.7.2 (2022-09-28)

#### Fixes

- update hookpoint to prevent error with interceptor

## 5.7.1 (2022-09-19)

#### Fixes

- trim filename in `@import` (AnWeber/vscode-httpyac#150)

## 5.7.0 (2022-09-06)

#### Features

- allow setting CookieJar Options (httpyac/httpyac.github.io#55)

## 5.6.5 (2022-08-25)

#### Fixes

- issue with breaking change in minor version of tough-cookie

## 5.6.4 (2022-08-24)

#### Fixes

- update dependency hookpoint@2.1.1

## 5.6.3 (2022-08-24)

#### Features

- add response tags to allow better filtering in responseLogging Hook (#322)

#### Fixes

- update dependency hookpoint@2.0.1
- modify usage because of Variadic option (#326)

## 5.6.2 (2022-08-14)

#### Fixes

- respect timeout in GRPC, MQTT and Websocket Requests (#320)

## 5.6.1 (2022-08-05)

#### Fixes

- prevent override of httpYac Script Keywords (AnWeber/vscode-httpyac#144)

## 5.6.0 (2022-08-04)

#### Features

- add OAuth2 config setting to change server.listener port (#315)

#### Fixes

- no exception after cancel while OAuth2 Authorization Code flow

## 5.5.5 (2022-07-12)

#### Fixes

- prevent circular JSON.stringify with fallback (AnWeber/vscode-httpyac#139)

## 5.5.4 (2022-07-12)

#### Fixes

- output header key in test.header (#304)

## 5.5.3 (2022-07-11)

#### Fixes

- prevent missing body with request body and `@loop` (#302)

## 5.5.2 (2022-07-05)

#### Fixes

- use correct request for HTTP302 logging (AnWeber/vscode-httpyac#137)
- prevent excessive ref calls if response body is falsy (AnWeber/vscode-httpyac#136)

## 5.5.1 (2022-06-23)

#### Fixes

- support Request Body in AWS Signature (#299)

## 5.5.0 (2022-06-19)

#### Features

- log redirect responses (HTTP 302)
- add symbols for handlebar in url, header and body

#### Fixes

- grpc requests allows output redirection (#297)

## 5.4.2 (2022-05-28)

#### Fixes

- `# @loop` allows statements before the loop is executed (#279)
- `# @loop` sets variable for `# @name` (#279)
- ensure string headers in http requests
- ignore casing in Intellij Headers (httpyac/httpyac.github.io#47)
- use correct symbol for response Header (AnWeber/httpbook#53)

## 5.4.1 (2022-05-09)

#### Features

- allow variables in outputRedirection (httpyac/httpyac.github.io#46)

#### Fixes

- allow empty string as variable (#268)
- add response parser for GRPC, WS, SSE to fix issues in httpbook (AnWeber/httpbook#51)
- add user with space in http auth digest (#274)

## 5.4.0 (2022-04-21)

#### Features

- add `dayjs` and `uuid` to require
- `# @disabled` allows evalExpression which is evaluated on each step in execution (#246)

#### Fixes

- throw error on javascript error (#245)
- correct order of output using `# @ref` (#245)
- correct order of output using `# @loop` (#243)
- right request count using `# @loop` (#242)

## 5.3.0 (2022-04-03)

#### Breaking Changes

- The default behavior of setting variables has been changed. Now the variables are evaluated directly (query evaluates to `?foo=foobar`).

```
@bar=bar
@foo=foo{{bar}}

###
@bar=bar2
GET https://httpbin.org/anything?foo={{foo}} HTTP/1.1
```

The previous behavior can be enforced by means of `:=` (query evaluates to `?foo=foobar2`).

```
@bar=bar
@foo:=foo{{bar}}

###
@bar=bar2
GET https://httpbin.org/anything?foo={{foo}} HTTP/1.1
```

#### Features

- allow simple transform response variables (#235)

```
GET https://httpbin.org/json

@foo={{response.parsedBody.slideshow.author}}
```

#### Fix

- right order of cli output (#237)

## 5.2.3 (2022-03-26)

#### Fix

- Security fix for transitive Dependency minimist

## 5.2.2 (2022-03-20)

#### Fix

- OAuth2 uses only fallback, if prefixed value is undefined or null (#228)

## 5.2.1 (2022-03-16)

#### Features

- merge all responses on using `repeat-mode` and add count of status (httpyac.github.io#34)

#### Fix

- Variable substitution did not work inside body of `application/x-www-form-urlencoded` (httpyac/httpyac.github.io#36)
- revert modification of `# @import` and store imported http files in httpFileStore (AnWeber/vscode-httpyac#112)

## 5.2.0 (2022-03-10)

#### Features

- add [RFC7636](https://datatracker.ietf.org/doc/html/rfc7636) OAuth2 Authorization Code Flow with PKCE support (#219)
- add [RFC8707](https://datatracker.ietf.org/doc/html/rfc8707) OAuth2 Resource Indicator support (#218)

#### Fix

- `# @import` does not store file in httpFileStore, if it is not already loaded in the store (AnWeber/vscode-httpyac#110)

## 5.1.0 (2022-03-06)

#### Features

- add workspace trust support (AnWeber/vscode-httpyac#104)
- OAuth2 Authorization Code Flow and Password Flow supports public clients (#214)

#### Fixes

- fixed parsing of meta data `# @jwt`
- fix order of variable replacer (#216)

## 5.0.4 (2022-02-28)

#### Fixes

- multiple import of the same file does not abort processing (#212)
- setClipboard on device_code OAuth2 flow does not throw exceptions (#211)

## 5.0.3 (2022-02-28)

#### Fixes

- OAuth2 does not use token exchange flow

## 5.0.2 (2022-02-28)

#### Fixes

- fix invalid protocol (#210)

## 5.0.1 (2022-02-28)

#### Fixes

- add mergeRawHttpHeaders to utils (#209)

## 5.0.0 (2022-02-27)

#### Breaking Changes

- The internal project structure was revised and a better separation of the plugin components was achieved. These are preparations to possibly provide an ESM build or support vscode.dev in the future.
- Setting Got Options directly on the request will be removed in one of the next versions. Got checks in v12 whether only valid options are set. But since options and custom properties are mixed at the request object, such a separation would be difficult. Please change `request[...]` to `request.options[...]`.
- function interface of [StreamLogger](https://github.com/ZeroWiggliness/httpyac/blob/main/src/models/logHandler.ts#L38) changed

#### Features

- added [RabbitMQ Support](http://localhost:8080/guide/request.html#amqp-rabbitmq)
- add OAuth2 Variable Prefix to Session to allow cache of different user login (#207)

#### Fixes

- transitive request references (`@import`) not being resolved (#205)
- import of modified variables works when using `@forceRef` (#205)

## 4.10.2 (2022-02-08)

#### Features

- add Asciidoc Injection
- add testFactory to utils (#194)
- update to globby and clipboardy ESM Packages

#### Fix

- use device_code instead of code in OAuth2 Device Code Flow
- add more file extensions for Markdown Injection (Anweber/vscode-httpyac#102)

## 4.10.1 (2022-01-30)

#### Fix

- add fallback, if fsPath results in undefined/ error (AnWeber/httpbook#43)
- Error parsing grpc URL starting with grpc fixed (mistaken for protocol)

## 4.10.0 (2022-01-27)

#### Features

- use Host Header as Url Prefix (#189)
- add cookie to userSessionStore instead cookieStore
- `# @loop` allows actions before execution of the loop (e.g. ' # @ref ...`)
- use all dotenv files between httpfile directory and rootDir (#174)

#### Fix

- handle Windows directory separators in glob pattern (#175)

## 4.9.1 (2022-01-04)

#### Fix

- GRPC name resolution problem when the path was set (#158)

## 4.9.0 (2021-12-29)

#### Features

- support http codeblocks in markdown files (#164)
- add raw headers to httpResponse (#165)
- add special env setting `request_rejectUnauthorized` to ignore SSL Verification (#159)
- add special env setting `request_proxy` to set proxy (#159)
- proxy support of `socks://` proxy (AnWeber/vscode-httpyac#91)

## 4.8.2 (2021-12-19)

#### Fix

- replace all whitespace in meta data name and use camelCase instead of underscore (#154)
- support nested `envDirName` (AnWeber/vscode-httpyac#93)
- allow hyphens in variable name (AnWeber/vscode-httpyac#95)

## 4.8.1 (2021-12-10)

#### Fix

- really read all `*.env.json` as Intellij Environment Files (AnWeber/vscode-httpyac#94)

## 4.8.0 (2021-12-09)

#### Feature

- `@import` supports variable substitution (#151)
- render objects as JSON while replacing variables (#146)
- add httpResponse as named variable with `${name}Response` (#152)

#### Fix

- read all `*.env.json` as Intellij Environment Files (AnWeber/vscode-httpyac#94)
- Intellij `client.global.set` really changes variables for this run (#150)

## 4.7.4 (2021-12-05)

#### Feature

- add new Command `httpyac oauth2` to support output of OAuth2 JWT Token (#138)

#### Fix

- remove `??` to support NodeJS v12 (#123)
- oauth2 variables are expanded

## 4.7.3 (2021-11-30)

#### Feature

- add config setting for OAuth2 redirectUri (#118)
- add password variable replacer (#139)
- besides `$shared` there is now also the possibility to use `$default` in `config.environment`. These variables are only used if no environment is selected (#142)

#### Fix

- added two line endings instead of one in response body (httpyac/httpyac.github.io#13)
- add support for `.` in header name #128
- parsing error with `=` fixed cli command `--var`
- interpret all status codes <400 as valid OAuth2 return codes (#131)
- global hooks are now always used for all HttpRegions and also work correctly in httpbook (AnWeber/httpbook#39)

## 4.7.2 (2021-11-23)

#### Fix

- remove special handling of Authorization Header on grpc Requests (#125)
- GraphQL queries withouth variables are executed (#124)

## 4.7.1 (2021-11-17)

#### Fix

- .env file in same folder not imported #112
- blank header is now supported (#107)
- using `# @no-log` breaks named variable (#106)

## 4.7.0 (2021-11-10)

#### Features

- add new event `@responseLogging` for scripts
- add `--var` option to cli command

#### Fix

- refreshTokenFlow does not require refreshExpiresIn
- envDirName is not overriden in cli command (#103)

## 4.6.0 (2021-11-07)

#### Features

- added [OAuth 2.0 Device Authorization Grant](https://datatracker.ietf.org/doc/html/rfc8628) (#97)
- extend GRPC Not Found Service Error with avaiable services

#### Fix

- escape of `{{...}}` works again (#99)
- user cancelation stops execution hook (#98)

## 4.5.2 (2021-11-03)

#### Features

- config setting to use Region scoped variables (default: false)

## 4.5.1 (2021-11-01)

#### Features

- added `--bail` option to fail fast on test error

#### Fix

- return with exit code 1 if non existing endpoint is called (#95)

## 4.5.0 (2021-10-31)

#### Features

- $randomInt Variable Substitution allows negative numbers (#93)
- text after region delimiter is used as title and name ([Intellij IDEA Compatibility](https://blog.jetbrains.com/idea/2021/10/intellij-idea-2021-3-eap-6-enhanced-http-client-kotlin-support-for-cdi-and-more/))
- support output redirection like [Intellij IDEA Compatibility](https://blog.jetbrains.com/idea/2021/10/intellij-idea-2021-3-eap-6-enhanced-http-client-kotlin-support-for-cdi-and-more/)
- add rate limiter support with meta option (#52)

## 4.4.1 (2021-10-25)

#### Fix

- Body for GraphQL requests was replaced only after request

## 4.4.0 (2021-10-24)

#### Features

- add [WebSocket](https://httpyac.github.io/guide/request.html#websocket) support
- add [MQTT](https://httpyac.github.io/guide/request.html#mqtt) support
- add [Server-Sent Events](https://httpyac.github.io/guide/request.html#server-sent-events-eventsource) support
- HTTP header array support added
- added oauthSession2 Variable to directly access OAuth2 Token
- add additional Meta Data
  - `@verbose` to increase log level to `trace`
  - `@debug` to increase log level to `debug`
  - `@keepStreaming` of MQTT, Server-Sent-Events or WebSocket until the session is ended manually
  - `@sleep` supports variables
  - documentation of meta data added to outline view

## 4.3.0 (2021-10-15)

#### Features

- support comments between request line and headers
- update to @grpc/js v1.4.1

#### Fix

- pretty print max size too low, 1kb instead fo 1Mb (#84)
- cookies are not cleared while editing in vscode (AnWeber/vscode-httpyac#77)

## 4.2.1 (2021-10-11)

#### Fix

- infinte loop if `@ref` in `@import` disabled or not found

## 4.2.0 (2021-10-10)

#### Features

- accept output options for utils.toHttpString
- response in HttpRegion is deleted after run to optimize memory

#### Fix

- variables with `2` got not replaced in Javascript Substitution

## 4.1.1 (2021-10-06)

#### Fix

- environments in .httpyac.js are not recognized (AnWeber/vscode-httpyac#71)
- js keyword as variable name not allowed (#76)

## 4.1.0 (2021-10-02)

#### Features

- Variable Substitution for file import (proto, gql, request body)
- env Variables in `process.env.HTTPYAC_ENV` are loaded
- plugin in location `process.env.HTTPYAC_PLUGIN` is loaded
- OAuth2 Variable Substitution uses sensible default (flow = client_credentials, prefix = oauth2)

#### Fix

- protoLoaderOptions conversion added (#75)

## 4.0.5 (2021-09-30)

#### Fix

- removeHook is working

## 4.0.4 (2021-09-23)

#### Fix

- use esbuild instead of webpack. Fixes require error in @grpc/proto-loader
- stack overflow with multiple use of the same ref statement

## 4.0.3 (2021-09-22)

#### Fix

- entry point path fixed

## 4.0.2 (2021-09-22)

#### Fix

- remove test script in root folder (package import error in vscode-httpyac)

## 4.0.1 (2021-09-22)

#### Fix

- missing typescript types provided

## 4.0.0 (2021-09-22)

#### Features

- [gRPC Request support](https://httpyac.github.io/guide/request.html#grpc)
  - Unary RPC
  - Server Streaming
  - Client Streaming
  - Bi-Directional Streaming
- add meta option sleep (wait x milliseconds before request)
- Basic Authentication with Whitespace in username or password (`Basic {{username}}:{{password}}`)
- register script task for event hooks (streaming, request, response, after)

#### Fix

- input and quickpick variable replacer fixed

#### Breaking Changes

- changed variable replacer interface from string to unknown

```
before: (text: string, type: string, context: ProcessorContext): Promise<string>

after: (text: unknown, _type: string, context: ProcessorContext): Promise<unknown>
```

## 3.2.0 (2021-09-12)

#### Fix

- markdown requests supports sending heading
- fix detection of environments in cli usage
- fix import of http files in global context

## 3.1.0 (2021-08-09)

#### Features

- OAuth2 Variable Substitution can send client_id in body (config setting)
- change responseLogging to BailSeriesHook for simple use

## 3.0.0 (2021-08-09)

#### Breaking Changes

- removed extensionScript (use instead [hook api](https://httpyac.github.io/guide/hooks.html#project-local-hooks))
- removed dotenv and intellij configuration (use instead [envDirName](https://httpyac.github.io/config/#envdirname), if needed)

#### Features

- [httpyac plugin support](https://httpyac.github.io/plugins/#getting-started)
- [hook api support](https://httpyac.github.io/guide/hooks.html#project-local-hooks)
- [better documentation](https://httpyac.github.io/guide)
- [new location for examples](https://github.com/httpyac/httpyac.github.io/tree/main/examples)
- add requireUncached to script context to clear NodeJS Caching

## 2.21.1 (2021-07-28)

#### Fix

- log trace can be selected

## 2.21.0 (2021-07-22)

#### Features

- add new option `--raw` to prevent pretty print of body
- add pretty print for xml (Anweber/vscode-httpyac#56)

#### Fix

- missing blank line after file import in multipart/formdata (#57)

## 2.20.0 (2021-07-18)

#### Features

- advanced logging (#49)
  - `--output` and `--output-failed` option to [format output](https://github.com/ZeroWiggliness/httpyac#commands)
  - `--json` option to create json output
  - `--filter` option to output only-failed requests
  - added meta data `title` and `description` to extend information of the logging
  - added summary after executing more requests
- allow [loop](https://github.com/ZeroWiggliness/httpyac/blob/main/examples/metaData/loop.http) one requests multiple times with `for <var> of <iterable>`, `for <count>` or `while <condition>`

#### Fix

- error in dotenv import with `.env.{{system}}` notation (Anweber/vscode-httpyac#51)
- line break issue with comment in last line #56

## 2.19.0 (2021-07-09)

#### Features

- simple escaping of template strings in body with `\{\{...\}\}` (is replaced with `{{...}}`)
- add test result summary, if more requests are executed at the same time

## 2.18.1 (2021-07-06)

#### Fix

- fix error with global variables (Anweber/vscode-httpyac#48)

## 2.18.0 (2021-06-30)

#### Features

- add new meta data @noRejectUnauthorized, to disable ssl verification
- update filesize dependency

## 2.17.0 (2021-06-28)

#### Fix

- fixed parser, if global variable is used in first line (Anweber/vscode-httpyac#45)
- http2 needs to explicitly activated (second attempt:-))

## 2.16.0 (2021-06-20)

#### Fix

- error while using metadata followRedirect fixed
- http2 needs to explicitly activated

## 2.15.1 (2021-06-17)

#### Fix

- fix gql (wrong Execution Order)

## 2.15.0 (2021-06-13)

#### Features

- add default accept header _/_
- faster parsing with lazy access of fs

## 2.14.1 (2021-06-11)

#### Fix

- update normalize-url

## 2.14.0 (2021-06-06)

#### Features

- better test method support

#### Fix

- error parsing body in inline response

## 2.13.1 (2021-06-05)

#### Fix

- error parsing http version in inline response

## 2.13.0 (2021-06-05)

#### Features

- assertUtils for simple tests

#### Fix

- empty line after requestline not needed anymore

## 2.12.5 (2021-06-04)

#### Fix

- region delimiter ignore chars after delimiter

## 2.12.4 (2021-06-03)

#### Fix

- error on require local javascript file

## 2.12.3 (2021-06-01)

#### Fix

- fix types issue

## 2.12.2 (2021-06-01)

#### Fix

- error if ### on first line

## 2.12.1 (2021-05-30)

#### Fix

- Spelling mistake in symbol
- small error in Http version output

## 2.12.0 (2021-05-30)

#### Features

- change signature of responseRef array
- HttpSymbol provides property source
- utils for http file output

## 2.11.0 (2021-05-29)

#### Features

- add parser for response and responseRef

## 2.10.0 (2021-05-24)

#### Features

- dependency updates of open, inquirer and dotenv

## 2.9.0 (2021-05-18)

#### Features

- force inject variables with metadata setting (`# @injectVariables`)

## 2.8.0 (2021-05-13)

#### Features

- allow custom filesystem provider (e.g. vscode.workspaces.fs)
- add support for mimetype application/x-javascript
- update dotenv to 9.0.2

## 2.7.0 (2021-05-03)

#### Features

- all markdown utils exported
- reuse parser promise on same version and filename

#### Fix

- use shared env on empty environment array
- delimiter ignored on source of httpregion

## 2.6.0 (2021-05-01)

#### Features

- toMarkdown with better option support and style change
- httpClient is optional on httpyacApi.send

#### Fix

- incomplete httpRegion.source fixed

## 2.5.1 (2021-04-25)

#### Fix

- declaration support added

## 2.5.0 (2021-04-25)

#### Breaking Changes

- [Action](https://github.com/ZeroWiggliness/httpyac/blob/main/src/models/httpRegionAction.ts#L7) method changed to process instead of processor
- [VariableReplacer](https://github.com/ZeroWiggliness/httpyac/blob/main/src/models/variableReplacer.ts#L5) changed to object with replace method, to implement better trust support

#### Features

- better static code analysis
- interactive mode, which do not close cli command
- glob pattern support for filename
- rest client dynamic variable support ($guid, $randomInt, $timestamp, $datetime, $localDatetime, $processEnv, $dotenv)

#### Fix

- ref and forceRef support is fixed
- error on executing httpRegionScript

## 2.4.0 (2021-04-15)

#### Features

- better [test](https://github.com/ZeroWiggliness/httpyac/blob/main/examples/README.md#node-js-scripts) method support
- refactored response in script to [http response](https://github.com/ZeroWiggliness/httpyac/blob/main/src/models/httpResponse.ts) instead of body

#### Fix

- intellij env support enabled
- unnecessary file parse when using ref in vscode

## 2.3.1 (2021-04-11)

#### Features

- define response example in http file (ignored in parsing file)
- using chalk for ansi support

#### Fix

- dotenv support accidentally disabled

## 2.3.0 (2021-04-09)

#### Features

- define global script executed after every request
- set ssl client certifcates per request
- intellij syntax support for metadata (`// @no-cookie-jar`)
- markdown utils in httpyac

#### Fix

- priority of config initialization adjusted ([#3](https://github.com/ZeroWiggliness/httpyac/issues/3))

## 2.2.1 (2021-04-05)

#### Fix

- minimize size of webpack build

## 2.2.0 (2021-04-05)

#### Feature

- support for ssl client certficates
- note http version (version 1.1 disables http2 support)
- cookiejar support

## 2.1.0 (2021-03-30)

#### Feature

- --version option in cli command

### Fix

- error in signing request with aws

## 2.0.0 (2021-03-27)

#### Feature

- cli support with [httpyac cli](https://www.npmjs.com/package/httpyac)
