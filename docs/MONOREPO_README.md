# Califnco Water Care

`califnco-ecommerce-ai-automation` is the complete source package for the Califnco Round 1 assignment: a native Expo Android shop, a React operations dashboard, and a daily AI Instagram workflow. Two additional web entry points provide separate shopping and AI-studio applications for the later Vercel deployment phase.

This ZIP milestone delivers source, sample assets, configuration, tests and setup instructions. Provider integrations are implemented but need your own credentials. No APK, live payment, active n8n schedule, Instagram publication or assignment submission is implied by a successful source build. See [the verification record](docs/TEST_RESULTS.md).

## Quick start: no credentials required

Install Node.js **22.13+ or 24** and npm, unzip the archive, and run:

```bash
cd califnco-ecommerce-ai-automation
npm ci
cp .env.demo.example .env
npm run dev
```

Open **http://localhost:4173**. Choose **Explore as admin**, **customer**, or **dealer**. The API runs on port **8787**. In Windows PowerShell, replace `cp` with `Copy-Item` if needed.

Try a customer checkout and service booking, sign out, then open the admin to see the same records. Approve the pending dealer, edit inventory, advance a paid order, and open AI studio to advance the local fixture. Customer/dealer web screens use the same API as Android. Demo identities are fixed sample profiles, not real Firebase accounts; registration and password-reset delivery require Firebase.

### Demonstration and live modes

| Mode                             | How to enter                                          | Storage and behavior                                                                                                                                                                       |
| -------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Local full-stack demo            | `.env.demo.example` → `.env`; `npm run dev`           | Shared API data in `.local/demo.json`. Simulated payment/notifications; deterministic social fixture. Never enabled on Vercel or in production.                                            |
| Browser sample workspace         | Start without Firebase and choose **Explore as…**     | Sample changes stay in that browser tab's session storage. No live API mutations, payment, booking, notification or AI/provider call. Separate website origins do not share these samples. |
| Firebase + provider integrations | `.env.example` → `.env`; configure the services below | Verified Firebase identities, Firestore persistence, server-enforced pricing/roles, Razorpay test mode and optional external notifications/AI.                                             |

The browser sample workspace also remains available alongside configured sign-in for evaluation. Its token is handled only by a client-side adapter and grants no server access. Close the tab to discard its session. To reset the local API demo, stop it, delete **only** `.local/demo.json`, and restart.

## Implemented applications

### Android: React Native + Expo + TypeScript

- Firebase email/password registration, login, password reset and editable customer/dealer profiles.
- 60 sample products across water purifiers, dispensers, pumps, filters and related spares; local product-family photos, specifications, prices and stock.
- Search, category filters, price sorting, product details, account-scoped persistent cart and address validation.
- Native Razorpay test checkout backed by server pricing, stock reservations and captured-payment verification.
- Order history, fulfillment timeline, unpaid-order cancellation and service booking/status history.
- Dealer approval/rejection state, wholesale pricing and minimum bulk quantities after approval.
- Optional location capture and OpenStreetMap delivery-pin link; permission handling and Android FCM registration.

### Admin: React + Vite + TypeScript + Tailwind CSS

- Responsive operations dashboard with Firebase authentication and server-enforced administrator authorization.
- Revenue/order/service/dealer metrics, searchable product creation/editing, inventory and active/inactive catalogue controls.
- Customer records, dealer application approval/rejection, customer/dealer order details and ordered fulfillment transitions.
- Service request status and notes, payment visibility, notification delivery/error journal and CSV exports.
- AI post history, stage/error visibility, draft advancement and integration-configuration indicators.

### Daily AI Instagram automation

- Inactive, importable n8n workflow scheduled for **09:00 Asia/Kolkata**, plus a 15-minute unpaid-reservation cleanup workflow.
- In-stock product rotation, Gemini caption/hashtags, Gemini or Hugging Face image generation, and public Cloudinary JPEG hosting.
- Official Instagram API media-container creation, processing checks, publishing and saved provider media ID.
- Persisted daily job, transactional lease, bounded stage retries, duplicate prevention and execution history.
- Ambiguous publication moves to manual review without automatically publishing again.
- Real draft mode, credential-free local fixture mode, and a separately identified pre-generated AI creative example.

The 60 SKUs use 18 product-family photos; pack variants deliberately reuse the relevant family photo. Names, prices, stock and specifications are sample assignment data. Review [image provenance](docs/IMAGE_SOURCES.md) and replace/approve assets and commercial claims before a real store launch.

## Architecture and folder structure

Android and web clients authenticate with Firebase Auth, send ID tokens to the Node API, and receive owner/role-filtered data. The API verifies identities and reads authoritative profiles before using the Firebase Admin SDK. Firestore transactions control stock, prices, payment state and automation leases; direct client writes are denied by the checked-in rules.

Vercel hosts a selected React application and the secure Node API. n8n runs on an always-on Docker host or n8n Cloud and calls the protected API with a scheduler credential. EAS or a local Android SDK builds the native APK. These runtimes are configured separately.

```text
califnco-ecommerce-ai-automation/
├── apps/
│   ├── mobile/            # Native Expo app, components, screens, services, EAS
│   ├── admin/             # React dashboard, shared web UI, product assets
│   ├── storefront/        # Independent customer/dealer web entry point
│   └── automation/        # Independent AI-studio web entry point
├── api/index.ts           # Vercel server entry point
├── functions/             # API, business rules, store, payments, notifications
├── automation/
│   ├── workflows/         # Daily Instagram and reservation-cleanup n8n JSON
│   ├── examples/          # AI sample visual, caption and provenance
│   ├── engine.ts          # Resumable daily state machine
│   ├── providers.ts       # AI, Cloudinary and official Instagram adapters
│   ├── docker-compose.yml
│   └── README.md
├── shared/                # Domain types and 60-product catalogue
├── scripts/               # Seed, admin bootstrap, runtime/package verification
├── tests/                 # Domain, HTTP, browser sample and emulator tests
├── docs/                  # Setup, environment, architecture, QA and handoff
├── .github/workflows/     # CI checks
├── .env.example
├── .env.demo.example
├── .gitignore
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── vercel.json
├── package-lock.json
└── package.json
```

## Prerequisites and installation

- Node 22.13+ or 24 and npm. Use the committed lockfile with `npm ci` at the monorepo root.
- Java 21 recommended for the Firebase emulator verification.
- For a local Android build: a compatible JDK, Android SDK/build tools and emulator or connected device. Alternatively, an Expo account and available EAS build capacity.
- Docker and Docker Compose, or an existing n8n account, to run the scheduler.
- Your own Firebase, Razorpay test, AI-provider, Cloudinary and eligible Meta/Instagram accounts for external integration testing. Resend/FCM/TextBee are optional notification channels.

Account eligibility, model availability, quotas and costs vary. No paid subscription, billing activation or free-tier entitlement is included or assumed.

### Start and build the web applications

From the repository root:

```bash
# API + combined admin/customer/dealer evaluation UI
npm run dev

# Optional separate web apps, in additional terminals while the API is running
npm run dev:storefront     # http://localhost:4174
npm run dev:automation     # http://localhost:4175

# Each app builds independently after the root npm ci
npm run build:admin
npm run build:storefront
npm run build:automation
```

The independent production entry points restrict roles: admin and AI studio require an administrator; storefront accepts customers/dealers. All three Vite configurations load root public environment values. [Separate deployment settings](docs/SEPARATE_DEPLOYMENTS.md) are supplied for the later deployment phase.

### Start the native Android application

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Set `EXPO_PUBLIC_API_URL` in that file to an origin reachable from the device: e.g. `http://10.0.2.2:8787` for the standard Android emulator and a local API, or your HTTPS API origin. Local development serves the catalogue photos from the same origin. Keep `npm run dev:api` running for a local demo.

With Android tooling installed:

```bash
cd apps/mobile
npx expo prebuild --platform android
npx expo run:android
```

For subsequent sessions, `npm run mobile` at the root starts Metro for the installed development client. Native Razorpay and FCM require a development build or APK; **Expo Go is insufficient**. EAS commands for the later APK phase:

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
```

`preview` produces an APK; `production` produces an AAB. Configure public environment values and your Firebase Android file in the build environment. See [ANDROID.md](docs/ANDROID.md) for device setup, signing and limitations.

## Firebase and database setup

1. Copy `.env.example` to `.env` and leave `DEMO_MODE=false`.
2. Enable Firebase Email/Password authentication and create Firestore. Register web and Android apps in your project.
3. Fill `VITE_FIREBASE_*` for the web build and `EXPO_PUBLIC_FIREBASE_*` in `apps/mobile/.env` for Android. Give the server `FIREBASE_SERVICE_ACCOUNT_JSON`, or use local Application Default Credentials as described in [SETUP.md](docs/SETUP.md). Private keys never belong in public variables.
4. Authenticate the Firebase CLI, then deploy rules/indexes, seed products and bootstrap an existing Firebase Auth user as administrator:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project YOUR_FIREBASE_PROJECT_ID
npm run seed
npm run bootstrap:admin -- your-admin-email@example.com
```

The seed preserves existing product edits and stock. There is no public admin-registration route. Add the deployed web domains to Firebase Authentication's authorized domains after deployment.

| Firestore collection | Contents and access                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `users`              | Profile, role, dealer approval and address; owner/admin reads                                     |
| `products`           | Retail/wholesale prices, stock, image and specs; privileged reads, redacted retail API            |
| `orders`             | Owner, canonical item snapshots, INR paise amount, payment and status timeline; owner/admin reads |
| `services`           | Customer request, location/address, preferred date and staff status; owner/admin reads            |
| `devices`            | Owner-bound Android push tokens; server-managed                                                   |
| `posts`              | Daily product snapshot, execution stages/logs, lease, hosted image and Instagram IDs; admin reads |
| `notifications`      | Channel delivery/error records; admin reads                                                       |

`firestore.rules` denies direct client writes and unauthorized reads. The API uses the Admin SDK, so it independently validates ownership, role, dealer status, input and price. See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for routes, data models and payment transitions.

## Payment, AI, Instagram and notifications

**Razorpay:** configure a test key ID, matching server secret and webhook secret. Live-mode keys are refused. Enable test auto-capture and send `payment.captured` webhooks to `/api/payments/webhook`. The server verifies HMAC and exact captured amount/currency/provider order. No real funds are charged by the local demo. Setup and reconciliation steps are in [SETUP.md](docs/SETUP.md).

**AI and public images:** configure Gemini for captions plus an available Gemini or Hugging Face image model, and Cloudinary credentials. Do a real draft before enabling publication. The local fixture uses deterministic text and an existing catalogue photo; it is explicitly not AI-generated. The included standalone creative is separately labeled.

**Instagram:** use your eligible professional account, authorized Meta app/token, correct Instagram or Facebook login flow, account ID, permissions and supported Graph API version. Leave `INSTAGRAM_PUBLISH_ENABLED=false` until a real hosted draft has been reviewed. The application only records `published` after a successful official API response with a media ID.

**n8n:** import `automation/workflows/daily-instagram.json` and `expire-orders.json`, replace their API origins, and select an HTTP Header Auth credential with `Authorization: Bearer YOUR_CRON_SECRET`. Imports are inactive; execute manually, inspect results and then activate them on a persistent host. Full provider, Docker, schedule and safe-retry instructions are in [AUTOMATION.md](docs/AUTOMATION.md) and [automation/README.md](automation/README.md).

**Notifications and maps:** Resend email, native Android FCM and optional TextBee SMS adapters record outcomes. Missing credentials record skipped delivery. OpenStreetMap/Leaflet displays optional address pins in the web UI; Android opens the captured pin in OpenStreetMap. App location and push permissions are requested through the platform.

## Environment reference

Use the placeholder-only root `.env.example`, mobile `.env.example`, and automation `.env.example`. [ENVIRONMENT.md](docs/ENVIRONMENT.md) describes every variable, where it belongs and which integration needs it. Values beginning `VITE_` or `EXPO_PUBLIC_` are bundled into public clients; never put server credentials in them. Restart development servers or rebuild clients after changing public variables.

## Build and verification commands

```bash
npm test                                  # Domain/API/automation/sample tests
npm run check                             # TypeScript: API and all four apps
npm run check:runtime                     # Compiled Node ESM API startup/routing
npm run format:check                      # Prettier formatting; not ESLint
npm run build                             # All three web production builds
npm run export:android -w apps/mobile -- --clear --max-workers 2
npm run emulator:test                     # Firebase Auth/Firestore; Java recommended
npm run automation:run                    # Demo fixture with demo .env; otherwise real providers
python3 scripts/package-source.py         # Rebuild and verify the source ZIP
```

The Android export verifies bundling, not APK compilation or device behavior. Mock provider tests do not prove live provider delivery. [TEST_RESULTS.md](docs/TEST_RESULTS.md) records exactly what was executed.

## Troubleshooting

| Symptom                                            | Resolution                                                                                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Firebase not configured / sign-in unavailable      | Use the explicit sample/demo mode, or fill Firebase public and server configuration; restart/rebuild.                             |
| Signed in but profile incomplete                   | Complete customer/dealer registration. Bootstrap administrators with the server-only script.                                      |
| Dealer sees pending/rejected or no wholesale price | Approve the dealer in admin, then refresh/relogin. The server always checks the current status.                                   |
| API returns HTML or 404                            | Confirm the API origin, Vite proxy, Vercel repository-root settings and checked-in rewrites. The origin must not include `/api`.  |
| Android cannot reach localhost                     | Use emulator `10.0.2.2` or the host LAN address. A phone's `localhost` points to the phone. Use HTTPS for final builds.           |
| Photos missing locally on Android                  | Keep the development API running; check `API_ORIGIN/products/countertop-carbon.jpg`.                                              |
| Native Razorpay/FCM module unavailable             | Install a native development client/APK; Expo Go does not include these modules.                                                  |
| Payment pending after a network error              | Inspect order history and Razorpay test dashboard/webhook before retrying. Expiry cleanup releases unpaid reservations.           |
| AI provider error                                  | Check the chosen model/account/quota and saved job error; no stock image is silently substituted.                                 |
| Instagram `needs_review`                           | Inspect the recorded container and actual account before a manual correction; do not blindly replay publication.                  |
| n8n imported but nothing posts                     | Configure URL/credential, run manually, review live/draft setting and activate the workflow on an always-on host.                 |
| Emulator startup fails                             | Install Java 21, ensure ports 8080/9099 are available and allow official emulator downloads.                                      |
| Gradle/EAS build fails before compilation          | Check network access, Android tooling, Expo project, signing and account build availability. An exported JS bundle is not an APK. |

This is an assignment-sized implementation: lists/maintenance batches are capped at 500, push fan-out at 20 devices per user, and refunds, provider-token refresh and large-scale operations require additional work. The next phases are source publication, deployment, provider configuration, APK build, scheduled integration testing and the [submission checklist](docs/SUBMISSION.md).
