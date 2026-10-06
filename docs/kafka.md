# Kafka

httpyac can produce and consume [Apache Kafka](https://kafka.apache.org/) messages and manage consumer group offsets. Kafka requests support the same features as other requests: variables, scripts, assertions (`??`), `# @name`, `# @ref` and streaming output.

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

Kafka support uses [`@platformatic/kafka`](https://github.com/platformatic/kafka), a JavaScript Kafka client with no native Kafka addon. It is an **optional dependency** of httpyac and works on Windows with Node.js 24.6 or newer. If the package is unavailable, httpyac still installs and works; Kafka requests report that the optional dependency could not be loaded.

## Request line

A Kafka request starts with `KAFKA` followed by a comma separated list of bootstrap brokers, or with a `kafka://` / `kafkas://` URL. `kafkas://` enables SSL.

```http
KAFKA localhost:9092

###
KAFKA broker1:9092,broker2:9092

###
kafka://localhost:9092

###
kafkas://broker.example.com:9093
```

All other request settings are headers with the prefix `kafka_`. Every header **without** the `kafka_` prefix is sent as a [Kafka message header](#message-headers).

## Methods

The method is selected with the header `kafka_method`:

| Method | Alias | Description |
| --- | --- | --- |
| `produce` | `publish` | send the request body as message to all topics in `kafka_topic` |
| `consume` | `subscribe` | subscribe to all topics in `kafka_topic` and stream the received messages |
| `commit` | | commit offsets of a consumer group |
| `seek` | | move a consumer group to an offset |

If `kafka_method` is not set, `produce` is used if the request has a body, otherwise `consume`.

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

- The body is sent as message value. Use `< ./message.json` to send a file.
- Multiple topics can be set by repeating the header `kafka_topic` or with a comma separated list (`kafka_topic: orders, audit`). One response is returned per topic.
- `kafka_key`, `kafka_partition` and `kafka_timestamp` set the message key, a fixed partition and the message timestamp (in ms).
- `kafka_acks` (`-1` = all in-sync replicas (default), `0`, `1`) and `kafka_compression` (`none`, `gzip`, `snappy`, `lz4`, `zstd`) configure the producer.

The response contains the topic, partition and offset of the produced message:

```json
{
  "produced": true,
  "topic": "orders",
  "partition": 0,
  "offset": "42",
  "key": "order-1",
  "headers": {
    "traceId": "0b0f0bd6-...",
    "content-type": "application/json"
  }
}
```

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

Each received message is written to the output as soon as it arrives and is also a response of the request (see [Responses](#responses)).

### When does consume finish?

A consume request keeps the consumer running until one of these happens:

| Setting | Behaviour |
| --- | --- |
| `kafka_max_messages: <n>` | stops after `n` messages (positive integer) |
| `kafka_timeout: <ms>` | stops after the given time (positive integer), also if no message was received |
| `# @keepStreaming` | keeps consuming until the request is cancelled (e.g. in VS Code or with `Ctrl+C`) |

If more than one is set, whichever happens first stops consuming. Without any of these the request finishes immediately and a warning is logged.
If `kafka_timeout` expires without any message, the request returns a response with status message `no messages received`.

```http
# @keepStreaming
KAFKA localhost:9092
kafka_topic: orders
```

### Consumer options

- `kafka_group_id`: the consumer group. Default: a new group `httpyac-<uuid>` for every request, so without `kafka_from_beginning` only messages produced after the subscription are received.
- `kafka_from_beginning`: start at the earliest offset if the group has no committed offset (default `false`).
- `kafka_auto_commit` (default `true`) and `kafka_auto_commit_interval` (ms, default `5000`): commit delivered message offsets automatically. The interval must be at least `100` ms. Offsets are also committed when the consumer disconnects. Messages fetched by the client but not returned before `kafka_max_messages` or `kafka_timeout` are not committed, so the next consume of the group continues right after the last returned message.
- `kafka_offset` (with optional `kafka_partition`, default `0`): seek to this offset before consuming.

## Commit

Commits offsets of a consumer group.

```http
KAFKA localhost:9092
kafka_method: commit
kafka_group_id: httpyac-orders
kafka_topic: orders
kafka_partition: 0
kafka_offset: 42
```

- If a consume request of the same group is currently running on the same connection (e.g. `# @keepStreaming` in VS Code), the offsets are committed with that consumer. Without `kafka_offset` it commits the offsets consumed so far.
- Otherwise httpyac creates a short-lived consumer of the group to commit the explicit offset. This requires `kafka_topic` and `kafka_offset`. The group must not have other active members; Kafka rejects offset commits of groups with active members.

`kafka_offset` is the offset of the **next** message to consume.

## Seek

Moves a consumer group to an offset.

```http
KAFKA localhost:9092
kafka_method: seek
kafka_group_id: httpyac-orders
kafka_topic: orders
kafka_partition: 0
kafka_offset: 0
```

- If a consume request of the group is currently running on the same connection, its consumer seeks to the offset and continues consuming from there.
- Otherwise the offset is committed for the group (status message `committed`), so the next consume request of the group starts at this offset. This works like resetting the offsets of an inactive consumer group.

A typical replay workflow:

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

Every request header that does **not** start with `kafka_` is sent as a Kafka message header. Variables are replaced as usual. Repeating a header sends multiple values for the same header key.

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

httpyac adds `Accept: */*` and `User-Agent: httpyac` to every request, but these implicit headers are not sent to Kafka. `Accept` and `User-Agent` are only sent if you set them yourself: in the request, with a header variable (`...headers`), or with `defaultHeaders` in the httpyac configuration. All headers from header variables and `defaultHeaders` are sent like request headers.

### Reading message headers

Each consumed message becomes a response. Its headers contain:

- all **Kafka message headers** of the message, decoded as UTF-8 strings (multiple values for the same key become an array)
- the message **metadata** with the reserved `kafka_` names:

| Header | Description |
| --- | --- |
| `kafka_topic` | topic of the message |
| `kafka_partition` | partition of the message |
| `kafka_offset` | offset of the message |
| `kafka_key` | message key (UTF-8) |
| `kafka_timestamp` | message timestamp in ms |
| `kafka_group_id` | consumer group |

Because the metadata always uses the `kafka_` prefix, it never collides with message headers set by httpyac.

If a message has a `content-type` header, it is used as the content type of the response. JSON messages are then pretty-printed and can be used in `?? body` assertions and scripts.

Message headers can be used like HTTP response headers:

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
# forward the traceId of the consumed message
KAFKA localhost:9092
kafka_topic: orders-audit
traceId: {{orderResponse.headers.traceId}}

{{order}}
```

As with other requests, `# @name order` stores the body in the variable `order` and the whole response, headers included, in `orderResponse`.

The produce response has the headers that were sent plus `kafka_topic`, `kafka_partition`, `kafka_offset`, `kafka_key` and `kafka_timestamp`.

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

- `kafka_ssl: true` enables SSL (same as `kafkas://`).
- `kafka_sasl_mechanism`: `plain`, `scram-sha-256` or `scram-sha-512`. If only `kafka_username` is set, `plain` is used.
- `kafka_client_id`: client id (default `httpyac`).
- `kafka_config_<property>`: supported connection settings for compatibility with existing requests: `ssl.ca.location`, `ssl.certificate.location`, `ssl.key.location`, `ssl.key.password`, `ssl.endpoint.identification.algorithm: none`, `security.protocol`, `sasl.mechanism`, `sasl.username`, `sasl.password`, `group.protocol` and `partition.assignment.strategy`. TLS file locations are read as PEM files. Other librdkafka-specific settings are not supported and cause a clear error.
- `# @noRejectUnauthorized` or the CLI option `--insecure` turn off SSL certificate verification.
- The request timeout (`--timeout` or the `timeout` setting) is used as connection timeout.

Requests with the same request line share one connection while they run at the same time. The connection settings of the first request are used for the whole connection.

## Header reference

| Header | Methods | Description |
| --- | --- | --- |
| `kafka_method` | all | `produce` / `publish`, `consume` / `subscribe`, `commit`, `seek` |
| `kafka_topic` | all | topic(s); repeat the header or use a comma separated list |
| `kafka_client_id` | all | client id (default `httpyac`) |
| `kafka_ssl` | all | enable SSL (default `false`, `true` for `kafkas://`) |
| `kafka_sasl_mechanism` | all | `plain`, `scram-sha-256`, `scram-sha-512` |
| `kafka_username` / `kafka_password` | all | SASL credentials |
| `kafka_config_<property>` | all | supported TLS, SASL and consumer-group settings listed above |
| `kafka_key` | produce | message key |
| `kafka_partition` | produce, consume, commit, seek | partition (produce: default partitioner; others: default `0`) |
| `kafka_timestamp` | produce | message timestamp in ms |
| `kafka_acks` | produce | `-1` (default), `0`, `1` |
| `kafka_compression` | produce | `none`, `gzip`, `snappy`, `lz4`, `zstd` |
| `kafka_group_id` | consume, commit, seek | consumer group (required for commit and seek) |
| `kafka_from_beginning` | consume | start at the earliest offset without committed offset |
| `kafka_auto_commit` | consume | auto commit consumed offsets (default `true`) |
| `kafka_auto_commit_interval` | consume | auto commit interval in ms (default `5000`) |
| `kafka_max_messages` | consume | stop after this number of messages |
| `kafka_timeout` | consume | stop after this time in ms |
| `kafka_offset` | consume, commit, seek | offset to seek to or to commit |
| any other header | produce | Kafka message header |

## Responses

Every produced or consumed message is a response with `protocol` `KAFKA` and status code `0`. Errors (e.g. a broker that can't be reached, a missing `kafka_group_id`, an invalid `kafka_max_messages` or an unsupported method) are responses with status code `1`, and the error message is the status message:

```http
?? status == 0
```

If a request receives more than one response (e.g. `kafka_max_messages: 5`), the responses are merged: the headers are those of the first message, and the body contains all responses.

Responses can be written into the http file as inline responses using the format `KAFKA 0 - <status message>`.

## Scripting

The client library is available in scripts with `require('@platformatic/kafka')`:

```http
{{
  const { Producer } = require('@platformatic/kafka');
  const producer = new Producer({
    clientId: 'httpyac-script',
    bootstrapBrokers: ['localhost:9092'],
  });
  await producer.send({ messages: [{ topic: 'orders', value: Buffer.from('hello') }] });
  await producer.close();
}}
```

While a request runs, `$requestClient.nativeClient` gives access to the connection (`kafka`, `producers`, `consumers`).

## Limitations

- Only messaging commands are supported. Topic and consumer group administration (create/delete topics, list groups, ...) can be done in [scripts](#scripting).
- Message values and header values are read as UTF-8 strings. The binary value of a consumed message is available as `response.rawBody`.
- Consumers use the `cooperative-sticky` partition assignor. You can change it with `kafka_config_partition.assignment.strategy`. It is not set if `kafka_config_group.protocol` is `consumer`.
