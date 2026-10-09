httpbook is the upstream VS Code notebook extension for HttpYac-style requests. It is useful when you want executable request cells mixed with notes and narrative text.

## Install

Install the extension from the Visual Studio Marketplace:

```shell
code --install-extension anweber.httpbook
```

Marketplace page: [anweber.httpbook](https://marketplace.visualstudio.com/items?itemName=anweber.httpbook)

Source: [AnWeber/httpbook](https://github.com/AnWeber/httpbook)

## When to use it

Use httpbook for notebook-style demos, shared walkthroughs and exploratory API sessions. Use the [CLI](Installation-CLI) when you need repeatable CI execution or the exact ZW edition runtime.

> [!NOTE]
> **ZW edition:** the published httpbook extension bundles the upstream httpyac core, so fork-only features such as `QUERY`, Kafka and `matchesFile` / `matchesJsonFile` only work in notebooks if the extension is built against this fork. See [ZW edition differences](ZW-Edition-Differences).
