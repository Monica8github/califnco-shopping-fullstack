import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { ArrowRight, ShieldCheck, Leaf, Droplets } from "lucide-react";
import { auth, api, setDemoToken, firebaseConfigurationError } from "./api";
import { Brand, Field, FormError } from "./components";
export default function Auth({
  mode,
  refresh,
  roles = ["admin", "customer", "dealer"],
  configurationError = "",
}: {
  mode: string;
  refresh: () => Promise<void>;
  roles: string[];
  configurationError?: string;
}) {
  const [role, setRole] = useState(roles[0]),
    [register, setRegister] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [business, setBusiness] = useState(""),
    [phone, setPhone] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [info, setInfo] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      const configError = configurationError || firebaseConfigurationError();
      if (configError) throw new Error(configError);
      if (!auth) throw new Error("Firebase sign-in is unavailable. Check the Firebase setup.");
      setDemoToken("");
      if (register) {
        await createUserWithEmailAndPassword(auth, email, password);
        await api("/profile", "POST", {
          name,
          phone,
          role,
          businessName: business,
        });
      } else await signInWithEmailAndPassword(auth, email, password);
      await refresh();
    } catch (e) {
      setError(authError((e as Error).message));
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    setError("");
    setInfo("");
    try {
      if (!email.trim()) throw new Error("Enter your email address first.");
      const configError = configurationError || firebaseConfigurationError();
      if (configError) throw new Error(configError);
      if (!auth) throw new Error("Firebase password reset is unavailable. Check the Firebase setup.");
      await sendPasswordResetEmail(auth, email);
      setInfo("Password reset requested. Check your inbox.");
    } catch (e) {
      setError(authError((e as Error).message));
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div className="auth-copy">
          <div className="eyebrow">
            <Leaf size={16} /> EVERY DROP, CONNECTED
          </div>
          <h1>
            Better water.
            <br />
            Better everyday.
          </h1>
          <p>
            One thoughtful workspace for your products, partners, and the people
            you serve.
          </p>
          <div className="auth-orbit">
            <Droplets size={100} />
            <span>
              CALIFNCO
              <br />
              <b>WATER CARE</b>
            </span>
          </div>
        </div>
        <div className="auth-footer">Commerce · Service · Connections</div>
      </section>
      <section className="auth-form">
        <div className="auth-card">
          <div className="eyebrow">WELCOME TO CALIFNCO</div>
          <h2>
            {register ? "Create your account" : "A fresh start, every day."}
          </h2>
          <p className="muted">
            {register
              ? "Join our water care community."
              : "Sign in to your workspace to keep things flowing."}
          </p>
          <div className="segmented">
            {roles.map((r) => (
              <button
                key={r}
                className={r === role ? "active" : ""}
                type="button"
                disabled={busy}
                onClick={() => {
                  setRole(r);
                  setRegister(false);
                  setError("");
                }}
              >
                {r}
              </button>
            ))}
          </div>
          <form onSubmit={submit}>
            {register && (
              <>
                <Field label="Full name">
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
                {role === "dealer" && (
                  <Field label="Business name">
                    <input
                      required
                      value={business}
                      onChange={(e) => setBusiness(e.target.value)}
                    />
                  </Field>
                )}
              </>
            )}
            <Field label="Email address">
              <input
                type="email"
                autoComplete="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                minLength={8}
                required
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <FormError error={error} />
            {info && (
              <p className="success" role="status">
                {info}
              </p>
            )}
            <button className="primary full" disabled={busy}>
              {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="auth-links">
            <button type="button" disabled={busy} onClick={reset}>Forgot password?</button>
            {role !== "admin" && (
              <button type="button" disabled={busy} onClick={() => setRegister(!register)}>
                {register ? "Already registered? Sign in" : "Create an account"}
              </button>
            )}
          </div>
          {mode === "local-demo" && (
            <div className="demo-login">
              <p>Local demonstration · no real payments or messages</p>
              <button
                className="secondary full"
                type="button"
                disabled={busy}
                onClick={async () => {
                  setDemoToken("demo-" + role);
                  setBusy(true);
                  try {
                    await refresh();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Explore as {role}
                <ArrowRight size={16} />
              </button>
            </div>
          )}
          {mode !== "local-demo" && configurationError && (
            <p className="setup-note">
              {configurationError} Set build-time VITE_ values before starting Vite or rebuilding the hosted app. See docs/SETUP.md.
            </p>
          )}
          {mode !== "local-demo" && (
            <div className="demo-login">
              <p>Explore sample data · no live transactions</p>
              <button
                className="secondary full"
                type="button"
                disabled={busy}
                onClick={async () => {
                  setDemoToken("browser-demo:demo-" + role);
                  setBusy(true);
                  try {
                    await refresh();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Explore as {role}
                <ArrowRight size={16} />
              </button>
              <p className="muted">
                Sample changes stay in this browser tab. Live accounts require
                Firebase setup.
              </p>
            </div>
          )}
          <div className="secure-note">
            <ShieldCheck size={15} /> Live account access is verified by the
            server.
          </div>
        </div>
      </section>
    </div>
  );
}

function authError(message: string) {
  const errors: Record<string, string> = {
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/user-not-found": "Email or password is incorrect.",
    "auth/email-already-in-use": "An account already exists for this email. Sign in instead.",
    "auth/weak-password": "Choose a stronger password (at least 8 characters).",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/network-request-failed": "Could not reach Firebase. Check your connection and try again.",
    "auth/too-many-requests": "Too many attempts. Wait a little and try again.",
    "auth/unauthorized-domain": "This website domain is not authorized in Firebase Authentication.",
  };
  const code = message.match(/auth\/[a-z-]+/)?.[0];
  return (code && errors[code]) || message;
}
