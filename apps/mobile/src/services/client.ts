import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp, getApps } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  connectAuthEmulator,
} from "firebase/auth";
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "").replace(
  /\/$/,
  "",
);
function setupAuth() {
  if (!config.apiKey || !config.projectId) return null;
  const app = getApps()[0] || initializeApp(config);
  let auth;
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    auth = getAuth(app);
  }
  if (process.env.EXPO_PUBLIC_AUTH_EMULATOR_URL)
    connectAuthEmulator(auth, process.env.EXPO_PUBLIC_AUTH_EMULATOR_URL, {
      disableWarnings: true,
    });
  return auth;
}
export const auth = setupAuth();
let demoToken = "";
export const setDemoToken = (value: string) => {
  demoToken = value;
};
export async function request<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (!API_URL)
    throw new Error(
      "Set EXPO_PUBLIC_API_URL to your Vercel URL, then rebuild the app.",
    );
  const token = demoToken || (await auth?.currentUser?.getIdToken());
  const response = await fetch(API_URL + "/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The server did not return JSON. Check the API URL.");
  }
  if (!response.ok) throw new Error(data.error || "The request failed");
  return data;
}
export const imageUrl = (value: string) =>
  value.startsWith("/") ? API_URL + value : value;
