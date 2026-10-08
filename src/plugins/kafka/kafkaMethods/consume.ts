import { v4 } from 'uuid';

import * as utils from '../../../utils';
import { KafkaActiveConsumer, KafkaEachMessagePayload, KafkaTopicPartitionOffset } from '../kafkaTypes';
import * as constants from './kafkaConstants';
import { KafkaMethodContext, KafkaMethodResult } from './kafkaMethodContext';
import {
  errorToHttpResponse,
  fromKafkaMessageHeaders,
  getPositiveIntegerHeader,
  getTopicPartitionOffsets,
  getTopics,
  warn,
} from './kafkaUtils';

const PauseSettleTime = 200;
const DefaultAutoCommitInterval = 5000;

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

  const autoCommit = utils.getHeaderBoolean(request.headers, constants.KafkaAutoCommit, true);
  const requestedAutoCommitInterval = utils.getHeaderNumber(request.headers, constants.KafkaAutoCommitInterval);
  if (!utils.isUndefined(requestedAutoCommitInterval) && requestedAutoCommitInterval < 100) {
    throw new Error(`${constants.KafkaAutoCommitInterval} must be at least 100ms for @platformatic/kafka`);
  }
  const autoCommitInterval = requestedAutoCommitInterval || DefaultAutoCommitInterval;
  const offsets = getTopicPartitionOffsets(request);
  const fromBeginning = utils.getHeaderBoolean(request.headers, constants.KafkaFromBeginning, false);
  const consumerOptions: Record<string, unknown> = {
    ...session.config,
    groupId,
    autocommit: false,
  };
  const partitionAssignmentStrategy = consumerOptions.partitionAssignmentStrategy;
  delete consumerOptions.partitionAssignmentStrategy;
  if (
    partitionAssignmentStrategy === undefined &&
    consumerOptions.groupProtocol !== 'consumer' &&
    typeof session.kafka.cooperativeStickyAssigner === 'function'
  ) {
    consumerOptions.partitionAssigner = session.kafka.cooperativeStickyAssigner;
  } else if (partitionAssignmentStrategy === 'cooperative-sticky') {
    consumerOptions.partitionAssigner = session.kafka.cooperativeStickyAssigner;
  } else if (partitionAssignmentStrategy === 'roundrobin') {
    consumerOptions.partitionAssigner = session.kafka.roundRobinAssigner;
  }

  const consumer = new session.kafka.Consumer(consumerOptions);
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let autoCommitTimer: NodeJS.Timeout | undefined;
  let messageCount = 0;
  let endedWithError = false;
  let resolveCompleted: () => void = () => undefined;
  const completed = new Promise<void>(resolve => {
    resolveCompleted = resolve;
  });

  const createStream = (initialOffsets?: Array<KafkaTopicPartitionOffset>) =>
    consumer.consume({
      topics,
      autocommit: false,
      mode: initialOffsets ? 'manual' : 'committed',
      fallbackMode: fromBeginning ? 'earliest' : 'latest',
      ...(initialOffsets
        ? {
            offsets: initialOffsets.map(offset => ({
              topic: offset.topic,
              partition: offset.partition,
              offset: BigInt(offset.offset),
            })),
          }
        : {}),
    });

  let currentStream = await createStream(offsets);
  const consumerState: KafkaActiveConsumer = {
    consumer,
    stream: currentStream,
    topics,
    latestMessages: new Map(),
    seek: async seekOffsets => {
      currentStream.pause();
      await new Promise(resolve => setTimeout(resolve, PauseSettleTime));
      await currentStream.close();
      consumerState.latestMessages.clear();
      currentStream = await createStream(seekOffsets);
      consumerState.stream = currentStream;
      processStream(currentStream);
    },
    stop: async () => {
      if (stopped) {
        return;
      }
      stopped = true;
      if (timer) {
        clearTimeout(timer);
      }
      if (autoCommitTimer) {
        clearInterval(autoCommitTimer);
      }
      if (autoCommit && !endedWithError) {
        try {
          await commitLatestMessages();
        } catch (err) {
          endedWithError = true;
          onMessage('error', errorToHttpResponse(err, request));
        }
      }
      if (messageCount === 0 && !endedWithError) {
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
      if (session.consumers.get(groupId) === consumerState) {
        session.consumers.delete(groupId);
      }
      await currentStream.close();
      await consumer.close();
      resolveCompleted();
    },
  };
  session.consumers.set(groupId, consumerState);

  function processStream(stream: typeof currentStream) {
    void (async () => {
      try {
        for await (const message of stream) {
          if (stopped || stream !== currentStream) {
            break;
          }
          const payload: KafkaEachMessagePayload = {
            topic: message.topic,
            partition: message.partition,
            message,
          };
          messageCount++;
          consumerState.latestMessages.set(`${message.topic}:${message.partition}`, message);
          onMessage(payload.topic, toConsumeResponse(payload, groupId, request));
          if (maxMessages && messageCount >= maxMessages) {
            stream.pause();
            setImmediate(() => void consumerState.stop());
            break;
          }
        }
      } catch (err) {
        if (!stopped && stream === currentStream) {
          endedWithError = true;
          onMessage('error', errorToHttpResponse(err, request));
          void consumerState.stop();
        }
      }
    })();
  }

  async function commitLatestMessages() {
    await Promise.all([...consumerState.latestMessages.values()].map(message => message.commit()));
  }

  processStream(currentStream);
  if (timeout) {
    timer = setTimeout(() => void consumerState.stop(), timeout);
  }
  if (autoCommit) {
    autoCommitTimer = setInterval(() => {
      if (!stopped) {
        void commitLatestMessages().catch(err => {
          endedWithError = true;
          onMessage('error', errorToHttpResponse(err, request));
          void consumerState.stop();
        });
      }
    }, autoCommitInterval);
  }
  return {
    completed: maxMessages || timeout ? completed : undefined,
    stop: consumerState.stop,
  };
}

function toConsumeResponse(
  { topic, partition, message }: KafkaEachMessagePayload,
  groupId: string,
  request: KafkaMethodContext['request']
) {
  const messageHeaders = fromKafkaMessageHeaders(
    message.headerEntries.reduce<Record<string, Buffer | string | Array<Buffer | string>>>((headers, [key, value]) => {
      if (key && value) {
        const headerName = key.toString('utf-8');
        const headerValue = Buffer.from(value);
        const existing = headers[headerName];
        if (!existing) {
          headers[headerName] = headerValue;
        } else if (Array.isArray(existing)) {
          existing.push(headerValue);
        } else {
          headers[headerName] = [existing, headerValue];
        }
      }
      return headers;
    }, {})
  );
  const contentType = utils.getHeader(messageHeaders, 'content-type');
  const body = message.value ? message.value.toString('utf-8') : '';
  const offset = message.offset.toString();
  const timestamp = message.timestamp.toString();
  return {
    protocol: 'KAFKA',
    name: `KAFKA consume ${topic}`,
    statusCode: 0,
    statusMessage: 'consumed',
    headers: {
      ...messageHeaders,
      [constants.KafkaTopic]: topic,
      [constants.KafkaPartition]: partition,
      [constants.KafkaOffset]: offset,
      [constants.KafkaKey]: message.key ? message.key.toString('utf-8') : undefined,
      [constants.KafkaTimestamp]: timestamp,
      [constants.KafkaGroupId]: groupId,
    },
    contentType: utils.isString(contentType) ? utils.parseMimeType(contentType) : undefined,
    request,
    message: `${body} (topic: ${topic}, partition: ${partition}, offset: ${offset})`,
    body,
    rawBody: message.value ? Buffer.from(message.value) : undefined,
  };
}
