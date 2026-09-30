import './completionItemProvider';

import { javascriptProvider, log } from '../../io';
import * as models from '../../models';
import { kafkaClientProvider, KafkaModuleName } from './kafkaClientProvider';
import { parseKafkaLine } from './kafkaHttpRegionParser';
import { parseKafkaResponse } from './kafkaResponseHttpRegionParser';

export function registerKafkaPlugin(api: models.HttpyacHooksApi) {
  api.hooks.parse.addHook('kafka', parseKafkaLine, { before: ['request'] });
  api.hooks.parse.addHook('kafkaResponse', parseKafkaResponse, { before: ['requestBody'] });
  if (!Object.getOwnPropertyDescriptor(javascriptProvider.require, KafkaModuleName)) {
    Object.defineProperty(javascriptProvider.require, KafkaModuleName, {
      configurable: true,
      enumerable: true,
      get() {
        try {
          return kafkaClientProvider.load();
        } catch (err) {
          log.warn(err);
          return undefined;
        }
      },
    });
  }
}
