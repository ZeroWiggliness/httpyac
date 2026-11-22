import { userInteractionProvider } from '../../io';
import {
  array,
  identifier,
  JsonObject,
  object,
  OpenApi,
  Operation,
  optionalObject,
  singleLine,
  text,
} from './document';

export interface AuthenticationOptions {
  auth?: string[];
  authFlow?: string[];
  interactive?: boolean;
}

export interface Authentication {
  headers: Record<string, string>;
  query: Array<[string, string]>;
  cookies: Array<[string, string]>;
}

const flows: Record<string, string> = {
  clientCredentials: 'client_credentials',
  authorizationCode: 'authorization_code',
  implicit: 'implicit',
  password: 'password',
  client_credentials: 'client_credentials',
  authorization_code: 'authorization_code',
};

export class AuthenticationGenerator {
  readonly variables = new Map<string, string>();
  readonly warnings = new Set<string>();
  private readonly decisions = new Map<string, string>();
  private readonly discoveries = new Map<string, JsonObject>();
  private readonly configurations = new Map<string, string>();
  private readonly usedOverrides = new Set<string>();
  private readonly usedFlows = new Set<string>();
  private readonly credentialNames = new Map<string, string>();

  constructor(
    private readonly api: OpenApi,
    private readonly options: AuthenticationOptions
  ) {}

  private async choose(label: string, choices: string[], overrides: string[]): Promise<string> {
    const supplied = overrides.filter(value => choices.includes(value));
    if (supplied.length > 1) {
      throw new Error(`More than one override applies to ${label}: ${supplied.join(', ')}`);
    }
    if (supplied.length === 1) {
      this.usedOverrides.add(supplied[0]);
      return supplied[0];
    }
    if (choices.length === 1) {
      return choices[0];
    }
    const key = `${label}:${choices.join(',')}`;
    const cached = this.decisions.get(key);
    if (cached) {
      return cached;
    }
    if (!(this.options.interactive ?? (process.stdin.isTTY && process.stdout.isTTY))) {
      throw new Error(
        `Ambiguous ${label}. Supply --auth or --auth-flow (${choices.join(', ')}) in non-interactive mode`
      );
    }
    const selection = await userInteractionProvider.showListPrompt(`Select ${label}`, choices);
    if (!selection || !choices.includes(selection)) {
      throw new Error(`No valid selection for ${label}`);
    }
    this.decisions.set(key, selection);
    return selection;
  }

  private credential(scheme: string, setting: string): string {
    let credentialName = this.credentialNames.get(scheme);
    if (!credentialName) {
      const base = scheme.replace(/[^a-zA-Z0-9]/gu, '_').toUpperCase();
      credentialName = base;
      let index = 2;
      while ([...this.credentialNames.values()].includes(credentialName)) {
        credentialName = `${base}_${index++}`;
      }
      this.credentialNames.set(scheme, credentialName);
    }
    const variable = `${identifier(`auth_${credentialName.toLowerCase()}`)}_${setting}`;
    const environment = `OAS_${credentialName}_${setting.replace(/([a-z])([A-Z])/gu, '$1_$2').toUpperCase()}`;
    this.variables.set(variable, `{{$processEnv ${environment}}}`);
    return `{{${variable}}}`;
  }

  async generate(operation: Operation): Promise<Authentication> {
    const result: Authentication = { headers: {}, query: [], cookies: [] };
    const requirements = array(operation.operation.security ?? this.api.root.security, 'security').map(value =>
      object(value, 'security requirement')
    );
    if (!requirements.length) {
      if (this.options.auth?.includes('none')) {
        this.usedOverrides.add('none');
      }
      return result;
    }
    const baseLabel = (requirement: JsonObject) => Object.keys(requirement).sort().join('+') || 'none';
    const label = (requirement: JsonObject) =>
      requirements.filter(value => baseLabel(value) === baseLabel(requirement)).length > 1
        ? Object.keys(requirement)
            .sort()
            .map(name => `${name}[${array(requirement[name], 'security scopes').join(' ')}]`)
            .join('+') || 'none'
        : baseLabel(requirement);
    const alternatives = [...new Set(requirements.map(label))];
    const overrides = (this.options.auth || []).map(value => value.split('+').sort().join('+'));
    const selected = await this.choose('authentication alternative', alternatives, overrides);
    (this.options.auth || [])
      .filter(value => value.split('+').sort().join('+') === selected)
      .forEach(value => this.usedOverrides.add(value));
    const requirement = requirements.find(value => label(value) === selected);
    if (!requirement) {
      throw new Error(`Authentication alternative not found: ${selected}`);
    }
    const schemes = optionalObject(
      optionalObject(this.api.root.components, 'components').securitySchemes,
      'securitySchemes'
    );
    for (const [name, scopeValues] of Object.entries(requirement)) {
      const scheme = object(schemes[name], `security scheme ${name}`);
      const scopes = array(scopeValues, `${name} scopes`).map(value => {
        if (typeof value !== 'string') {
          throw new Error(`Invalid scope for ${name}`);
        }
        if (/\s/u.test(value)) {
          throw new Error(`Scopes must be separate strings without whitespace for ${name}`);
        }
        return value;
      });
      switch (scheme.type) {
        case 'http': {
          const kind = text(scheme.scheme).toLowerCase();
          if (kind === 'basic' || kind === 'digest') {
            this.header(
              result,
              'Authorization',
              `${kind} ${this.credential(name, 'username')}:${this.credential(name, 'password')}`
            );
          } else if (kind === 'bearer') {
            this.header(result, 'Authorization', `Bearer ${this.credential(name, 'token')}`);
          } else {
            throw new Error(`Unsupported HTTP security scheme ${name}: ${kind}`);
          }
          break;
        }
        case 'apiKey': {
          const key = text(scheme.name);
          if (!key || /[\r\n]/u.test(key)) {
            throw new Error(`Invalid API key name for ${name}`);
          }
          const value = this.credential(name, 'apiKey');
          if (scheme.in === 'header') {
            this.header(result, key, value);
          } else if (scheme.in === 'query') {
            result.query.push([key, value]);
          } else if (scheme.in === 'cookie') {
            result.cookies.push([key, value]);
          } else {
            throw new Error(`Unsupported API key location for ${name}`);
          }
          break;
        }
        case 'oauth2':
        case 'openIdConnect':
          this.header(result, 'Authorization', await this.oauth(name, scheme, scopes));
          break;
        default:
          throw new Error(`Unsupported security scheme ${name}: ${text(scheme.type)}`);
      }
    }
    return result;
  }

  private header(result: Authentication, name: string, value: string): void {
    if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u.test(name)) {
      throw new Error(`Invalid authentication header: ${name}`);
    }
    if (Object.keys(result.headers).some(key => key.toLowerCase() === name.toLowerCase())) {
      throw new Error(`Incompatible combined authentication schemes both require ${name}`);
    }
    result.headers[name] = value;
  }

  private async oauth(name: string, scheme: JsonObject, scopes: string[]): Promise<string> {
    let available: Record<string, JsonObject> = {};
    if (scheme.type === 'openIdConnect') {
      const url = text(scheme.openIdConnectUrl);
      if (!/^https?:\/\//u.test(url)) {
        throw new Error(`Expected an absolute HTTP(S) openIdConnectUrl for ${name}`);
      }
      let discovery = this.discoveries.get(url);
      if (!discovery) {
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) {
          throw new Error(`OpenID discovery failed (${response.status}) for ${url}`);
        }
        discovery = object(await response.json(), `OpenID discovery ${url}`);
        this.discoveries.set(url, discovery);
      }
      const grants = array(
        discovery.grant_types_supported ?? ['authorization_code', 'implicit'],
        'grant_types_supported'
      );
      for (const grant of grants) {
        if (typeof grant === 'string' && flows[grant]) {
          available[flows[grant]] = {
            tokenUrl: discovery.token_endpoint,
            authorizationUrl: discovery.authorization_endpoint,
          };
        }
      }
    } else {
      available = Object.fromEntries(
        Object.entries(object(scheme.flows, `${name} flows`)).map(([flow, value]) => {
          if (!flows[flow]) {
            throw new Error(`Unsupported OAuth flow ${flow} for ${name}`);
          }
          return [flows[flow], object(value, `${name} ${flow}`)];
        })
      );
    }
    const overrides = (this.options.authFlow || []).filter(
      value => !value.includes('=') || value.startsWith(`${name}=`)
    );
    const normalized = overrides.map(value => (value.includes('=') ? value.slice(value.indexOf('=') + 1) : value));
    for (const flow of normalized) {
      if (!available[flow]) {
        throw new Error(`OAuth flow ${flow} is not declared/supported for ${name}`);
      }
    }
    const choices = Object.keys(available);
    if (!choices.length) {
      throw new Error(`No supported OAuth flows for ${name}`);
    }
    const selected = await this.choose(`OAuth flow for ${name}`, choices, normalized);
    overrides.forEach(value => this.usedFlows.add(value));
    const key = JSON.stringify([name, selected, scopes]);
    let prefix = this.configurations.get(key);
    if (!prefix) {
      prefix = `${identifier(`auth_${name}`)}_flow${this.configurations.size + 1}`;
      this.configurations.set(key, prefix);
      const flow = available[selected];
      if (scheme.type === 'oauth2') {
        const declared = object(flow.scopes, `${name} flow scopes`);
        if (scopes.some(scope => !Object.hasOwn(declared, scope))) {
          throw new Error(`Security requirement uses an undeclared scope for ${name}: ${scopes.join(' ')}`);
        }
      }
      const endpoint = text(flow.tokenUrl);
      if (!endpoint && selected === 'implicit') {
        this.variables.set(`${prefix}_tokenEndpoint`, this.credential(name, 'tokenEndpoint'));
        this.warnings.add(
          `The native implicit helper requires a token endpoint not supplied by ${name}; configure OAS_${this.credentialNames.get(name)}_TOKEN_ENDPOINT before execution`
        );
      } else if (!/^https?:\/\//u.test(endpoint)) {
        throw new Error(`Missing/invalid token URL for ${name} ${selected}`);
      } else {
        this.variables.set(`${prefix}_tokenEndpoint`, singleLine(endpoint));
      }
      if (selected === 'authorization_code' || selected === 'implicit') {
        const authorization = text(flow.authorizationUrl);
        if (!/^https?:\/\//u.test(authorization)) {
          throw new Error(`Missing/invalid authorization URL for ${name} ${selected}`);
        }
        this.variables.set(`${prefix}_authorizationEndpoint`, singleLine(authorization));
      }
      this.variables.set(`${prefix}_clientId`, this.credential(name, 'clientId'));
      if (selected !== 'implicit') {
        this.variables.set(`${prefix}_clientSecret`, this.credential(name, 'clientSecret'));
      }
      if (selected === 'password') {
        this.variables.set(`${prefix}_username`, this.credential(name, 'username'));
        this.variables.set(`${prefix}_password`, this.credential(name, 'password'));
      }
      this.variables.set(`${prefix}_scope`, scopes.join(' '));
      this.variables.set(`${prefix}_keepAlive`, 'false');
    }
    return `${scheme.type === 'openIdConnect' ? 'openid' : 'oauth2'} ${selected} ${prefix}`;
  }

  validateOverrides(): void {
    for (const value of this.options.auth || []) {
      if (!this.usedOverrides.has(value)) {
        throw new Error(`Authentication override does not match selected operations: ${value}`);
      }
    }
    for (const value of this.options.authFlow || []) {
      if (!this.usedFlows.has(value)) {
        throw new Error(`OAuth flow override does not match selected operations: ${value}`);
      }
    }
  }
}
