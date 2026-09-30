import './completionItemProvider';

import { javascriptProvider, log } from '../../io';
import * as models from '../../models';
import { kafkaClientProvider, KafkaModuleName } from './kafkaClientProvider';
import { parseKafkaLine } from './kafkaHttpRegionParser';
import { isKafkaRequest } from './kafkaRequest';
import { parseKafkaResponse } from './kafkaResponseHttpRegionParser';

export function registerKafkaPlugin(api: models.HttpyacHooksApi) {
  api.hooks.parse.addHook('kafka', parseKafkaLine, { before: ['request'] });
  api.hooks.parse.addHook('kafkaResponse', parseKafkaResponse, { before: ['requestBody'] });
  api.hooks.onRequest.addHook('kafkaDeclaredHeaders', setDeclaredHeaders, { before: ['setDefaultHttpyacHeaders'] });
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

/**
 * remembers all headers set by the http file, header variables or config.defaultHeaders,
 * before httpyac adds its implicit default headers (Accept, User-Agent)
 */
function setDeclaredHeaders(request: models.Request) {
  if (isKafkaRequest(request)) {
    request.declaredHeaders = Object.keys(request.headers || {}).map(obj => obj.toLowerCase());
  }
}
