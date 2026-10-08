import * as utils from '../../utils';
import { KafkaModule } from './kafkaTypes';

export const KafkaModuleName = '@platformatic/kafka';

let kafkaModule: KafkaModule | undefined;

function loadKafkaModule(): KafkaModule {
  if (!kafkaModule) {
    try {
      // loaded lazily, because Kafka support is optional
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      kafkaModule = require('@platformatic/kafka') as KafkaModule;
    } catch (err) {
      const reason = utils.isError(err)
        ? err.message.split(/\r?\n/u)[0].replace(/\s*Tried:\s*$/u, '')
        : utils.toString(err);
      throw new Error(
        `Kafka support requires the optional dependency ${KafkaModuleName}, which could not be loaded (${reason}). Install it with Node.js 24.6 or newer.`,
        { cause: err }
      );
    }
  }
  return kafkaModule;
}

export const kafkaClientProvider: { load: () => KafkaModule } = {
  load: loadKafkaModule,
};
