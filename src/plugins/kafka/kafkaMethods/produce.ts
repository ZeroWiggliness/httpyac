import * as utils from '../../../utils';
import { KafkaProducerMessage } from '../kafkaTypes';
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
  const message: KafkaProducerMessage = {
    value: utils.toBufferLike(request.body) ?? null,
    key,
    partition: utils.getHeaderNumber(request.headers, constants.KafkaPartition),
    timestamp: utils.getHeaderString(request.headers, constants.KafkaTimestamp),
    headers,
  };

  const producer = await getProducer(session, request);
  for (const topic of topics) {
    // the library mutates the message on send, so every topic needs its own copy
    const [metadata] = await producer.send({
      topic,
      messages: [{ ...message, headers: headers && { ...headers } }],
    });
    const partition = metadata?.partition ?? message.partition;
    const offset = metadata?.offset ?? metadata?.baseOffset;
    // the delivery report returns timestamp 0, if the broker does not use LogAppendTime
    const timestamp = Number(metadata?.timestamp) > 0 ? metadata?.timestamp : message.timestamp;
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
