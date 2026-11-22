import RefParser from '@apidevtools/json-schema-ref-parser';
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import { resolve } from 'path';

export type JsonObject = Record<string, unknown>;
export const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];

export interface Operation {
  path: string;
  method: string;
  item: JsonObject;
  operation: JsonObject;
  name: string;
}

export interface OpenApi {
  root: JsonObject;
  operations: Operation[];
  files: string[];
  resolveReference: (reference: string) => unknown;
}

export function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function object(value: unknown, label: string): JsonObject {
  if (!isObject(value)) {
    throw new Error(`Expected an object for ${label}`);
  }
  return value;
}

export function optionalObject(value: unknown, label: string): JsonObject {
  return value === undefined ? {} : object(value, label);
}

export function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function array(value: unknown, label: string): unknown[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`Expected an array for ${label}`);
  }
  return value;
}

export function identifier(value: string): string {
  const name = value.replace(/[^a-zA-Z0-9_]/gu, '_');
  return /^[a-zA-Z_]/u.test(name) ? `oas_${name}` : `oas_request_${name}`;
}

export function singleLine(value: string): string {
  return value
    .replace(/[\r\n\u2028\u2029]/gu, ' ')
    .replace(/\{\{/gu, '{ {')
    .trim();
}

function isDocument(value: unknown): value is OpenAPIV3.Document | OpenAPIV3_1.Document {
  return (
    isObject(value) &&
    /^3\.\d+\.\d+(?:[-+].*)?$/u.test(text(value.openapi)) &&
    isObject(value.info) &&
    typeof value.info.title === 'string' &&
    typeof value.info.version === 'string' &&
    isObject(value.paths)
  );
}

export async function loadOpenApi(fileName: string): Promise<OpenApi> {
  const parser = new RefParser();
  const api: unknown = await parser.dereference(resolve(fileName), {
    resolve: { http: { timeout: 10000, maxContentLength: 8 * 1024 * 1024, safeUrlResolver: false } },
    dereference: { circular: true },
  });
  if (!isDocument(api)) {
    throw new Error('Expected an OpenAPI 3.x document with info.title, info.version and paths (not Swagger 2.0)');
  }
  const root = object(api, 'OpenAPI document');
  const operations: Operation[] = [];
  const names = new Map<string, number>();
  for (const [path, value] of Object.entries(object(root.paths, 'paths'))) {
    if (!path.startsWith('/')) {
      throw new Error(`OpenAPI path must start with /: ${path}`);
    }
    const item = object(value, path);
    for (const [method, value] of Object.entries(item)) {
      if (!methods.includes(method)) {
        continue;
      }
      const operation = object(value, `${method.toUpperCase()} ${path}`);
      object(operation.responses, `${method.toUpperCase()} ${path} responses`);
      const base = identifier(text(operation.operationId, `${method}_${path}`));
      const count = (names.get(base) || 0) + 1;
      names.set(base, count);
      operations.push({ path, method, item, operation, name: count === 1 ? base : `${base}_${count}` });
    }
  }
  return {
    root,
    operations,
    files: parser.$refs.paths('file'),
    resolveReference: reference => parser.$refs.get(reference),
  };
}

function tokenizeSelectors(value: string): string[] {
  const selectors: string[] = [];
  let token = '';
  let regex = false;
  let escaped = false;
  let characterClass = false;
  for (const character of value) {
    if (regex) {
      token += character;
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '[') {
        characterClass = true;
      } else if (character === ']') {
        characterClass = false;
      } else if (character === '/' && !characterClass) {
        regex = false;
      }
    } else if (character === '/' && /(?:^|\s)regex:$/u.test(token)) {
      token += character;
      regex = true;
    } else if (character === ',') {
      selectors.push(token.trim());
      token = '';
    } else {
      token += character;
    }
  }
  if (regex) {
    throw new Error('Unterminated regex endpoint selector');
  }
  selectors.push(token.trim());
  if (selectors.some(selector => !selector)) {
    throw new Error('Endpoint selectors must not be empty');
  }
  return selectors;
}

function pathMatcher(selector: string): (path: string) => boolean {
  if (selector.startsWith('regex:')) {
    const match = /^regex:\/(.*)\/([imu]*)$/u.exec(selector);
    if (!match) {
      throw new Error(`Invalid regex selector (allowed flags: i, m, u): ${selector}`);
    }
    const regex = new RegExp(match[1], match[2]);
    return path => regex.test(path);
  }
  if (!selector.startsWith('/')) {
    throw new Error(`Expected an exact path, wildcard path or regex:/pattern/: ${selector}`);
  }
  const expression = selector
    .split('*')
    .map(part => part.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
    .join('.*');
  const regex = new RegExp(`^${expression}$`, 'u');
  return path => regex.test(path);
}

export function selectOperations(api: OpenApi, selectors?: string): Operation[] {
  const result: Operation[] = [];
  for (const selector of selectors === undefined ? [undefined] : tokenizeSelectors(selectors)) {
    let method: string | undefined;
    let matches: (path: string) => boolean = () => true;
    if (selector !== undefined) {
      const methodMatch = /^([a-zA-Z]+)\s+(.+)$/u.exec(selector);
      if (methodMatch) {
        method = methodMatch[1].toLowerCase();
        if (!methods.includes(method)) {
          throw new Error(`Unsupported HTTP method in selector: ${methodMatch[1]}`);
        }
      }
      matches = pathMatcher(methodMatch ? methodMatch[2] : selector);
    }
    const selected = api.operations.filter(
      operation => (!method || operation.method === method) && matches(operation.path)
    );
    if (!selected.length) {
      throw new Error(`No OpenAPI operations match ${selector === undefined ? 'the document' : selector}`);
    }
    result.push(...selected);
  }
  const names = new Set<string>();
  return result.map(operation => {
    let name = operation.name;
    let index = 2;
    while (names.has(name)) {
      name = `${operation.name}_${index++}`;
    }
    names.add(name);
    return { ...operation, name };
  });
}
