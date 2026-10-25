import "firebase/auth";
declare module "firebase/auth" {
  // Firebase exports this function in its React Native bundle. Its generic
  // public declaration file omits it, so declare the documented native API.
  export function getReactNativePersistence(storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }): import("firebase/auth").Persistence;
}
