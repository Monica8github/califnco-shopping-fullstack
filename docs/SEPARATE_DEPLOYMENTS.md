# Three independent Vercel projects

The monorepo now has separate web entry points for the shopping app, administration, and Instagram automation. Each Vercel project receives its own deployment URL. They can share one Firebase project so catalogue, dealer approvals and orders stay synchronized.

| Vercel project name  | CALIFNCO_APP | Web source        | Audience                         |
| -------------------- | ------------ | ----------------- | -------------------------------- |
| `califnco-shop`      | `storefront` | `apps/storefront` | Customers and dealers            |
| `califnco-admin`     | `admin`      | `apps/admin`      | Administrators                   |
| `califnco-instagram` | `automation` | shared `apps/admin` UI in automation-only mode | Administrators managing AI posts |

These are requested project names, **not confirmed deployment URLs**. Vercel assigns the actual domains when deployment succeeds. No `.vercel.app` link is fabricated in this package.

## Import settings for each project

Import the same GitHub repository for each intended deployment. For every project set:

- Root directory: repository root (leave the field empty).
- Framework: Other.
- Install: `npm ci`.
- Build: `npm run build:deployment`.
- Do not override `vercel.json` with shell-specific `CALIFNCO_APP=... npm run ...`; set `CALIFNCO_APP` in that project's environment instead.
- Output: `dist`.
- Node: 22.x or 24.x.
- Environment `CALIFNCO_APP`: the corresponding value from the table.

`scripts/build-deployment.mjs` builds only the selected app and copies its output to the root `dist`. The root `vercel.json` includes an independently deployed API in each project. Each API uses the same configured Firestore, verifies tokens, and enforces roles. The shop does not expose admin navigation; the Instagram project opens the AI studio and integration settings; the admin starts at the operations overview.

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
