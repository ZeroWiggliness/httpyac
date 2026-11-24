import { array, isObject, JsonObject, optionalObject, text } from './document';

export type Warn = (message: string) => void;

export function withoutReadOnly(value: unknown, schema: unknown, seen = new Set<JsonObject>()): unknown {
  if (!isObject(schema) || seen.has(schema)) {
    return value;
  }
  const next = new Set(seen).add(schema);
  if (Array.isArray(value)) {
    return value.map(item => withoutReadOnly(item, schema.items, next));
  }
  if (!isObject(value)) {
    return value;
  }
  let result: JsonObject = { ...value };
  for (const child of array(schema.allOf, 'allOf')) {
    const filtered = withoutReadOnly(result, child, next);
    if (isObject(filtered)) {
      result = filtered;
    }
  }
  for (const [key, property] of Object.entries(optionalObject(schema.properties, 'properties'))) {
    if (isObject(property) && property.readOnly === true) {
      delete result[key];
    } else if (Object.hasOwn(result, key)) {
      result[key] = withoutReadOnly(result[key], property, next);
    }
  }
  return result;
}

export function sample(source: unknown, warn: Warn, seen = new Set<JsonObject>()): unknown {
  if (source === false) {
    warn('Unsatisfiable false request schema requires manual review');
    return null;
  }
  if (source === true || source === undefined) {
    warn('Unconstrained request schema requires an editable value');
    return 'REPLACE_ME';
  }
  if (!isObject(source)) {
    throw new Error('Expected an object or boolean request schema');
  }
  for (const key of ['example', 'default']) {
    if (source[key] !== undefined) {
      return source[key];
    }
    if (Object.hasOwn(source, 'const')) {
      return source.const;
    }
  }
  const examples = source.examples;
  if (Array.isArray(examples) && examples.length) {
    return examples[0];
  }
  if (isObject(examples)) {
    const example = Object.values(examples).find(value => isObject(value) && value.value !== undefined);
    if (isObject(example)) {
      return example.value;
    }
  }
  const values = array(source.enum, 'schema enum');
  if (values.length) {
    return values[0];
  }
  if (seen.has(source) || seen.size >= 12) {
    warn('Recursive/deep request schema requires an editable value');
    return null;
  }
  const next = new Set(seen).add(source);
  if (source.schema !== undefined) {
    return sample(source.schema, warn, next);
  }
  const alternatives = array(source.oneOf ?? source.anyOf, 'schema alternatives');
  if (alternatives.length) {
    warn('Request schema has alternatives; using the first branch for an editable example');
    return sample(alternatives[0], warn, next);
  }
  const composed = array(source.allOf, 'schema allOf');
  if (composed.length) {
    const siblings = { ...source };
    delete siblings.allOf;
    const hasSiblingSample =
      siblings.type !== undefined || siblings.properties !== undefined || siblings.items !== undefined;
    const parts = composed
      .filter(value => {
        if (value === false) {
          sample(value, warn, next);
        }
        return value !== true && value !== false;
      })
      .map(value => sample(value, warn, next));
    if (hasSiblingSample) {
      parts.push(sample(siblings, warn, next));
    }
    if (!parts.length) {
      return sample(siblings, warn, next);
    }
    if (parts.every(isObject)) {
      return Object.assign({}, ...parts);
    }
    warn('Non-object allOf request example needs review');
    return parts[0];
  }
  const type = Array.isArray(source.type) ? source.type.find(value => value !== 'null') : source.type;
  switch (type || (source.properties ? 'object' : undefined)) {
    case 'object':
      return Object.fromEntries(
        Object.entries(optionalObject(source.properties, 'schema properties'))
          .filter(([, value]) => !isObject(value) || value.readOnly !== true)
          .map(([key, value]) => [key, sample(value, warn, next)])
      );
    case 'array':
      if (source.items === false && !(typeof source.minItems === 'number' && source.minItems > 0)) {
        return [];
      }
      return [sample(source.items, warn, next)];
    case 'integer':
    case 'number':
      return typeof source.minimum === 'number' ? source.minimum : 1;
    case 'boolean':
      return false;
    case 'null':
      return null;
    case 'string':
      if (source.format === 'date') {
        return '2026-01-01';
      }
      if (source.format === 'date-time') {
        return '2026-01-01T00:00:00Z';
      }
      return 'example';
    default:
      warn(`No example/type for ${text(source.title, 'a request value')}; edit the generated placeholder`);
      return 'REPLACE_ME';
  }
}

interface NativeAssertions {
  lines: string[];
  path: string;
}

function completeOneOfBranch(schema: unknown, seen: Set<JsonObject>): boolean {
  if (typeof schema === 'boolean') {
    return true;
  }
  if (!isObject(schema) || seen.has(schema) || seen.size >= 12) {
    return false;
  }
  const supported = new Set([
    'type',
    'nullable',
    'properties',
    'required',
    'items',
    'allOf',
    'anyOf',
    'oneOf',
    'enum',
    'const',
    'title',
    'description',
    'example',
    'examples',
    'default',
    'readOnly',
    'writeOnly',
    'deprecated',
    'xml',
    'externalDocs',
    'discriminator',
  ]);
  if (Object.keys(schema).some(key => !supported.has(key) && !key.startsWith('x-'))) {
    return false;
  }
  if (
    schema.writeOnly === true ||
    (schema.properties !== undefined && schema.type === undefined) ||
    schema.nullable === true ||
    schema.type === 'null' ||
    (Array.isArray(schema.type) && schema.type.includes('null'))
  ) {
    return false;
  }
  const next = new Set(seen).add(schema);
  if (schema.properties !== undefined) {
    if (
      !isObject(schema.properties) ||
      !Object.values(schema.properties).every(child => completeOneOfBranch(child, next))
    ) {
      return false;
    }
  }
  if (schema.items !== undefined && !completeOneOfBranch(schema.items, next)) {
    return false;
  }
  return ['allOf', 'anyOf', 'oneOf'].every(
    key =>
      schema[key] === undefined ||
      (Array.isArray(schema[key]) &&
        (key === 'allOf' || schema[key].length > 0) &&
        schema[key].every(child => completeOneOfBranch(child, next)))
  );
}

function equalityCheck(value: string, expected: unknown): string {
  const json = JSON.stringify(expected);
  if (json === undefined) {
    throw new Error('Expected a JSON value in response schema enum or const');
  }
  const encoded = JSON.stringify(json)
    .replace(/\{/gu, '\\u007b')
    .replace(/\u2028/gu, '\\u2028')
    .replace(/\u2029/gu, '\\u2029');
  return `((oasEqual, oasExpected) => oasEqual(oasEqual, ${value}, oasExpected))((eq, a, b) => a === b || (a !== null && b !== null && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b) && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => Object.hasOwn(b, k) && eq(eq, a[k], b[k]))), JSON.parse(${encoded}))`;
}

export function schemaCheck(
  schema: unknown,
  value: string,
  warn: Warn,
  seen = new Set<JsonObject>(),
  native?: NativeAssertions
): string {
  if (schema === true || schema === undefined) {
    return 'true';
  }
  if (schema === false) {
    return 'false';
  }
  if (!isObject(schema)) {
    throw new Error('Expected an object or boolean response schema');
  }
  if (seen.has(schema) || seen.size >= 12) {
    warn('Recursive/deep response schema checks are limited at the recursive boundary');
    return 'true';
  }
  const next = new Set(seen).add(schema);
  for (const key of [
    '$ref',
    '$dynamicRef',
    'not',
    'if',
    'then',
    'else',
    'dependentSchemas',
    'patternProperties',
    'unevaluatedProperties',
    'prefixItems',
  ]) {
    if (schema[key] !== undefined) {
      warn(`Response schema keyword ${key} is not checked`);
    }
  }
  const checks: string[] = [];
  if (schema.enum !== undefined) {
    const values = array(schema.enum, 'response schema enum');
    checks.push(values.length ? `(${values.map(expected => equalityCheck(value, expected)).join(' || ')})` : 'false');
  }
  if (Object.hasOwn(schema, 'const')) {
    checks.push(equalityCheck(value, schema.const));
  }
  let types: unknown[] = [];
  if (Array.isArray(schema.type)) {
    types = schema.type;
  } else if (schema.type) {
    types = [schema.type];
  } else if (schema.properties) {
    types = ['object'];
  }
  const eligibleNative =
    schema.nullable === true || types.includes('null') || schema.oneOf || schema.anyOf ? undefined : native;
  const typeChecks: Record<string, string> = {
    object: `(${value} !== null && typeof ${value} === "object" && !Array.isArray(${value}))`,
    array: `Array.isArray(${value})`,
    string: `typeof ${value} === "string"`,
    number: `(typeof ${value} === "number" && Number.isFinite(${value}))`,
    integer: `Number.isInteger(${value})`,
    boolean: `typeof ${value} === "boolean"`,
    null: `${value} === null`,
  };
  if (types.length) {
    const predicates: Record<string, string> = { string: 'isString', boolean: 'isBoolean', array: 'isArray' };
    const predicate = Object.hasOwn(predicates, String(types[0])) ? predicates[String(types[0])] : undefined;
    if (eligibleNative?.path && types.length === 1 && predicate) {
      eligibleNative.lines.push(`?? body ${eligibleNative.path} ${predicate}`);
    } else {
      const check = types
        .map(type => {
          if (typeof type !== 'string' || !Object.hasOwn(typeChecks, type)) {
            throw new Error(`Unsupported response schema type: ${String(type)}`);
          }
          return typeChecks[type];
        })
        .join(' || ');
      checks.push(types.length > 1 ? `(${check})` : check);
    }
  }
  if (schema.properties || schema.required) {
    const properties = optionalObject(schema.properties, 'response properties');
    const required = array(schema.required, 'required');
    const propertyChecks: string[] = [];
    const objectType = types.length === 1 && types[0] === 'object';
    for (const key of required) {
      if (typeof key !== 'string') {
        throw new Error('Required property names must be strings');
      }
      if (!isObject(properties[key]) || properties[key].writeOnly !== true) {
        propertyChecks.push(`Object.hasOwn(${value}, ${JSON.stringify(key)})`);
      }
    }
    for (const [key, property] of Object.entries(properties)) {
      if (isObject(property) && property.writeOnly === true) {
        continue;
      }
      const child = `${value}[${JSON.stringify(key)}]`;
      const childNative =
        eligibleNative &&
        types.length === 1 &&
        types[0] === 'object' &&
        required.includes(key) &&
        /^[A-Za-z_$][\w$]*$/u.test(key)
          ? { lines: eligibleNative.lines, path: eligibleNative.path ? `${eligibleNative.path}?.${key}` : key }
          : undefined;
      const check = schemaCheck(property, child, warn, next, childNative);
      if (check !== 'true') {
        propertyChecks.push(
          objectType && required.includes(key)
            ? `(${check})`
            : `(!Object.hasOwn(${value}, ${JSON.stringify(key)}) || (${check}))`
        );
      }
    }
    if (propertyChecks.length) {
      if (objectType) {
        checks.push(...propertyChecks);
      } else {
        checks.push(
          `(${value} === null || typeof ${value} !== "object" || Array.isArray(${value}) || (${propertyChecks.join(' && ')}))`
        );
      }
    }
  }
  if (schema.items !== undefined) {
    const itemCheck = schemaCheck(schema.items, 'oasItem', warn, next);
    if (itemCheck !== 'true') {
      const every = `${value}.every(oasItem => (${itemCheck}))`;
      checks.push(`(!Array.isArray(${value}) || ${every})`);
    }
  }
  for (const key of ['allOf', 'anyOf', 'oneOf']) {
    const children = array(schema[key], key);
    if (children.length) {
      if (key === 'oneOf' && !children.every(child => completeOneOfBranch(child, next))) {
        warn('Response oneOf check omitted because a branch contains unsupported or recursive constraints');
        continue;
      }
      const expressions = children.map(
        child => `(${schemaCheck(child, value, warn, next, key === 'allOf' ? eligibleNative : undefined)})`
      );
      checks.push(
        key === 'oneOf'
          ? `([${expressions.join(',')}].filter(Boolean).length === 1)`
          : `(${expressions.join(key === 'allOf' ? ' && ' : ' || ')})`
      );
    }
  }
  const expression = checks.length ? checks.join(' && ') : 'true';
  return schema.nullable === true || types.includes('null') ? `(${value} === null || (${expression}))` : expression;
}
