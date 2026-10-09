Assertions turn request examples into executable checks. Use them for status codes, headers, timings, body fields, XML XPath values, custom JavaScript expressions, and ZW edition file comparisons.

- [Syntax](#syntax)
- [Value providers](#value-providers)
- [Predicates](#predicates)
- [Examples by assert type](#examples-by-assert-type)
- [File comparison asserts in the ZW edition](#file-comparison-asserts-in-the-zw-edition)
- [Scripted tests](#scripted-tests)

## Syntax

Simple assertions start with `??` and run after the response is received:

```http
GET https://httpbin.org/status/200

?? status == 200
?? duration total < 1000
```

The general form is:

```text
?? <type> [value] <predicate> [expected]
```

- `<type>` selects the value provider, such as `status`, `header`, `duration`, `body`, `js`, or `xpath`.
- `[value]` identifies the specific value inside that provider, such as a header name or body property.
- `<predicate>` is the comparison to run.
- `[expected]` is first processed with normal variable replacement, then converted to the response value's type unless the predicate opts out of conversion.

## Value providers

| Provider | Form | Value checked |
| --- | --- | --- |
| Status | `?? status == 200` | `response.statusCode`. |
| Header | `?? header content-type includes json` | Response header value. Header lookup is case-insensitive. |
| Duration | `?? duration < 1000` | Total request timing in milliseconds. |
| Duration detail | `?? duration firstByte < 300` | One timing field: `firstByte`, `download`, `wait`, `request`, `tcp`, `tls`, or `total`. |
| Body | `?? body includes ok` | Raw response body as a string or buffer-like value. |
| Body property | `?? body data.items isArray` | JavaScript property access on `response.parsedBody || response.body`. |
| JavaScript | `?? js response.parsedBody.total > 0` | Result of a JavaScript expression evaluated in the normal script context. |
| XPath | `?? xpath //title/text() == Example` | XPath result from the XML response body; `@xpath_ns prefix=uri` can define namespaces. |

Body property access is JavaScript-style member access. For more complex paths, use `js`.

```http
GET https://example.test/orders/42

?? body id == 42
?? body customer.name == Ada
?? js response.parsedBody.items.length >= 1
```

## Predicates

| Predicate | Aliases | Description |
| --- | --- | --- |
| `==` | `===`, `equals` | Strict equality after expected-value conversion; objects compare by safe JSON stringification. |
| `!=` | `!==`, `not equals` | Strict inequality after expected-value conversion. |
| `>` | | Numeric greater-than comparison. |
| `>=` | | Numeric greater-than-or-equal comparison. |
| `<` | | Numeric less-than comparison. |
| `<=` | | Numeric less-than-or-equal comparison. |
| `startsWith` | | String value starts with expected text. |
| `endsWith` | | String value ends with expected text. |
| `includes` | `contains` | String contains expected text, or array contains the expected element. |
| `exists` | `isTrue` | Value is truthy. |
| `isFalse` | | Value is falsy. |
| `isNumber` | | Value is a number. |
| `isBoolean` | | Value is a boolean. |
| `isString` | | Value is a string. |
| `isArray` | | Value is an array. |
| `matches` | | String value matches a JavaScript regular expression. |
| `sha256` | | Base64 SHA-256 digest of the value matches expected. |
| `sha512` | | Base64 SHA-512 digest of the value matches expected. |
| `md5` | | Base64 MD5 digest of the value matches expected. |
| `matchesFile` | ZW edition | Exact text comparison with a file. |
| `matchesJsonFile` | ZW edition | Deep JSON comparison with a file. |

## Examples by assert type

### Status

```http
GET https://httpbin.org/status/204

?? status == 204
?? status >= 200
?? status < 300
```

### Headers

```http
GET https://httpbin.org/json

?? header content-type includes application/json
?? header cache-control isFalse
```

### Duration

```http
GET https://httpbin.org/delay/1

?? duration total < 2000
?? duration firstByte < 1500
```

### Body and parsed body fields

```http
GET https://httpbin.org/json

?? body includes slideshow
?? body slideshow.title isString
?? body slideshow.slides isArray
```

### JavaScript expressions

```http
GET https://example.test/report

?? js response.statusCode == 200
?? js response.parsedBody.rows.length > 0
?? js response.parsedBody.rows.every(row => row.id) isTrue
```

### XPath

```http
GET https://example.test/books.xml

@xpath_ns bookml=http://example.com/book
?? xpath //bookml:title/text() == Harry Potter
```

## File comparison asserts in the ZW edition

> [!NOTE]
> **ZW edition:** File comparison asserts are exclusive to the ZW edition and are not available in upstream httpyac. See [ZW edition differences](ZW-Edition-Differences).

Use file comparison asserts when the expected body or JSON value is clearer as a separate fixture.

```http
GET https://example.test/plain

?? body matchesFile ./expected.txt
?? body matchesFile ./expected.txt --trim --ignoreLineEndings
```

`matchesFile` performs exact text comparison:

- The file path is resolved relative to the `.http` file.
- `--trim` trims both the file content and returned value before comparison.
- `--ignoreLineEndings` normalizes CRLF and CR to LF before comparison.
- Buffers are read as UTF-8; non-string values are converted with the normal httpyac string conversion.

```http
GET https://example.test/items

?? body matchesJsonFile ./expected.json
?? body matchesJsonFile ./expected.json --ignoreLineEndings
?? body data.items matchesJsonFile ./items.json
?? js response.parsedBody.items matchesJsonFile ./items.json
```

`matchesJsonFile` performs deep JSON equality:

- Object key order and JSON formatting do not matter.
- A UTF-8 byte-order mark in the expected file or returned string is stripped before parsing.
- `--ignoreLineEndings` also normalizes line endings inside string values.
- Array order still matters.
- Failure output reports the first differing JSONPath and the expected/returned line from key-sorted pretty JSON.

Both predicates fail the test with a clear message for missing files, unreadable files, invalid JSON, omitted file names, and unknown flags. Predicate ids are matched longest-first, so `matchesFile` and `matchesJsonFile` are not parsed as `matches`.

Example failure messages:

```text
./expected.txt differs at line 2
  expected: "Hello World"
  returned: "Hello world"
```

```text
./expected.txt differs at line 2
  expected: "line2"
  returned: <end of response>
```

```text
./expected.json differs at $.items[1].name (line 7)
  expected: "name": "a"
  returned: "name": "b"
```

```text
unknown option --trim (supported: --ignoreLineEndings)
```

## Scripted tests

For checks that do not fit a single assert line, use JavaScript tests from [Guide-Scripting](Guide-Scripting):

```http
GET https://example.test/health

{{
  test.status(200);
  test.headerContains("content-type", "json");
  test("service is healthy", () => {
    if (response.parsedBody.status !== "ok") {
      throw new Error(`unexpected status ${response.parsedBody.status}`);
    }
  });
}}
```

The `test` helper records named test results and provides shortcuts for status, total time, exact header value, header containment, response body equality, and body presence checks.
