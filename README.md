# pi-modealias

[pi](https://github.com/earendil-works/pi) extension. Registers provider `modealias` whose models are aliases of other models, each with its own context limit, cost and thinking levels. Requests are streamed by the target model; its provider resolves its own auth.

Use it to cap context below the model's maximum, correct wrong catalog cost, hide unsupported thinking levels, or give one model several named variants.
For routing between models per request, use pi's built-in [virtual models](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/virtual-models.md) instead: they take limits from the physical model and cannot override them.

## Install

```bash
pi install git:github.com/GoodDingo/pi-modealias@v0.1.0
```

Create `<agent dir>/modealias.json` (default `~/.pi/agent/modealias.json`; see [`modealias.example.json`](modealias.example.json)), then restart pi or `/reload`.

```json
{ "aliases": [ {
  "id": "sonnet-250k",
  "target": "anthropic/claude-sonnet-4-5",
  "reasoning": true,
  "contextWindow": 250000,
  "maxTokens": 64000,
  "thinkingLevelMap": { "xhigh": null }
} ] }
```

Select with `/model` or `pi --model modealias/sonnet-250k:high`.

## Alias fields

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Unique; model id under `modealias/`. |
| `target` | yes | `provider/model`, split at first `/` (model ids may contain `/`). Not another alias. |
| `contextWindow`, `maxTokens` | yes | Positive numbers. Shown in pi, used for compaction. |
| `name` | no | Display name; defaults to `id`. |
| `reasoning`, `input`, `cost` | no | Model metadata, as in pi's `models.json`. Explicit, because the target catalog is not loaded when pi resolves models at startup. |
| `thinkingLevelMap` | no | `null` hides a level in the picker. |
| `enforceContextWindow` | no | `false` disables the hard cap (below). |
| `promptCache`, `compat`, `inputLimits`, `headers` | no | Passed to the target model; `compat` is merged over the target's. |

`api` and `baseUrl` on an alias are ignored for the alias itself and passed to the target request: use them when the target provider isn't in pi's catalog.

## Behavior

- **Target resolution:** exact catalog entry `provider/model`; else any model of that provider (supplies `api`, `baseUrl`, `compat`); else error.
- **Hard context cap:** a request estimated over `contextWindow` is rejected before sending. Estimate = JSON characters / 4, deliberately coarse; base64 images count by length, so image-heavy sessions over-count.
- **Thinking levels:** `/thinking` is clamped by pi. `--thinking L` or `--model alias:L` naming a level hidden by `thinkingLevelMap` aborts startup.
- **Cost:** the alias's `cost` is used as given, not the target's.
- **Invalid config fails loudly at load:** missing file, duplicate `id`, alias-of-alias, missing `contextWindow`/`maxTokens`.

## Develop

```bash
npm install && npm run typecheck && npm test
```

See [docs/maintaining.md](docs/maintaining.md). MIT licensed.
