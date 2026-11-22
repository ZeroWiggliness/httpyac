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

export function sample(source: JsonObject, warn: Warn, seen = new Set<JsonObject>()): unknown {
  for (const key of ['example', 'default']) {
    if (source[key] !== undefined) {
      return source[key];
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
  if (isObject(source.schema)) {
    return sample(source.schema, warn, next);
  }
  const alternatives = array(source.oneOf ?? source.anyOf, 'schema alternatives');
  if (alternatives.length && isObject(alternatives[0])) {
    warn('Request schema has alternatives; using the first branch for an editable example');
    return sample(alternatives[0], warn, next);
  }
  const composed = array(source.allOf, 'schema allOf');
  if (composed.length) {
    const parts = composed.map(value => (isObject(value) ? sample(value, warn, next) : undefined));
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
          .map(([key, value]) => [key, sample(optionalObject(value, `property ${key}`), warn, next)])
      );
    case 'array':
      return [sample(optionalObject(source.items, 'array items'), warn, next)];
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

export function schemaCheck(schema: unknown, value: string, warn: Warn, seen = new Set<JsonObject>()): string {
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
  let types: unknown[] = [];
  if (Array.isArray(schema.type)) {
    types = schema.type;
  } else if (schema.type) {
    types = [schema.type];
  } else if (schema.properties) {
    types = ['object'];
  }
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
    checks.push(
      `(${types
        .map(type => {
          if (typeof type !== 'string' || !typeChecks[type]) {
            throw new Error(`Unsupported response schema type: ${String(type)}`);
          }
          return typeChecks[type];
        })
        .join(' || ')})`
    );
  }
  if (schema.properties || schema.required) {
    const properties = optionalObject(schema.properties, 'response properties');
    const required = array(schema.required, 'required');
    const propertyChecks: string[] = [];
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
      propertyChecks.push(
        `(!Object.hasOwn(${value}, ${JSON.stringify(key)}) || (${schemaCheck(property, child, warn, next)}))`
      );
    }
    checks.push(
      `(${value} === null || typeof ${value} !== "object" || Array.isArray(${value}) || (${propertyChecks.join(' && ') || 'true'}))`
    );
  }
  if (schema.items !== undefined) {
    checks.push(
      `(!Array.isArray(${value}) || ${value}.every(oasItem => ${schemaCheck(schema.items, 'oasItem', warn, next)}))`
    );
  }
  for (const key of ['allOf', 'anyOf', 'oneOf']) {
    const children = array(schema[key], key);
    if (children.length) {
      const expressions = children.map(child => `(${schemaCheck(child, value, warn, next)})`);
      checks.push(
        key === 'oneOf'
          ? `([${expressions.join(',')}].filter(Boolean).length === 1)`
          : `(${expressions.join(key === 'allOf' ? ' && ' : ' || ')})`
      );
    }
  }
  const expression = checks.length ? checks.join(' && ') : 'true';
  return schema.nullable === true || types.includes('null')
    ? `(${value} === null || (${expression}))`
    : `(${expression})`;
}
