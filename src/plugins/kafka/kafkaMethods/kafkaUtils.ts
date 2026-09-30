import * as io from '../../../io';
import * as models from '../../../models';
import * as utils from '../../../utils';
import { KafkaRequest } from '../kafkaRequest';
import {
  KafkaConsumer,
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
  const kafkaJS: Record<string, unknown> = {};
  const acks = utils.getHeaderNumber(request.headers, constants.KafkaAcks);
  if (!utils.isUndefined(acks)) {
    kafkaJS.acks = acks;
  }
  const compression = utils.getHeaderString(request.headers, constants.KafkaCompression)?.trim().toLowerCase();
  if (compression) {
    kafkaJS.compression = compression;
  }
  const key = utils.stringifySafe(kafkaJS);
  let producer = session.producers.get(key);
  if (!producer) {
    producer = (async () => {
      const result = session.kafka.producer({ kafkaJS });
      await result.connect();
      return result;
    })();
    session.producers.set(key, producer);
    producer.catch(() => session.producers.delete(key));
  }
  return producer;
}

const consumerDisconnectTimeout = 10000;

/**
 * disconnects the consumer, but does not wait longer than 10 seconds
 */
export async function disconnectConsumer(consumer: KafkaConsumer) {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<'timeout'>(resolve => {
    timer = setTimeout(() => resolve('timeout'), consumerDisconnectTimeout);
  });
  try {
    const result = await Promise.race([consumer.disconnect(), timeout]);
    if (result === 'timeout') {
      io.log.warn(`kafka consumer disconnect did not finish within ${consumerDisconnectTimeout}ms`);
    }
  } catch (err) {
    io.log.debug('kafka consumer disconnect failed', err);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * creates a short-lived consumer of the group (without joining the group) to commit offsets
 */
export async function withTemporaryConsumer<T>(
  session: KafkaSession,
  groupId: string,
  action: (consumer: KafkaConsumer) => Promise<T>
): Promise<T> {
  const consumer = session.kafka.consumer({
    kafkaJS: {
      groupId,
      autoCommit: false,
    },
  });
  await consumer.connect();
  try {
    return await action(consumer);
  } finally {
    await disconnectConsumer(consumer);
  }
}

export async function disconnectSession(session: KafkaSession) {
  const consumers = [...session.consumers.values()];
  const producers = [...session.producers.values()];
  session.consumers.clear();
  session.producers.clear();
  await Promise.allSettled([
    ...consumers.map(consumer => disconnectConsumer(consumer)),
    ...producers.map(async producer => (await producer).disconnect()),
  ]);
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
          stack: err.stack,
        },
        2
      ),
    };
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
