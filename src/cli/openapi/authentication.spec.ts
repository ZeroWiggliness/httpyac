import { userInteractionProvider } from '../../io';
import { AuthenticationGenerator } from './authentication';
import { JsonObject, OpenApi, Operation } from './document';

function fixture(security: unknown[], schemes: JsonObject): { api: OpenApi; operation: Operation } {
  return {
    api: {
      root: { security, components: { securitySchemes: schemes } },
      files: [],
      operations: [],
      resolveReference: () => undefined,
    },
    operation: { path: '/test', method: 'get', name: 'test', item: {}, operation: {} },
  };
}

describe('OpenAPI authentication', () => {
  afterEach(() => jest.restoreAllMocks());

  it('respects public operation overrides and keeps AND requirements combined', async () => {
    const { api, operation } = fixture([{ bearer: [], key: [] }], {
      bearer: { type: 'http', scheme: 'bearer' },
      key: { type: 'apiKey', in: 'query', name: 'key' },
    });
    const generator = new AuthenticationGenerator(api, {});
    const result = await generator.generate(operation);
    expect(result.headers.Authorization).toContain('Bearer {{');
    expect(result.query).toHaveLength(1);
    expect(await generator.generate({ ...operation, operation: { security: [] } })).toEqual({
      headers: {},
      query: [],
      cookies: [],
    });
    expect([...generator.variables.values()].every(value => value.includes('$processEnv'))).toBe(true);
  });

  it('prompts only for ambiguous OR alternatives and validates explicit/noninteractive choices', async () => {
    const { api, operation } = fixture([{ bearer: [] }, { basic: [] }], {
      bearer: { type: 'http', scheme: 'bearer' },
      basic: { type: 'http', scheme: 'basic' },
    });
    await expect(new AuthenticationGenerator(api, { interactive: false }).generate(operation)).rejects.toThrow(
      'Ambiguous'
    );
    const prompt = jest.spyOn(userInteractionProvider, 'showListPrompt').mockResolvedValue('bearer');
    const interactive = new AuthenticationGenerator(api, { interactive: true });
    await interactive.generate(operation);
    await interactive.generate(operation);
    expect(prompt).toHaveBeenCalledTimes(1);
    const explicit = new AuthenticationGenerator(api, { auth: ['basic'], interactive: false });
    expect((await explicit.generate(operation)).headers.Authorization).toContain('basic ');
    explicit.validateOverrides();
    const invalid = new AuthenticationGenerator(api, { auth: ['missing'], interactive: false });
    expect(() => invalid.validateOverrides()).toThrow('does not match');
  });

  it('selects declared OAuth flows and configures native helpers and scopes', async () => {
    const { api, operation } = fixture([{ oauth: ['read'] }], {
      oauth: {
        type: 'oauth2',
        flows: {
          clientCredentials: { tokenUrl: 'https://id.example/token', scopes: { read: 'Read' } },
          authorizationCode: {
            tokenUrl: 'https://id.example/token',
            authorizationUrl: 'https://id.example/authorize',
            scopes: { read: 'Read' },
          },
        },
      },
    });
    await expect(new AuthenticationGenerator(api, { interactive: false }).generate(operation)).rejects.toThrow(
      'OAuth flow'
    );
    const generator = new AuthenticationGenerator(api, { authFlow: ['oauth=client_credentials'] });
    expect((await generator.generate(operation)).headers.Authorization).toContain('oauth2 client_credentials ');
    expect([...generator.variables.values()]).toContain('read');
    generator.validateOverrides();
  });

  it('retrieves OpenID discovery without obtaining a token', async () => {
    const request = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          token_endpoint: 'https://id.example/token',
          grant_types_supported: ['client_credentials'],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const { api, operation } = fixture([{ todo: ['todo.read'] }], {
      todo: { type: 'openIdConnect', openIdConnectUrl: 'https://id.example/.well-known/openid-configuration' },
    });
    const generator = new AuthenticationGenerator(api, { interactive: false });
    expect((await generator.generate(operation)).headers.Authorization).toContain('openid client_credentials ');
    await generator.generate(operation);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toContain('openid-configuration');
    expect([...generator.variables.values()]).toContain('https://id.example/token');
  });

  it('rejects conflicting AND headers and failed discovery explicitly', async () => {
    const { api, operation } = fixture([{ a: [], b: [] }], {
      a: { type: 'http', scheme: 'bearer' },
      b: { type: 'http', scheme: 'basic' },
    });
    await expect(new AuthenticationGenerator(api, {}).generate(operation)).rejects.toThrow('Incompatible');
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 503 }));
    const openid = fixture([{ todo: [] }], {
      todo: { type: 'openIdConnect', openIdConnectUrl: 'https://id.example/discovery' },
    });
    await expect(new AuthenticationGenerator(openid.api, {}).generate(openid.operation)).rejects.toThrow(
      'discovery failed'
    );
  });

  it('accepts combined choices in either order and keeps distinct scoped alternatives explicit', async () => {
    const combined = fixture([{ key: [], bearer: [] }], {
      key: { type: 'apiKey', in: 'cookie', name: 'key' },
      bearer: { type: 'http', scheme: 'bearer' },
    });
    const generator = new AuthenticationGenerator(combined.api, { auth: ['key+bearer'], interactive: false });
    expect((await generator.generate(combined.operation)).cookies).toHaveLength(1);
    generator.validateOverrides();
    const scoped = fixture([{ oauth: ['read'] }, { oauth: ['write'] }], {
      oauth: {
        type: 'oauth2',
        flows: {
          clientCredentials: {
            tokenUrl: 'https://id.example/token',
            scopes: { read: 'Read', write: 'Write' },
          },
        },
      },
    });
    await expect(
      new AuthenticationGenerator(scoped.api, { interactive: false }).generate(scoped.operation)
    ).rejects.toThrow('oauth[read]');
    const explicit = new AuthenticationGenerator(scoped.api, { auth: ['oauth[write]'] });
    await explicit.generate(scoped.operation);
    explicit.validateOverrides();
    expect([...explicit.variables.values()]).toContain('write');
  });

  it('uses an explicit token-endpoint placeholder when an implicit flow does not declare one', async () => {
    const { api, operation } = fixture([{ oauth: [] }], {
      oauth: { type: 'oauth2', flows: { implicit: { authorizationUrl: 'https://id.example/authorize', scopes: {} } } },
    });
    const generator = new AuthenticationGenerator(api, { interactive: false });
    expect((await generator.generate(operation)).headers.Authorization).toContain('oauth2 implicit');
    expect([...generator.variables.values()]).toContain('{{$processEnv OAS_OAUTH_TOKEN_ENDPOINT}}');
    expect([...generator.warnings].join(' ')).toContain('native implicit helper');
  });
});
