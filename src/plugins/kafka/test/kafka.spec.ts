import { TestResultStatus } from '../../../models';
import { initFileProvider, parseHttp, sendHttp, sendHttpFile } from '../../../test/testUtils';
import { kafkaClientProvider } from '../kafkaClientProvider';
import { fromKafkaMessageHeaders, getKafkaMethod, toKafkaMessageHeaders } from '../kafkaMethods';
import { getKafkaConfig, parseBrokers } from '../kafkaRequestClient';
import { KafkaEachMessagePayload, KafkaModule, KafkaProducerMessage, KafkaTopicPartitionOffset } from '../kafkaTypes';

interface MockConsumer {
  config: Record<string, unknown>;
  subscribed: Array<string>;
  seeks: Array<KafkaTopicPartitionOffset>;
  commits: Array<Array<KafkaTopicPartitionOffset> | undefined>;
  disconnected: boolean;
  running: boolean;
  paused: boolean;
  processed: Array<string>;
  skipped: Array<string>;
}

function initKafkaMock(messages: Array<KafkaEachMessagePayload> = []) {
  const mock = {
    configs: [] as Array<Record<string, unknown>>,
    sent: [] as Array<{ topic: string; messages: Array<KafkaProducerMessage> }>,
    producerConfigs: [] as Array<Record<string, unknown> | undefined>,
    consumers: [] as Array<MockConsumer>,
  };
  const kafkaModule: KafkaModule = {
    KafkaJS: {
      Kafka: class {
        constructor(config: Record<string, unknown>) {
          mock.configs.push(config);
        }
        producer(config?: Record<string, unknown>) {
          mock.producerConfigs.push(config);
          return {
            connect: async () => undefined,
            disconnect: async () => undefined,
            send: async (record: { topic: string; messages: Array<KafkaProducerMessage> }) => {
              mock.sent.push(structuredClone(record));
              // simulate the library, which converts the headers in place
              for (const message of record.messages) {
                if (Array.isArray(message.headers)) {
                  throw new Error('Header value must be a string or buffer');
                }
                message.headers = Object.entries(message.headers || {}).map(([key, value]) => ({
                  [key]: value,
                })) as never;
              }
              return [{ topicName: record.topic, partition: 0, errorCode: 0, offset: `${mock.sent.length - 1}` }];
            },
          };
        }
        consumer(config: Record<string, unknown>) {
          const state: MockConsumer = {
            config,
            subscribed: [],
            seeks: [],
            commits: [],
            disconnected: false,
            running: false,
            paused: false,
            processed: [],
            skipped: [],
          };
          mock.consumers.push(state);
          return {
            connect: async () => undefined,
            disconnect: async () => {
              state.disconnected = true;
            },
            subscribe: async ({ topics }: { topics: Array<string> }) => {
              state.subscribed.push(...topics);
            },
            run: async ({ eachMessage }: { eachMessage: (payload: KafkaEachMessagePayload) => Promise<void> }) => {
              state.running = true;
              setImmediate(async () => {
                for (const message of messages) {
                  // like the library, only a resolved eachMessage marks the offset as processed
                  try {
                    await eachMessage(message);
                    state.processed.push(message.message.offset);
                  } catch {
                    state.skipped.push(message.message.offset);
                  }
                }
              });
            },
            pause: () => {
              state.paused = true;
            },
            commitOffsets: async (offsets?: Array<KafkaTopicPartitionOffset>) => {
              state.commits.push(offsets);
            },
            seek: (offset: KafkaTopicPartitionOffset) => {
              state.seeks.push(offset);
            },
          };
        }
      },
    },
  };
  kafkaClientProvider.load = () => kafkaModule;
  return mock;
}

function createMessage(
  offset: string,
  value: string,
  headers: Record<string, Buffer | string | Array<Buffer | string>> = {}
): KafkaEachMessagePayload {
  return {
    topic: 'orders',
    partition: 0,
    message: {
      key: Buffer.from(`key-${offset}`),
      value: Buffer.from(value),
      offset,
      timestamp: '1700000000000',
      headers,
    },
  };
}

describe('kafka', () => {
  describe('parse', () => {
    it('should parse method and protocol request line', async () => {
      initFileProvider();
      const httpFile = await parseHttp(`
KAFKA localhost:9092,localhost:9093
kafka_topic: orders

###
kafkas://broker:9093
kafka_topic: orders
`);
      expect(httpFile.httpRegions.length).toBe(2);
      expect(httpFile.httpRegions[0].request?.protocol).toBe('KAFKA');
      expect(httpFile.httpRegions[0].request?.url).toBe('localhost:9092,localhost:9093');
      expect(httpFile.httpRegions[1].request?.protocol).toBe('KAFKA');
      expect(httpFile.httpRegions[1].request?.url).toBe('kafkas://broker:9093');
    });

    it('should not parse inline response as request', async () => {
      initFileProvider();
      const httpFile = await parseHttp(`
KAFKA localhost:9092
kafka_topic: orders

hello

KAFKA 0 - produced
`);
      expect(httpFile.httpRegions.length).toBe(1);
      expect(httpFile.httpRegions[0].request?.url).toBe('localhost:9092');
    });

    it('should parse brokers', () => {
      expect(parseBrokers('localhost:9092, localhost:9093')).toEqual(['localhost:9092', 'localhost:9093']);
      expect(parseBrokers('kafka://broker:9092/')).toEqual(['broker:9092']);
      expect(parseBrokers('kafkas://a:9093,b:9093')).toEqual(['a:9093', 'b:9093']);
    });

    it('should resolve method', () => {
      expect(getKafkaMethod({ url: '', headers: {}, body: 'x' })).toBe('produce');
      expect(getKafkaMethod({ url: '', headers: {} })).toBe('consume');
      expect(getKafkaMethod({ url: '', headers: { kafka_method: 'publish' } })).toBe('produce');
      expect(getKafkaMethod({ url: '', headers: { kafka_method: 'Subscribe' } })).toBe('consume');
      expect(getKafkaMethod({ url: '', headers: { kafka_method: 'seek' } })).toBe('seek');
      expect(() => getKafkaMethod({ url: '', headers: { kafka_method: 'foo' } })).toThrow(
        'Kafka method foo not supported'
      );
    });
  });

  describe('config', () => {
    it('should create connection config', () => {
      const config = getKafkaConfig(
        {
          url: 'kafkas://broker:9093',
          headers: {
            kafka_client_id: 'test',
            kafka_sasl_mechanism: 'SCRAM-SHA-256',
            kafka_username: 'user',
            kafka_password: 'secret',
            'kafka_config_ssl.ca.location': '/tmp/ca.pem',
          },
          noRejectUnauthorized: true,
        },
        {} as never
      );
      expect(config['ssl.ca.location']).toBe('/tmp/ca.pem');
      expect(config['enable.ssl.certificate.verification']).toBe(false);
      expect(config.kafkaJS).toMatchObject({
        brokers: ['broker:9093'],
        clientId: 'test',
        ssl: true,
        sasl: { mechanism: 'scram-sha-256', username: 'user', password: 'secret' },
      });
    });
  });

  describe('message headers', () => {
    it('should convert request headers to kafka message headers', () => {
      expect(
        toKafkaMessageHeaders({
          url: '',
          headers: {
            kafka_topic: 'orders',
            traceId: 'abc',
            tag: ['a', 'b'],
            Accept: '*/*',
            'User-Agent': 'httpyac',
            empty: undefined,
          },
          declaredHeaders: ['kafka_topic', 'traceid', 'tag'],
        })
      ).toEqual({ traceId: 'abc', tag: ['a', 'b'] });
    });
    it('should keep declared default headers', () => {
      expect(
        toKafkaMessageHeaders({
          url: '',
          headers: { Accept: 'application/json' },
          declaredHeaders: ['accept'],
        })
      ).toEqual({ Accept: 'application/json' });
    });
    it('should convert kafka message headers to strings', () => {
      expect(
        fromKafkaMessageHeaders({
          traceId: Buffer.from('abc'),
          plain: 'text',
          multi: [Buffer.from('a'), 'b'],
          empty: undefined,
        })
      ).toEqual({ traceId: 'abc', plain: 'text', multi: ['a', 'b'] });
    });
  });

  describe('produce', () => {
    it('should produce message with headers', async () => {
      initFileProvider();
      const mock = initKafkaMock();
      const responses = await sendHttp(
        `
KAFKA localhost:9092
kafka_topic: orders
kafka_key: order-{{id}}
kafka_partition: 2
kafka_acks: 1
traceId: {{traceId}}
tag: a
tag: b
content-type: application/json

{ "id": {{id}} }
`,
        { id: 42, traceId: 'trace-1' }
      );
      expect(mock.configs[0].kafkaJS).toMatchObject({ brokers: ['localhost:9092'], clientId: 'httpyac', ssl: false });
      expect(mock.producerConfigs[0]).toEqual({ kafkaJS: { acks: 1 } });
      expect(mock.sent.length).toBe(1);
      expect(mock.sent[0].topic).toBe('orders');
      const message = mock.sent[0].messages[0];
      expect(message.value?.toString()).toBe('{ "id": 42 }');
      expect(message.key).toBe('order-42');
      expect(message.partition).toBe(2);
      expect(message.headers).toEqual({
        traceId: 'trace-1',
        tag: ['a', 'b'],
        'content-type': 'application/json',
      });

      expect(responses.length).toBe(1);
      expect(responses[0].protocol).toBe('KAFKA');
      expect(responses[0].statusCode).toBe(0);
      expect(responses[0].headers).toMatchObject({
        traceId: 'trace-1',
        kafka_topic: 'orders',
        kafka_partition: 0,
        kafka_offset: '0',
        kafka_key: 'order-42',
      });
    });

    it('should produce to multiple topics', async () => {
      initFileProvider();
      const mock = initKafkaMock();
      const responses = await sendHttp(`
KAFKA localhost:9092
kafka_topic: orders, audit
traceId: abc

hello
`);
      expect(mock.sent.map(obj => obj.topic)).toEqual(['orders', 'audit']);
      expect(mock.sent.map(obj => obj.messages[0].headers)).toEqual([{ traceId: 'abc' }, { traceId: 'abc' }]);
      expect(responses[0].statusCode).toBe(0);
    });
  });

  describe('consume', () => {
    it('should consume messages and expose message headers', async () => {
      initFileProvider();
      const mock = initKafkaMock([
        createMessage('5', '{"id":1}', {
          traceId: Buffer.from('trace-1'),
          'content-type': Buffer.from('application/json'),
        }),
        createMessage('6', '{"id":2}'),
      ]);
      const httpFile = await parseHttp(`
KAFKA localhost:9092
kafka_topic: orders
kafka_group_id: test-group
kafka_from_beginning: true
kafka_max_messages: 1

?? header traceId == trace-1
?? header kafka_offset == 5
?? body id == 1
`);
      const responses = await sendHttpFile({ httpFile });

      expect(mock.consumers.length).toBe(1);
      const consumer = mock.consumers[0];
      expect(consumer.config).toEqual({
        kafkaJS: {
          groupId: 'test-group',
          fromBeginning: true,
          autoCommit: true,
          partitionAssigners: ['cooperative-sticky'],
        },
      });
      expect(consumer.subscribed).toEqual(['orders']);
      expect(consumer.disconnected).toBe(true);
      expect(consumer.paused).toBe(true);
      expect(consumer.processed).toEqual(['5']);
      expect(consumer.skipped).toEqual(['6']);

      expect(responses.length).toBe(1);
      expect(responses[0].body).toBe('{"id":1}');
      expect(responses[0].headers).toMatchObject({
        traceId: 'trace-1',
        kafka_topic: 'orders',
        kafka_partition: 0,
        kafka_offset: '5',
        kafka_key: 'key-5',
        kafka_group_id: 'test-group',
      });
      const testResults = httpFile.httpRegions[0].testResults;
      expect(testResults?.length).toBe(3);
      expect(testResults?.every(obj => obj.status === TestResultStatus.SUCCESS)).toBe(true);
    });

    it('should not set partition assigner for consumer group protocol', async () => {
      initFileProvider();
      const mock = initKafkaMock();
      await sendHttp(`
KAFKA localhost:9092
kafka_topic: orders
kafka_config_group.protocol: consumer
kafka_timeout: 10
`);
      expect(mock.configs[0]['group.protocol']).toBe('consumer');
      expect((mock.consumers[0].config.kafkaJS as Record<string, unknown>).partitionAssigners).toBeUndefined();
    });

    it('should seek before consume and stop after timeout', async () => {
      initFileProvider();
      const mock = initKafkaMock();
      const responses = await sendHttp(`
KAFKA localhost:9092
kafka_topic: orders
kafka_partition: 1
kafka_offset: 10
kafka_timeout: 50
`);
      const consumer = mock.consumers[0];
      expect(`${consumer.config.kafkaJS && (consumer.config.kafkaJS as Record<string, unknown>).groupId}`).toMatch(
        /^httpyac-/u
      );
      expect(consumer.seeks).toEqual([{ topic: 'orders', partition: 1, offset: '10' }]);
      expect(consumer.disconnected).toBe(true);
      expect(responses.length).toBe(1);
      expect(responses[0].statusMessage).toBe('no messages received');
    });
  });

  describe('commit', () => {
    it('should commit explicit offsets for a group', async () => {
      initFileProvider();
      const mock = initKafkaMock();
      const responses = await sendHttp(`
KAFKA localhost:9092
kafka_method: commit
kafka_group_id: test-group
kafka_topic: orders
kafka_partition: 0
kafka_offset: 7
`);
      expect(mock.consumers.length).toBe(1);
      expect(mock.consumers[0].config).toEqual({ kafkaJS: { groupId: 'test-group', autoCommit: false } });
      expect(mock.consumers[0].commits).toEqual([[{ topic: 'orders', partition: 0, offset: '7' }]]);
      expect(mock.consumers[0].disconnected).toBe(true);
      expect(responses[0].statusCode).toBe(0);
      expect(responses[0].statusMessage).toBe('committed');
    });

    it('should return error without active consumer and offset', async () => {
      initFileProvider();
      initKafkaMock();
      const responses = await sendHttp(`
KAFKA localhost:9092
kafka_method: commit
kafka_group_id: test-group
`);
      expect(responses[0].statusCode).toBe(1);
      expect(responses[0].statusMessage).toContain('no active consumer');
    });
  });

  describe('seek', () => {
    it('should commit offset without active consumer', async () => {
      initFileProvider();
      const mock = initKafkaMock();
      const responses = await sendHttp(`
KAFKA localhost:9092
kafka_method: seek
kafka_group_id: test-group
kafka_topic: orders
kafka_offset: 3
`);
      expect(mock.consumers[0].commits).toEqual([[{ topic: 'orders', partition: 0, offset: '3' }]]);
      expect(responses[0].statusMessage).toBe('committed');
    });

    it('should require group id', async () => {
      initFileProvider();
      initKafkaMock();
      const responses = await sendHttp(`
KAFKA localhost:9092
kafka_method: seek
kafka_topic: orders
kafka_offset: 3
`);
      expect(responses[0].statusCode).toBe(1);
      expect(responses[0].statusMessage).toBe('seek requires header kafka_group_id');
    });
  });

  it('should return error for unsupported method', async () => {
    initFileProvider();
    initKafkaMock();
    const responses = await sendHttp(`
KAFKA localhost:9092
kafka_method: foo
`);
    expect(responses[0].statusCode).toBe(1);
    expect(responses[0].statusMessage).toContain('Kafka method foo not supported');
  });
});
