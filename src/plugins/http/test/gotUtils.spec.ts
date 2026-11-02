import { getLocal } from 'mockttp';

import { getClientOptions, gotHttpClient } from '../gotUtils';

describe('got HTTP client', () => {
  const server = getLocal();
  beforeAll(async () => await server.start());
  afterAll(async () => await server.stop());

  it('disables retries while keeping the response wrapper', () => {
    const options = getClientOptions({ url: 'http://localhost' }, {});
    expect(options.retry).toEqual({ limit: 0 });
    expect(options.resolveBodyOnly).toBe(false);
  });

  it('returns a Buffer for the raw response body', async () => {
    await server.forGet('/body').thenReply(200, 'hello');

    const response = await gotHttpClient({ url: `http://localhost:${server.port}/body` }, {});

    expect(response).not.toBe(false);
    if (response) {
      expect(response.body).toBe('hello');
      expect(response.rawBody).toEqual(Buffer.from('hello'));
      expect(Buffer.isBuffer(response.rawBody)).toBe(true);
    }
  });
});
