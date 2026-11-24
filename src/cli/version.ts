import { existsSync, promises as fs } from 'fs';
import { dirname, join } from 'path';

export async function getPackageVersion(): Promise<string> {
  let directory = __dirname;
  while (true) {
    const file = join(directory, 'package.json');
    if (existsSync(file)) {
      const metadata: unknown = JSON.parse(await fs.readFile(file, 'utf8'));
      if (
        metadata !== null &&
        typeof metadata === 'object' &&
        'version' in metadata &&
        typeof metadata.version === 'string'
      ) {
        return metadata.version;
      }
      throw new Error(`Missing package version in ${file}`);
    }
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error('Could not locate httpYac package metadata');
    }
    directory = parent;
  }
}
