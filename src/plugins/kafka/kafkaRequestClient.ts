import { log } from '../../io';
import * as models from '../../models';
import * as utils from '../../utils';
import { kafkaClientProvider } from './kafkaClientProvider';
import * as kafkaMethods from './kafkaMethods';
import * as constants from './kafkaMethods/kafkaConstants';
import { isKafkaRequest, KafkaRequest } from './kafkaRequest';
import { KafkaSession } from './kafkaTypes';

type KafkaMethod = (context: kafkaMethods.KafkaMethodContext) => Promise<kafkaMethods.KafkaMethodResult>;

const methods: Record<constants.KafkaMethodName, KafkaMethod> = {
  produce: kafkaMethods.produce,
  consume: kafkaMethods.consume,
  commit: kafkaMethods.commit,
  seek: kafkaMethods.seek,
};

export class KafkaRequestClient extends models.AbstractRequestClient<KafkaSession | undefined> {
  private methodResult: kafkaMethods.KafkaMethodResult | undefined;
  private disconnected = false;

  constructor(
    private readonly request: models.Request,
    private readonly context: models.ProcessorContext
  ) {
    super();
  }

  get reportMessage(): string {
    return `perform Kafka Request (${this.request.url})`;
  }

  get supportsStreaming() {
    return true;
  }

  public getSessionId() {
    return utils.replaceInvalidChars(this.request.url);
  }

  private _nativeClient: KafkaSession | undefined;
  get nativeClient(): KafkaSession | undefined {
    return this._nativeClient;
  }

  async connect(obj: KafkaSession | undefined): Promise<KafkaSession | undefined> {
    if (isKafkaRequest(this.request)) {
      this._nativeClient = obj || createKafkaSession(this.request, this.context);
      const methodResult = await this.executeKafkaMethod(
        this.request,
        () => methods[constants.getKafkaMethod(this.request as KafkaRequest)]
      );
      if (this.disconnected) {
        // cancelled while the method was starting
        await methodResult?.stop?.();
      } else {
        this.methodResult = methodResult;
      }
      return this._nativeClient;
    }
    return undefined;
  }

  async send(body?: unknown): Promise<void> {
    if (isKafkaRequest(this.request) && this._nativeClient && body) {
      await this.executeKafkaMethod(
        {
          ...this.request,
          body: utils.toBufferLike(body),
        },
        () => methods.produce
      );
    }
    if (this.methodResult?.completed) {
      await this.methodResult.completed;
      // ends a pending # @keepStreaming
      this.onDisconnect();
    }
  }

  private async executeKafkaMethod(request: KafkaRequest, getMethod: () => KafkaMethod) {
    if (this._nativeClient) {
      try {
        const method = getMethod();
        return await method({
          session: this._nativeClient,
          request,
          context: this.context,
          onMessage: (type, msg) => this.onMessage(type, msg),
        });
      } catch (err) {
        log.debug('kafka error', err);
        this.onMessage('error', kafkaMethods.errorToHttpResponse(err, request));
      }
    }
    return undefined;
  }

  override disconnect(err?: Error): void {
    if (err) {
      log.debug('kafka disconnect', err);
    }
    this.disconnected = true;
    const session = this._nativeClient;
    const stop = this.methodResult?.stop;
    this.methodResult = undefined;
    (async () => {
      await stop?.();
      if (session) {
        await kafkaMethods.disconnectSession(session);
      }
    })().catch(err => log.debug('kafka disconnect failed', err));
    this.onDisconnect();
  }
}

export function parseBrokers(url: string): Array<string> {
  return url
    .replace(/^\s*kafkas?:\/\//iu, '')
    .split(',')
    .map(obj => obj.trim().replace(/\/.*$/u, ''))
    .filter(obj => !!obj);
}

export function getKafkaConfig(request: KafkaRequest, context: models.ProcessorContext): Record<string, unknown> {
  const headers = request.headers;
  const kafkaJS: Record<string, unknown> = {
    brokers: parseBrokers(request.url),
    clientId: utils.getHeaderString(headers, constants.KafkaClientId) || 'httpyac',
    ssl: /^\s*kafkas:\/\//iu.test(request.url) || utils.getHeaderBoolean(headers, constants.KafkaSsl, false),
    logger: createLogger(),
  };

  const username = utils.getHeaderString(headers, constants.KafkaUsername);
  const password = utils.getHeaderString(headers, constants.KafkaPassword);
  const mechanism = utils.getHeaderString(headers, constants.KafkaSaslMechanism)?.trim().toLowerCase();
  if (mechanism || username) {
    kafkaJS.sasl = {
      mechanism: mechanism || 'plain',
      username,
      password,
    };
  }
  const timeout = request.timeout || utils.toNumber(context.config?.request?.timeout);
  if (timeout) {
    kafkaJS.connectionTimeout = timeout;
  }

  const config: Record<string, unknown> = {};
  if (
    request.noRejectUnauthorized ||
    (!utils.isUndefined(context.config?.request?.rejectUnauthorized) &&
      !utils.toBoolean(context.config?.request?.rejectUnauthorized, true))
  ) {
    config['enable.ssl.certificate.verification'] = false;
  }
  for (const [key, value] of Object.entries(headers || {})) {
    if (key.toLowerCase().startsWith(constants.KafkaConfigPrefix) && !utils.isUndefined(value)) {
      config[key.slice(constants.KafkaConfigPrefix.length)] = Array.isArray(value) ? value.join(',') : value;
    }
  }
  return {
    ...config,
    kafkaJS,
  };
}

function createKafkaSession(request: KafkaRequest, context: models.ProcessorContext): KafkaSession {
  const { Kafka } = kafkaClientProvider.load().KafkaJS;
  return {
    kafka: new Kafka(getKafkaConfig(request, context)),
    producers: new Map(),
    consumers: new Map(),
  };
}

function createLogger() {
  const logger = {
    info: (message: string, extra?: object) => log.debug(message, extra || ''),
    debug: (message: string, extra?: object) => log.trace(message, extra || ''),
    warn: (message: string, extra?: object) => log.warn(message, extra || ''),
    error: (message: string, extra?: object) => {
      if (message?.includes?.(constants.ConsumeStoppedMessage)) {
        log.trace(message, extra || '');
      } else {
        log.error(message, extra || '');
      }
    },
    namespace: () => logger,
    setLogLevel: () => undefined,
  };
  return logger;
}
