import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { request } from "./client";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
const tokenKey = "califnco-fcm-device-token";
export async function enablePush() {
  if (!Device.isDevice || Platform.OS !== "android")
    throw new Error(
      "FCM requires an Android device with a development or APK build.",
    );
  await Notifications.setNotificationChannelAsync("orders", {
    name: "Order and service updates",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted")
    permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted")
    throw new Error("Notification permission was not granted.");
  const token = String((await Notifications.getDevicePushTokenAsync()).data);
  await request("/devices", "POST", { token });
  await AsyncStorage.setItem(tokenKey, token);
  return token;
}
export async function disablePush() {
  const token = await AsyncStorage.getItem(tokenKey);
  if (token) {
    await request("/devices", "DELETE", { token });
    await AsyncStorage.removeItem(tokenKey);
  }
}
