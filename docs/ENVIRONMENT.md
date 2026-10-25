# Environment variables

All example files contain placeholders only. Keep real `.env` files, Firebase service accounts, Android Google services files, signing keys and provider tokens out of archives and git. Public client variables are embedded in built apps; all other credentials below belong only to the server or scheduler.

## Root API and web environment

Copy root `.env.example` to `.env` for local services. Both web apps set Vite `envDir` to the repository root, and the API/CLI reads it through Node's env-file option. The four `VITE_FIREBASE_*` values must be the Web app settings from the same Firebase project as `FIREBASE_PROJECT_ID`. Vite embeds these public values at build time: stop and restart the local development server after editing `.env`; in Vercel or another frontend host set them for the intended project/environment and rebuild the client. Configuration diagnostics name missing variables without printing their values. Configure values in the hosting provider instead of uploading `.env`.

| Variable                         | Purpose / requirement                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CALIFNCO_APP`                   | `admin`, `storefront` or `automation`; selects the independent deployment build. Defaults to storefront.                                                            |
| `DEMO_MODE`                      | `true` only for the local simulated API. Forced off on Vercel or when `NODE_ENV=production`.                                                                        |
| `DEMO_DATA_FILE`                 | Optional local demo JSON path; default `.local/demo.json`. Present in `.env.demo.example`.                                                                          |
| `FIREBASE_PROJECT_ID`            | Firebase project ID for the server/seed/bootstrap.                                                                                                                  |
| `FIREBASE_SERVICE_ACCOUNT_JSON`  | Complete server-only service-account JSON object on one line. Alternative: local application credentials.                                                           |
| `GOOGLE_APPLICATION_CREDENTIALS` | Optional local path to a private service-account file, outside the repository.                                                                                      |
| `VITE_FIREBASE_API_KEY`          | Public Firebase web API key.                                                                                                                                        |
| `VITE_FIREBASE_AUTH_DOMAIN`      | Public Firebase authentication domain.                                                                                                                              |
| `VITE_FIREBASE_PROJECT_ID`       | Public Firebase project ID.                                                                                                                                         |
| `VITE_FIREBASE_APP_ID`           | Public Firebase web app ID.                                                                                                                                         |
| `VITE_API_BASE_URL`              | Optional public API origin for a separately hosted browser app, such as the Render Web Service URL. Leave blank to use same-origin `/api` and the local Vite proxy. |
| `VITE_AUTH_EMULATOR_URL`         | Local-only Firebase Auth emulator URL, for example `http://127.0.0.1:9099`; never set on a public deployment.                                                       |
| `ALLOWED_ORIGINS`                | Comma-separated exact browser origins allowed by the API when frontend and API use different origins. Same-origin deployments need no entry.                        |
| `RAZORPAY_KEY_ID`                | Test key ID beginning `rzp_test_`; live keys are refused. The checkout receives the public ID from the server.                                                      |
| `RAZORPAY_KEY_SECRET`            | Matching test account secret; server only.                                                                                                                          |
| `RAZORPAY_WEBHOOK_SECRET`        | Raw-body HMAC webhook verification secret.                                                                                                                          |
| `CRON_SECRET`                    | Random scheduler bearer secret; match the n8n Header Auth credential.                                                                                               |
| `AUTOMATION_TIMEZONE`            | Day boundary for daily jobs; default `Asia/Kolkata`. Keep n8n workflow timezone aligned.                                                                            |
| `AUTOMATION_ALERT_EMAIL`         | Optional recipient for failure notices through configured Resend.                                                                                                   |
| `GEMINI_API_KEY`                 | Server Gemini credential for caption generation, and images if selected.                                                                                            |
| `GEMINI_TEXT_MODEL`              | Available caption model. Example defaults to `gemini-2.5-flash`; verify availability in your account.                                                               |
| `AI_IMAGE_PROVIDER`              | `huggingface` or `gemini`.                                                                                                                                          |
| `HF_TOKEN`                       | Hugging Face inference token when that image provider is selected.                                                                                                  |
| `HF_IMAGE_MODEL`                 | Available image model identifier for your inference account.                                                                                                        |
| `HF_PROVIDER`                    | Inference provider selection; example `auto`.                                                                                                                       |
| `GEMINI_IMAGE_MODEL`             | Image-capable Gemini model available to your account when selected.                                                                                                 |
| `CLOUDINARY_CLOUD_NAME`          | Cloudinary cloud for public product post images.                                                                                                                    |
| `CLOUDINARY_API_KEY`             | Cloudinary signed-upload key; keep in server configuration.                                                                                                         |
| `CLOUDINARY_API_SECRET`          | Cloudinary upload signature secret.                                                                                                                                 |
| `INSTAGRAM_PUBLISH_ENABLED`      | Defaults to `false`. `true` allows the protected scheduled endpoint to advance a live job. Admin draft actions remain draft-only.                                   |
| `INSTAGRAM_LOGIN_TYPE`           | `instagram` or `facebook`; selects the official Graph host and matching token flow.                                                                                 |
| `INSTAGRAM_ACCOUNT_ID`           | Authorized professional account ID.                                                                                                                                 |
| `INSTAGRAM_ACCESS_TOKEN`         | Token for the selected login flow with current publishing permissions.                                                                                              |
| `META_GRAPH_VERSION`             | Explicit supported Graph API version for your Meta app. Intentionally blank in the example.                                                                         |
| `RESEND_API_KEY`                 | Optional server email provider credential.                                                                                                                          |
| `MAIL_FROM`                      | Verified sender accepted by Resend.                                                                                                                                 |
| `TEXTBEE_API_KEY`                | Optional SMS gateway credential.                                                                                                                                    |
| `TEXTBEE_DEVICE_ID`              | TextBee Android gateway device ID; depends on its SIM/network.                                                                                                      |

Generate scheduler/encryption values locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and store them privately. Do not include generated values in screenshots or commits.

## Android environment

Copy `apps/mobile/.env.example` to `apps/mobile/.env`; Expo loads this app-level file. Root `EXPO_PUBLIC_*` entries are a reference for deployment configuration, not a substitute for the mobile file. Set the same public values in the selected EAS build environment.

| Variable                           | Purpose                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`              | Reachable API origin, without trailing `/api`. HTTPS for distributed builds. |
| `EXPO_PUBLIC_FIREBASE_API_KEY`     | Public Firebase client API key.                                              |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Public Firebase authentication domain.                                       |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID`  | Public Firebase project ID.                                                  |
| `EXPO_PUBLIC_FIREBASE_APP_ID`      | Public Firebase app ID used by the JavaScript Auth client.                   |
| `EAS_PROJECT_ID`                   | Expo project ID placed in `extra.eas.projectId` during app configuration.    |

For Android FCM also supply `apps/mobile/google-services.json` from the matching Firebase Android app, using an appropriate EAS file variable/upload for cloud builds. The native application ID is `com.califnco.watercare`. Firebase Admin uses the same project to send push messages. No FCM server secret belongs in the client.

## Emulator-only settings

For a disposable Firebase project, use `FIREBASE_PROJECT_ID=demo-califnco`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, and `VITE_AUTH_EMULATOR_URL=http://127.0.0.1:9099`. For Android set `EXPO_PUBLIC_AUTH_EMULATOR_URL` to a reachable emulator address, such as `http://10.0.2.2:9099`. Never set emulator variables on a public deployment. The emulator test command configures its own disposable environment.

## n8n environment

Copy `automation/.env.example` to `automation/.env` for Docker Compose. Set `N8N_VERSION` to a specific supported image version and `N8N_ENCRYPTION_KEY` to a stable random private value. Retain that encryption key with backups of the persistent volume; changing it prevents existing n8n credentials from being read. `GENERIC_TIMEZONE`/`TZ` are set to Asia/Kolkata by Compose. The API origin is configured in the imported workflow and `CRON_SECRET` is stored in n8n's Header Auth credential, not in its exported JSON.
