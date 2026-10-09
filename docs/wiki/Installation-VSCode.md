The upstream VS Code extension adds editor commands for `.http` files, request selection, response previews and a more interactive workflow inside Visual Studio Code.

## Install

Install the extension from the Visual Studio Marketplace:

```shell
code --install-extension anweber.vscode-httpyac
```

Marketplace page: [anweber.vscode-httpyac](https://marketplace.visualstudio.com/items?itemName=anweber.vscode-httpyac)

Source: [AnWeber/vscode-httpyac](https://github.com/AnWeber/vscode-httpyac)

## When to use it

Use the extension when you want to run requests from the editor, inspect responses next to the request file, and keep request authoring close to the code you are testing.

For CI, scripted usage, or fork-only runtime features, prefer the [CLI](Installation-CLI) or [Docker](Installation-Docker).

> [!NOTE]
> **ZW edition:** the published VS Code extension bundles the upstream httpyac core, so fork-only features such as `QUERY`, Kafka and `matchesFile` / `matchesJsonFile` only work in the extension if it is built against this fork. See [ZW edition differences](ZW-Edition-Differences).
