import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, request, setDemoToken, API_URL } from "../services/client";
import { Button, Input, s, C } from "../components/ui";
export default function Login({
  onLogin,
  demo,
  complete = false,
}: {
  onLogin: () => Promise<void>;
  demo: boolean;
  complete?: boolean;
}) {
  const [register, setRegister] = useState(complete),
    [role, setRole] = useState<"customer" | "dealer">("customer"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [business, setBusiness] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [info, setInfo] = useState("");
  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (!auth)
        throw new Error(
          "Firebase is not configured in this build. Complete the mobile environment setup.",
        );
      setDemoToken("");
      if (register) {
        if (name.trim().length < 2 || !/^\+?[0-9]{10,15}$/.test(phone))
          throw new Error("Enter your name and a valid phone number.");
        if (role === "dealer" && !business.trim())
          throw new Error("Enter your business name.");
        if (!complete)
          await createUserWithEmailAndPassword(auth, email, password);
        await request("/profile", "POST", {
          name,
          phone,
          role,
          businessName: business,
        });
      } else await signInWithEmailAndPassword(auth, email, password);
      await onLogin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={s.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[s.body, { paddingTop: 30 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.brand}>califnco</Text>
        <Text style={[s.eyebrow, { marginTop: 4, letterSpacing: 4 }]}>
          WATER CARE
        </Text>
        <View style={[s.hero, { marginTop: 30 }]}>
          <Text style={s.eyebrow}>EVERY DROP, CONNECTED</Text>
          <Text style={s.h1}>Better water.{"\n"}Better everyday.</Text>
          <Text style={[s.p, { marginTop: 12 }]}>
            Your water care essentials, all in one place.
          </Text>
        </View>
        <Text style={s.h2}>
          {complete
            ? "Complete your profile"
            : register
              ? "Join the community"
              : "Welcome back"}
        </Text>
        <View style={s.row}>
          {(["customer", "dealer"] as const).map((r) => (
            <Pressable
              key={r}
              onPress={() => setRole(r)}
              style={[
                s.tab,
                { flex: 1, alignItems: "center" },
                role === r && s.tabActive,
              ]}
            >
              <Text style={[s.tabText, role === r && s.tabTextActive]}>
                {r === "customer" ? "Customer" : "Dealer"}
              </Text>
            </Pressable>
          ))}
        </View>
        {register && (
          <>
            <Input label="Full name" value={name} onChangeText={setName} />
            <Input
              label="Phone"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            {role === "dealer" && (
              <Input
                label="Business name"
                value={business}
                onChangeText={setBusiness}
              />
            )}
          </>
        )}
        {!complete && (
          <>
            <Input
              label="Email address"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Input
              label="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </>
        )}
        {error && (
          <View style={s.error}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}
        {info && <Text style={[s.p, { marginTop: 10 }]}>{info}</Text>}
        <Button
          title={
            busy ? "Please wait…" : register ? "Create account" : "Sign in"
          }
          disabled={busy}
          onPress={submit}
        />
        {!complete && (
          <>
            <Button
              title={
                register ? "Already registered? Sign in" : "Create an account"
              }
              secondary
              onPress={() => setRegister(!register)}
            />
            <Pressable
              onPress={async () => {
                try {
                  if (!auth || !email)
                    throw new Error("Enter your email address first.");
                  await sendPasswordResetEmail(auth, email);
                  setInfo("Password reset requested. Check your inbox.");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Text
                style={[
                  s.small,
                  { textAlign: "center", marginTop: 18, color: C.green },
                ]}
              >
                Forgot password?
              </Text>
            </Pressable>
          </>
        )}
        {demo && (
          <>
            <Text style={[s.small, { marginTop: 25, textAlign: "center" }]}>
              Local demo · No actual payments or notifications
            </Text>
            <Button
              title={`Explore as ${role}`}
              secondary
              onPress={async () => {
                setDemoToken("demo-" + role);
                try {
                  await onLogin();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          </>
        )}
        {!API_URL && (
          <Text style={[s.small, { marginTop: 20 }]}>
            Set EXPO_PUBLIC_API_URL to your deployed Vercel API URL before
            building.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
