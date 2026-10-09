# AGENTS.md

pi extension in one file (`index.ts`). Read [docs/maintaining.md](docs/maintaining.md) first.

- Verify: `npm run typecheck && npm test`; both must pass and print nothing unexpected.
- Fail loudly: invalid config throws at load; never clamp or default silently.
- Keep one file, no new dependencies; pi packages are peer dependencies (`*`), never `dependencies`.
- Pre-v1: no compatibility shims; document current behavior only.
- Config shape changes: update `README.md` field table, `modealias.example.json`, header comment in `index.ts`, tests, `CHANGELOG.md`.
- Logic with branches needs a test in `index.test.ts`.
