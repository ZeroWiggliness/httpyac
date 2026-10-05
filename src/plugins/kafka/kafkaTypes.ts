/**
 * Minimal structural typings of the KafkaJS compatible API of @confluentinc/kafka-javascript.
 * The library is an optional (native) dependency, so it must not be required for type checking.
 */
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
  topicName: string;
  partition: number;
  errorCode: number;
  offset?: string;
  timestamp?: string;
  baseOffset?: string;
}

export interface KafkaProducer {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(record: { topic: string; messages: Array<KafkaProducerMessage> }): Promise<Array<KafkaRecordMetadata>>;
}

export interface KafkaConsumedMessage {
  key: Buffer | null;
  value: Buffer | null;
  timestamp: string;
  offset: string;
  headers?: KafkaMessageHeaders;
}

export interface KafkaEachMessagePayload {
  topic: string;
  partition: number;
  message: KafkaConsumedMessage;
}

export interface KafkaTopicPartitionOffset {
  topic: string;
  partition: number;
  offset: string;
}

export interface KafkaConsumer {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(subscription: { topics: Array<string> }): Promise<void>;
  run(config: { eachMessage: (payload: KafkaEachMessagePayload) => Promise<void> }): Promise<void>;
  commitOffsets(topicPartitions?: Array<KafkaTopicPartitionOffset>): Promise<void>;
  seek(topicPartitionOffset: KafkaTopicPartitionOffset): void;
  pause(topics: Array<{ topic: string; partitions?: Array<number> }>): unknown;
}

export interface KafkaClient {
  producer(config?: Record<string, unknown>): KafkaProducer;
  consumer(config: Record<string, unknown>): KafkaConsumer;
}

export interface KafkaJSModule {
  Kafka: new (config: Record<string, unknown>) => KafkaClient;
}

export interface KafkaModule {
  KafkaJS: KafkaJSModule;
}

export interface KafkaSession {
  kafka: KafkaClient;
  producers: Map<string, Promise<KafkaProducer>>;
  consumers: Map<string, KafkaConsumer>;
}
