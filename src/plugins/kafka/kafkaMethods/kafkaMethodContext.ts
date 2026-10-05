import { HttpResponse, ProcessorContext, StreamResponse } from '../../../models';
import { KafkaRequest } from '../kafkaRequest';
import { KafkaSession } from '../kafkaTypes';

export interface KafkaMethodContext {
  session: KafkaSession;
  request: KafkaRequest;
  context: ProcessorContext;
  onMessage(type: string, message: HttpResponse & StreamResponse): void;
}

export interface KafkaMethodResult {
  /**
   * resolved if the method has finished (e.g. consume reached max messages or timeout)
   */
  completed?: Promise<void>;
  /**
   * stops the method (e.g. disconnects the consumer)
   */
  stop?: () => Promise<void>;
}
