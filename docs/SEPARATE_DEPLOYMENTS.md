# Three independent Vercel projects

The monorepo now has separate web entry points for the shopping app, administration, and Instagram automation. Each Vercel project receives its own deployment URL. They can share one Firebase project so catalogue, dealer approvals and orders stay synchronized.

| Vercel project name  | CALIFNCO_APP | Web source                                     | Audience                         |
| -------------------- | ------------ | ---------------------------------------------- | -------------------------------- |
| `califnco-shop`      | `storefront` | `apps/storefront`                              | Customers and dealers            |
| `califnco-admin`     | `admin`      | `apps/admin`                                   | Administrators                   |
| `califnco-instagram` | `automation` | shared `apps/admin` UI in automation-only mode | Administrators managing AI posts |

These are requested project names, **not confirmed deployment URLs**. Vercel assigns the actual domains when deployment succeeds. No `.vercel.app` link is fabricated in this package.

## Import the existing GitHub repository into Vercel

1. In Vercel, choose **Add New → Project** and import the existing `Monica8github/califnco-shopping-fullstack` repository. Do not create another GitHub repository.
2. Set **Root Directory** to the repository root. Leave it blank or use `.`; do not select `apps/storefront`, `apps/admin`, or `apps/mobile`.
3. Set **Framework Preset** to **Other**. The checked-in `vercel.json` uses `"framework": null` so Vercel does not replace the monorepo build with a Vite-only command.
4. Use **Install Command** `npm ci`, **Build Command** `npm run build:deployment`, and **Output Directory** `dist`.
5. Select Node.js **24.x** in the project's Node.js version setting.
6. Set `CALIFNCO_APP` to the value from the table for the project. Set it for Preview and Production (and Development if deploying there).
7. Add the environment variables below before the first live deployment. Vite embeds the public Firebase variables during the build, so redeploy after changing them.

Keep Vercel's project commands aligned with the checked-in `vercel.json`; do not set an app-subdirectory root or add shell-specific environment assignments to the build command. The root npm workspace and `package-lock.json` are required for a reproducible `npm ci`.

`scripts/build-deployment.mjs` builds the selected npm workspace and copies its production assets into root `dist`. `api/index.ts` is the Vercel Node function entry and imports the actual handler from `functions/app.ts`; Vercel bundles that handler and its source dependencies. The Vercel function is not the local `functions/dev.ts` development server. Rewrites send `/api/<route>` requests to the function as `/api?route=<route>`, while other web routes fall back to `index.html`. Product images are copied into `dist` from the admin workspace's shared public assets.

## Environment variables

Use `.env.example` as the authoritative variable list and configure values in **Vercel → Project → Settings → Environment Variables**, not in the repository. The storefront and admin should use the same Firebase project if they are expected to share accounts, products and orders.

Required for live Firebase-backed web/API operation:

- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID`: public Firebase Web App settings from Firebase Console → Project settings → Your apps. These are client configuration, not service-account credentials. They are embedded in the web bundle.
- `FIREBASE_PROJECT_ID`: the same project ID, used by the server.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: the server-only service-account JSON for that Firebase project. Create/download it from Firebase Console → Project settings → Service accounts, restrict its permissions, and paste the JSON as a Vercel server environment variable. Never use a `VITE_` prefix for it.
- `DEMO_MODE=false`: production must use Firebase. The API explicitly disables local demo mode on Vercel even if this is set to `true`.

Optional service configuration:

- Payments (test mode only): `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` from Razorpay Test Mode. `RAZORPAY_WEBHOOK_SECRET` is the secret configured for the Razorpay webhook pointing to `https://<project-domain>/api/payments/webhook`. The server rejects live-mode keys.
- Scheduled maintenance/Instagram jobs: `CRON_SECRET`, set to a newly generated private value and configured as the matching n8n Authorization credential. Configure it only on projects serving the associated scheduler endpoint.
- Instagram AI/publishing, image hosting, email and SMS are optional and use the server-side variables documented in `.env.example` and [ENVIRONMENT.md](ENVIRONMENT.md). Keep publishing disabled until provider setup and review are complete.
- `ALLOWED_ORIGINS` is only needed when a browser client calls the API from a different origin. Same-origin Vercel deployments do not need it. Do not set emulator variables on Vercel.

Without live credentials, the storefront can show its existing browser sample workspace; this is not a live database, payment or API integration and must not be represented as production data.

## API, Firebase, and domain checks

Every project built from the repository root receives the API function and API rewrites from `vercel.json`; the frontend calls same-origin `/api/...` URLs. After deployment:

1. Open `https://<project-domain>/api/health`; expect HTTP 200 and `service: "califnco"`. For live service setup, verify `mode: "firebase"` and no configuration issues.
2. Open a client route and refresh it; the SPA fallback should serve the storefront/admin page. Confirm `/products/...` images load.
3. Add each Vercel domain to Firebase Console → Authentication → Settings → Authorized domains.
4. Deploy Firestore rules and indexes and bootstrap the intended administrator using the commands in [SETUP.md](SETUP.md).
5. Configure Razorpay webhook URLs, n8n endpoints, and Vercel Deployment Protection access where those services are used. External provider credentials and Firebase project setup cannot be completed by the repository build.

The admin and storefront are recommended as **separate Vercel projects** because they have distinct audiences and app entry points. Each project has its own same-origin API function; configure each to use the same Firebase project if data must be shared. The Instagram/automation UI can be deployed as a third project using `CALIFNCO_APP=automation`; it is optional and does not start the n8n scheduler.

The automation mode builds the retained `apps/admin` workspace, then opens its restricted automation UI; there is no separate `apps/automation` workspace in this package. Provide Firebase public client configuration and server credentials in each project's own environment. Configure Razorpay test keys and the shared webhook secret for projects serving checkout. Set the webhook to the admin project's `/api/payments/webhook`. Point Android `EXPO_PUBLIC_API_URL` at the admin project's origin. Native API calls remain available there independently of the admin UI role gate.

Put AI/image/Instagram credentials and `CRON_SECRET` in the Instagram project. Point n8n's daily workflow at that origin. Put the maintenance scheduler credential in the admin project and point the expiry workflow there. Do not activate duplicate schedules for each domain. Shared Firestore job IDs also guard against duplicate daily publication.

Add all three final domains to Firebase Authentication's authorized domains. Check project access/protection for the intended evaluator, payment provider and scheduler. Supply configuration through provider secret settings, never through a public repository.

## Verify the build selector locally

On macOS/Linux:

```bash
CALIFNCO_APP=storefront npm run build:deployment
CALIFNCO_APP=admin npm run build:deployment
CALIFNCO_APP=automation npm run build:deployment
```

On Windows PowerShell:

```powershell
$env:CALIFNCO_APP = 'storefront'
npm run build:deployment
```

Use `admin` or `automation` for the other two. The root output is replaced on each build; each remote Vercel project has its own isolated build environment.

## Android and the scheduler

The shopping URL is a responsive website backed by the same commerce API. The native Android app remains in `apps/mobile` and requires an APK/AAB build; deploying a website to Vercel does not create an APK. The Instagram URL is the automation dashboard/API. n8n still needs a persistent scheduler host; the dashboard alone does not start a daily schedule.
