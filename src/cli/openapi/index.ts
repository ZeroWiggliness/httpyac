import { Command } from 'commander';
import { promises as fs } from 'fs';
import { dirname, join, parse, resolve } from 'path';

import { AuthenticationOptions } from './authentication';
import { isObject, loadOpenApi, selectOperations } from './document';
import { generateHttp } from './generate';

export interface OpenApiOptions extends AuthenticationOptions {
  path?: string;
  output?: string;
  force?: boolean;
}

export function openapiCommand(): Command {
  return new Command('openapi')
    .description('generate http files from OpenAPI 3.x JSON or YAML')
    .argument('<fileName>', 'path to an OpenAPI file')
    .option(
      '--path <selectors>',
      'ordered comma-separated paths, wildcards or regex:/pattern/flags; optional METHOD prefix'
    )
    .option('-o, --output <file>', 'output http file (default: beside the specification)')
    .option('--force', 'replace an existing output file')
    .option('--auth <selection...>', 'security alternative(s): scheme, scheme+scheme, or none')
    .option('--auth-flow <selection...>', 'OAuth flow(s): flow or scheme=flow')
    .action(writeOpenApi);
}

export async function writeOpenApi(fileName: string, options: OpenApiOptions): Promise<void> {
  const input = resolve(fileName);
  const parsed = parse(input);
  const output = resolve(options.output || join(parsed.dir, `${parsed.name}.http`));
  const api = await loadOpenApi(input);
  let existing: Awaited<ReturnType<typeof fs.stat>> | undefined;
  try {
    existing = await fs.stat(output);
  } catch (error) {
    if (!(isObject(error) && error.code === 'ENOENT')) {
      throw error;
    }
  }
  if (existing) {
    for (const file of [input, ...api.files]) {
      const source = await fs.stat(file);
      if (source.dev === existing.dev && source.ino === existing.ino) {
        throw new Error(`Output must not overwrite the specification or a referenced file: ${output}`);
      }
    }
    if (!options.force) {
      throw new Error(`Output already exists: ${output}. Use --force to replace it`);
    }
  }
  const selected = selectOperations(api, options.path);
  const generated = await generateHttp(api, selected, options);
  const directory = await fs.mkdtemp(join(dirname(output), '.httpyac-openapi-'));
  const temporary = join(directory, 'generated.http');
  try {
    await fs.writeFile(temporary, generated.content, 'utf8');
    if (options.force) {
      await fs.rename(temporary, output);
    } else {
      await fs.link(temporary, output);
    }
  } finally {
    await fs.rm(temporary, { force: true });
    await fs.rmdir(directory);
  }
  generated.warnings.forEach(warning => console.warn(`OpenAPI: ${warning}`));
  console.info(`Generated ${selected.length} requests in ${output}`);
}
