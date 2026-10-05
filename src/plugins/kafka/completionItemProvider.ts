import { CompletionItem, completionItemProvider } from '../../io';
import * as utils from '../../utils';
import * as constants from './kafkaMethods/kafkaConstants';
import { isKafkaRequest } from './kafkaRequest';

completionItemProvider.emptyLineProvider.push(() => [
  {
    name: 'KAFKA',
    description: 'Kafka request',
  },
]);

completionItemProvider.requestHeaderProvider.push(request => {
  const result: Array<CompletionItem> = [];
  if (isKafkaRequest(request)) {
    result.push(
      {
        name: constants.KafkaMethod,
        description: `Method (default: produce with body, consume without body). Valid values: ${constants.KafkaMethods.join(', ')}`,
      },
      {
        name: constants.KafkaTopic,
        description: 'Topic (repeat header or use comma separated list for multiple topics)',
      },
      { name: constants.KafkaClientId, description: 'client id (default: httpyac)' },
      { name: constants.KafkaSsl, description: 'enable SSL (default: false, true for kafkas://)' },
      {
        name: constants.KafkaSaslMechanism,
        description: 'SASL mechanism: plain, scram-sha-256, scram-sha-512 (default plain if username is set)',
      },
      { name: constants.KafkaUsername, description: 'SASL username' },
      { name: constants.KafkaPassword, description: 'SASL password' },
      {
        name: `${constants.KafkaConfigPrefix}`,
        description: 'librdkafka configuration property, e.g. kafka_config_ssl.ca.location',
      }
    );

    const method = utils.getHeader(request?.headers, constants.KafkaMethod) || '';
    if (utils.isString(method)) {
      switch (method.toLowerCase()) {
        case 'commit':
        case 'seek':
          result.push(
            { name: constants.KafkaGroupId, description: 'consumer group id' },
            { name: constants.KafkaPartition, description: 'partition (default: 0)' },
            {
              name: constants.KafkaOffset,
              description:
                method.toLowerCase() === 'commit'
                  ? 'offset to commit (default: consumed offsets)'
                  : 'offset to seek to',
            }
          );
          break;
        case 'consume':
        case 'subscribe':
          result.push(...consumeCompletionItems);
          break;
        case 'produce':
        case 'publish':
          result.push(...produceCompletionItems);
          break;
        case '':
          result.push(...produceCompletionItems, ...consumeCompletionItems);
          break;
        default:
          break;
      }
    }
  }
  return result;
});

const produceCompletionItems: Array<CompletionItem> = [
  { name: constants.KafkaKey, description: 'message key' },
  { name: constants.KafkaPartition, description: 'partition (default: assigned by partitioner)' },
  { name: constants.KafkaTimestamp, description: 'message timestamp in ms' },
  { name: constants.KafkaAcks, description: 'required acks: -1 (all, default), 0, 1' },
  { name: constants.KafkaCompression, description: 'compression: none, gzip, snappy, lz4, zstd' },
];

const consumeCompletionItems: Array<CompletionItem> = [
  { name: constants.KafkaGroupId, description: 'consumer group id (default: httpyac-<uuid>)' },
  { name: constants.KafkaFromBeginning, description: 'consume from earliest offset if no offset is committed' },
  { name: constants.KafkaAutoCommit, description: 'auto commit consumed offsets (default: true)' },
  { name: constants.KafkaAutoCommitInterval, description: 'auto commit interval in ms (default: 5000)' },
  { name: constants.KafkaMaxMessages, description: 'stop consuming after this number of messages' },
  { name: constants.KafkaTimeout, description: 'stop consuming after this time in ms' },
  { name: constants.KafkaOffset, description: 'seek to offset before consuming' },
];
