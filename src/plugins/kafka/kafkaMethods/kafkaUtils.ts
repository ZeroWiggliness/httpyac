import * as io from '../../../io';
import * as models from '../../../models';
import * as utils from '../../../utils';
import { KafkaRequest } from '../kafkaRequest';
import {
  KafkaActiveConsumer,
  KafkaMessageHeaders,
  KafkaProducer,
  KafkaSession,
  KafkaTopicPartitionOffset,
} from '../kafkaTypes';
import * as constants from './kafkaConstants';

const defaultHttpyacHeaders = ['accept', 'user-agent'];

export function isKafkaHeader(key: string) {
  return key.toLowerCase().startsWith(constants.KafkaHeaderPrefix);
}

/**
 * converts all request headers, which are not kafka_ control headers, to Kafka message headers
 */
export function toKafkaMessageHeaders(request: KafkaRequest): KafkaMessageHeaders | undefined {
  const result: KafkaMessageHeaders = {};
  for (const [key, value] of Object.entries(request.headers || {})) {
    if (isKafkaHeader(key) || utils.isUndefined(value) || value === null) {
      continue;
    }
    const lowerKey = key.toLowerCase();
    if (defaultHttpyacHeaders.includes(lowerKey) && !request.declaredHeaders?.includes(lowerKey)) {
      continue;
    }
    if (Array.isArray(value)) {
      result[key] = value.map(obj => utils.toString(obj) || '');
    } else {
      result[key] = utils.toString(value) || '';
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * converts Kafka message headers (Buffer values) to plain string headers
 */
export function fromKafkaMessageHeaders(
  headers: KafkaMessageHeaders | undefined
): Record<string, string | Array<string>> {
  const result: Record<string, string | Array<string>> = {};
  for (const [key, value] of Object.entries(headers || {})) {
    if (utils.isUndefined(value) || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      result[key] = value.map(obj => headerValueToString(obj));
    } else {
      result[key] = headerValueToString(value);
    }
  }
  return result;
}

function headerValueToString(value: Buffer | string): string {
  if (Buffer.isBuffer(value)) {
    return value.toString('utf-8');
  }
  return `${value}`;
}

/**
 * returns the header value as positive integer, or undefined if the header is not set
 */
export function getPositiveIntegerHeader(request: KafkaRequest, headerName: string): number | undefined {
  const value = utils.getHeader(request.headers, headerName);
  if (utils.isUndefined(value) || utils.isStringEmpty(value)) {
    return undefined;
  }
  const stringValue = utils.toString(value)?.trim() || '';
  const result = Number(stringValue);
  if (!/^\d+$/u.test(stringValue) || !Number.isSafeInteger(result) || result <= 0) {
    throw new Error(`${headerName} must be a positive integer (value: ${stringValue})`);
  }
  return result;
}

export function getTopics(request: KafkaRequest) {
  return utils
    .getHeaderArray(request.headers, constants.KafkaTopic)
    .flatMap(obj => obj.split(','))
    .map(obj => obj.trim())
    .filter(obj => !!obj);
}

export function getTopicPartitionOffsets(request: KafkaRequest): Array<KafkaTopicPartitionOffset> | undefined {
  const offset = utils.getHeaderString(request.headers, constants.KafkaOffset)?.trim();
  if (!offset) {
    return undefined;
  }
  const partition = utils.getHeaderNumber(request.headers, constants.KafkaPartition) ?? 0;
  return getTopics(request).map(topic => ({ topic, partition, offset }));
}

export function getRequiredGroupId(request: KafkaRequest, method: string) {
  const groupId = utils.getHeaderString(request.headers, constants.KafkaGroupId)?.trim();
  if (!groupId) {
    throw new Error(`${method} requires header ${constants.KafkaGroupId}`);
  }
  return groupId;
}

export function getProducer(session: KafkaSession, request: KafkaRequest): Promise<KafkaProducer> {
  const options = getKafkaClientConfig(session);
  const acks = utils.getHeaderNumber(request.headers, constants.KafkaAcks);
  if (!utils.isUndefined(acks)) {
    options.acks = acks;
  }
  const compression = utils.getHeaderString(request.headers, constants.KafkaCompression)?.trim().toLowerCase();
  if (compression && compression !== 'none') {
    options.compression = compression;
  }
  const key = utils.stringifySafe({ acks, compression });
  let producer = session.producers.get(key);
  if (!producer) {
    producer = Promise.resolve(new session.kafka.Producer(options));
    session.producers.set(key, producer);
    producer.catch(() => session.producers.delete(key));
  }
  return producer;
}

export async function alterGroupOffsets(
  session: KafkaSession,
  groupId: string,
  offsets: Array<KafkaTopicPartitionOffset>
): Promise<void> {
  const admin = new session.kafka.Admin(getKafkaClientConfig(session));
  try {
    await admin.alterConsumerGroupOffsets({
      groupId,
      topics: groupOffsetsByTopic(offsets),
    });
  } finally {
    await admin.close();
  }
}

function getKafkaClientConfig(session: KafkaSession): Record<string, unknown> {
  const options = { ...session.config };
  delete options.groupProtocol;
  delete options.partitionAssignmentStrategy;
  return options;
}

function groupOffsetsByTopic(offsets: Array<KafkaTopicPartitionOffset>) {
  const topics = new Map<string, Array<{ partition: number; offset: bigint }>>();
  for (const { topic, partition, offset } of offsets) {
    const topicOffsets = topics.get(topic) || [];
    topicOffsets.push({ partition, offset: BigInt(offset) });
    topics.set(topic, topicOffsets);
  }
  return [...topics].map(([name, partitionOffsets]) => ({ name, partitionOffsets }));
}

export async function disconnectSession(session: KafkaSession) {
  const consumers = [...session.consumers.values()];
  const producers = [...session.producers.values()];
  session.consumers.clear();
  session.producers.clear();
  await Promise.allSettled([
    ...consumers.map(consumer => consumer.stop()),
    ...producers.map(async producer => (await producer).close()),
  ]);
}

export async function disconnectConsumer(consumer: KafkaActiveConsumer) {
  await consumer.stop();
}

export function warn(message: string) {
  io.userInteractionProvider.showWarnMessage?.(message);
  io.log.warn(message);
}

export function errorToHttpResponse(err: unknown, request: KafkaRequest): models.HttpResponse & models.StreamResponse {
  if (utils.isError(err)) {
    return {
      protocol: 'KAFKA',
      name: `KAFKA error`,
      statusCode: 1,
      statusMessage: err.message,
      message: err.message,
      request,
      body: utils.stringifySafe(
        {
          name: err.name,
          message: err.message,
          code: (err as Error & { code?: unknown }).code,
          errors: getAggregateErrorDetails(err),
          stack: err.stack,
        },
        2
      ),
    };
  }

  function getAggregateErrorDetails(
    err: Error
  ): Array<{ name: string; message: string; code?: unknown; errors?: Array<unknown> }> | undefined {
    if (!(err instanceof AggregateError)) {
      return undefined;
    }
    return [...err.errors].map(error => {
      if (utils.isError(error)) {
        return {
          name: error.name,
          message: error.message,
          code: (error as Error & { code?: unknown }).code,
          errors: getAggregateErrorDetails(error),
        };
      }
      return { name: typeof error, message: utils.toString(error) ?? '' };
    });
  }
  return {
    protocol: 'KAFKA',
    name: `KAFKA error`,
    statusCode: 1,
    statusMessage: utils.toString(err),
    message: utils.toString(err),
    request,
    body: utils.toString(err),
  };
}
