import * as utils from '../../utils';
import { KafkaModule } from './kafkaTypes';

export const KafkaModuleName = '@confluentinc/kafka-javascript';

let kafkaModule: KafkaModule | undefined;

function loadKafkaModule(): KafkaModule {
  if (!kafkaModule) {
    try {
      // loaded lazily, because it is an optional native dependency
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      kafkaModule = require('@confluentinc/kafka-javascript') as KafkaModule;
    } catch (err) {
      const reason = utils.isError(err)
        ? err.message.split(/\r?\n/u)[0].replace(/\s*Tried:\s*$/u, '')
        : utils.toString(err);
      throw new Error(
        `Kafka support requires the optional dependency ${KafkaModuleName}, which could not be loaded (${reason}). Install it with a Node.js version supported by its prebuilt binaries or with a native build toolchain.`,
        { cause: err }
      );
    }
  }
  return kafkaModule;
}

export const kafkaClientProvider: { load: () => KafkaModule } = {
  load: loadKafkaModule,
};
