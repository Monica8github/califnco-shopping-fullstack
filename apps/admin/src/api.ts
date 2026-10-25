import { initializeApp, getApps } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import type { Profile } from "../../../shared/types";
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const requiredFirebaseVariables = {
  apiKey: "VITE_FIREBASE_API_KEY",
  authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "VITE_FIREBASE_PROJECT_ID",
  appId: "VITE_FIREBASE_APP_ID",
} as const;
export const missingFirebaseVariables = Object.entries(requiredFirebaseVariables)
  .filter(([key]) => {
    const value = config[key as keyof typeof config];
    return typeof value !== "string" || !value.trim();
  })
  .map(([, variable]) => variable);
export const firebaseProjectId = config.projectId?.trim() || "";
let initializationError = "";
let firebaseAuth: ReturnType<typeof getAuth> | null = null;
if (!missingFirebaseVariables.length) {
  try {
    const app =
      getApps().find((candidate) => candidate.options.projectId === config.projectId) ||
      initializeApp(config, `califnco-${config.projectId}`);
    firebaseAuth = getAuth(app);
    const globals = globalThis as typeof globalThis & {
      __califncoEmulatorAuth?: WeakSet<object>;
    };
    globals.__califncoEmulatorAuth ??= new WeakSet<object>();
    if (
      import.meta.env.VITE_AUTH_EMULATOR_URL &&
      !globals.__califncoEmulatorAuth.has(firebaseAuth)
    ) {
      connectAuthEmulator(firebaseAuth, import.meta.env.VITE_AUTH_EMULATOR_URL, {
        disableWarnings: true,
      });
      globals.__califncoEmulatorAuth.add(firebaseAuth);
    }
  } catch {
    initializationError = "Firebase could not be initialized. Verify the web app configuration.";
  }
}
export const auth = firebaseAuth;
export function firebaseConfigurationError(serverProjectId?: string) {
  if (missingFirebaseVariables.length)
    return `Firebase sign-in is not configured. Missing: ${missingFirebaseVariables.join(", ")}.`;
  if (initializationError) return initializationError;
  if (serverProjectId && serverProjectId !== firebaseProjectId)
    return "Firebase project mismatch: VITE_FIREBASE_PROJECT_ID and FIREBASE_PROJECT_ID must identify the same project.";
  return "";
}
export let demoToken = sessionStorage.getItem("califnco-demo-token") || "";
export function setDemoToken(value: string) {
  demoToken = value;
  if (value) sessionStorage.setItem("califnco-demo-token", value);
  else sessionStorage.removeItem("califnco-demo-token");
}
export const isBrowserDemo = () => demoToken.startsWith("browser-demo:");
export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (isBrowserDemo()) {
    const { demoApi } = await import("./browserDemo");
    return demoApi(path, method, body, demoToken);
  }
  const token = demoToken || (await auth?.currentUser?.getIdToken());
  const request = (bearer: string) =>
    fetch("/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(bearer ? { Authorization: "Bearer " + bearer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let response = await request(token || "");
  if (response.status === 401 && !demoToken && auth?.currentUser) {
    const refreshedToken = await auth.currentUser.getIdToken(true);
    response = await request(refreshedToken);
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "API unavailable. Verify the Vercel root and API deployment.",
    );
  }
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
export type Session = {
  profile: Profile | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};
