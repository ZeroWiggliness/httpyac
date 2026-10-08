import { convertCliOptionsToContext } from './send';

describe('cli', () => {
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
