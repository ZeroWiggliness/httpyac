import { default as chalk } from 'chalk';

import { HttpResponse, testSymbols, TestResultStatus } from '../models';
import { HttpFile, HttpRegion } from '../store';
import { isHttpRequestMethod, mergeRawHttpHeaders, requestLoggerFactory } from './requestUtils';
import { toMultiLineString } from './stringUtils';

describe('Request logger colors', () => {
  const originalLevel = chalk.level;

  afterEach(() => {
    chalk.level = originalLevel;
  });

  it.each([0, 1] as const)('formats exchange output at color level %s', async level => {
    chalk.level = level;
    const logger = jest.fn();
    const region = new HttpRegion(new HttpFile('color.http'));
    region.metaData.title = 'publish {literal}';
    region.metaData.description = 'Description {cyan untouched}';
    region.testResults = [
      { status: TestResultStatus.SUCCESS, message: 'status == 0' },
      { status: TestResultStatus.SKIPPED, message: '' },
      {
        status: TestResultStatus.FAILED,
        message: 'body.text == hello',
        error: { error: new Error('failed'), displayMessage: 'AssertionError' },
      },
      { status: TestResultStatus.ERROR, message: '' },
    ];
    const body = '{"text":"hello {gray world}"}';
    const response: HttpResponse = {
      protocol: 'KAFKA',
      statusCode: 0,
      statusMessage: 'produced',
      headers: { kafka_offset: '6', 'content-type': 'application/json', ':hidden': 'ignored' },
      body,
      timings: { total: 12 },
      request: {
        method: 'KAFKA',
        url: 'host.docker.internal:9094',
        headers: { kafka_topic: 'color-test' },
        body,
      },
    };

    await requestLoggerFactory(logger, {
      requestOutput: true,
      requestHeaders: true,
      requestBodyLength: 0,
      responseHeaders: true,
      responseBodyLength: 0,
      timings: true,
    })(response, region);

    expect(logger.mock.calls.map(([message]) => message)).toEqual([
      '',
      '---------------------',
      '',
      chalk.gray('=== publish {literal} ==='),
      chalk.gray('Description {cyan untouched}'),
      '',
      chalk.cyan.bold('KAFKA host.docker.internal:9094'),
      `${chalk.yellow('kafka_topic')}: color-test`,
      '',
      chalk.gray(body),
      toMultiLineString([
        `${chalk.cyan.bold('KAFKA')} ${chalk.cyan.bold(0)} ${chalk.bold(' - produced')}`,
        `${chalk.yellow('content-type')}: application/json`,
        `${chalk.yellow('kafka_offset')}: 6`,
        '',
        `${chalk.cyan.bold('Timings')}:`,
        `${chalk.yellow('total')}: 12`,
        '',
        body,
      ]),
      chalk.green(`${testSymbols.ok} status == 0`),
      chalk.yellow(`${testSymbols.skipped} Test skipped`),
      chalk.red(`${testSymbols.error} body.text == hello (AssertionError)`),
      chalk.red(`${testSymbols.error} Test failed`),
    ]);
    const output = logger.mock.calls.map(([message]) => message).join('\n');
    expect(output.includes('\u001b[')).toBe(level > 0);
    expect(output).not.toContain('{cyan.bold');
    expect(output).not.toContain('{yellow');
    expect(output).toContain(body);
  });

  it.each([0, 1] as const)('formats short output at color level %s', async level => {
    chalk.level = level;
    const logger = jest.fn();
    await requestLoggerFactory(logger, { useShort: true })({
      protocol: 'HTTP',
      statusCode: 200,
      timings: { total: 12 },
      meta: { size: '42 B' },
      request: { method: 'GET', url: 'http://localhost' },
    });
    expect(logger.mock.calls.map(([message]) => message)).toEqual([
      '',
      '---------------------',
      '',
      `${chalk.yellow('GET')} ${chalk.gray('http://localhost')}`,
      `${chalk.gray('=>')} ${chalk.cyan.bold(200)} (${chalk.yellow('12 ms')}, ${chalk.yellow('42 B')})`,
    ]);
  });
});

describe('HTTP request method utils', () => {
  it.each(['QUERY', 'query'])('recognizes QUERY method %s', method => {
    expect(isHttpRequestMethod(method)).toBe(true);
  });

  it('rejects unsupported methods', () => {
    expect(isHttpRequestMethod('INVALID')).toBe(false);
  });
});

describe('Raw HTTP Header merge utils', () => {
  it('merges example raw headers to expected record value', () => {
    // Example taken from got documentation of the rawHeaders property of the Response type
    const rawHeaders = [
      'user-agent',
      'this is invalid because there can be only one',
      'User-Agent',
      'curl/7.22.0',
      'Host',
      '127.0.0.1:8000',
      'ACCEPT',
      '*',
    ];
    const mergedHeaders = mergeRawHttpHeaders(rawHeaders);
    // Note User-Agent header with different casing collapsed into a single multi-item string-array
    expect(mergedHeaders['user-agent']).toEqual(['this is invalid because there can be only one', 'curl/7.22.0']);
    // Headers that only appear once are stored in single-item string-arrays
    expect(mergedHeaders.host).toEqual(['127.0.0.1:8000']);
    expect(mergedHeaders.accept).toEqual(['*']);
  });
});
