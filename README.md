# WalletGate Verifier Demo

Public, mobile‑first verifier UI for showcasing the WalletGate flow to investors, partners, and non‑technical users.

## Features
- 3‑step interactive flow (Configure → Scan → Results)
- Uses WalletGate demo endpoints (no API keys required)
- Simulate success/failure outcomes for live demos
- Mobile responsive and branded

## Local Development

```bash
npm install
npm run dev
```

By default, the app uses `http://localhost:4000` in development and `https://api.walletgate.app` in production.

You can override the API base:

```bash
VITE_DEMO_API_BASE=https://api.walletgate.app npm run dev
```

## Demo API
The UI calls these public endpoints:
- `POST /api/demo/sessions`
- `GET /api/demo/sessions/:id`
- `POST /api/demo/sessions/:id/simulate`

These are backed by test‑only credentials and rate‑limited.

## License
Apache‑2.0. See `LICENSE`.
