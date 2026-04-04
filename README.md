# TripKavach

Emergency travel insurance website for Indian travelers visiting the United States — and for families in the US insuring visiting parents and relatives.

TripKavach is a customer-facing storefront that sells travel-assistance plans underwritten by [BMI Financial Group](https://www.bmicos.com/) (AM Best A- rated, 50+ years). Plans include direct hospital payment, zero deductibles, pre-existing condition emergency coverage, and 24/7 assistance — aimed specifically at closing the protection gap that exists because Indian health insurance typically does not cover US medical emergencies.

## What it does

- **Persona-aware landing page** — visitors pick "I'm traveling" or "My family is traveling" and the copy, recommendations, and FAQs adapt.
- **7-step quote wizard** that talks to the BMI Travel Assist API to return live pricing for short-visit (daily, ages up to 84) and extended-stay (monthly, ages up to 65) plans across three tiers: Ultra Plus, VIP, and VIP Plus.
- **Plan comparison, claims guide, policy conditions** and a full FAQ covering eligibility, direct hospital payment, pre-existing conditions, cancellation, and excluded destinations.
- **Travel info extras** — airport status and weather alerts via serverless endpoints.
- **Multi-language** support for 12+ Indian languages via Google Translate widget.

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | Vite 8, Tailwind CSS 3, vanilla JS ES modules, static multi-page HTML |
| API | Vercel serverless functions (production) or Express 5 (local dev) |
| Middleware | Helmet, CORS, compression, dotenv |
| Secrets | AES-encrypted `vault.enc` with `.env` fallback |
| Insurance backend | BMI Travel Assist REST API |
| Hosting | Vercel |
| Runtime | Node.js ESM |

## Repository layout

```
.
├── *.html                  # Static pages (index, quote, claims, faq, plans/, ...)
├── js/                     # Frontend ES modules (path-selector, quote wizard, etc.)
├── src/input.css           # Tailwind entry
├── api/                    # Vercel serverless functions
│   ├── _lib/               # BMI client, validation, middleware
│   ├── quote/step1..7.js   # Quote wizard endpoints
│   ├── catalog/            # Reference data (countries, benefits, ...)
│   └── travel/             # Airport + weather endpoints
├── server/                 # Local Express dev server
│   ├── index.js
│   ├── vault.js            # Encrypted secret store
│   └── .env.example
├── public/                 # Static assets (images, favicons)
├── vite.config.js
├── tailwind.config.js
└── vercel.json             # Vercel framework + headers config
```

## Getting started

### Prerequisites

- **Node.js 20+** (for ESM + Vite 8)
- **npm** (ships with Node)
- **Git**
- BMI Travel Assist API credentials (sandbox or production) — for live quotes. The site loads fallback catalogs without them, but the quote wizard won't price real plans.

### 1. Clone and install

```bash
git clone https://github.com/GregHomstad/NicoGregTravelInsurance.git
cd NicoGregTravelInsurance
npm install
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env` and fill in:

```env
BMI_API_BASE=https://api.bmicos.com/bmiecommerce/sandbox/v4
BMI_AUTH_USER=your_auth_user
BMI_AUTH_KEY=your_auth_key
BMI_AGENT_ID=16111
PROXY_API_KEY=generate_with_crypto_randomBytes
PORT=3001
ALLOWED_ORIGINS=http://localhost:5174,http://localhost:3000
```

Generate `PROXY_API_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

> For production, store secrets in the encrypted vault instead of `.env`:
> ```bash
> VAULT_KEY=your-master-password node server/vault.js encrypt
> ```

### 3. Run locally

Open two terminals.

**Terminal 1 — API server (Express):**
```bash
npm run server
```
Runs on `http://localhost:3001`.

**Terminal 2 — Frontend (Vite):**
```bash
npm run dev
```
Runs on `http://localhost:5174`. Vite proxies `/api/*` to the Express server automatically (see `vite.config.js`).

Open <http://localhost:5174> in your browser.

### 4. Build for production

```bash
npm run build
```

Outputs a static bundle to `dist/`. You can preview it locally with:

```bash
npm run preview
```

### 5. Deploy

The repo is Vercel-ready (`vercel.json`). On push to `master`:

- Vite builds the static site to `dist/`
- Files under `api/` deploy as serverless functions
- Security headers and function timeouts are applied per `vercel.json`

Set the same environment variables (`BMI_*`, `PROXY_API_KEY`, `ALLOWED_ORIGINS`) in the Vercel project settings.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite dev server (frontend) |
| `npm run server` | Start Express API server (local BMI proxy) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |

## License

MIT © NicoGreg

## Disclaimer

TripKavach plans are travel assistance products provided by BMI Travel Assist, a subsidiary of BMI Financial Group. They are not a substitute for health insurance, Medicare, or social security programs. Coverage is subject to the terms in each plan's conditions of coverage.
