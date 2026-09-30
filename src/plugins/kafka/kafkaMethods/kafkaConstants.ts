import * as utils from '../../../utils';
import { KafkaRequest } from '../kafkaRequest';

export const KafkaHeaderPrefix = 'kafka_';
export const KafkaConfigPrefix = 'kafka_config_';

export const KafkaMethod = 'kafka_method';
export const KafkaClientId = 'kafka_client_id';
export const KafkaSsl = 'kafka_ssl';
export const KafkaSaslMechanism = 'kafka_sasl_mechanism';
export const KafkaUsername = 'kafka_username';
export const KafkaPassword = 'kafka_password';

export const KafkaTopic = 'kafka_topic';
export const KafkaKey = 'kafka_key';
export const KafkaPartition = 'kafka_partition';
export const KafkaOffset = 'kafka_offset';
export const KafkaTimestamp = 'kafka_timestamp';
export const KafkaAcks = 'kafka_acks';
export const KafkaCompression = 'kafka_compression';

export const KafkaGroupId = 'kafka_group_id';
export const KafkaFromBeginning = 'kafka_from_beginning';
export const KafkaAutoCommit = 'kafka_auto_commit';
export const KafkaAutoCommitInterval = 'kafka_auto_commit_interval';
export const KafkaMaxMessages = 'kafka_max_messages';
export const KafkaTimeout = 'kafka_timeout';

export const ConsumeStoppedMessage = 'httpyac consume stopped, message is not processed';

export type KafkaMethodName = 'produce' | 'consume' | 'commit' | 'seek';

const methodAliases: Record<string, KafkaMethodName> = {
  produce: 'produce',
  publish: 'produce',
  consume: 'consume',
  subscribe: 'consume',
  commit: 'commit',
  seek: 'seek',
};

export const KafkaMethods = Object.keys(methodAliases);

export function getKafkaMethod(request: KafkaRequest): KafkaMethodName {
  const method = utils.getHeaderString(request.headers, KafkaMethod)?.trim().toLowerCase();
  if (method) {
    const result = methodAliases[method];
    if (!result) {
      throw new Error(`Kafka method ${method} not supported (supported: ${KafkaMethods.join(', ')})`);
    }
    return result;
  }
  return request.body ? 'produce' : 'consume';
}
