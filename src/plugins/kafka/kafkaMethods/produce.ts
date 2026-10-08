import * as utils from '../../../utils';
import { KafkaPlatformaticMessage } from '../kafkaTypes';
import * as constants from './kafkaConstants';
import { KafkaMethodContext, KafkaMethodResult } from './kafkaMethodContext';
import { fromKafkaMessageHeaders, getProducer, getTopics, toKafkaMessageHeaders, warn } from './kafkaUtils';

export async function produce({ session, request, onMessage }: KafkaMethodContext): Promise<KafkaMethodResult> {
  const topics = getTopics(request);
  if (topics.length === 0) {
    warn(`no ${constants.KafkaTopic} to produce`);
    return {};
  }
  if (utils.isUndefined(request.body)) {
    warn(`no body for produce`);
    return {};
  }
  const key = utils.getHeaderString(request.headers, constants.KafkaKey);
  const headers = toKafkaMessageHeaders(request);
  const value = utils.toBufferLike(request.body);
  const message: KafkaPlatformaticMessage = {
    topic: '',
    value: typeof value === 'string' ? Buffer.from(value) : value ?? null,
    key: key === undefined ? undefined : Buffer.from(key),
    partition: utils.getHeaderNumber(request.headers, constants.KafkaPartition),
    timestamp: toTimestamp(utils.getHeaderString(request.headers, constants.KafkaTimestamp)),
    headers: toPlatformaticMessageHeaders(headers),
  };

  const producer = await getProducer(session, request);
  for (const topic of topics) {
    const result = await producer.send({
      messages: [{ ...message, topic }],
      acks: utils.getHeaderNumber(request.headers, constants.KafkaAcks),
      compression: getCompression(request),
    });
    const metadata = result.offsets?.find(obj => obj.topic === topic);
    const partition = metadata?.partition ?? message.partition;
    const offset = metadata?.offset.toString();
    const timestamp = utils.getHeaderString(request.headers, constants.KafkaTimestamp);
    onMessage(topic, {
      protocol: 'KAFKA',
      name: `KAFKA produce ${topic}`,
      statusCode: 0,
      statusMessage: 'produced',
      headers: {
        ...fromKafkaMessageHeaders(headers),
        [constants.KafkaTopic]: topic,
        [constants.KafkaPartition]: partition,
        [constants.KafkaOffset]: offset,
        [constants.KafkaKey]: key,
        [constants.KafkaTimestamp]: timestamp,
      },
      request,
      message: `produce ${topic} (partition: ${partition}, offset: ${offset})`,
      body: utils.stringifySafe(
        {
          produced: true,
          topic,
          partition,
          offset,
          key,
          timestamp,
          headers: fromKafkaMessageHeaders(headers),
        },
        2
      ),
    });
  }
  return {};
}

function toTimestamp(timestamp: string | undefined): bigint | undefined {
  if (!timestamp) {
    return undefined;
  }
  if (!/^\d+$/u.test(timestamp)) {
    throw new Error(`${constants.KafkaTimestamp} must be a non-negative integer (value: ${timestamp})`);
  }
  return BigInt(timestamp);
}

function toPlatformaticMessageHeaders(headers: ReturnType<typeof toKafkaMessageHeaders>) {
  if (!headers) {
    return undefined;
  }
  const result = new Map<Buffer, Buffer>();
  for (const [key, value] of Object.entries(headers)) {
    const values = Array.isArray(value) ? value : [value];
    for (const headerValue of values) {
      if (!utils.isUndefined(headerValue)) {
        result.set(Buffer.from(key), Buffer.isBuffer(headerValue) ? headerValue : Buffer.from(headerValue));
      }
    }
  }
  return result;
}

function getCompression({ headers }: KafkaMethodContext['request']): string | undefined {
  const compression = utils.getHeaderString(headers, constants.KafkaCompression)?.trim().toLowerCase();
  return compression && compression !== 'none' ? compression : undefined;
}
