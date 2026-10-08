import { fileProvider } from '../../../io';
import type { PathLike, ProcessorContext } from '../../../models';
import * as utils from '../../../utils';

export interface FileCompareArgs {
  fileName: string;
  flags: Array<string>;
}

export interface LineDifference {
  line: number;
  expectedLine: string | undefined;
  actualLine: string | undefined;
}

export function parseFileCompareArgs(expected: unknown): FileCompareArgs {
  let text = (utils.toString(expected) || '').trim();
  const flags: Array<string> = [];
  const flagRegex = /\s*(?<flag>--[^\s]+)$/u;
  let match: RegExpExecArray | null;
  while ((match = flagRegex.exec(text)) && match.groups?.flag) {
    flags.unshift(match.groups.flag);
    text = text.slice(0, match.index).trim();
  }
  return { fileName: text, flags };
}

export function getUnsupportedFlags(flags: Array<string>, supportedFlags: Array<string>) {
  return flags.filter(flag => supportedFlags.indexOf(flag) < 0);
}

export async function readCompareFile(
  fileName: string,
  context: ProcessorContext | undefined
): Promise<{ content: string } | { error: string }> {
  if (!fileName) {
    return { error: 'no file name specified' };
  }
  const baseDir: PathLike | undefined = context?.httpFile?.fileName
    ? fileProvider.dirname(context.httpFile.fileName)
    : undefined;
  const file = await utils.toAbsoluteFilename(fileName, baseDir);
  if (!file) {
    return { error: `file ${fileName} not found` };
  }
  try {
    return { content: await fileProvider.readFile(file, 'utf-8') };
  } catch (err) {
    return { error: `file ${fileName} could not be read (${utils.toString(err)})` };
  }
}

export function normalizeLineEndings(text: string) {
  return text.replace(/\r\n?/gu, '\n');
}

export function normalizeLineEndingsDeep(value: unknown): unknown {
  if (typeof value === 'string') {
    return normalizeLineEndings(value);
  }
  if (Array.isArray(value)) {
    return value.map(normalizeLineEndingsDeep);
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, normalizeLineEndingsDeep(val)]));
  }
  return value;
}

export function firstLineDifference(expected: string, actual: string): LineDifference | undefined {
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const length = Math.max(expectedLines.length, actualLines.length);
  for (let index = 0; index < length; index++) {
    if (expectedLines[index] !== actualLines[index]) {
      return {
        line: index + 1,
        expectedLine: expectedLines[index],
        actualLine: actualLines[index],
      };
    }
  }
  return undefined;
}

export function firstJsonDifference(expected: unknown, actual: unknown, path = '$'): string | undefined {
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const length = Math.max(expected.length, actual.length);
    for (let index = 0; index < length; index++) {
      const result = firstJsonDifference(expected[index], actual[index], `${path}[${index}]`);
      if (result) {
        return result;
      }
    }
    return undefined;
  }
  if (isPlainObject(expected) && isPlainObject(actual)) {
    const keys = Array.from(new Set([...Object.keys(expected), ...Object.keys(actual)])).sort();
    for (const key of keys) {
      if (!(key in expected) || !(key in actual)) {
        return toJsonPath(path, key);
      }
      const result = firstJsonDifference(expected[key], actual[key], toJsonPath(path, key));
      if (result) {
        return result;
      }
    }
    return undefined;
  }
  if (Object.is(expected, actual)) {
    return undefined;
  }
  return path;
}

export function stringifySorted(value: unknown) {
  return JSON.stringify(sortKeysDeep(value), null, 2) ?? `${value}`;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, sortKeysDeep(value[key])])
    );
  }
  return value;
}

function toJsonPath(path: string, key: string) {
  return /^[A-Za-z_$][\w$]*$/u.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !Buffer.isBuffer(value);
}

export function formatLine(line: string | undefined, eofText: string, quote = true) {
  if (line === undefined) {
    return eofText;
  }
  return quote ? JSON.stringify(line) : line.trim();
}
