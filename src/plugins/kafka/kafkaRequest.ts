import { Request } from '../../models';

export interface KafkaRequest extends Request<string> {
  headers?: Record<string, string | string[] | undefined> | undefined;
  body?: string | Buffer;
  /**
   * lower case names of the headers written in the http file (used to ignore default headers added by httpyac)
   */
  declaredHeaders?: Array<string>;
}

export function isKafkaRequest(request: Request | undefined): request is KafkaRequest {
  return request?.protocol === 'KAFKA';
}
