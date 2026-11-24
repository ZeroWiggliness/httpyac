import { AuthenticationGenerator, AuthenticationOptions } from './authentication';
import { getPackageVersion } from '../version';
import {
  array,
  identifier,
  isObject,
  JsonObject,
  object,
  OpenApi,
  Operation,
  optionalObject,
  singleLine,
  text,
} from './document';
import { sample, schemaCheck, Warn, withoutReadOnly } from './schema';

interface Binding {
  source: Operation;
  value: unknown;
}

interface Links {
  parameters: Map<string, Binding>;
  body?: Binding;
}

export interface GenerationResult {
  content: string;
  warnings: string[];
}

export interface GenerationOptions extends AuthenticationOptions {
  detailedAsserts?: boolean;
}

function parameters(operation: Operation): JsonObject[] {
  const merged = new Map<string, JsonObject>();
  for (const value of [
    ...array(operation.item.parameters, 'path parameters'),
    ...array(operation.operation.parameters, 'operation parameters'),
  ]) {
    const parameter = object(value, 'parameter');
    const name = text(parameter.name);
    const location = text(parameter.in);
    if (!name || !['path', 'query', 'header', 'cookie'].includes(location)) {
      throw new Error(`Invalid parameter for ${operation.method} ${operation.path}`);
    }
    merged.set(`${location}:${name}`, parameter);
  }
  return [...merged.values()];
}

function parameterVariable(operation: Operation, parameter: JsonObject): string {
  return identifier(`${operation.name}_${text(parameter.in)}_${text(parameter.name)}`);
}

function directLinkExpression(binding: Binding, parameter?: JsonObject): string | undefined {
  const { source, value } = binding;
  if (typeof value === 'string') {
    const match = /^\$response\.body#\/([A-Za-z_$][\w$]*)$/u.exec(value);
    if (match && (!parameter || match[1] === parameter.name)) {
      return `${source.name}.${match[1]}`;
    }
    if (!parameter && value === '$response.body#') {
      return source.name;
    }
  }
  return undefined;
}

function findLinks(api: OpenApi, selected: Operation[], targetIndex: number, warn: Warn): Links {
  const target = selected[targetIndex];
  const result: Links = { parameters: new Map() };
  const conflicts = new Set<string>();
  const seen = new Set<string>();
  for (const source of selected.slice(0, targetIndex)) {
    for (const link of responseLinks(source)) {
      const matches = linkTargets(api, selected, link);
      if (!matches.length) {
        warn(`Link from ${source.name} targets an operation outside the selection`);
        continue;
      }
      if (!matches.includes(target)) {
        continue;
      }
      const bindings = optionalObject(link.parameters, 'link parameters');
      const add = (key: string, value: unknown) => {
        const binding = { source, value };
        if (conflicts.has(key)) {
          return;
        }
        if (seen.has(key)) {
          conflicts.add(key);
          result.parameters.delete(key);
          if (key === '$body') {
            result.body = undefined;
          }
          warn(`Ambiguous link binding for ${target.name} ${key}; use an editable value`);
          return;
        }
        seen.add(key);
        const parameter = parameters(target).find(item => `${text(item.in)}:${text(item.name)}` === key);
        if (!directLinkExpression(binding, parameter)) {
          warn(`Unsupported or mismatched link for ${target.name} ${key}; using an editable OpenAPI value`);
          return;
        }
        if (key === '$body') {
          result.body = binding;
        } else {
          result.parameters.set(key, binding);
        }
      };
      for (const [key, binding] of Object.entries(bindings)) {
        const definitions = parameters(target).filter(
          parameter => key === parameter.name || key === `${text(parameter.in)}.${text(parameter.name)}`
        );
        if (definitions.length !== 1) {
          warn(`Link parameter ${key} is missing or ambiguous on ${target.name}`);
          continue;
        }
        add(`${text(definitions[0].in)}:${text(definitions[0].name)}`, binding);
      }
      if (link.requestBody !== undefined) {
        add('$body', link.requestBody);
      }
    }
  }
  return result;
}

function responseLinks(operation: Operation): JsonObject[] {
  return Object.values(object(operation.operation.responses, 'responses')).flatMap(value =>
    Object.values(optionalObject(object(value, 'response').links, 'response links')).map(link =>
      object(link, 'response link')
    )
  );
}

function linkTargets(api: OpenApi, selected: Operation[], link: JsonObject): Operation[] {
  if (typeof link.operationId === 'string') {
    return selected.filter(operation => operation.operation.operationId === link.operationId);
  }
  if (typeof link.operationRef === 'string') {
    const target = api.resolveReference(link.operationRef);
    return selected.filter(operation => operation.operation === target);
  }
  throw new Error('Response link requires operationId or operationRef');
}

function serializeParameter(value: unknown, name: string, location: string, style: string, explode: boolean): string {
  const encode = (item: unknown) => encodeURIComponent(String(item));
  const entries =
    value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value) : undefined;
  const items = Array.isArray(value) ? value : undefined;
  let simple = encode(value);
  if (entries) {
    simple = entries
      .map(([key, item]) => (explode ? `${encode(key)}=${encode(item)}` : `${encode(key)},${encode(item)}`))
      .join(',');
  } else if (items) {
    simple = items.map(encode).join(',');
  }
  if (style === 'simple') {
    return location === 'header' ? decodeURIComponent(simple) : simple;
  }
  if (style === 'label') {
    let label = encode(value);
    if (entries) {
      label = entries
        .map(([key, item]) => (explode ? `${encode(key)}=${encode(item)}` : `${encode(key)},${encode(item)}`))
        .join(explode ? '.' : ',');
    } else if (items) {
      label = items.map(encode).join(explode ? '.' : ',');
    }
    return `.${label}`;
  }
  if (style === 'matrix') {
    if (entries && explode) {
      return entries.map(([key, item]) => `;${encode(key)}=${encode(item)}`).join('');
    }
    if (items && explode) {
      return items.map(item => `;${encode(name)}=${encode(item)}`).join('');
    }
    return `;${encode(name)}=${simple}`;
  }
  if (style === 'deepObject') {
    if (!entries || entries.some(([, item]) => item !== null && typeof item === 'object')) {
      throw new Error('deepObject parameters require a flat object');
    }
    return entries.map(([key, item]) => `${encode(name)}[${encode(key)}]=${encode(item)}`).join('&');
  }
  const separator = location === 'cookie' ? '; ' : '&';
  if (style === 'spaceDelimited' || style === 'pipeDelimited') {
    if (!items) {
      throw new Error(`${style} parameters require an array`);
    }
    return `${encode(name)}=${items.map(encode).join(style === 'spaceDelimited' ? '%20' : '|')}`;
  }
  if (entries && explode) {
    return entries.map(([key, item]) => `${encode(key)}=${encode(item)}`).join(separator);
  }
  if (items && explode) {
    return items.map(item => `${encode(name)}=${encode(item)}`).join(separator);
  }
  return `${encode(name)}=${simple}`;
}

function statusExpression(status: string): string {
  return status.endsWith('XX')
    ? `(response.statusCode >= ${Number(status[0]) * 100} && response.statusCode < ${(Number(status[0]) + 1) * 100})`
    : `response.statusCode === ${Number(status)}`;
}

function assertions(operation: Operation, warn: Warn, detailedAsserts: boolean): string[] {
  const responses = Object.entries(object(operation.operation.responses, 'responses'));
  for (const [status] of responses) {
    if (status !== 'default' && !/^[1-5](?:\d{2}|XX)$/u.test(status)) {
      throw new Error(`Invalid response status ${status} on ${operation.name}`);
    }
  }
  const success = responses.filter(([status]) => /^2(?:\d{2}|XX)$/u.test(status));
  const lines: string[] = [];
  if (success.some(([status]) => status === '2XX')) {
    lines.push('?? status >= 200', '?? status < 300');
  } else if (success.length === 1) {
    lines.push(`?? status == ${success[0][0]}`);
  } else if (success.length) {
    lines.push(`?? status matches ^(?:${success.map(([status]) => status).join('|')})$`);
  } else {
    lines.push('# No documented success response; asserting the success range.', '?? status >= 200', '?? status < 300');
  }
  if (operation.method === 'head') {
    return lines;
  }
  const explicit = success.filter(([status]) => status !== '2XX').map(([status]) => Number(status));
  for (const [status, value] of success) {
    const response = object(value, 'response');
    if (status === '204' || status === '205') {
      continue;
    }
    const content = optionalObject(response.content, 'response content');
    const mediaTypes = Object.keys(content);
    if (!mediaTypes.length) {
      continue;
    }
    const guard =
      status === '2XX'
        ? `(${statusExpression(status)} && !${JSON.stringify([...explicit, 204, 205])}.includes(response.statusCode))`
        : statusExpression(status);
    const media = `String(response.headers?.["content-type"] || "").split(";")[0].trim().toLowerCase()`;
    const mediaCheck = (kind: string) => {
      if (kind === '*/*') {
        return 'true';
      }
      return kind.endsWith('/*')
        ? `${media}.startsWith(${JSON.stringify(kind.slice(0, -1).toLowerCase())})`
        : `${media} === ${JSON.stringify(kind.toLowerCase())}`;
    };
    const specificity = (kind: string) => {
      if (kind === '*/*') {
        return 0;
      }
      return kind.endsWith('/*') ? 1 : 2;
    };
    const unconditional = success.length === 1 && status !== '2XX';
    if (unconditional) {
      if (!mediaTypes.includes('*/*')) {
        const patterns = mediaTypes.map(kind =>
          kind
            .toLowerCase()
            .split('')
            .map(character => {
              if (character === '*') {
                return '[^;\\s]+';
              }
              if (/[a-z]/u.test(character)) {
                return `[${character}${character.toUpperCase()}]`;
              }
              return character.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
            })
            .join('')
        );
        lines.push(`?? header content-type matches ^\\s*(?:${patterns.join('|')})\\s*(?:;.*)?$`);
      }
    } else if (detailedAsserts) {
      lines.push(`?? js (!(${guard}) || (${mediaTypes.map(mediaCheck).join(' || ')})) isTrue`);
    }
    for (const [kind, mediaValue] of Object.entries(content)) {
      const definition = object(mediaValue, 'response media type');
      if ((kind.includes('json') || kind.endsWith('/*')) && definition.schema !== undefined) {
        const native: string[] = [];
        const check = schemaCheck(
          definition.schema,
          kind.endsWith('/*')
            ? '(response.parsedBody === undefined ? response.body : response.parsedBody)'
            : 'response.parsedBody',
          warn,
          new Set(),
          unconditional && mediaTypes.length === 1 && !kind.endsWith('/*') ? { lines: native, path: '' } : undefined
        );
        lines.push(...new Set(native));
        if (detailedAsserts && check !== 'true') {
          const moreSpecific = mediaTypes.filter(other => specificity(other) > specificity(kind));
          const selectedMedia = [mediaCheck(kind), ...moreSpecific.map(other => `!(${mediaCheck(other)})`)].join(
            ' && '
          );
          lines.push(
            unconditional && mediaTypes.length === 1
              ? `?? js ${check} isTrue`
              : `?? js (!(${guard}) || !(${selectedMedia}) || (${check})) isTrue`
          );
        }
      }
    }
  }
  return lines;
}

function renderBody(
  operation: Operation,
  binding: Binding | undefined,
  variables: Map<string, string>,
  allocate: (name: string) => string,
  warn: Warn
): { headers: Record<string, string>; body: string } {
  if (operation.operation.requestBody === undefined) {
    return { headers: {}, body: '' };
  }
  const request = object(operation.operation.requestBody, 'requestBody');
  const content = object(request.content, 'request content');
  const types = Object.keys(content);
  const kind = types.find(value => value.includes('json')) || types[0];
  if (!kind) {
    throw new Error(`No request media type for ${operation.name}`);
  }
  const media = object(content[kind], 'request media');
  if (types.length > 1) {
    warn(`Multiple request media types for ${operation.name}; using ${kind}`);
  }
  const example = withoutReadOnly(sample(media, warn), media.schema);
  if (kind.includes('json')) {
    if (binding) {
      return {
        headers: { 'Content-Type': kind },
        body: `{{JSON.stringify(${directLinkExpression(binding)}, null, 2)}}`,
      };
    }
    return { headers: { 'Content-Type': kind }, body: JSON.stringify(example, null, 2) };
  }
  if (binding) {
    warn(`Linked ${kind} body on ${operation.name} requires manual editing; using an editable OpenAPI value`);
  }
  if (kind === 'application/x-www-form-urlencoded') {
    const values = object(example, 'form example');
    const encoding = optionalObject(media.encoding, 'form encoding');
    const body = Object.entries(values)
      .map(([name, value]) => {
        const settings = optionalObject(encoding[name], 'form property encoding');
        const style = text(settings.style, 'form');
        if (!['form', 'spaceDelimited', 'pipeDelimited', 'deepObject'].includes(style)) {
          throw new Error(`Unsupported form serialization ${style}`);
        }
        return serializeParameter(value, name, 'query', style, settings.explode !== false);
      })
      .join('\n&');
    return { headers: { 'Content-Type': kind }, body };
  }
  if (kind === 'multipart/form-data') {
    const boundary = `HttpYac_${operation.name}`;
    const schema = optionalObject(media.schema, 'multipart schema');
    const properties = optionalObject(schema.properties, 'multipart properties');
    const encoding = optionalObject(media.encoding, 'multipart encoding');
    const parts = Object.entries(object(example, 'multipart example')).flatMap(([name, value]) => {
      if (/["\r\n]/u.test(name)) {
        throw new Error('Invalid multipart field name');
      }
      const property = optionalObject(properties[name], `multipart ${name}`);
      const settings = optionalObject(encoding[name], 'multipart encoding');
      let itemSchema = property;
      if (Array.isArray(value)) {
        itemSchema =
          typeof property.items === 'boolean' ? {} : optionalObject(property.items, `multipart ${name} items`);
      }
      const binary = itemSchema.format === 'binary' || itemSchema.format === 'base64';
      const style = text(settings.style, 'form');
      const explode = settings.explode === undefined ? style === 'form' : settings.explode === true;
      let items = Array.isArray(value) ? value : [value];
      let unsupported = !!settings.headers || settings.allowReserved !== undefined;
      if (settings.contentType && (settings.style !== undefined || settings.explode !== undefined)) {
        warn(`Multipart encoding style/explode for ${name} ignored because contentType is set`);
      } else if (Array.isArray(value) && (style !== 'form' || !explode)) {
        if (
          !binary &&
          ['form', 'spaceDelimited', 'pipeDelimited'].includes(style) &&
          (style === 'form' || !explode) &&
          value.every(item => item === null || typeof item !== 'object')
        ) {
          const serialized = serializeParameter(value, name, 'query', style, false);
          items = [serialized.slice(serialized.indexOf('=') + 1)];
        } else {
          unsupported = true;
        }
      } else if (!Array.isArray(value) && (settings.style !== undefined || settings.explode !== undefined)) {
        unsupported = true;
      }
      if (unsupported) {
        warn(`Multipart encoding for ${name} cannot be fully serialized; review its parts manually`);
      }
      return items.map(item => {
        const variable = binary ? allocate(identifier(`${operation.name}_${name}_file`)) : '';
        if (binary) {
          variables.set(variable, `./${name}.bin`);
        }
        const part = typeof item === 'string' ? item : JSON.stringify(item);
        return [
          `--${boundary}`,
          `Content-Disposition: form-data; name="${name}"${binary ? `; filename="${name}.bin"` : ''}`,
          ...(binary || settings.contentType || isObject(item) || Array.isArray(item)
            ? [
                `Content-Type: ${singleLine(text(settings.contentType, binary ? 'application/octet-stream' : 'application/json'))}`,
              ]
            : []),
          '',
          binary ? `< {{${variable}}}` : part,
        ].join('\n');
      });
    });
    return {
      headers: { 'Content-Type': `${kind}; boundary=${boundary}` },
      body: [...parts, `--${boundary}--`].join('\n'),
    };
  }
  if (typeof example === 'string' && (kind.startsWith('text/') || kind.includes('xml'))) {
    if (example === 'REPLACE_ME' || (example === 'example' && kind.includes('xml'))) {
      warn(`No serialized ${kind} example for ${operation.name}; provide the body manually`);
    }
    return { headers: { 'Content-Type': kind }, body: example };
  }
  const variable = allocate(`${operation.name}_bodyFile`);
  variables.set(variable, './payload.bin');
  warn(`Provide a file for ${operation.name} ${kind} at {{${variable}}}`);
  return { headers: { 'Content-Type': kind }, body: `< {{${variable}}}` };
}

export async function generateHttp(
  api: OpenApi,
  selected: Operation[],
  options: GenerationOptions = {}
): Promise<GenerationResult> {
  const warnings = new Set<string>();
  const warn: Warn = message => warnings.add(message);
  const authentication = new AuthenticationGenerator(api, options);
  const variables = new Map<string, string>();
  const servers = new Map<string, string>();
  const regions: string[] = [];
  const authentications = [];
  for (const operation of selected) {
    authentications.push(await authentication.generate(operation));
  }
  const usedNames = new Set([...selected.map(operation => operation.name), ...authentication.variables.keys()]);
  const allocate = (name: string): string => {
    let candidate = name;
    let suffix = 2;
    while (usedNames.has(candidate)) {
      candidate = `${name}_${suffix++}`;
    }
    usedNames.add(candidate);
    return candidate;
  };
  for (const [index, source] of selected.entries()) {
    for (const link of responseLinks(source)) {
      const targets = linkTargets(api, selected, link);
      if (!targets.length) {
        warn(`Link from ${source.name} targets an operation outside the selection`);
      } else if (!targets.some(target => selected.indexOf(target) > index)) {
        warn(`Link from ${source.name} requires a backward/cyclic dependency; selectors are not reordered`);
      }
    }
  }
  for (const [index, operation] of selected.entries()) {
    const links = findLinks(api, selected, index, warn);
    const auth = authentications[index];
    const serverList = array(operation.operation.servers ?? operation.item.servers ?? api.root.servers, 'servers');
    const server = serverList.length ? object(serverList[0], 'server') : { url: 'http://localhost' };
    const serverKey = JSON.stringify(server);
    let serverVariable = servers.get(serverKey);
    let serverUrl = text(server.url);
    if (!serverList.length || !/^https?:\/\//u.test(serverUrl)) {
      warn(`Configure the relative/missing server URL for ${operation.name} before sending`);
    }
    if (!serverVariable) {
      for (const [key, value] of Object.entries(optionalObject(server.variables, 'server variables'))) {
        const definition = object(value, 'server variable');
        const variable = allocate(identifier(`server${servers.size + 1}_${key}`));
        if (definition.default === undefined) {
          throw new Error(`Missing default for server variable ${key}`);
        }
        variables.set(variable, singleLine(String(definition.default)));
        serverUrl = serverUrl.split(`{${key}}`).join(`{{${variable}}}`);
      }
      serverVariable = allocate(servers.size === 0 ? 'baseUrl' : `baseUrl${servers.size + 1}`);
      servers.set(serverKey, serverVariable);
      const defaultUrl = serverUrl.replace(/[\r\n]/gu, '').replace(/\/$/u, '');
      const expression = defaultUrl
        .split(/(\{\{[a-zA-Z0-9_]+\}\})/gu)
        .map(part => {
          const variable = /^\{\{([a-zA-Z0-9_]+)\}\}$/u.exec(part);
          return variable ? `$context.variables[${JSON.stringify(variable[1])}]` : JSON.stringify(part);
        })
        .join(' + ');
      variables.set(serverVariable, `{{ $context.variables[${JSON.stringify(serverVariable)}] ?? (${expression}) }}`);
    }
    let path = operation.path;
    const queries: string[] = [];
    const headers: Record<string, string> = {};
    const cookies: string[] = [];
    const notes: string[] = [];
    for (const parameter of parameters(operation)) {
      const name = text(parameter.name);
      const location = text(parameter.in);
      const key = `${location}:${name}`;
      let binding = links.parameters.get(key);
      if (parameter.content || parameter.allowReserved || parameter.allowEmptyValue) {
        warn(
          `Parameter ${name} on ${operation.name} uses content/allowReserved/allowEmptyValue; review its serialization`
        );
      }
      const style = text(parameter.style, location === 'path' || location === 'header' ? 'simple' : 'form');
      const allowed: Record<string, string[]> = {
        path: ['simple', 'label', 'matrix'],
        query: ['form', 'spaceDelimited', 'pipeDelimited', 'deepObject'],
        header: ['simple'],
        cookie: ['form'],
      };
      if (!allowed[location].includes(style)) {
        throw new Error(`Unsupported ${location} parameter style ${style}`);
      }
      const value = sample(parameter, warn);
      const schema = parameter.schema;
      if (schema === false) {
        warn(`Parameter ${name} on ${operation.name} has a false schema; no value is valid`);
      }
      const type = typeof schema === 'boolean' ? undefined : optionalObject(schema, 'parameter schema').type;
      const complex = (value !== null && typeof value === 'object') || type === 'object' || type === 'array';
      const supported = !complex && (style === 'simple' || style === 'form');
      if (binding && !supported) {
        warn(`Complex linked parameter ${name} on ${operation.name}; using an editable OpenAPI value`);
        links.parameters.delete(key);
        binding = undefined;
      }
      let rendered: string;
      if (supported) {
        const variable = binding ? '' : allocate(parameterVariable(operation, parameter));
        if (!binding) {
          variables.set(variable, JSON.stringify({ value }));
        }
        const expression = binding ? directLinkExpression(binding, parameter) : `JSON.parse(${variable}).value`;
        const encoded =
          location === 'header' || (binding && (type === 'integer' || type === 'number' || type === 'boolean'))
            ? `{{${expression}}}`
            : `{{encodeURIComponent(${expression}${binding ? '.toString()' : ''})}}`;
        rendered = location === 'query' || location === 'cookie' ? `${encodeURIComponent(name)}=${encoded}` : encoded;
      } else {
        const variable = allocate(parameterVariable(operation, parameter));
        variables.set(
          variable,
          singleLine(
            serializeParameter(
              value,
              name,
              location,
              style,
              parameter.explode === undefined ? style === 'form' : parameter.explode === true
            )
          )
        );
        warn(
          `Parameter ${name} on ${operation.name} uses a pre-serialized editable OpenAPI value; edit its serialization manually`
        );
        rendered = `{{${variable}}}`;
      }
      notes.push(
        `# ${singleLine(`${location} ${name}${parameter.required === true ? ' (required)' : ' (optional)'}: ${text(parameter.description, binding ? `from ${binding.source.name}.${name}` : 'edit the value above')}`)}`
      );
      if (location === 'path') {
        path = path.split(`{${name}}`).join(rendered);
      } else if (location === 'query') {
        queries.push(rendered);
      } else if (location === 'cookie') {
        cookies.push(rendered);
      } else {
        if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u.test(name)) {
          throw new Error(`Invalid parameter header ${name}`);
        }
        headers[name] = rendered;
      }
    }
    for (const [name, value] of auth.query) {
      queries.push(`${encodeURIComponent(name)}={{encodeURIComponent(${value.replace(/^\{\{|\}\}$/gu, '')})}}`);
    }
    if (/(?<!\{)\{[^{}]+\}(?!\})/u.test(path)) {
      throw new Error(`Missing definition for a path parameter on ${operation.name}: ${path}`);
    }
    auth.cookies.forEach(([name, value]) => cookies.push(`${encodeURIComponent(name)}=${value}`));
    if (cookies.length) {
      headers.Cookie = cookies.join('; ');
    }
    for (const [name, value] of Object.entries(auth.headers)) {
      if (Object.keys(headers).some(key => key.toLowerCase() === name.toLowerCase())) {
        throw new Error(`Authentication conflicts with parameter header ${name}`);
      }
      headers[name] = value;
    }
    const body = renderBody(operation, links.body, variables, allocate, warn);
    Object.assign(headers, body.headers);
    const responseTypes = Object.values(object(operation.operation.responses, 'responses')).flatMap(value =>
      Object.keys(optionalObject(object(value, 'response').content, 'response content'))
    );
    if (responseTypes.length && !Object.keys(headers).some(key => key.toLowerCase() === 'accept')) {
      headers.Accept = [...new Set(responseTypes)].join(', ');
    }
    const dependencies = new Set(
      [...links.parameters.values(), ...(links.body ? [links.body] : [])].map(binding => binding.source.name)
    );
    const description = text(operation.operation.description);
    const external = optionalObject(operation.operation.externalDocs, 'externalDocs');
    const lines = [
      `### ${singleLine(text(operation.operation.summary, `${operation.method.toUpperCase()} ${operation.path}`))}`,
      `# @name ${operation.name}`,
      ...(cookies.length ? ['# @noCookieJar'] : []),
      ...(description ? [`# @description ${singleLine(description)}`] : []),
      ...(operation.operation.tags
        ? [
            `# @tag ${array(operation.operation.tags, 'tags')
              .map(value => singleLine(String(value)))
              .join(', ')}`,
          ]
        : []),
      ...(operation.operation.deprecated ? ['# Deprecated operation'] : []),
      ...(external.url ? [`# Documentation: ${singleLine(text(external.url))}`] : []),
      ...notes,
      ...[...dependencies].map(name => `# @ref ${name}`),
      `${operation.method.toUpperCase()} {{${serverVariable}}}${path}${queries.length ? `?${queries.join('&')}` : ''}`,
      ...Object.entries(headers).map(([name, value]) => `${name}: ${value}`),
      '',
      ...(body.body ? [body.body, ''] : []),
      ...assertions(operation, warn, options.detailedAsserts === true),
    ];
    regions.push(lines.join('\n'));
  }
  authentication.validateOverrides();
  authentication.warnings.forEach(warn);
  const variableLines = [...variables, ...authentication.variables].map(
    ([name, value]) => `@${name} = ${value === '' ? '{{ "" }}' : value}`
  );
  const info = object(api.root.info, 'info');
  return {
    content: [
      `# Generated from ${singleLine(text(info.title))} (${singleLine(text(info.version))}). Created by HttpYacZW (${await getPackageVersion()})`,
      '# Scalar parameter variables use JSON {"value": ...}; complex parameters use editable serialized values.',
      ...[...warnings].map(message => `# WARNING: ${singleLine(message)}`),
      ...variableLines,
      '',
      regions.join('\n\n'),
      '',
    ].join('\n'),
    warnings: [...warnings],
  };
}
