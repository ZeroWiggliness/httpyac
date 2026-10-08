import type { ProcessorContext } from '../../../models';

export interface TestPredicateResult {
  valid: boolean;
  /** detailed failure message, used instead of the default assert message */
  message?: string;
}

export interface TestPredicate {
  readonly id: Array<string>;
  readonly noAutoConvert?: boolean;
  match(
    value: unknown,
    expected: unknown,
    context?: ProcessorContext
  ): boolean | TestPredicateResult | Promise<boolean | TestPredicateResult>;
}
