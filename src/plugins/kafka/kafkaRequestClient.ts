import { log } from '../../io';
import * as models from '../../models';
import * as utils from '../../utils';
import * as fs from 'node:fs';
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
  const config: Record<string, unknown> = {
    bootstrapBrokers: parseBrokers(request.url),
    clientId: utils.getHeaderString(headers, constants.KafkaClientId) || 'httpyac',
  };
  let useTls = /^\s*kafkas:\/\//iu.test(request.url) || utils.getHeaderBoolean(headers, constants.KafkaSsl, false);

  const username = utils.getHeaderString(headers, constants.KafkaUsername);
  const password = utils.getHeaderString(headers, constants.KafkaPassword);
  const mechanism = utils.getHeaderString(headers, constants.KafkaSaslMechanism)?.trim().toLowerCase();
  if (mechanism || username) {
    config.sasl = {
      mechanism: toPlatformaticSaslMechanism(mechanism || 'plain'),
      username,
      password,
    };
  }
  const timeout = request.timeout || utils.toNumber(context.config?.request?.timeout);
  if (timeout) {
    config.connectTimeout = timeout;
  }

  const rejectUnauthorized =
    request.noRejectUnauthorized ||
    (!utils.isUndefined(context.config?.request?.rejectUnauthorized) &&
      !utils.toBoolean(context.config?.request?.rejectUnauthorized, true));
  const tls: Record<string, unknown> = {};
  const unsupportedConfig: Array<string> = [];
  for (const [key, value] of Object.entries(headers || {})) {
    if (!key.toLowerCase().startsWith(constants.KafkaConfigPrefix) || utils.isUndefined(value)) {
      continue;
    }
    const configKey = key.slice(constants.KafkaConfigPrefix.length).toLowerCase();
    const configValue = (Array.isArray(value) ? value.join(',') : utils.toString(value)) ?? '';
    switch (configKey) {
      case 'security.protocol':
        useTls = /(?:^|_)ssl$/iu.test(configValue);
        break;
      case 'sasl.mechanism':
        config.sasl = {
          ...(config.sasl as Record<string, unknown> | undefined),
          mechanism: toPlatformaticSaslMechanism(configValue.toLowerCase()),
        };
        break;
      case 'sasl.username':
        config.sasl = { ...(config.sasl as Record<string, unknown> | undefined), username: configValue };
        break;
      case 'sasl.password':
        config.sasl = { ...(config.sasl as Record<string, unknown> | undefined), password: configValue };
        break;
      case 'ssl.ca.location':
        tls.ca = fs.readFileSync(configValue);
        useTls = true;
        break;
      case 'ssl.certificate.location':
        tls.cert = fs.readFileSync(configValue);
        useTls = true;
        break;
      case 'ssl.key.location':
        tls.key = fs.readFileSync(configValue);
        useTls = true;
        break;
      case 'ssl.key.password':
        tls.passphrase = configValue;
        break;
      case 'ssl.endpoint.identification.algorithm':
        if (!configValue || configValue.toLowerCase() === 'none') {
          tls.rejectUnauthorized = false;
        } else {
          unsupportedConfig.push(key);
        }
        break;
      case 'group.protocol':
        config.groupProtocol = configValue.toLowerCase();
        break;
      case 'partition.assignment.strategy':
        config.partitionAssignmentStrategy = configValue.toLowerCase();
        break;
      default:
        unsupportedConfig.push(key);
    }
  }
  if (unsupportedConfig.length > 0) {
    throw new Error(
      `Unsupported ${constants.KafkaConfigPrefix} setting(s) for @platformatic/kafka: ${unsupportedConfig.join(', ')}`
    );
  }
  if (useTls && rejectUnauthorized) {
    tls.rejectUnauthorized = false;
  }
  if (useTls || Object.keys(tls).length > 0) {
    config.tls = tls;
  }
  return config;
}

function createKafkaSession(request: KafkaRequest, context: models.ProcessorContext): KafkaSession {
  const kafka = kafkaClientProvider.load();
  return {
    kafka,
    config: getKafkaConfig(request, context),
    producers: new Map(),
    consumers: new Map(),
  };
}

function toPlatformaticSaslMechanism(mechanism: string): string {
  switch (mechanism) {
    case 'plain':
      return 'PLAIN';
    case 'scram-sha-256':
      return 'SCRAM-SHA-256';
    case 'scram-sha-512':
      return 'SCRAM-SHA-512';
    default:
      throw new Error(`Unsupported Kafka SASL mechanism: ${mechanism}`);
  }
}
