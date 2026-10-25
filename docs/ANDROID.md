# Android app and APK

The source is a native Expo SDK 54 / React Native Android app. An exported Hermes JavaScript bundle is **not an installable APK**. Razorpay and FCM require a native development build or APK, not Expo Go.

## App configuration

1. Copy `apps/mobile/.env.example` to `apps/mobile/.env`.
2. Set `EXPO_PUBLIC_API_URL` to the deployed HTTPS origin, without `/api`. Fill the Firebase public configuration. Rebuild after changing these values.
3. For local API testing, use an address reachable from the Android device. Android emulator `10.0.2.2:8787` reaches a development server on the host; a physical device needs its host's LAN address. Local HTTP requires a development network configuration. Use HTTPS for the final build.
4. Register Android package `com.califnco.watercare` in Firebase and put its `google-services.json` in `apps/mobile` for push notifications. This file is excluded from git.

## Build with EAS

Authenticate to your Expo account and run from `apps/mobile`:

```bash
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
```

The checked-in `preview` profile produces an APK; `production` produces an AAB. `development` creates an Expo development client. EAS project setup/signing is account-dependent. If EAS supplies a project ID, set `EAS_PROJECT_ID` or retain the generated `extra.eas.projectId`. Set the `EXPO_PUBLIC_*` values in the chosen EAS environment as well. Never put Firebase Admin, Razorpay secret, Gemini, or Instagram keys into an EAS public variable.

For FCM in cloud builds, provide the Google services file through your chosen EAS file/environment mechanism or the local upload included with the build. Keep it out of public source history. This package does not include or invent a signing key.

## Build locally

With a compatible JDK, Android SDK/build tools, and Android emulator/device installed:

```bash
npm ci
cd apps/mobile
npx expo prebuild --platform android
npx expo run:android
```

A development APK is suitable for local evaluation. Use EAS or configure your own release signing for distribution. The project intentionally does not commit generated `android/` or `ios/` directories.

## Verify without Android tooling

At the repository root:

```bash
npm run check
npm run export:android -w apps/mobile -- --clear --max-workers 2
```

The Metro configuration includes the repository's `shared` folder, so the app also bundles from a ZIP checkout.

## Device walkthrough to record

Register customer → browse/search/filter → view specifications → add item → edit quantity → add address/location → pay with a Razorpay test instrument → see confirmed order → request service → enable notifications → sign out. Then register a dealer, show the pending state, approve in the admin, refresh/relogin, demonstrate wholesale price and minimum quantity. Test notification permission refusal and payment cancellation as well as success.

Actual APK installation, native Razorpay UI, location permission, FCM delivery and device screenshots remain unverified until performed on an Android device with configured services. Build status is recorded in `TEST_RESULTS.md`; there is no fictitious APK download link.
