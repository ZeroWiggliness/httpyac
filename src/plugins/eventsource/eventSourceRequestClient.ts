import { EventSource, type FetchLike } from 'eventsource';
import * as http from 'http';
import * as https from 'https';
import { Readable } from 'stream';

import { log } from '../../io';
import * as models from '../../models';
import * as utils from '../../utils';
import { createProxyAgents } from '../http/gotUtils';
import { EventSourceRequest, isEventSourceRequest } from './eventSourceRequest';

const maxRedirects = 5;

export class EventSourceRequestClient extends models.AbstractRequestClient<EventSource | undefined> {
  private responseTemplate: Partial<models.HttpResponse> & { protocol: string } = {
    protocol: 'SSE',
  };

  constructor(private readonly request: models.Request) {
    super();
  }
  get reportMessage(): string {
    return `perform SSE Request (${this.request.url})`;
  }

  get supportsStreaming() {
    return true;
  }

  private _nativeClient: EventSource | undefined;
  get nativeClient(): EventSource | undefined {
    return this._nativeClient;
  }

  async connect(): Promise<EventSource | undefined> {
    if (isEventSourceRequest(this.request)) {
      this._nativeClient = new EventSource(this.request.url || '', { fetch: this.createFetch(this.request) });
      this.registerEvents(this._nativeClient, this.request);
    }
    return this._nativeClient;
  }

  async send(): Promise<void> {
    log.debug('SSE does not support send');
  }

  override disconnect(): void {
    this.nativeClient?.close();
    this.onDisconnect();
  }

  // eventsource v5 has no headers/proxy/TLS options, so they are applied through a custom fetch
  private createFetch(request: EventSourceRequest): FetchLike {
    const headers: Record<string, string> = { ...request.headers };
    utils.deleteHeader(headers, 'event');
    const agents = request.proxy ? createProxyAgents(request.proxy) : undefined;

    const doFetch = (url: string | URL, init: Parameters<FetchLike>[1], redirects: number): ReturnType<FetchLike> =>
      new Promise((resolve, reject) => {
        const target = new URL(url);
        const isHttps = target.protocol === 'https:';
        const req = (isHttps ? https : http).request(
          target,
          {
            headers: { ...headers, ...init.headers },
            agent: isHttps ? agents?.https : agents?.http,
            rejectUnauthorized: request.noRejectUnauthorized ? false : undefined,
            signal: init.signal,
          },
          res => {
            const location = res.headers.location;
            const status = res.statusCode || 0;
            if (location && [301, 302, 303, 307, 308].includes(status) && init.redirect === 'follow') {
              res.resume();
              if (redirects >= maxRedirects) {
                reject(new Error(`Too many redirects (${maxRedirects})`));
                return;
              }
              doFetch(new URL(location, target), init, redirects + 1).then(
                response => resolve({ ...response, redirected: true }),
                reject
              );
              return;
            }
            resolve({
              body: Readable.toWeb(res) as ReadableStream,
              url: target.href,
              status,
              redirected: false,
              headers: {
                get: name => {
                  const value = res.headers[name.toLowerCase()];
                  return Array.isArray(value) ? value.join(', ') : (value ?? null);
                },
              },
            });
          }
        );
        req.on('error', reject);
        req.end();
      });
    return (url, init) => doFetch(url, init, 0);
  }

  private registerEvents(client: EventSource, request: EventSourceRequest) {
    const events = utils.getHeaderArray(request.headers, 'event', ['data', 'message']);

    for (const event of events) {
      client.addEventListener(event, message => {
        this.onMessage('message', {
          ...this.responseTemplate,
          statusCode: 200,
          name: `EventSource (${this.request.url})`,
          request: this.request,
          body: message.data,
          rawBody: Buffer.from(message.data),
        });
      });
    }
    client.onerror = err => {
      this.onMessage('error', {
        ...this.responseTemplate,
        statusCode: 400,
        request: this.request,
        body: utils.errorToString(err),
      });
    };

    const metaDataEvents = ['open'];
    for (const event of metaDataEvents) {
      client.addEventListener(event, message => {
        this.onMetaData('open', {
          ...this.responseTemplate,
          statusCode: 200,
          message: message.data,
          body: {
            data: message.data,
            date: new Date(),
          },
        });
      });
    }
  }
}
