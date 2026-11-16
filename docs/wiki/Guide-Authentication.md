Authentication is expressed with request headers, cookies, client certificates, or helpers that obtain and generate credentials. Keep secrets in [environments](Guide-Environments), dotenv files, or CLI variables rather than committing them to a request file.

- [Header authentication](#header-authentication)
- [Basic authentication](#basic-authentication)
- [Digest authentication](#digest-authentication)
- [OAuth 2.0 and OpenID Connect](#oauth-20-and-openid-connect)
- [AWS Signature Version 4](#aws-signature-version-4)
- [Cookies and session authentication](#cookies-and-session-authentication)
- [SSL client certificates](#ssl-client-certificates)
- [Script-generated credentials](#script-generated-credentials)
- [Related configuration](#related-configuration)

## Header authentication

For bearer tokens, API keys, and other schemes, set the authorization header directly. Variables keep the credential out of the request syntax.

```http
@token = {{$processEnv API_TOKEN}}

GET https://api.example.test/private
Authorization: Bearer {{token}}
```

An API key can use a provider-specific header:

```http
@apiKey = {{$dotenv apiKey}}

GET https://api.example.test/private
X-API-Key: {{apiKey}}
```

The same approach works for custom headers such as `X-Auth-Token`. See [Variables](Guide-Variables) and [Environments](Guide-Environments) for value sources and precedence.

## Basic authentication

Use the `basic` authorization helper for a username and password. HttpYac creates the Basic authorization value for the request.

```http
GET https://example.test/private
Authorization: basic demo secret
```

If a username or password contains spaces, separate the values with a colon:

```http
GET https://example.test/private
Authorization: basic demo user:secret with spaces
```

You can also create the header yourself when the server expects normal HTTP Basic authentication:

```http
{{
  const credentials = Buffer.from("demo:secret").toString("base64");
  exports.authHeader = `Basic ${credentials}`;
}}
GET https://example.test/basic-auth/demo/secret
Authorization: {{authHeader}}
```

## Digest authentication

Use the `digest` helper when the server uses HTTP Digest authentication:

```http
GET https://example.test/private
Authorization: digest demo secret
```

The helper waits for a `401` digest challenge and retries the request with the computed digest header. The colon form is also supported for values containing spaces.

## OAuth 2.0 and OpenID Connect

OAuth 2.0 and OpenID Connect are handled through the `Authorization` header. There is no `{{$oauth2}}` or `{{$openidconnect}}` dynamic variable; use the `oauth2` or `openid` authorization helper, or call `$getOAuth2Response` from JavaScript.

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

Configure a flow with variables named `<prefix>_<setting>` or nested values such as `<prefix>.<setting>`. For example:

```http
@local_tokenEndpoint = https://id.example.test/realms/demo/protocol/openid-connect/token
@local_clientId = httpyac
@local_clientSecret = secret
@local_scope = openid profile

GET https://api.example.test/secured
Authorization: openid client_credentials local
```

Common settings include `tokenEndpoint`, `authorizationEndpoint`, `deviceCodeEndpoint`, `clientId`, `clientSecret`, `scope`, `resource`, `audience`, `username`, `password`, `responseType`, `responseMode`, `redirectUri`, `serverPort`, `keepAlive`, `useAuthorizationHeader`, `useDeviceCodeClientSecret`, `usePkce`, `proxy`, `subjectIssuer`, and `interceptRequest`.

Required settings by flow:

| Flow | Required settings |
| --- | --- |
| `client_credentials` | `tokenEndpoint`, `clientId`, `clientSecret` |
| `authorization_code` | `tokenEndpoint`, `authorizationEndpoint`, `clientId` |
| `implicit` / `hybrid` | `tokenEndpoint`, `authorizationEndpoint`, `clientId` |
| `password` | `tokenEndpoint`, `clientId`, `username`, `password` |
| `device_code` | `tokenEndpoint`, `deviceCodeEndpoint`, `clientId` |
| `token_exchange` target | `tokenEndpoint`, `clientId`, `clientSecret` |

Authorization-code and implicit/hybrid flows start a temporary local HTTP server and open the browser. Configure the identity provider to allow the selected `redirectUri`. Use `$auth.idToken("name")` when the ID token is needed instead of the access token.

OAuth2 token requests honor `request.rejectUnauthorized` and host-matched `clientCertificates`. IntelliJ `Security.Auth` entries in `http-client.env.json` can be used by IntelliJ dynamic auth variables such as `{{$auth.token("keycloak")}}`.

## AWS Signature Version 4

Use the `aws` helper to sign an AWS request:

```http
GET https://service.region.amazonaws.com/resource
Authorization: aws {{accessKeyId}} {{secretAccessKey}} token: {{sessionToken}} region: eu-central-1 service: execute-api
```

`token:`, `region:`, and `service:` are optional. The helper signs the request and adds the AWS headers. Store the access key and secret in an environment or dotenv file.

## Cookies and session authentication

When the cookie jar is enabled, HTTP responses can store `Set-Cookie` values and later requests to the same environment and host reuse them. Disable it for a request with `# @noCookieJar` or globally with `cookieJarEnabled: false`.

For an explicit login flow, execute a named login request from a script and pass its cookie or token to the next request:

```http
### login
POST https://example.test/login
Content-Type: application/json

{"username":"demo","password":"secret"}

### profile
{{
  const login = $httpyac.findHttpRegionInContext("login");
  await $httpyac.execute(login);
  exports.sessionId = response.headers["set-cookie"];
}}
GET https://example.test/profile
Cookie: {{sessionId}}
```

See [Scripting](Guide-Scripting) for request execution and response access.

## SSL client certificates

Client certificates can be configured globally with `clientCertificates` in [Configuration](Configuration), keyed by host:

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

## Script-generated credentials

Scripts can compute a credential immediately before the request:

```http
{{
  const token = Buffer.from("demo:secret").toString("base64");
  exports.authHeader = `Basic ${token}`;
}}
GET https://example.test/private
Authorization: {{authHeader}}
```

Scripts can also call `$getOAuth2Response` or use the `oauth2Session` global during OAuth/OpenID flows. See [Scripting](Guide-Scripting) for the script runtime and [Assert](Guide-Assert) for checking an authenticated response.

## Related configuration

- [Variables](Guide-Variables): variable definitions, dynamic values, and CLI variables.
- [Environments](Guide-Environments): dotenv, environment files, private values, and `Security.Auth`.
- [Meta data](Guide-MetaData): `@noClientCert`, `@noCookieJar`, and request references.
- [Configuration](Configuration): client certificates, cookie jars, default headers, and request TLS settings.
