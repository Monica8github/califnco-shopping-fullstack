# califnco-shopping-fullstack

Independent full-stack source package for the customer/dealer shopping website and Expo Android app.

## Run locally

Use Node.js 22.13+ (24 recommended) and npm. From this folder, choose one setup mode:

```bash
npm ci
# Demo only: copy .env.demo.example to .env using your shell's file-copy command.
npm run dev
```

The API runs on port 8787; the web app runs on port 4174. Demo mode uses local sample data. For live Firebase, use `.env.example` and configure the public and server variables in the appropriate places; do not switch to demo to mask missing live settings. The four `VITE_FIREBASE_*` values are embedded at build time, so restart `npm run dev` after changing them. See `.env.example` and `docs/ENVIRONMENT.md` for live configuration.

For Android, also copy `apps/mobile/.env.example` to `apps/mobile/.env`, set the API URL to your computer’s LAN address, and run `npm run mobile`. Native Razorpay requires an Expo development build; see `docs/ANDROID.md`.

## Verify and build

```bash
npm run check
npm test
npm run check:runtime
npm run build
npm run build:deployment
```

Deploy this folder as the Vercel project root, use `npm ci`, build `npm run build:deployment`, output `dist`, Node.js 24, and `CALIFNCO_APP=storefront` (`admin` and `automation` are also supported). For hosted deployments set `DEMO_MODE=false` and supply matching Firebase web and server project configuration in each Vercel project's settings, then redeploy. Unconfigured browser sample mode is explicitly labelled.

## Complete backend and shared dependencies

This ZIP includes `api/`, `functions/`, `shared/`, Firebase rules/indexes, provider adapters, tests, assets, environment templates and setup documentation. `apps/admin` contains shared React UI and image assets imported by the web entry points; retaining this directory is required even in the shopping and Instagram packages. The shared backend includes commerce and automation routes. No sibling ZIP is needed. To share live orders and products across separate deployments, configure the same Firebase project; browser sample data remains isolated by origin.

## Instagram and integrations

The Instagram package includes `automation/workflows/daily-instagram.json`, the scheduled n8n workflow, AI generation, Cloudinary hosting and official Instagram API publishing. Import the workflow into an always-on n8n instance and configure credentials before enabling it. See `automation/README.md` and `docs/AUTOMATION.md`. No successful live publishing, payment, email/push delivery, or APK build is claimed by this source package. Credentials and service setup remain necessary.

See `docs/SETUP.md`, `docs/ENVIRONMENT.md`, `docs/ARCHITECTURE.md`, and `docs/MONOREPO_README.md` for detailed integration instructions. The latter documents the original combined repository; commands for workspaces omitted from this focused package do not apply. `docs/TEST_RESULTS.md` records the original implementation validation; `PACKAGE_VERIFICATION.md` records checks of this separate package.
