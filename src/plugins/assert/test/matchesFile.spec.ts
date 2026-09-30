import { HttpFile, TestResult, TestResultStatus } from '../../../models';
import { initFileProvider, initHttpClientProvider, parseHttp, sendHttpFile } from '../../../test/testUtils';

async function runAssert(assertLine: string, response: { body?: string; parsedBody?: unknown }) {
  initHttpClientProvider(() => Promise.resolve(response));
  const httpFile: HttpFile = await parseHttp(`
    GET /get

    ${assertLine}
    `);
  await sendHttpFile({ httpFile });
  expect(httpFile.httpRegions[0].testResults?.length).toBe(1);
  return httpFile.httpRegions[0].testResults?.[0] as TestResult;
}

describe('assert.matchesFile', () => {
  it('should match file content', async () => {
    initFileProvider({ 'expected.txt': 'Hello\nWorld' });
    const result = await runAssert('?? body matchesFile ./expected.txt', { body: 'Hello\nWorld' });
    expect(result.status).toBe(TestResultStatus.SUCCESS);
    expect(result.message).toBe('body matchesFile ./expected.txt');
  });

  it('should support absolute file path', async () => {
    initFileProvider({ '/abs/expected.txt': 'Hello' });
    const result = await runAssert('?? body matchesFile /abs/expected.txt', { body: 'Hello' });
    expect(result.status).toBe(TestResultStatus.SUCCESS);
  });

  it('should show expected and returned line on mismatch', async () => {
    initFileProvider({ 'expected.txt': 'line1\nHello World\nline3' });
    const result = await runAssert('?? body matchesFile ./expected.txt', { body: 'line1\nHello world\nline3' });
    expect(result.status).toBe(TestResultStatus.FAILED);
    const message = result.error?.displayMessage;
    expect(message).toContain('./expected.txt differs at line 2');
    expect(message).toContain('expected: "Hello World"');
    expect(message).toContain('returned: "Hello world"');
  });

  it('should show end of response if response is shorter', async () => {
    initFileProvider({ 'expected.txt': 'line1\nline2' });
    const result = await runAssert('?? body matchesFile ./expected.txt', { body: 'line1' });
    expect(result.status).toBe(TestResultStatus.FAILED);
    expect(result.error?.displayMessage).toContain('differs at line 2');
    expect(result.error?.displayMessage).toContain('expected: "line2"');
    expect(result.error?.displayMessage).toContain('returned: <end of response>');
  });

  it('should fail on different line endings by default', async () => {
    initFileProvider({ 'expected.txt': 'Hello\r\nWorld' });
    const result = await runAssert('?? body matchesFile ./expected.txt', { body: 'Hello\nWorld' });
    expect(result.status).toBe(TestResultStatus.FAILED);
    expect(result.error?.displayMessage).toContain('expected: "Hello\\r"');
    expect(result.error?.displayMessage).toContain('returned: "Hello"');
  });

  it('should ignore line endings with --ignoreLineEndings', async () => {
    initFileProvider({ 'expected.txt': 'Hello\r\nWorld' });
    const result = await runAssert('?? body matchesFile ./expected.txt --ignoreLineEndings', {
      body: 'Hello\nWorld',
    });
    expect(result.status).toBe(TestResultStatus.SUCCESS);
  });

  it('should trim with --trim', async () => {
    initFileProvider({ 'expected.txt': 'Hello\n' });
    expect((await runAssert('?? body matchesFile ./expected.txt', { body: '  Hello' })).status).toBe(
      TestResultStatus.FAILED
    );
    expect((await runAssert('?? body matchesFile ./expected.txt --trim', { body: '  Hello' })).status).toBe(
      TestResultStatus.SUCCESS
    );
  });

  it('should support multiple flags', async () => {
    initFileProvider({ 'expected.txt': 'Hello\r\nWorld\r\n' });
    const result = await runAssert('?? body matchesFile ./expected.txt --trim --ignoreLineEndings', {
      body: '\nHello\nWorld',
    });
    expect(result.status).toBe(TestResultStatus.SUCCESS);
  });

  it('should fail on unknown option', async () => {
    initFileProvider({ 'expected.txt': 'Hello' });
    const result = await runAssert('?? body matchesFile ./expected.txt --foo', { body: 'Hello' });
    expect(result.status).toBe(TestResultStatus.FAILED);
    expect(result.error?.displayMessage).toContain('unknown option --foo');
  });

  it('should fail on missing file', async () => {
    initFileProvider({});
    const result = await runAssert('?? body matchesFile ./missing.txt', { body: 'Hello' });
    expect(result.status).toBe(TestResultStatus.FAILED);
    expect(result.error?.displayMessage).toBe('file ./missing.txt not found');
  });

  it('should replace variables in file name', async () => {
    initFileProvider({ 'expected.txt': 'Hello' });
    initHttpClientProvider(() => Promise.resolve({ body: 'Hello' }));
    const httpFile = await parseHttp(`
    @name = expected
    GET /get

    ?? body matchesFile ./{{name}}.txt
    `);
    await sendHttpFile({ httpFile });
    expect(httpFile.httpRegions[0].testResults?.[0].status).toBe(TestResultStatus.SUCCESS);
    expect(httpFile.httpRegions[0].testResults?.[0].message).toBe('body matchesFile ./expected.txt');
  });

  it('should still support matches predicate', async () => {
    initFileProvider();
    const result = await runAssert('?? body matches ^Hel+o$', { body: 'Hello' });
    expect(result.status).toBe(TestResultStatus.SUCCESS);
    expect(result.message).toBe('body matches ^Hel+o$');
  });
});

describe('assert.matchesJsonFile', () => {
  it('should ignore key order and formatting', async () => {
    initFileProvider({ 'expected.json': '{\n  "b": [1, 2],\n  "a": "foo"\n}' });
    const result = await runAssert('?? body matchesJsonFile ./expected.json', {
      parsedBody: { a: 'foo', b: [1, 2] },
    });
    expect(result.status).toBe(TestResultStatus.SUCCESS);
    expect(result.message).toBe('body matchesJsonFile ./expected.json');
  });

  it('should show path, expected and returned line on mismatch', async () => {
    initFileProvider({ 'expected.json': '{"items":[{"name":"a"},{"name":"a"}]}' });
    const result = await runAssert('?? body matchesJsonFile ./expected.json', {
      parsedBody: { items: [{ name: 'a' }, { name: 'b' }] },
    });
    expect(result.status).toBe(TestResultStatus.FAILED);
    const message = result.error?.displayMessage;
    expect(message).toContain('./expected.json differs at $.items[1].name (line 7)');
    expect(message).toContain('expected: "name": "a"');
    expect(message).toContain('returned: "name": "b"');
  });

  it('should fail on array order', async () => {
    initFileProvider({ 'expected.json': '[1,2]' });
    const result = await runAssert('?? body matchesJsonFile ./expected.json', { body: '[2,1]' });
    expect(result.status).toBe(TestResultStatus.FAILED);
    expect(result.error?.displayMessage).toContain('differs at $[0]');
  });

  it('should compare nested body property', async () => {
    initFileProvider({ 'items.json': '["x","y"]' });
    const result = await runAssert('?? body data.items matchesJsonFile ./items.json', {
      parsedBody: { data: { items: ['x', 'y'] } },
    });
    expect(result.status).toBe(TestResultStatus.SUCCESS);
  });

  it('should ignore line endings in string values with --ignoreLineEndings', async () => {
    initFileProvider({ 'expected.json': '{"text":"a\\r\\nb"}' });
    const body = { parsedBody: { text: 'a\nb' } };
    const failed = await runAssert('?? body matchesJsonFile ./expected.json', body);
    expect(failed.status).toBe(TestResultStatus.FAILED);
    expect(failed.error?.displayMessage).toContain('differs at $.text');

    const success = await runAssert('?? body matchesJsonFile ./expected.json --ignoreLineEndings', body);
    expect(success.status).toBe(TestResultStatus.SUCCESS);
  });

  it('should reject --trim option', async () => {
    initFileProvider({ 'expected.json': '{}' });
    const result = await runAssert('?? body matchesJsonFile ./expected.json --trim', { body: '{}' });
    expect(result.status).toBe(TestResultStatus.FAILED);
    expect(result.error?.displayMessage).toContain('unknown option --trim');
  });

  it('should fail on invalid json file', async () => {
    initFileProvider({ 'expected.json': '{invalid' });
    const result = await runAssert('?? body matchesJsonFile ./expected.json', { body: '{}' });
    expect(result.status).toBe(TestResultStatus.FAILED);
    expect(result.error?.displayMessage).toContain('file ./expected.json is not valid JSON');
  });

  it('should fail on invalid json response', async () => {
    initFileProvider({ 'expected.json': '{}' });
    const result = await runAssert('?? body matchesJsonFile ./expected.json', { body: 'no json' });
    expect(result.status).toBe(TestResultStatus.FAILED);
    expect(result.error?.displayMessage).toContain('returned value is not valid JSON');
  });
});
