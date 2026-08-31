# CORS Lab

Interactive Cross-Origin Resource Sharing simulator by **Saeed Rumaneh**.

Tune request origin, method, credentials, and extra headers; inspect how a browser would run an **OPTIONS preflight** versus the **actual request**, and why the exchange is **allowed** or **denied**.

Synthetic demo only — no live cross-origin calls. Last scenario persists to `localStorage`.

## How to run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run test` | Vitest |
| `npm run typecheck` | TypeScript check |

## Example scenarios

Click the scenario chips:

| Scenario | Expected |
| --- | --- |
| Simple GET | Allow — no preflight |
| Credentialed request | Allow — concrete origin + `Allow-Credentials` |
| Wildcard + credentials | Deny — `*` cannot pair with credentials |
| Missing Allow-Origin | Deny |
| Method not allowed | Deny — preflight fails on `Allow-Methods` |

Decision logic lives in [`lib/cors.ts`](./lib/cors.ts). See [`SECURITY.md`](./SECURITY.md).

## Complete product flows

1. Pick a Deny scenario (Missing Allow-Origin or Method not allowed) — verdict is Deny.
2. Pick an Allow scenario (Simple GET or Credentialed request) — verdict is Allow.
3. Set a custom origin with credentials and `Allow-Origin: *` — wildcard + credentials is Deny. Last scenario is stored in `localStorage`.

## License

MIT © 2026 Saeed Rumaneh
