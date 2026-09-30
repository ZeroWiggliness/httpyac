import { v4 } from 'uuid';

import * as io from '../../../io';
import * as utils from '../../../utils';
import { KafkaEachMessagePayload } from '../kafkaTypes';
import * as constants from './kafkaConstants';
import { ConsumeStoppedMessage } from './kafkaConstants';

const PauseSettleTime = 200;
import { KafkaMethodContext, KafkaMethodResult } from './kafkaMethodContext';
import {
  disconnectConsumer,
  fromKafkaMessageHeaders,
  getPositiveIntegerHeader,
  getTopicPartitionOffsets,
  getTopics,
  warn,
} from './kafkaUtils';

export async function consume({
  session,
  request,
  context,
  onMessage,
}: KafkaMethodContext): Promise<KafkaMethodResult> {
  const topics = getTopics(request);
  if (topics.length === 0) {
    warn(`no ${constants.KafkaTopic} to consume`);
    return {};
  }
  const groupId = utils.getHeaderString(request.headers, constants.KafkaGroupId)?.trim() || `httpyac-${v4()}`;
  const maxMessages = getPositiveIntegerHeader(request, constants.KafkaMaxMessages);
  const timeout = getPositiveIntegerHeader(request, constants.KafkaTimeout);
  if (!maxMessages && !timeout && !context.httpRegion.metaData.keepStreaming) {
    warn(
      `consume without ${constants.KafkaMaxMessages}, ${constants.KafkaTimeout} or # @keepStreaming finishes immediately`
    );
  }

  const kafkaJS: Record<string, unknown> = {
    groupId,
    fromBeginning: utils.getHeaderBoolean(request.headers, constants.KafkaFromBeginning, false),
    autoCommit: utils.getHeaderBoolean(request.headers, constants.KafkaAutoCommit, true),
  };
  const autoCommitInterval = utils.getHeaderNumber(request.headers, constants.KafkaAutoCommitInterval);
  if (!utils.isUndefined(autoCommitInterval)) {
    kafkaJS.autoCommitInterval = autoCommitInterval;
  }
  const groupProtocol = utils
    .getHeaderString(request.headers, `${constants.KafkaConfigPrefix}group.protocol`)
    ?.trim()
    .toLowerCase();
  if (
    !utils.getHeader(request.headers, `${constants.KafkaConfigPrefix}partition.assignment.strategy`) &&
    (!groupProtocol || groupProtocol === 'classic')
  ) {
    // an eager rebalance during disconnect shortly after the assignment can hang the consumer disconnect
    kafkaJS.partitionAssigners = ['cooperative-sticky'];
  }
  const consumer = session.kafka.consumer({ kafkaJS });
  await consumer.connect();
  session.consumers.set(groupId, consumer);

  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let messageCount = 0;
  let resolveCompleted: () => void = () => undefined;
  const completed = new Promise<void>(resolve => {
    resolveCompleted = resolve;
  });

  let paused = false;
  const pauseConsumer = () => {
    if (paused) {
      return;
    }
    paused = true;
    try {
      // pause seeks back to the last processed message, so skipped messages are not committed
      consumer.pause(topics.map(topic => ({ topic })));
    } catch (err) {
      io.log.debug('kafka consumer pause failed', err);
    }
  };

  const stop = async () => {
    if (stopped) {
      return;
    }
    stopped = true;
    pauseConsumer();
    if (timer) {
      clearTimeout(timer);
    }
    if (messageCount === 0) {
      onMessage('consume', {
        protocol: 'KAFKA',
        name: `KAFKA consume ${topics.join(', ')}`,
        statusCode: 0,
        statusMessage: 'no messages received',
        headers: {
          [constants.KafkaTopic]: topics,
          [constants.KafkaGroupId]: groupId,
        },
        request,
        message: `no messages received (topics: ${topics.join(', ')}, groupId: ${groupId})`,
        body: utils.stringifySafe({ topics, groupId, messageCount }, 2),
      });
    }
    if (session.consumers.get(groupId) === consumer) {
      session.consumers.delete(groupId);
    }
    // the library can not disconnect while the pause is still pending
    await new Promise(resolve => setTimeout(resolve, PauseSettleTime));
    await disconnectConsumer(consumer);
    resolveCompleted();
  };

  try {
    await consumer.subscribe({ topics });
    for (const topicPartitionOffset of getTopicPartitionOffsets(request) || []) {
      consumer.seek(topicPartitionOffset);
    }
    await consumer.run({
      eachMessage: async (payload: KafkaEachMessagePayload) => {
        if (stopped || (maxMessages && messageCount >= maxMessages)) {
          // throwing prevents the library from storing (and committing) the offset of the skipped message
          throw new Error(ConsumeStoppedMessage);
        }
        messageCount++;
        onMessage(payload.topic, toConsumeResponse(payload, groupId, request));
        if (maxMessages && messageCount >= maxMessages) {
          pauseConsumer();
          // eachMessage must not wait for the consumer disconnect
          setImmediate(() => void stop());
        }
      },
    });
  } catch (err) {
    stopped = true;
    session.consumers.delete(groupId);
    await disconnectConsumer(consumer);
    throw err;
  }
  if (timeout) {
    timer = setTimeout(() => void stop(), timeout);
  }
  return {
    completed: maxMessages || timeout ? completed : undefined,
    stop,
  };
}

function toConsumeResponse(
  { topic, partition, message }: KafkaEachMessagePayload,
  groupId: string,
  request: KafkaMethodContext['request']
) {
  const messageHeaders = fromKafkaMessageHeaders(message.headers);
  const contentType = utils.getHeader(messageHeaders, 'content-type');
  const body = message.value ? message.value.toString('utf-8') : '';
  return {
    protocol: 'KAFKA',
    name: `KAFKA consume ${topic}`,
    statusCode: 0,
    statusMessage: 'consumed',
    headers: {
      ...messageHeaders,
      [constants.KafkaTopic]: topic,
      [constants.KafkaPartition]: partition,
      [constants.KafkaOffset]: message.offset,
      [constants.KafkaKey]: message.key ? message.key.toString('utf-8') : undefined,
      [constants.KafkaTimestamp]: message.timestamp,
      [constants.KafkaGroupId]: groupId,
    },
    contentType: utils.isString(contentType) ? utils.parseMimeType(contentType) : undefined,
    request,
    message: `${body} (topic: ${topic}, partition: ${partition}, offset: ${message.offset})`,
    body,
    rawBody: message.value ? Buffer.from(message.value) : undefined,
  };
}
