# Maintaining and extending

## Flow

1. Factory loads and validates `<agent dir>/modealias.json` (`validateAliases`), then `assertRequestedLevelSupported` checks `process.argv`.
2. `registerProvider("modealias")` lists each alias as a model. Dummy `apiKey` and `api` make models selectable; `api`/`baseUrl`/`target`/`enforceContextWindow` are stripped from the listed model.
3. `session_start` captures `ctx.modelRegistry`.
4. `streamSimple(aliasModel, …)`: cap check, then `registry.streamSimple(targetModel(alias), …)` with the dummy `apiKey` removed so the target's provider resolves its own.
5. `targetModel`: catalog entry or any model of the target provider as base; alias metadata overlaid; `id` = real model id; `compat` merged.

## Invariants

- Alias metadata is explicit because the target catalog isn't loaded at startup.
- Errors in `streamSimple` throw synchronously; pi's provider docs allow this before a stream is returned.
- `registry` is unset before `session_start`; no stream runs before it.
- Alias-of-alias is rejected: it would allow unbounded recursion.

## For other extensions

Aliases are ordinary models: `ctx.modelRegistry.find("modealias", id)` and `modelRegistry.streamSimple(...)` work. There is no events or API surface; adding fields means extending `Alias` (open `[field: string]: any`) and the strip lists in `targetModel` and `registerProvider`.

## Test

`npm test` (Node ≥ 22.18 runs TypeScript directly) covers config validation and the CLI level check. The streaming path needs a running pi: `pi -e . --model modealias/<id>` with a real `modealias.json`.

## Release

1. Update `CHANGELOG.md`, bump `version`.
2. `npm run typecheck && npm test && npm pack --dry-run` (check the file list).
3. `git tag vX.Y.Z && git push --tags && npm publish`.

Known limits: the token estimate is coarse; the argv check only parses `--model X` (not `--model=X`) and `--thinking X`.
