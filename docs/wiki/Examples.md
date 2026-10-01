HttpYac request files can cover quick smoke tests, API exploration, and repeatable CI checks. The upstream project keeps a useful examples collection in the [httpyac.github.io examples folder](https://github.com/httpyac/httpyac.github.io/tree/main/examples); link to those files when you need full sample request sets instead of copying them into the wiki.

## Upstream example catalog

The upstream examples include request files for:

- Arbeitsagentur Jobbörse
- ArgoCD
- GitHub GraphQL
- gRPCb.in
- Httpbin
- Learn Webservices
- SpaceX REST and GraphQL APIs
- Spring Boot Actuator

Most upstream examples run unchanged with the ZW CLI package. Install the fork as shown in [Installation CLI](Installation-CLI), then send your request file with:

```shell
httpyac send requests.http --all
```

## ZW edition examples

> [!NOTE]
> **ZW edition:** The examples in this section use fork-only request syntax or assertions. See [ZW edition differences](ZW-Edition-Differences).

### QUERY request

`QUERY` is parsed like the other HTTP methods. Use it when the request is safe and idempotent, but the query expression belongs in the body.

```http
QUERY https://api.example.test/search
content-type: application/json

{
  "filter": "status:open",
  "limit": 10
}

?? status == 200
```

### Kafka produce and consume

Kafka requests start with `KAFKA` plus bootstrap brokers, or with a `kafka://` / `kafkas://` URL. Request settings use `kafka_` headers; other headers become Kafka message headers. See [Kafka](Guide-Kafka) for the full header list.

Run the produce request first, then the consume request.

```http
@broker = localhost:9092
@topic = orders

###
# @name produceOrder
KAFKA {{broker}}
kafka_method: produce
kafka_topic: {{topic}}
kafka_key: order-{{$timestamp}}
traceId: {{$uuid}}
content-type: application/json

{
  "id": "order-{{$timestamp}}",
  "state": "created"
}

?? status == 0
?? body produced == true
?? header kafka_topic == orders

###
# @name consumeOrder
KAFKA {{broker}}
kafka_method: consume
kafka_topic: {{topic}}
kafka_group_id: httpyac-wiki
kafka_from_beginning: true
kafka_max_messages: 1
kafka_timeout: 10000

?? status == 0
?? body state == created
?? header traceId exists
```

Kafka support depends on the optional native package `@confluentinc/kafka-javascript`. If it is not available, use the fork Docker image or see [Troubleshooting](Troubleshooting).

### File comparison assertions

Use `matchesFile` for exact text comparisons and `matchesJsonFile` for JSON comparisons. `matchesFile` supports `--trim` and `--ignoreLineEndings`; `matchesJsonFile` supports `--ignoreLineEndings`.

```http
GET https://api.example.test/plain

?? status == 200
?? body matchesFile ./expected.txt --trim --ignoreLineEndings

###
GET https://api.example.test/users/42

?? status == 200
?? body matchesJsonFile ./expected-user.json --ignoreLineEndings
```

`matchesJsonFile` compares parsed JSON, so object key order and formatting do not matter. Array order still matters. More assertion syntax is covered in [Assertions](Guide-Assert).

## CI with JUnit output

Use `httpyac send --all --junit` to run every request in a file or glob and write JUnit XML. GitHub Actions fails the step automatically when httpyac exits with a non-zero code.

```yaml
name: httpyac

on:
  push:
  pull_request:

jobs:
  httpyac:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npm install -g @zerowiggliness/httpyac
      - run: httpyac send "test/**/*.http" --all --junit > httpyac-junit.xml
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: httpyac-junit
          path: httpyac-junit.xml
```

The Docker image can be used instead of a global npm install:

```yaml
- run: docker run --rm -v "${{ github.workspace }}:/data" -w /data ghcr.io/zerowiggliness/httpyac:latest send "test/**/*.http" --all --junit > httpyac-junit.xml
```

Exit code `0` means the run completed without failed or errored tests. Exit code `10` means an unexpected runtime error, `19` means at least one test errored, and `20` means at least one test failed. See [Troubleshooting](Troubleshooting#cli-exit-codes) for the table and fork-specific note.
