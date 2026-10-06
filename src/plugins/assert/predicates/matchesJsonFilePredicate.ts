import isEqual from 'lodash/isEqual';

import * as models from '../../../models';
import * as utils from '../../../utils';
import {
  firstJsonDifference,
  firstLineDifference,
  formatLine,
  getUnsupportedFlags,
  normalizeLineEndingsDeep,
  parseFileCompareArgs,
  readCompareFile,
  stringifySorted,
} from './fileCompareUtils';
import { TestPredicate, TestPredicateResult } from './testPredicate';

const IGNORE_LINE_ENDINGS = '--ignoreLineEndings';

export class MatchesJsonFilePredicate implements TestPredicate {
  readonly id = ['matchesJsonFile'];
  noAutoConvert = true;
  async match(value: unknown, expected: unknown, context?: models.ProcessorContext): Promise<TestPredicateResult> {
    const { fileName, flags } = parseFileCompareArgs(expected);
    const unsupportedFlags = getUnsupportedFlags(flags, [IGNORE_LINE_ENDINGS]);
    if (unsupportedFlags.length > 0) {
      return {
        valid: false,
        message: `unknown option ${unsupportedFlags.join(', ')} (supported: ${IGNORE_LINE_ENDINGS})`,
      };
    }
    const file = await readCompareFile(fileName, context);
    if ('error' in file) {
      return { valid: false, message: file.error };
    }

    let expectedJson = parseJson(file.content);
    if (expectedJson.error) {
      return { valid: false, message: `file ${fileName} is not valid JSON (${expectedJson.error})` };
    }
    let actualJson = typeof value === 'string' || Buffer.isBuffer(value) ? parseJson(value) : { json: value };
    if (actualJson.error) {
      return { valid: false, message: `returned value is not valid JSON (${actualJson.error})` };
    }
    if (flags.includes(IGNORE_LINE_ENDINGS)) {
      expectedJson = { json: normalizeLineEndingsDeep(expectedJson.json) };
      actualJson = { json: normalizeLineEndingsDeep(actualJson.json) };
    }
    if (isEqual(expectedJson.json, actualJson.json)) {
      return { valid: true };
    }

    const path = firstJsonDifference(expectedJson.json, actualJson.json) ?? '$';
    const diff = firstLineDifference(stringifySorted(expectedJson.json), stringifySorted(actualJson.json));
    return {
      valid: false,
      message: utils.toMultiLineString([
        `${fileName} differs at ${path}${diff ? ` (line ${diff.line})` : ''}`,
        `  expected: ${formatLine(diff?.expectedLine, '<end of file>', false)}`,
        `  returned: ${formatLine(diff?.actualLine, '<end of response>', false)}`,
      ]),
    };
  }
}

function parseJson(value: string | Buffer): { json?: unknown; error?: string } {
  try {
    const text = Buffer.isBuffer(value) ? value.toString('utf-8') : value;
    return { json: JSON.parse(text.replace(/^\uFEFF/u, '')) };
  } catch (err) {
    return { error: utils.toString(err) || 'parse error' };
  }
}
