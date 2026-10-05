import { Request } from '../../models';

export interface KafkaRequest extends Request<string> {
  headers?: Record<string, string | string[] | undefined> | undefined;
  body?: string | Buffer;
  /**
   * lower case names of the headers set before httpyac adds its implicit default headers (Accept, User-Agent)
   */
  declaredHeaders?: Array<string>;
}

export function isKafkaRequest(request: Request | undefined): request is KafkaRequest {
  return request?.protocol === 'KAFKA';
}
