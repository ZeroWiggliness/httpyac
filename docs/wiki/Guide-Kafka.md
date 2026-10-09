> [!NOTE]
> **ZW edition:** Kafka protocol support is exclusive to the ZW edition and is not available in upstream httpyac. See [ZW edition differences](ZW-Edition-Differences).

HttpYac can produce and consume [Apache Kafka](https://kafka.apache.org/) messages, commit consumer group offsets, and seek a group to a specific offset. Kafka requests work with normal `.http` features such as [Variables](Guide-Variables), [Scripting](Guide-Scripting), [Assert](Guide-Assert), `# @name`, `# @ref`, and streaming output from [Meta data](Guide-MetaData).

- [Setup](#setup)
- [Request line](#request-line)
- [Methods](#methods)
- [Produce](#produce)
- [Consume](#consume)
- [Commit](#commit)
- [Seek](#seek)
- [Message headers](#message-headers)
- [Connection, authentication and SSL](#connection-authentication-and-ssl)
- [Header reference](#header-reference)
- [Responses](#responses)
- [Scripting](#scripting)
- [Limitations](#limitations)

## Setup

Kafka support is implemented with the optional native package `@confluentinc/kafka-javascript`, which wraps `librdkafka`. It is listed under `optionalDependencies` in `@zerowiggliness/httpyac`, so normal [Installation CLI](Installation-CLI) and [Docker](Installation-Docker) installs can succeed even when the native Kafka package cannot be loaded.

The optional package ships prebuilt binaries for these supported combinations:

- Linux glibc and musl, x64 and arm64
- macOS, x64 and arm64
- Windows, x64

If your platform or Node.js version is not covered, npm tries to build the package from source and needs a working native build toolchain. If loading fails, non-Kafka requests still run, but Kafka requests fail with a status `1` error response like:

```text
Kafka support requires the optional dependency @confluentinc/kafka-javascript, which could not be loaded (...). Install it with a Node.js version supported by its prebuilt binaries or with a native build toolchain.
```

## Request line

Use one of these request-line forms:

```http
KAFKA localhost:9092

###
KAFKA broker1:9092,broker2:9092

###
kafka://localhost:9092

###
kafkas://broker.example.com:9093
```

`KAFKA` is followed by a comma-separated list of bootstrap brokers. `kafka://` is the URL form for plain connections. `kafkas://` enables SSL for the connection.

Kafka-specific options are request headers whose names start with `kafka_`. Headers without that prefix are Kafka message headers; see [Message headers](#message-headers).

## Methods

Select the operation with the `kafka_method` header.

| Method | Alias | Description |
| --- | --- | --- |
| `produce` | `publish` | Send the request body to every topic in `kafka_topic`. |
| `consume` | `subscribe` | Subscribe to every topic in `kafka_topic` and stream received messages. |
| `commit` | | Commit offsets for a consumer group. |
| `seek` | | Move a consumer group to an offset. |

If `kafka_method` is omitted, httpyac uses `produce` when the request has a body and `consume` when it does not.

## Produce

```http
KAFKA localhost:9092
kafka_topic: orders
kafka_key: order-{{orderId}}
traceId: {{$uuid}}
content-type: application/json

{
  "id": {{orderId}},
  "state": "created"
}

?? status == 0
?? header kafka_topic == orders
```

- The request body is the Kafka message value. File request bodies such as `< ./message.json` work like other request bodies.
- `kafka_topic` is required. Repeat it or use a comma-separated value (`kafka_topic: orders, audit`) to produce to multiple topics. One response is emitted for each topic.
- `kafka_key`, `kafka_partition`, and `kafka_timestamp` set the message key, fixed partition, and timestamp.
- `kafka_acks` sets producer acknowledgements: `-1` for all in-sync replicas (default), `0`, or `1`.
- `kafka_compression` supports `none`, `gzip`, `snappy`, `lz4`, and `zstd`.

The produce response includes a JSON body with the delivery metadata:

```json
{
  "produced": true,
  "topic": "orders",
  "partition": 0,
  "offset": "42",
  "key": "order-1",
  "timestamp": "1750000000000",
  "headers": {
    "traceId": "0b0f0bd6-...",
    "content-type": "application/json"
  }
}
```

The same values are also exposed as response headers such as `kafka_topic`, `kafka_partition`, and `kafka_offset`.

## Consume

```http
KAFKA localhost:9092
kafka_topic: orders
kafka_group_id: httpyac-orders
kafka_from_beginning: true
kafka_max_messages: 1
kafka_timeout: 10000

?? header traceId exists
?? body state == created
```

Each consumed Kafka record becomes a response immediately. Message headers become response headers, and the message value becomes the response body. If a consumed message has a `content-type` header, httpyac uses it as the response content type, so JSON bodies can be asserted with normal [Assert](Guide-Assert) syntax.

### When consume finishes

A consume request keeps the consumer running until the first of these conditions happens:

| Setting | Behaviour |
| --- | --- |
| `kafka_max_messages: <n>` | Stop after `n` messages. The value must be a positive integer. |
| `kafka_timeout: <ms>` | Stop after the given number of milliseconds. The value must be a positive integer. |
| `# @keepStreaming` | Keep consuming until the request is cancelled, for example with `Ctrl+C`. |

If multiple stop conditions are set, the first one reached wins. Without `kafka_max_messages`, `kafka_timeout`, or `# @keepStreaming`, the request warns and finishes immediately. If `kafka_timeout` expires before any message arrives, the request returns a status `0` response with status message `no messages received`.

```http
# @keepStreaming
KAFKA localhost:9092
kafka_topic: orders
kafka_group_id: live-orders
```

### Consumer options

- `kafka_group_id` sets the consumer group. If it is omitted, httpyac creates a new group named `httpyac-<uuid>` for the request. With a fresh group and without `kafka_from_beginning`, Kafka only returns messages produced after subscription.
- `kafka_from_beginning: true` starts at the earliest offset when the group has no committed offset.
- `kafka_auto_commit` controls automatic commits and defaults to `true`.
- `kafka_auto_commit_interval` sets the auto-commit interval in milliseconds. The default is `5000`.
- `kafka_offset` seeks before consuming. Use it with `kafka_partition` when needed; the default partition is `0`.

When a consume request stops, httpyac pauses before disconnecting so messages fetched after the stop condition are not committed. With auto commit enabled, only returned messages are committed.

## Commit

`commit` commits offsets for a consumer group. `kafka_group_id` is required.

```http
KAFKA localhost:9092
kafka_method: commit
kafka_group_id: httpyac-orders
kafka_topic: orders
kafka_partition: 0
kafka_offset: 42
```

If a consume request for the same group is currently running on the same connection, httpyac commits with that active consumer. Without an explicit `kafka_offset`, it commits the offsets consumed so far.

If there is no active consumer, httpyac creates a short-lived consumer for the group and commits the explicit offsets. In that mode, `kafka_topic` and `kafka_offset` are required. Kafka rejects this kind of commit when the group has other active members.

`kafka_offset` is the offset of the next message that should be consumed.

## Seek

`seek` moves a consumer group to an offset. `kafka_group_id`, `kafka_topic`, and `kafka_offset` are required.

```http
KAFKA localhost:9092
kafka_method: seek
kafka_group_id: httpyac-orders
kafka_topic: orders
kafka_partition: 0
kafka_offset: 0
```

If a consume request for the same group is currently running on the same connection, httpyac calls `seek` on that active consumer and consuming continues from the new offset. Otherwise, httpyac commits the offset for the group and returns status message `committed`; the next consume request for that group starts there.

A replay workflow can reset a group and then consume from the reset position:

```http
# @name reset
KAFKA localhost:9092
kafka_method: seek
kafka_group_id: replay
kafka_topic: orders
kafka_offset: 0

###
# @ref reset
KAFKA localhost:9092
kafka_topic: orders
kafka_group_id: replay
kafka_max_messages: 10
kafka_timeout: 10000
```

## Message headers

### Setting message headers

Every request header that does not start with `kafka_` is sent as a Kafka message header. Variables and header variables are resolved as usual. Repeating a header sends multiple values for that key.

```http
KAFKA localhost:9092
kafka_topic: orders
traceId: {{$uuid}}
tenant: {{tenant}}
tag: new
tag: priority
content-type: application/json

{ "id": 1 }
```

HttpYac normally adds implicit `Accept: */*` and `User-Agent: httpyac` headers to requests. Kafka does not send those implicit headers as message headers. They are only sent if you declare them yourself in the request, through a header variable, or through `defaultHeaders` in [Configuration](Configuration).

### Reading message headers

Consumed response headers include all Kafka message headers decoded as UTF-8 strings. Multiple values for the same key become an array.

HttpYac also adds Kafka metadata headers with reserved `kafka_` names:

| Header | Description |
| --- | --- |
| `kafka_topic` | Topic of the message. |
| `kafka_partition` | Partition of the message. |
| `kafka_offset` | Offset of the message. |
| `kafka_key` | Message key decoded as UTF-8. |
| `kafka_timestamp` | Message timestamp in milliseconds. |
| `kafka_group_id` | Consumer group used by the consume request. |

Because metadata headers use the `kafka_` prefix, they do not collide with Kafka message headers sent by httpyac.

```http
# @name order
KAFKA localhost:9092
kafka_topic: orders
kafka_group_id: order-check
kafka_from_beginning: true
kafka_max_messages: 1
kafka_timeout: 10000

?? header traceId exists
?? header tenant == acme
?? header kafka_topic == orders

{{
  console.info(`traceId: ${response.headers.traceId}, offset: ${response.headers.kafka_offset}`);
}}

###
# @ref order
KAFKA localhost:9092
kafka_topic: orders-audit
traceId: {{orderResponse.headers.traceId}}

{{order}}
```

As with other named requests, `# @name order` stores the response body in `order` and the full response in `orderResponse`; see [Meta data](Guide-MetaData).

## Connection, authentication and SSL

```http
kafkas://broker.example.com:9093
kafka_topic: orders
kafka_client_id: my-client
kafka_sasl_mechanism: scram-sha-512
kafka_username: {{kafkaUser}}
kafka_password: {{kafkaPassword}}
kafka_config_ssl.ca.location: ./ca.pem
```

- `kafkas://` enables SSL. `kafka_ssl: true` does the same for `KAFKA` and `kafka://` request lines.
- `kafka_sasl_mechanism` supports `plain`, `scram-sha-256`, and `scram-sha-512`. If `kafka_username` is set without a mechanism, `plain` is used.
- `kafka_username` and `kafka_password` set SASL credentials.
- `kafka_client_id` sets the client id. The default is `httpyac`.
- `kafka_config_<property>` forwards arbitrary `librdkafka` configuration properties. For example: `kafka_config_ssl.ca.location`, `kafka_config_ssl.certificate.location`, `kafka_config_ssl.key.location`, `kafka_config_security.protocol`, or `kafka_config_debug`.
- `# @noRejectUnauthorized`, the `--insecure` CLI option, or `request.rejectUnauthorized: false` in [Configuration](Configuration) disables SSL certificate verification by setting `enable.ssl.certificate.verification` to `false`.
- The request timeout, from `--timeout` or the configured `request.timeout`, is used as the Kafka connection timeout.

Requests with the same Kafka request line share one connection while they run at the same time. The first request that opens the shared connection determines the connection settings for that connection.

## Header reference

| Header | Methods | Description |
| --- | --- | --- |
| `kafka_method` | all | `produce` / `publish`, `consume` / `subscribe`, `commit`, or `seek`. |
| `kafka_topic` | all | Topic names. Repeat the header or use a comma-separated list. |
| `kafka_client_id` | all | Kafka client id. Default: `httpyac`. |
| `kafka_ssl` | all | Enable SSL. Default: `false`, or `true` with `kafkas://`. |
| `kafka_sasl_mechanism` | all | `plain`, `scram-sha-256`, or `scram-sha-512`. |
| `kafka_username` / `kafka_password` | all | SASL credentials. |
| `kafka_config_<property>` | all | Forward a `librdkafka` configuration property. |
| `kafka_key` | produce | Message key. |
| `kafka_partition` | produce, consume, commit, seek | Partition. Produce uses the default partitioner if omitted; other methods default to `0` where a partition is needed. |
| `kafka_offset` | consume, commit, seek | Offset to seek to or commit. For commit and seek, this is the next message to consume. |
| `kafka_timestamp` | produce | Message timestamp in milliseconds. |
| `kafka_acks` | produce | `-1` (default), `0`, or `1`. |
| `kafka_compression` | produce | `none`, `gzip`, `snappy`, `lz4`, or `zstd`. |
| `kafka_group_id` | consume, commit, seek | Consumer group. Required for commit and seek. |
| `kafka_from_beginning` | consume | Start at the earliest offset when the group has no committed offset. |
| `kafka_auto_commit` | consume | Automatically commit returned messages. Default: `true`. |
| `kafka_auto_commit_interval` | consume | Auto-commit interval in milliseconds. Default: `5000`. |
| `kafka_max_messages` | consume | Stop after this many messages. Must be a positive integer. |
| `kafka_timeout` | consume | Stop after this many milliseconds. Must be a positive integer. |
| any non-`kafka_` header | produce | Kafka message header. |

## Responses

Kafka responses use protocol `KAFKA`.

- Successful produced and consumed messages have status code `0`.
- Successful commit and seek operations also have status code `0`.
- Runtime errors, unsupported methods, missing required headers, invalid positive-integer headers, and native dependency load failures are returned as status code `1`.
- A consume timeout with no messages is status code `0` with status message `no messages received`.

```http
?? status == 0
?? header kafka_offset exists
```

When a request emits multiple responses, for example producing to multiple topics or consuming several messages, httpyac merges them like other multi-response requests: the merged response keeps the headers of the first response and the body contains all responses.

Inline Kafka responses are parsed in this form:

```http
KAFKA 0 - consumed
content-type: application/json

{ "id": 1 }
```

Use `KAFKA 1 - <message>` for inline error examples.

## Scripting

The native Kafka package is available to scripts with `require('@confluentinc/kafka-javascript')`.

```http
{{
  const { Kafka } = require('@confluentinc/kafka-javascript').KafkaJS;
  const kafka = new Kafka({ kafkaJS: { brokers: ['localhost:9092'] } });
  const admin = kafka.admin();
  await admin.connect();
  exports.topics = await admin.listTopics();
  await admin.disconnect();
}}
```

While a Kafka request runs, `$requestClient.nativeClient` exposes the current Kafka session:

```js
{
  kafka,     // Kafka client
  producers, // Map of connected producers
  consumers  // Map of active consumers by group id
}
```

Use this for advanced flows from [Scripting](Guide-Scripting), such as admin calls that are not first-class Kafka request methods.

## Limitations

- Kafka support is available in the ZW edition CLI, Docker image, and Node.js library. Upstream editor integrations that bundle upstream httpyac do not support it unless they are rebuilt against `@zerowiggliness/httpyac`.
- Only messaging operations are first-class request methods. Topic administration, consumer group listing, and similar admin tasks should be done in [Scripting](Guide-Scripting).
- Message values and header values are decoded as UTF-8 strings. A consumed binary message is also available to scripts as `response.rawBody`.
- Consumers default to the `cooperative-sticky` partition assignor to avoid disconnect hangs after short subscriptions. Override it with `kafka_config_partition.assignment.strategy`. The default is not set when `kafka_config_group.protocol` is `consumer`.
