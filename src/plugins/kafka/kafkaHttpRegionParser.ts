import { userSessionStore } from '../../store';
import * as utils from '../../utils';
import { KafkaRequestClient } from './kafkaRequestClient';

export const parseKafkaLine = utils.parseRequestLineFactory({
  protocol: 'KAFKA',
  // ignore inline responses like "KAFKA 0 - consumed"
  methodRegex: /^\s*(KAFKA)\s+(?!-?\d+\s*(-|$))(?<url>.+?)\s*$/u,
  protocolRegex: /^\s*(?<url>kafka(s)?:\/\/.+?)\s*$/iu,
  requestClientFactory(request, context) {
    return new KafkaRequestClient(request, context);
  },
  modifyRequest(request) {
    request.supportsStreaming = true;
  },
  sessionStore: userSessionStore,
});
