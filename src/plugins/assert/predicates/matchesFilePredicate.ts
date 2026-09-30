import * as models from '../../../models';
import * as utils from '../../../utils';
import {
  firstLineDifference,
  formatLine,
  getUnsupportedFlags,
  normalizeLineEndings,
  parseFileCompareArgs,
  readCompareFile,
} from './fileCompareUtils';
import { TestPredicate, TestPredicateResult } from './testPredicate';

const TRIM = '--trim';
const IGNORE_LINE_ENDINGS = '--ignoreLineEndings';

export class MatchesFilePredicate implements TestPredicate {
  readonly id = ['matchesFile'];
  noAutoConvert = true;
  async match(value: unknown, expected: unknown, context?: models.ProcessorContext): Promise<TestPredicateResult> {
    const { fileName, flags } = parseFileCompareArgs(expected);
    const unsupportedFlags = getUnsupportedFlags(flags, [TRIM, IGNORE_LINE_ENDINGS]);
    if (unsupportedFlags.length > 0) {
      return {
        valid: false,
        message: `unknown option ${unsupportedFlags.join(', ')} (supported: ${TRIM}, ${IGNORE_LINE_ENDINGS})`,
      };
    }
    const file = await readCompareFile(fileName, context);
    if ('error' in file) {
      return { valid: false, message: file.error };
    }

    let expectedText = file.content;
    let actualText = toText(value);
    if (flags.includes(IGNORE_LINE_ENDINGS)) {
      expectedText = normalizeLineEndings(expectedText);
      actualText = normalizeLineEndings(actualText);
    }
    if (flags.includes(TRIM)) {
      expectedText = expectedText.trim();
      actualText = actualText.trim();
    }
    if (expectedText === actualText) {
      return { valid: true };
    }
    const diff = firstLineDifference(expectedText, actualText);
    return {
      valid: false,
      message: utils.toMultiLineString([
        `${fileName} differs at line ${diff?.line ?? 1}`,
        `  expected: ${formatLine(diff?.expectedLine, '<end of file>')}`,
        `  returned: ${formatLine(diff?.actualLine, '<end of response>')}`,
      ]),
    };
  }
}

function toText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Buffer.isBuffer(value)) {
    return value.toString('utf-8');
  }
  return utils.toString(value) ?? `${value}`;
}
