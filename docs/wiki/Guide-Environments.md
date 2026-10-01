Environments are named sets of variables. They let the same requests run against local, test, staging, and production services by changing the active environment instead of editing the request file.

- [Selecting environments](Guide-Environments#selecting-environments)
- [Variable expansion](Guide-Environments#variable-expansion)
- [Configuration environments](Guide-Environments#configuration-environments)
- [Dotenv files](Guide-Environments#dotenv-files)
- [IntelliJ environment files](Guide-Environments#intellij-environment-files)
- [Special request variables](Guide-Environments#special-request-variables)
- [CLI usage](Guide-Environments#cli-usage)
- [Precedence notes](Guide-Environments#precedence-notes)

## Selecting environments

One or more environments can be active at the same time. When several environments are selected, their variables are merged in the selected order and later environments can override earlier ones.

```shell
httpyac send api.http --env dev
httpyac send api.http --env dev tenant-a
```

The VS Code extension can select a different environment per file. Newly opened files use the last active environment from the extension session.

## Variable expansion

Environment values can reference other variables and are expanded when used.

```ini
# .env
auth_tokenEndpoint={{authHost}}/auth/realms/demo/protocol/openid-connect/token

# local.env
authHost=https://id.local.test
```

With the `local` environment selected, `{{auth_tokenEndpoint}}` resolves to:

```text
https://id.local.test/auth/realms/demo/protocol/openid-connect/token
```

The same replacement rules described in [Guide-Variables](Guide-Variables) apply to request lines, headers, bodies, scripts, and protocol settings.

## Configuration environments

Configuration environments are defined in the `environments` setting, usually in `.httpyac.js` or another HttpYac configuration file. `$shared` is merged into every environment. `$default` is used only when no environment is selected.

```js
module.exports = {
  environments: {
    $shared: {
      host: 'https://api.example.test',
    },
    $default: {
      user: 'guest',
    },
    dev: {
      host: 'https://dev-api.example.test',
      user: 'dev-user',
      password: 'dev-secret',
    },
    prod: {
      host: 'https://api.example.test',
      user: 'prod-user',
      password: 'prod-secret',
    },
  },
};
```

```http
GET {{host}}/me
Authorization: basic {{user}} {{password}}
```

If `dev` is active, HttpYac merges `$shared` and `dev`. If no environment is active, it merges `$shared` and `$default`.

## Dotenv files

Dotenv support is enabled by default and uses the `dotenv` package syntax.

```ini
host=https://dev-api.example.test
tokenEndpoint={{host}}/oauth/token
```

Environment-specific dotenv files can put the environment name before or after `.env`:

```text
.env          # variables loaded for every selection
.env.local    # variables for environment "local"
local.env     # variables for environment "local"
```

HttpYac searches these locations:

- The directory named by the `HTTPYAC_ENV` process environment variable.
- The `.http` file directory and each parent directory up to the project root.
- In every searched directory, the configured environment directory, `env` by default.

The environment directory name can be changed with `envDirName` in [Configuration](Configuration).

```text
project/
  .env
  env/
    dev.env
  requests/
    .env.local
    api.http
```

For `api.http`, HttpYac can load the root `.env`, the root `env/dev.env`, and dotenv files beside `api.http`, depending on the selected environments.

Environment discovery ignores files that are not in the supported forms; for example `.envrc` is not treated as an HttpYac environment.

## IntelliJ environment files

HttpYac also reads JetBrains HTTP Client environment files:

```text
http-client.env.json
http-client.private.env.json
```

Example:

```json
{
  "dev": {
    "host": "https://dev-api.example.test",
    "user": "dev-user"
  },
  "prod": {
    "host": "https://api.example.test",
    "user": "prod-user"
  }
}
```

Private files are useful for secrets and override values from matching public files.

```json
{
  "dev": {
    "password": "dev-secret",
    "Security": {
      "Auth": {
        "keycloak": {
          "Type": "OAuth2",
          "Grant Type": "Client Credentials",
          "Token URL": "https://id.example.test/token",
          "Client ID": "httpyac",
          "Client Secret": "secret",
          "Scope": "openid profile"
        }
      }
    }
  }
}
```

The `Security.Auth` section can be used by IntelliJ dynamic auth variables such as `{{$auth.token("keycloak")}}`; see [Guide-Variables](Guide-Variables#oauth-20-and-openid-connect).

Search locations are the `HTTPYAC_ENV` directory, the configured `envDirName` directory at the project root, and the `.http` file directory plus its parents up to the project root.

## Special request variables

Two variables change request transport behavior and are often useful per environment:

| Variable | Effect |
| --- | --- |
| `request_rejectUnauthorized` | Controls TLS certificate validation. Set `false` to allow self-signed or otherwise untrusted server certificates. |
| `request_proxy` | Sets the request proxy URL. HTTP, HTTPS, and SOCKS proxy URLs are supported by the HTTP client. |

```ini
# local.env
request_rejectUnauthorized=false
request_proxy=http://localhost:8080
```

These variables apply to normal HTTP requests and related protocols that read the same request options.

## CLI usage

Use `--env` to select environments and `--var` to add or override variables for a single run.

```shell
httpyac send api.http --env local --var user=demo password=secret
```

`--env` accepts multiple values:

```shell
httpyac send api.http --env dev tenant-a
```

`--var` values use `name=value` syntax. If the value contains additional `=`, HttpYac keeps them as part of the value.

```shell
httpyac send api.http --var token=abc=123
```

The OAuth CLI command accepts the same `--env` and `--var` style when generating a token.

## Precedence notes

When the same variable appears in several places, the later merge wins.

- Configuration environments merge `$shared` first, then the selected environments; `$default` is used only when no environment is selected.
- Dotenv loading starts with `HTTPYAC_ENV`, then parent directories from the project root down to the `.http` file directory. In a directory, `.env` is loaded before selected environment files, and the `env` directory can override same-directory files.
- IntelliJ private environment files override matching public files.
- Request and file variables can override environment-provided values in their scope.
- CLI `--var` values override environment provider values for the run.

Keep secrets in private files, dotenv files that are not committed, or your shell environment rather than in shared request files.
