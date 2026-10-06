import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { TestResultStatus } from '../../../models';
import { initFileProvider, parseHttp, sendHttp, sendHttpFile } from '../../../test/testUtils';
import { kafkaClientProvider } from '../kafkaClientProvider';
import { fromKafkaMessageHeaders, getKafkaMethod, toKafkaMessageHeaders } from '../kafkaMethods';
import { getKafkaConfig, parseBrokers } from '../kafkaRequestClient';
import { KafkaEachMessagePayload, KafkaModule, KafkaPlatformaticMessage } from '../kafkaTypes';

interface MockConsumer {
  config: Record<string, unknown>;
  consumeOptions: Record<string, unknown>;
  subscribed: Array<string>;
  seeks: Array<{ topic: string; partition: number; offset: bigint }>;
  disconnected: boolean;
  paused: boolean;
  processed: Array<string>;
  committed: Array<string>;
}

function initKafkaMock(messages: Array<KafkaEachMessagePayload> = []) {
  const mock = {
    configs: [] as Array<Record<string, unknown>>,
    sent: [] as Array<{ topic: string; messages: Array<KafkaPlatformaticMessage>; acks?: number }>,
    consumers: [] as Array<MockConsumer>,
    adminCommits: [] as Array<{
      groupId: string;
      topics: Array<{ name: string; partitionOffsets: Array<{ partition: number; offset: bigint }> }>;
    }>,
    adminConfigs: [] as Array<Record<string, unknown>>,
  };
  const kafkaModule: KafkaModule = {
    Producer: class {
      constructor(config: Record<string, unknown>) {
        mock.configs.push(config);
      }
      async close() {}
      async send(options: { messages: Array<KafkaPlatformaticMessage>; acks?: number }) {
        const records = options.messages;
        const topic = records[0].topic;
        mock.sent.push({
          topic,
          acks: options.acks,
          messages: records.map(record => ({
            ...record,
            headers: record.headers && new Map(record.headers),
          })),
        });
        return {
          offsets: [{ topic, partition: records[0].partition ?? 0, offset: BigInt(mock.sent.length - 1) }],
        };
      }
    },
    Consumer: class {
      private readonly state: MockConsumer;
      constructor(config: Record<string, unknown>) {
        mock.configs.push(config);
        this.state = {
          config,
          consumeOptions: {},
          subscribed: [],
          seeks: [],
          disconnected: false,
          paused: false,
          processed: [],
          committed: [],
        };
        mock.consumers.push(this.state);
      }
      async close() {
        this.state.disconnected = true;
      }
      async commit() {}
      async consume(options: Record<string, unknown>) {
        this.state.consumeOptions = options;
        this.state.subscribed.push(...(options.topics as Array<string>));
        this.state.seeks.push(...((options.offsets as MockConsumer['seeks'] | undefined) || []));
        const state = this.state;
        return {
          pause() {
            state.paused = true;
            return this;
          },
          async close() {
            state.disconnected = true;
          },
          async *[Symbol.asyncIterator]() {
            for (const item of messages) {
              if (state.disconnected || state.paused) {
                break;
              }
              state.processed.push(item.message.offset.toString());
              yield {
                ...item.message,
                topic: item.topic,
                partition: item.partition,
                commit: async () => {
                  state.committed.push(item.message.offset.toString());
                  await item.message.commit();
                },
              };
            }
          },
        };
      }
    },
    Admin: class {
      constructor(config: Record<string, unknown>) {
        mock.adminConfigs.push(config);
      }
      async alterConsumerGroupOffsets(options: (typeof mock.adminCommits)[number]) {
        mock.adminCommits.push(options);
      }
      async close() {}
    },
    cooperativeStickyAssigner: () => [],
    roundRobinAssigner: () => [],
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
      topic: 'orders',
      partition: 0,
      key: Buffer.from(`key-${offset}`),
      value: Buffer.from(value),
      offset: BigInt(offset),
      timestamp: 1700000000000n,
      leaderEpoch: 0,
      headerEntries: Object.entries(headers).flatMap(([key, headerValues]) =>
        (Array.isArray(headerValues) ? headerValues : [headerValues]).map(headerValue => [
          Buffer.from(key),
          Buffer.isBuffer(headerValue) ? headerValue : Buffer.from(headerValue),
        ])
      ),
      commit: async () => undefined,
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
      const caPath = path.join(os.tmpdir(), `httpyac-kafka-ca-${randomUUID()}.pem`);
      fs.writeFileSync(caPath, 'certificate');
      try {
        const config = getKafkaConfig(
          {
            url: 'kafkas://broker:9093',
            headers: {
              kafka_client_id: 'test',
              kafka_sasl_mechanism: 'SCRAM-SHA-256',
              kafka_username: 'user',
              kafka_password: 'secret',
              'kafka_config_ssl.ca.location': caPath,
            },
            noRejectUnauthorized: true,
          },
          {} as never
        );
        expect(config.bootstrapBrokers).toEqual(['broker:9093']);
        expect(config.clientId).toBe('test');
        expect(config.tls).toEqual({ ca: Buffer.from('certificate'), rejectUnauthorized: false });
        expect(config.sasl).toEqual({ mechanism: 'SCRAM-SHA-256', username: 'user', password: 'secret' });
      } finally {
        fs.rmSync(caPath, { force: true });
      }
    });

    it('should reject unsupported librdkafka settings', () => {
      expect(() =>
        getKafkaConfig({ url: 'localhost:9092', headers: { kafka_config_debug: 'broker' } }, {} as never)
      ).toThrow('Unsupported kafka_config_ setting(s) for @platformatic/kafka: kafka_config_debug');
    });

    it('should not enable TLS for a plaintext connection when certificate validation is disabled globally', () => {
      const config = getKafkaConfig({ url: 'localhost:9092', headers: {}, noRejectUnauthorized: true }, {} as never);
      expect(config.tls).toBeUndefined();
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
      expect(mock.configs[0]).toMatchObject({ bootstrapBrokers: ['localhost:9092'], clientId: 'httpyac' });
      expect(mock.sent.length).toBe(1);
      expect(mock.sent[0].acks).toBe(1);
      expect(mock.sent[0].topic).toBe('orders');
      const message = mock.sent[0].messages[0];
      expect(Buffer.isBuffer(message.value)).toBe(true);
      expect(message.value?.toString()).toBe('{ "id": 42 }');
      expect(Buffer.isBuffer(message.key)).toBe(true);
      expect(message.key?.toString()).toBe('order-42');
      expect(message.partition).toBe(2);
      expect([...message.headers!.entries()].map(([key, value]) => [key.toString(), value.toString()])).toEqual([
        ['traceId', 'trace-1'],
        ['tag', 'a'],
        ['tag', 'b'],
        ['content-type', 'application/json'],
      ]);

      expect(responses.length).toBe(1);
      expect(responses[0].protocol).toBe('KAFKA');
      expect(responses[0].statusCode).toBe(0);
      expect(responses[0].headers).toMatchObject({
        traceId: 'trace-1',
        kafka_topic: 'orders',
        kafka_partition: 2,
        kafka_offset: '0',
        kafka_key: 'order-42',
      });
    });

    it('should send configured default headers and header variables, but not implicit httpyac headers', async () => {
      initFileProvider();
      const mock = initKafkaMock();
      const httpFile = await parseHttp(`
{{
  exports.messageHeaders = { 'User-Agent': 'my-agent', tenant: 'acme' };
}}
###
KAFKA localhost:9092
kafka_topic: orders
...messageHeaders

hello
`);
      await sendHttpFile({
        httpFile,
        config: { defaultHeaders: { Accept: 'application/json' } },
      });
      expect(
        [...mock.sent[0].messages[0].headers!.entries()].map(([key, value]) => [key.toString(), value.toString()])
      ).toEqual([
        ['User-Agent', 'my-agent'],
        ['tenant', 'acme'],
        ['Accept', 'application/json'],
      ]);
    });

    it('should not send implicit httpyac headers', async () => {
      initFileProvider();
      const mock = initKafkaMock();
      await sendHttp(`
KAFKA localhost:9092
kafka_topic: orders

hello
`);
      expect(mock.sent[0].messages[0].headers).toBeUndefined();
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
      expect(
        mock.sent.map(obj =>
          [...obj.messages[0].headers!.entries()].map(([key, value]) => [key.toString(), value.toString()])
        )
      ).toEqual([[['traceId', 'abc']], [['traceId', 'abc']]]);
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
      expect(consumer.config).toMatchObject({
        groupId: 'test-group',
        autocommit: false,
        partitionAssigner: expect.any(Function),
      });
      expect(consumer.consumeOptions).toMatchObject({
        topics: ['orders'],
        mode: 'committed',
        fallbackMode: 'earliest',
        autocommit: false,
      });
      expect(consumer.subscribed).toEqual(['orders']);
      expect(consumer.disconnected).toBe(true);
      expect(consumer.paused).toBe(true);
      expect(consumer.processed).toEqual(['5']);
      expect(consumer.committed).toEqual(['5']);

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

    it('should reject invalid consume limits', async () => {
      initFileProvider();
      const mock = initKafkaMock([createMessage('0', 'a')]);
      const responses = await sendHttp(`
KAFKA localhost:9092
kafka_topic: orders
kafka_max_messages: -1

###
KAFKA localhost:9092
kafka_topic: orders
kafka_timeout: 1.5
`);
      expect(mock.consumers.length).toBe(0);
      expect(responses.map(obj => obj.statusCode)).toEqual([1, 1]);
      expect(responses[0].statusMessage).toBe('kafka_max_messages must be a positive integer (value: -1)');
      expect(responses[1].statusMessage).toBe('kafka_timeout must be a positive integer (value: 1.5)');
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
      expect(mock.configs[0].groupProtocol).toBe('consumer');
      expect(mock.consumers[0].config.partitionAssigner).toBeUndefined();
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
      expect(`${consumer.config.groupId}`).toMatch(/^httpyac-/u);
      expect(consumer.seeks).toEqual([{ topic: 'orders', partition: 1, offset: 10n }]);
      expect(consumer.consumeOptions.mode).toBe('manual');
      expect(consumer.disconnected).toBe(true);
      expect(responses.length).toBe(1);
      expect(responses[0].statusMessage).toBe('no messages received');
    });

    it('should auto-commit only delivered messages on the configured interval', async () => {
      initFileProvider();
      const mock = initKafkaMock([createMessage('5', 'message')]);
      await sendHttp(`
KAFKA localhost:9092
kafka_topic: orders
kafka_auto_commit_interval: 100
kafka_timeout: 250
`);
      expect(mock.consumers[0].committed).toContain('5');
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
      expect(mock.adminCommits).toEqual([
        {
          groupId: 'test-group',
          topics: [{ name: 'orders', partitionOffsets: [{ partition: 0, offset: 7n }] }],
        },
      ]);
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
kafka_config_group.protocol: consumer
`);
      expect(mock.adminConfigs[0].groupProtocol).toBeUndefined();
      expect(mock.adminCommits).toEqual([
        {
          groupId: 'test-group',
          topics: [{ name: 'orders', partitionOffsets: [{ partition: 0, offset: 3n }] }],
        },
      ]);
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
