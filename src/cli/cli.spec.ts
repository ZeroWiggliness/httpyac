import { convertCliOptionsToContext } from './send';
import { createProgram } from './cli';

describe('cli', () => {
  it('registers OpenAPI generation while preserving send as the default command', async () => {
    const program = await createProgram();
    expect(program.commands.map(command => command.name())).toContain('openapi');
    expect(program.helpInformation()).toContain('send');
    const openapi = program.commands.find(command => command.name() === 'openapi');
    expect(openapi?.helpInformation()).toContain('--auth-flow');
    const action = jest.fn();
    const send = program.commands.find(command => command.name() === 'send');
    if (!send) {
      throw new Error('send command is missing');
    }
    send.action(action);
    await program.parseAsync(['node', 'httpyac', 'example.http']);
    expect(action.mock.calls[0][0]).toEqual(['example.http']);
  });
  it.each([false, true])('passes detailed assertion selection to OpenAPI generation: %s', async enabled => {
    const program = await createProgram();
    const openapi = program.commands.find(command => command.name() === 'openapi');
    if (!openapi) {
      throw new Error('openapi command is missing');
    }
    const action = jest.fn();
    openapi.action(action);
    await program.parseAsync(['node', 'httpyac', 'openapi', 'api.yaml', ...(enabled ? ['--detailed-asserts'] : [])]);
    expect(action.mock.calls[0][1].detailedAsserts === true).toBe(enabled);
  });
  describe('convertCliOptionsToContext', () => {
    it('disables ANSI colors when explicitly requested', () => {
      const result = convertCliOptionsToContext({ color: false });
      expect(result.config?.log?.supportAnsiColors).toBe(false);
    });
    it('preserves automatic color detection by default', () => {
      const result = convertCliOptionsToContext({});
      expect(result.config?.log?.supportAnsiColors).toBeUndefined();
    });
    it('should parse variables', () => {
      const result = convertCliOptionsToContext({ var: ['name=value'] });
      expect(result.variables?.name).toBe('value');
    });
    it('should support = character in variable value', () => {
      const result = convertCliOptionsToContext({
        var: [
          'oauth2_authenticationEndpoint=https://login.microsoftonline.com/tenantId/oauth2/authorize?resource=resourceId',
        ],
      });
      expect(result.variables?.oauth2_authenticationEndpoint).toBe(
        'https://login.microsoftonline.com/tenantId/oauth2/authorize?resource=resourceId'
      );
    });
  });
});
