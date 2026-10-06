/** Minimal structural typings for the optional @platformatic/kafka dependency. */
export type KafkaHeaderValue = Buffer | string | Array<Buffer | string> | undefined;

export interface KafkaMessageHeaders {
  [key: string]: KafkaHeaderValue;
}

export interface KafkaProducerMessage {
  key?: Buffer | string | null;
  value: Buffer | string | null;
  partition?: number;
  headers?: KafkaMessageHeaders;
  timestamp?: string;
}

export interface KafkaRecordMetadata {
  topic: string;
  partition: number;
  offset: bigint;
}

export interface KafkaPlatformaticMessage {
  topic: string;
  key?: Buffer | null;
  value: Buffer | null;
  partition?: number;
  timestamp?: bigint;
  headers?: Map<Buffer, Buffer>;
}

export interface KafkaProducer {
  close(): Promise<void>;
  send(options: {
    messages: Array<KafkaPlatformaticMessage>;
    acks?: number;
    compression?: string;
  }): Promise<{ offsets?: Array<KafkaRecordMetadata> }>;
}

export interface KafkaConsumedMessage {
  topic: string;
  partition: number;
  key: Buffer | null;
  value: Buffer | null;
  timestamp: bigint;
  offset: bigint;
  leaderEpoch: number;
  headerEntries: Array<[Buffer | null, Buffer | null]>;
  commit(): Promise<void>;
}

export interface KafkaEachMessagePayload {
  topic: string;
  partition: number;
  message: KafkaConsumedMessage;
}

export interface KafkaMessageStream extends AsyncIterable<KafkaConsumedMessage> {
  pause(): this;
  close(): Promise<void>;
}

export interface KafkaTopicPartitionOffset {
  topic: string;
  partition: number;
  offset: string;
}

export interface KafkaConsumer {
  consume(options: Record<string, unknown>): Promise<KafkaMessageStream>;
  commit(options: {
    offsets: Array<{ topic: string; partition: number; offset: bigint; leaderEpoch: number }>;
  }): Promise<void>;
  close(force?: boolean): Promise<void>;
}

export interface KafkaAdmin {
  alterConsumerGroupOffsets(options: {
    groupId: string;
    topics: Array<{ name: string; partitionOffsets: Array<{ partition: number; offset: bigint }> }>;
  }): Promise<void>;
  close(): Promise<void>;
}

export interface KafkaModule {
  Producer: new (config: Record<string, unknown>) => KafkaProducer;
  Consumer: new (config: Record<string, unknown>) => KafkaConsumer;
  Admin: new (config: Record<string, unknown>) => KafkaAdmin;
  cooperativeStickyAssigner?: unknown;
  roundRobinAssigner?: unknown;
}

export interface KafkaActiveConsumer {
  consumer: KafkaConsumer;
  stream: KafkaMessageStream;
  topics: Array<string>;
  latestMessages: Map<string, KafkaConsumedMessage>;
  seek(offsets: Array<KafkaTopicPartitionOffset>): Promise<void>;
  stop(): Promise<void>;
}

export interface KafkaSession {
  kafka: KafkaModule;
  config: Record<string, unknown>;
  producers: Map<string, Promise<KafkaProducer>>;
  consumers: Map<string, KafkaActiveConsumer>;
}
