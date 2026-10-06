# File matching assertions

Use `matchesFile` and `matchesJsonFile` to compare a response value with a file. The file name can contain httpyac variables and is resolved relative to the `.http` file. Absolute paths are also supported.

```http
GET https://httpbin.org/json

?? body matchesJsonFile ./expected/response.json
```

The expected file must contain the complete value selected by the assertion. For example, `body data.items` compares only the `items` property:

```http
GET https://api.example.com/items

?? body data.items matchesJsonFile ./expected/items.json
```

## Text comparison

`matchesFile` compares the response value and file contents exactly, including whitespace and line endings. It is useful for plain text, XML, or a response body whose exact formatting matters.

```http
GET https://api.example.com/report.txt

?? body matchesFile ./expected/report.txt
```

Available options:

| Option                | Behaviour                                                               |
| --------------------- | ----------------------------------------------------------------------- |
| `--trim`              | Trim whitespace from the start and end of both values before comparing. |
| `--ignoreLineEndings` | Treat CRLF, CR, and LF line endings as equivalent.                      |

Options can be combined:

```http
?? body matchesFile ./expected/report.txt --trim --ignoreLineEndings
```

## JSON comparison

`matchesJsonFile` parses both values as JSON and compares their data. Object property order and formatting do not matter; array order and all values do. The assertion reports the first differing JSON path and the differing lines.

```http
GET https://api.example.com/items

?? body matchesJsonFile ./expected/items.json
```

The response value can be an already-parsed JSON value or a JSON string. The expected file must contain valid JSON.

| Option                | Behaviour                                                                  |
| --------------------- | -------------------------------------------------------------------------- |
| `--ignoreLineEndings` | Treat CRLF, CR, and LF as equivalent, including inside JSON string values. |

## Failure details

When values differ, the assertion shows the file name and first difference. Text comparisons report a line number; JSON comparisons report a JSON path, such as `$.items[1].name`. Missing or unreadable files, and invalid JSON, are reported as assertion failures.
