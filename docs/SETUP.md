# Setup and Vercel deployment

## 1. Install and choose a mode

Use Node 22.13+ or 24, npm, and the committed lockfile. Run `npm ci` at the repository root. For a local walkthrough, copy `.env.demo.example` to `.env`, run `npm run dev`, and use the clearly labeled demo buttons. Stop the server before switching modes.

Without Firebase, the web apps also offer a browser sample workspace. Its changes stay in session storage in that browser tab; it does not call payment, AI, booking or messaging services. It does not share records between separate web origins. The native Android app uses the local demo API or configured Firebase backend, not the browser adapter. See [ENVIRONMENT.md](ENVIRONMENT.md) for the complete variable reference.

For real services, copy `.env.example` to `.env`, leave `DEMO_MODE=false`, and fill values locally or in the hosting provider's secret settings. Never put private credentials in `VITE_` or `EXPO_PUBLIC_` variables. Their values are embedded in browser/Android bundles.

## 2. Firebase

1. Create/select your Firebase project. Enable Authentication → Email/Password and create Firestore in production mode.
2. Register a web app and copy its public API key, auth domain, project ID, and app ID into `VITE_FIREBASE_*`. Copy those values into `apps/mobile/.env` under `EXPO_PUBLIC_FIREBASE_*`.
3. Provide `FIREBASE_SERVICE_ACCOUNT_JSON` to the **server only**, as the entire service-account JSON object. Locally, `GOOGLE_APPLICATION_CREDENTIALS` may instead point at a private JSON file. Keep keys out of git and archives. Use a service identity with only the Firebase permissions required for this project.
4. Deploy the checked-in rules with `npx firebase-tools deploy --only firestore:rules,firestore:indexes --project YOUR_FIREBASE_PROJECT_ID` after authenticating the CLI.
5. Run `npm run seed`. Existing catalogue documents are preserved, including stock and edits. Running the seed again does not reset inventory.
6. Create the intended administrator's email/password account in Firebase Auth or register through the app, then run `npm run bootstrap:admin -- your-admin-email@example.com`. This command selects an **existing** account and writes its role through the Admin SDK. There is no public administrator registration endpoint.
7. Add the deployed Vercel domain to Firebase Authentication → Authorized domains. Confirm password-reset email templates in Firebase.

All clients use ID tokens for the API. Roles and dealer status are read from Firestore on every protected request; client-supplied roles/prices are never accepted. Direct Firestore writes are denied. Customers read their own records; product documents containing wholesale prices are restricted, and the API returns a redacted retail view.

For local Firebase development, run emulators on ports 9099/8080. Set `FIREBASE_PROJECT_ID=demo-califnco`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, and `VITE_AUTH_EMULATOR_URL=http://127.0.0.1:9099`. Emulator variables must never be set on Vercel.

## 3. Razorpay test checkout

- Use test credentials: `RAZORPAY_KEY_ID` beginning `rzp_test_` and `RAZORPAY_KEY_SECRET`. The API refuses live-mode keys.
- Enable auto-capture in the Razorpay test dashboard. Checkout success is accepted only after signature verification and a server fetch confirms captured status, exact amount, currency, and provider order ID.
- Create a webhook for `https://YOUR_DOMAIN/api/payments/webhook`, subscribe to `payment.captured`, and set its secret as `RAZORPAY_WEBHOOK_SECRET`. The handler verifies the signature against the raw body before accepting the event.
- Test checkout failure/cancellation, pending capture, retry, and webhook delivery in the test dashboard. Use Razorpay's documented test instruments; no real card details are needed.
- Unpaid reservations expire after 30 minutes when the maintenance workflow runs. Payments received after a cancellation become `paid_needs_review` and cannot be fulfilled automatically. Reconcile them in Razorpay; refunds are deliberately not automated by this assignment.

## 4. Notifications

Email: configure a verified Resend sender in `MAIL_FROM` plus `RESEND_API_KEY`. Android push: register `com.califnco.watercare` in the same Firebase project; place `google-services.json` in `apps/mobile`, enable the Firebase Cloud Messaging API, and rebuild the native app. The profile screen requests consent and registers the device's FCM token. Sign-out unregisters the saved token.

Optional SMS: configure your TextBee Android gateway device and `TEXTBEE_API_KEY` / `TEXTBEE_DEVICE_ID`. SMS originates from that device and depends on its network/SIM. Notification records explicitly distinguish `sent`, `partial`, `skipped`, `demo_not_sent`, and `unknown`. An ambiguous provider result needs inspection before retrying. None of these services is represented as delivered merely because variables are present.

## 5. GitHub

Create a repository named `califnco-ecommerce-ai-automation` in the intended account. Push this complete monorepo, including the product assets and lockfile. Exclude `.env`, service-account files, `node_modules`, generated Android directories and build outputs. The `.gitignore` already covers these.

If initializing from an archive:

```bash
git init -b main
git add .
git commit -m "Build Califnco commerce apps and daily social workflow"
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Use your ordinary GitHub authentication. Never paste a token into a remote URL or a chat message.

## 6. Vercel

Import the repository into the authorized Vercel workspace three times, following [SEPARATE_DEPLOYMENTS.md](SEPARATE_DEPLOYMENTS.md). Use the **repository root**, framework preset **Other**, install command `npm ci`, build command `npm run build:deployment`, output directory `dist`, and the correct `CALIFNCO_APP` value for each project. The checked-in `vercel.json` supplies these settings, the API function, and routing.

Set Node 22.x or 24.x. Add server variables from `.env.example` and the public `VITE_FIREBASE_*` values to the appropriate Preview/Production environments. Set `DEMO_MODE=false`. Add `CRON_SECRET`, a random 32-byte secret shared only with n8n's HTTP credential. Keep `INSTAGRAM_PUBLISH_ENABLED=false` until the live draft has been reviewed. Redeploy whenever client build variables change.

After deployment verify:

1. `/api/health` reports `firebase`; the integration indicators only report configuration presence.
2. Admin login succeeds; a customer token receives 403 from `/api/admin/overview`.
3. Product photos load from `/products/…`, and reloading a web route returns the application.
4. A customer can create a test payment, verify it, and see the order. A dealer only receives wholesale prices after approval.
5. API calls from the native APK reach the same origin. Set `EXPO_PUBLIC_API_URL` to that origin, without `/api`.

Vercel deployment protection must permit the intended evaluator, native API traffic, Razorpay webhook, and scheduler. Configure project access appropriately; do not distribute a temporary protection-bypass secret inside the Android app. This project does not modify account-wide protection settings.

## Known scale boundary

This is an assignment-sized implementation. Lists are capped at 500 records, device fan-out at 20 tokens per user, and maintenance processes at most 500 pending orders per invocation. Larger installations need pagination, indexed expiry queries, durable notification workers, request limits, operational monitoring, and a separate review/refund process. Those are not presented as completed features.

Official references: [Firebase Admin setup](https://firebase.google.com/docs/admin/setup), [Firebase rules](https://firebase.google.com/docs/firestore/security/get-started), [Razorpay React Native](https://razorpay.com/docs/payments/payment-gateway/react-native-integration/standard/), [Vercel configuration](https://vercel.com/docs/project-configuration), [Expo notifications](https://docs.expo.dev/push-notifications/overview/).
