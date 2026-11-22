import { Command } from 'commander';
import { initIOProvider } from './initCliProvider';
import { oauth2Command } from './oauth2';
import { openapiCommand } from './openapi';
import { sendCommand } from './send';
import { getPackageVersion } from './version';

export async function createProgram() {
  const program = new Command();
  program
    .version(await getPackageVersion())
    .description('httpYac - Quickly and easily send REST, SOAP, GraphQL and gRPC requests')
    .addCommand(oauth2Command())
    .addCommand(openapiCommand())
    .addCommand(sendCommand(), { isDefault: true });
  return program;
}

export async function execute(rawArgs: string[]): Promise<void> {
  try {
    await initIOProvider();
    const program = await createProgram();
    await program.parseAsync(rawArgs);
  } catch (err) {
    console.error(err);
    if (!process.exitCode) {
      process.exitCode = 1;
    }
    throw err;
  } finally {
    // needed because of async
    // eslint-disable-next-line n/no-process-exit
    process.exit();
  }
}
