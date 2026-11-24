import { runInNewContext } from 'vm';

import { sample, schemaCheck, withoutReadOnly } from './schema';

describe('OpenAPI schema sampling', () => {
  it('merges allOf branches with sibling properties and excludes read-only fields', () => {
    const schema = {
      type: 'object',
      properties: { sibling: { type: 'boolean' }, secret: { type: 'string', readOnly: true } },
      allOf: [{ properties: { base: { type: 'integer' } } }, { properties: { extra: { const: 'yes' } } }],
    };
    const warn = jest.fn();
    expect(withoutReadOnly(sample(schema, warn), schema)).toEqual({ base: 1, extra: 'yes', sibling: false });
    expect(warn).not.toHaveBeenCalled();
  });

  it('accepts nested boolean schemas and warns on unsatisfiable false schemas', () => {
    const warn = jest.fn();
    expect(sample({ properties: { unrestricted: true, impossible: false } }, warn)).toEqual({
      unrestricted: 'REPLACE_ME',
      impossible: null,
    });
    expect(sample({ type: 'array', items: false }, warn)).toEqual([]);
    expect(sample({ type: 'array', items: false, minItems: 1 }, warn)).toEqual([null]);
    expect(sample({ schema: false }, warn)).toBeNull();
    expect(sample({ allOf: [true, false, { properties: { name: { type: 'string' } } }] }, warn)).toEqual({
      name: 'example',
    });
    expect(warn.mock.calls.filter(([message]) => String(message).includes('Unsatisfiable'))).toHaveLength(4);
  });
});

describe('detailed OpenAPI schema checks', () => {
  function check(schema: unknown, value: unknown, warn = jest.fn()): boolean {
    return runInNewContext(`(${schemaCheck(schema, 'value', warn)})`, { value }) as boolean;
  }

  it('discriminates oneOf branches by enum and const, including nested JSON values', () => {
    const schema = {
      oneOf: [
        { type: 'object', required: ['kind'], properties: { kind: { enum: ['cat', 'kitten'] } } },
        { type: 'object', required: ['kind'], properties: { kind: { const: 'dog' } } },
      ],
    };
    expect(check(schema, { kind: 'cat' })).toBe(true);
    expect(check(schema, { kind: 'dog' })).toBe(true);
    expect(check(schema, { kind: 'bird' })).toBe(false);
    expect(check(schema, {})).toBe(false);
    expect(check({ const: { a: [1, { b: false }], c: null } }, { c: null, a: [1, { b: false }] })).toBe(true);
    expect(check({ enum: [{ a: 1 }, [1, 2]] }, { a: 2 })).toBe(false);
    expect(check({ enum: [1, 2] }, 2)).toBe(true);
    expect(check({ oneOf: [{ enum: [1, 2] }, { const: 2 }] }, 2)).toBe(false);
  });

  it('omits oneOf checks when an unsupported constraint prevents safe discrimination', () => {
    const warn = jest.fn();
    const schema = { type: 'number', oneOf: [{ minimum: 0 }, { maximum: -1 }] };
    expect(check(schema, 2, warn)).toBe(true);
    expect(check(schema, -2, warn)).toBe(true);
    expect(check(schema, '2', warn)).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('oneOf check omitted'));
  });

  it('omits oneOf checks for inferred object types and nullable branch constraints', () => {
    const warn = jest.fn();
    expect(check({ oneOf: [{ properties: { kind: { const: 'a' } } }, { type: 'string' }] }, 'text', warn)).toBe(true);
    expect(check({ oneOf: [{ type: ['string', 'null'], enum: ['a'] }, { type: 'null' }] }, null, warn)).toBe(true);
    expect(check({ oneOf: [{ type: 'null', const: 'not null' }, { type: 'null' }] }, null, warn)).toBe(true);
    expect(check({ oneOf: [{ anyOf: [] }, { type: 'string' }] }, 'text', warn)).toBe(true);
    expect(warn).toHaveBeenCalledTimes(4);
  });

  it('escapes template delimiters in generated enum and const assertions', () => {
    const schema = { const: { value: '{{danger}}' } };
    const expression = schemaCheck(schema, 'value', jest.fn());
    expect(expression).not.toContain('{{');
    expect(check(schema, { value: '{{danger}}' })).toBe(true);
  });

  it('checks nested boolean schemas in objects, arrays, and oneOf', () => {
    const schema = {
      type: 'object',
      properties: { allowed: true, forbidden: false, list: { type: 'array', items: false } },
    };
    expect(check(schema, { allowed: 'anything', list: [] })).toBe(true);
    expect(check(schema, { forbidden: null })).toBe(false);
    expect(check(schema, { list: [1] })).toBe(false);
    expect(check({ oneOf: [true, false] }, 1)).toBe(true);
  });
});
