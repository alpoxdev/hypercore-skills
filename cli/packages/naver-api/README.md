# @kood/naver-api-cli

A Node.js ESM CLI for the Naver API HUB. Requires Node.js 20 or newer.

## Install and run

Build the workspace package, then run `naver-api --help`. The package exposes the `naver-api` binary.

## Command grammar

```text
naver-api [--json] config set [--stdin]
naver-api [--json] config show
naver-api [--json] config path
naver-api [--json] config validate
naver-api [--json] config delete
naver-api [--json] trends --input <file>
naver-api [--json] shopping-insight categories --input <file>
naver-api [--json] shopping-insight keywords --input <file>
naver-api [--json] search <type> <query> [--display <count>] [--start <index>] [--sort <sort>] [--filter <filter>] [--format json]
```

`--input` accepts a YAML or JSON object. Use `--input=-` (with `=`) to read that request object from standard input; the separated form `--input -` is parsed as a missing option value by the CLI parser. Trend request objects use `startDate`, `endDate`, `timeUnit`, and the API-specific group field (`keywordGroups`, `category`, or `keyword`). See the API HUB schema for the accepted device, age, gender, and group values.

## Credentials and local configuration

Credentials use API HUB names exactly:

```yaml
apiKeyId: your-api-key-id
apiKey: your-api-key
```

Never place credentials in command arguments. `config set` reads each value from a hidden TTY prompt. For non-interactive use, send the YAML above through standard input:

```sh
naver-api config set --stdin < credentials.yaml
```

Do not commit `credentials.yaml`, shell history containing its contents, or any redirected command output. `config path` prints the exact local config location (`~/.hypercore/naver-api/config.yml`). The parent and credential directory must be non-symlink protected directories. `config show` only displays masked values. Credential values and upstream response bodies are never included in errors. `config validate` checks only the local configuration shape and does not make a network request.

## API HUB registry policy

The CLI calls only current API HUB operations registered by the package adapters: Search Trend, Shopping Insight category trends, Shopping Insight keyword trends, and exactly these Naver search types. Retired `shop`, `book`, and `doc` are excluded. It does not synthesize arbitrary paths, discover endpoints, or accept a URL override. Every Search request sends `format=json`; `--format` only accepts `json`.

| Type          | `--display` / `--start` | `--sort`               | `--filter`                        | Unsupported options                          |
| ------------- | ----------------------- | ---------------------- | --------------------------------- | -------------------------------------------- |
| `blog`        | 1–100 / 1–1000          | `sim`, `date`          | —                                 | `--filter`                                   |
| `news`        | 1–100 / 1–1000          | `sim`, `date`          | —                                 | `--filter`                                   |
| `cafearticle` | 1–100 / 1–1000          | `sim`, `date`          | —                                 | `--filter`                                   |
| `kin`         | 1–100 / 1–1000          | `sim`, `date`, `point` | —                                 | `--filter`                                   |
| `local`       | 1–5 / 1 only            | `random`, `comment`    | —                                 | `--filter`                                   |
| `encyc`       | 1–100 / 1–1000          | —                      | —                                 | `--sort`, `--filter`                         |
| `webkr`       | 1–100 / 1–1000          | —                      | —                                 | `--sort`, `--filter`                         |
| `image`       | 1–100 / 1–1000          | `sim`, `date`          | `all`, `large`, `medium`, `small` | none                                         |
| `adult`       | —                       | —                      | —                                 | `--display`, `--start`, `--sort`, `--filter` |
| `errata`      | —                       | —                      | —                                 | `--display`, `--start`, `--sort`, `--filter` |

## Output

Human output uses tables for search results and period/ratio tables plus labeled ASCII charts for trends. Ratios are normalized relative indexes: the maximum is 100 within the returned comparison group and is not search volume.

`--json` writes exactly one document to stdout on success:

```json
{ "ok": true, "command": "search", "data": {} }
```

Failures write only to stderr. With `--json`, they use one document and no stdout:

```json
{
  "ok": false,
  "command": "search",
  "error": { "kind": "usage", "code": "NAVER_API_INPUT_ERROR", "message": "Invalid API request." }
}
```

Exit codes are stable: `2` usage, `3` config, `4` auth, `5` rate limit, `6` upstream, and `7` network or timeout. Requests have a 15-second deadline.
