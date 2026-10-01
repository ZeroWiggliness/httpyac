Requests are the central unit in a `.http` or `.rest` file. A request region starts with optional variables, metadata or scripts, then a request line, headers, a body, and optional assertions or response examples. Regions are separated by `###`; streaming request bodies can also use `===` body separators where supported.

This page focuses on request syntax. For variables, metadata, scripts and assertions, see [Variables](Guide-Variables), [Meta data](Guide-MetaData), [Scripting](Guide-Scripting), and [Assert](Guide-Assert).

## Request regions

Use `###` to separate independent requests:

```http
### List users
GET https://example.org/users

### Create user
POST https://example.org/users
Content-Type: application/json

{ "name": "Ada" }
```

Text after `###` is a title for humans and editor tooling. Metadata such as `# @name` and variables can appear before the request line.

## HTTP

HTTP requests use an HTTP method followed by a URL and, optionally, an HTTP version:

```http
GET https://example.org/users HTTP/1.1
Accept: application/json
```

If the request line is only a URL, HttpYac sends a `GET`. If the URL is followed by `HTTP/2`, the request is sent with HTTP/2 support.

The parser recognizes these HTTP methods:

`GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`, `CONNECT`, `TRACE`, `PROPFIND`, `PROPPATCH`, `MKCOL`, `COPY`, `MOVE`, `LOCK`, `UNLOCK`, `CHECKOUT`, `CHECKIN`, `REPORT`, `MERGE`, `MKACTIVITY`, `MKWORKSPACE`, `VERSION-CONTROL`, `BASELINE-CONTROL`, `MKCALENDAR`, `ACL`, `SEARCH`, `QUERY`, and `GRAPHQL`.

`GRAPHQL` is accepted as a request-line method and is converted to a JSON `POST` GraphQL request. See [GraphQL](Guide-Request#graphql).

### QUERY

```http
QUERY https://example.org/contacts
Content-Type: application/json
Accept: application/json

{
  "where": {
    "city": "Berlin"
  },
  "select": ["name", "email"]
}
```

`QUERY` is intended for safe, idempotent queries whose request body describes what to retrieve. It comes from the IETF HTTP QUERY method draft and avoids overloading `GET` bodies or encoding large query descriptions into a URL.

> [!NOTE]
> **ZW edition:** adds the `QUERY` HTTP method to parsing, scripting types and completion. See [ZW edition differences](ZW-Edition-Differences).

### Query strings

Query strings can be written directly in the URL:

```http
GET https://example.org/search?q=httpyac&page=1
```

Variables can be used in any part of the URL:

```http
@term = httpyac

GET https://example.org/search?q={{term}}
```

### Headers

Headers use `Name: value` lines after the request line:

```http
GET https://example.org/users
Accept: application/json
Authorization: Bearer {{token}}
```

Header names are case-insensitive for normal HTTP behavior. Values can contain variables. Protocol-specific request options also use header syntax; those options are described in each protocol section.

### Cookies

Send cookies with the normal `Cookie` header:

```http
GET https://example.org/account
Cookie: session={{sessionId}}; theme=dark
```

When the cookie jar is enabled in configuration, HTTP responses can store `Set-Cookie` values and later requests to the same environment and host can reuse them. Use the cookie-related metadata in [Meta data](Guide-MetaData) when a request should opt out of the jar.

### Request bodies

Place the body after the headers:

```http
POST https://example.org/users
Content-Type: application/json

{
  "name": "Ada Lovelace"
}
```

For `application/x-www-form-urlencoded`, multiline bodies are joined into a single encoded form payload:

```http
POST https://example.org/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id={{clientId}}
&client_secret={{clientSecret}}
```

For `multipart/form-data`, write the multipart body with an explicit boundary:

```http
POST https://example.org/upload
Content-Type: multipart/form-data; boundary=HttpYacBoundary

--HttpYacBoundary
Content-Disposition: form-data; name="description"

monthly report
--HttpYacBoundary
Content-Disposition: form-data; name="file"; filename="report.json"
Content-Type: application/json

< ./report.json
--HttpYacBoundary--
```

File imports are body lines:

```http
POST https://example.org/import
Content-Type: application/json

< ./payload.json
```

```http
POST https://example.org/import
Content-Type: application/json

<@ ./payload-with-variables.json
```

- `< ./file` imports the file as a buffer without replacing variables.
- `<@ ./file` reads text and replaces variables inside the imported file.
- `<@utf8 ./file`, `<@base64 ./file`, and other Node buffer encodings select the text encoding used while reading the file.
- The path is resolved relative to the request file and can contain variables.

## GraphQL

GraphQL can be written as a normal `POST` request followed by a `query`, `mutation`, or imported `gql` block. HttpYac converts the GraphQL text and optional JSON variables into a JSON request body.

```http
POST https://example.org/graphql
Content-Type: application/json

query userById($id: ID!) {
  user(id: $id) {
    id
    name
  }
}

{
  "id": "42"
}
```

The `GRAPHQL` request-line method is a shortcut for a JSON `POST` and adds `Content-Type: application/json` when no content type is already set:

```http
GRAPHQL https://example.org/graphql

query viewer {
  viewer {
    login
  }
}
```

Fragments can be declared in earlier regions or earlier in the same file. If a request uses `...FragmentName`, the fragment is appended to the generated query:

```http
fragment UserParts on User {
  id
  name
}

###
POST https://example.org/graphql
Content-Type: application/json

query userById($id: ID!) {
  user(id: $id) {
    ...UserParts
  }
}

{ "id": "42" }
```

GraphQL can also be imported from a `.gql` file:

```http
POST https://example.org/graphql
Content-Type: application/json

gql userById < ./queries/userById.gql

{ "id": "42" }
```

> [!NOTE]
> **ZW edition:** includes an upstream GraphQL parser fix that has not been released on npm: anonymous operations written with a space, such as `query { ... }` or `mutation { ... }`, no longer treat `{` as the operation name. The same fix applies to `fragment` and `gql name < file` lines. See [ZW edition differences](ZW-Edition-Differences).

## gRPC

gRPC requests use `GRPC` or a `grpc://` URL. Import one or more protobuf files before the request:

```http
proto < ./hello.proto

###
GRPC localhost:50051/helloworld.Greeter/SayHello
Content-Type: application/json

{
  "name": "Ada"
}
```

The target format is:

```text
<server>/<service>/<method>
```

The server may be prefixed with `grpc://`, `http://`, or `https://`. A path segment before the service is supported for path-aware proxies:

```http
GRPC grpc://example.org/grpc/helloworld.Greeter/SayHello
```

`proto < ./file.proto` accepts proto-loader options as header-like lines below it:

```http
proto < ./hello.proto
keepCase: true
longs: String
enums: String
```

Reflection can be enabled with gRPC metadata; see [Meta data](Guide-MetaData).

Request headers become gRPC metadata. Headers beginning with `grpc.` become gRPC channel options and are removed from metadata. `channelcredentials: ssl` uses TLS credentials, and `channelcredentials: insecure` uses insecure credentials.

```http
GRPC localhost:50051/helloworld.Greeter/SayHello
channelcredentials: insecure
authorization: Bearer {{token}}
grpc.max_receive_message_length: 4194304

{ "name": "Ada" }
```

Unary, server streaming, client streaming, and bidirectional streaming methods are supported according to the imported proto definition. For client or bidirectional streams, split frames with `===`; `=== wait-for-server` waits for incoming messages before sending the next frame.

```http
GRPC localhost:50051/chat.Chat/Stream
Content-Type: application/json

{ "text": "first" }
===
{ "text": "second" }
===
```

## WebSocket

WebSocket requests use `WS`, `WSS`, `WEBSOCKET`, or a `ws://` / `wss://` URL:

```http
WS wss://echo.websocket.events

hello
```

Headers are passed to the WebSocket handshake:

```http
WSS wss://example.org/socket
Authorization: Bearer {{token}}

{"type":"ping"}
```

Use `===` body separators to send multiple frames. `=== wait-for-server` waits for received messages before continuing.

```http
WS ws://localhost:8080/chat

{"text":"hello"}
===
{"text":"still there?"}
=== wait-for-server
{"text":"thanks"}
```

The WebSocket client honors common metadata and config such as proxy, redirects and `# @noRejectUnauthorized`; see [Meta data](Guide-MetaData).

## Server-Sent Events

SSE requests use `SSE` or `EVENTSOURCE`:

```http
SSE https://example.org/events
Accept: text/event-stream
event: message
event: update
```

The `event` header selects which event names to listen to. When omitted, HttpYac listens for `data` and `message`. Other headers are sent with the request.

> [!NOTE]
> **ZW edition:** reimplements SSE on `eventsource` v5 with a custom fetch: request headers are sent, `http://`, `https://`, and `socks://` proxies are supported, `# @noRejectUnauthorized` is honoured, redirects are followed up to 5 times, and each message response has status code `200`. See [ZW edition differences](ZW-Edition-Differences).

## MQTT

MQTT requests use `MQTT`, `MQTTS`, `mqtt://`, or `mqtts://`:

```http
MQTT mqtt://localhost:1883
topic: sensors/temperature
qos: 1

{"value": 21.5}
```

Headers control publish and subscribe behavior:

| Header | Description |
| --- | --- |
| `topic` | Topic used for both publish and subscribe. Repeat it or use comma-separated values for multiple topics. |
| `publish` | Topic used only for publishing. |
| `subscribe` | Topic used only for subscribing. |
| `qos` | MQTT QoS for publish or subscribe. |
| `retain` | Publish with the retain flag when present. |

If a body is present, HttpYac publishes it to `topic` and `publish` topics. If subscribe topics are present, it subscribes and streams received messages. Headers other than `topic`, `publish`, `subscribe`, `qos`, and `retain` are passed into the MQTT client options, together with request metadata and config.

```http
MQTT mqtt://localhost:1883
subscribe: sensors/#
qos: 0
```

## AMQP and RabbitMQ

AMQP requests use `AMQP` or an `amqp://` / `amqps://` URL:

```http
AMQP amqp://localhost:5672
amqp_exchange: events
amqp_routing_key: users.created
content-type: application/json

{ "id": 42 }
```

If `amqp_method` is omitted, HttpYac uses `publish` when the request has a body and `consume` when it does not. Supported methods are `publish`, `consume`, `subscribe`, `ack`, `nack`, `cancel`, `purge`, `declare`, `bind`, `unbind`, and `delete`.

> [!NOTE]
> **ZW edition:** AMQP works again because upstream updated `@cloudamqp/amqp-client` to v3.4.1; the ZW edition has since moved to v4 while keeping the restored behavior. See [ZW edition differences](ZW-Edition-Differences).

### AMQP common headers

| Header | Description |
| --- | --- |
| `amqp_channel_id` | Reuse or select a channel id. |
| `amqp_method` | Operation to execute. |
| `amqp_queue` | Queue name. Can be repeated or comma-separated. |
| `amqp_exchange` | Exchange name. Can be repeated or comma-separated. |
| `amqp_routing_key` | Routing key for publish, bind, or unbind. |

Headers that do not start with `amqp_` are passed as AMQP message or operation arguments where the method supports them.

### AMQP publish

Publish sends the request body to every queue or exchange named by headers:

```http
AMQP amqp://localhost
amqp_exchange: events
amqp_routing_key: users.created
amqp_content_type: application/json
traceId: {{$uuid}}

{ "id": 42 }
```

Useful publish headers include `amqp_mandatory`, `amqp_correlation_id`, `amqp_content_type`, `amqp_content_encoding`, `amqp_delivery_mode`, `amqp_expiration`, `amqp_message_id`, `amqp_priority`, `amqp_replyTo`, `amqp_type`, and `amqp_user_id`.

### AMQP consume, ack and cancel

Consume streams queue messages:

```http
AMQP amqp://localhost
amqp_method: consume
amqp_queue: events
amqp_no_ack: false
amqp_exclusive: false
```

Consumed messages are not acknowledged automatically unless `amqp_no_ack` is true. Use the delivery tag and channel id from the consumed response:

```http
AMQP amqp://localhost
amqp_method: ack
amqp_channel_id: 1
amqp_tag: 12
amqp_multiple: true
```

`nack` also accepts `amqp_requeue` and `amqp_multiple`. `cancel` uses `amqp_tag` as the consumer tag.

### AMQP declare, bind, purge and delete

Declare queues or exchanges:

```http
AMQP amqp://localhost
amqp_method: declare
amqp_queue: events
amqp_durable: true
amqp_auto_delete: false
```

`amqp_type` selects an exchange type for exchange declarations; the default is `direct`. `amqp_passive`, `amqp_durable`, `amqp_auto_delete`, `amqp_internal`, and `amqp_exclusive` configure declarations.

Bind or unbind queues or exchanges:

```http
AMQP amqp://localhost
amqp_method: bind
amqp_exchange: events
amqp_queue: events.audit
amqp_routing_key: users.*
```

Use `amqp_exchange_destination` to bind or unbind one exchange to another. `purge` removes all messages from `amqp_queue`. `delete` deletes queues or exchanges and supports `amqp_if_unused` and `amqp_if_empty`.

## Kafka

Kafka requests use `KAFKA`, `kafka://`, or `kafkas://` and can produce, consume, commit offsets, and seek consumer groups.

```http
KAFKA localhost:9092
kafka_topic: orders
content-type: application/json

{ "id": 42 }
```

> [!NOTE]
> **ZW edition:** Kafka is a new protocol in this fork. See [ZW edition differences](ZW-Edition-Differences).

For full syntax, setup requirements and header reference, see [Kafka](Guide-Kafka).
