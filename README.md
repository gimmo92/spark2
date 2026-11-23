# Spark

Monorepo: `packages/core` (auth, security, data, shell, UI), `packages/mbo` (MBO module), `apps/*` (one Next.js app per client; `apps/demo` = app.tryspark.it).

```bash
npm install
npm run dev        # demo app on http://localhost:3000
npm run lint && npm run typecheck && npm run build
```

See `CLAUDE.md` for architecture, rules and how to create a client app.
