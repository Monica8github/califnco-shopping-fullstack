import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { Profile } from "../../../shared/types";
import {
  api,
  auth,
  setDemoToken,
  demoToken,
  isBrowserDemo,
  firebaseConfigurationError,
} from "./api";
import Auth from "./Auth";
import Admin from "./Admin";
import Shop from "./Shop";
import { Loading, FormError, Field } from "./components";
import "./style.css";
export default function App({
  kind = "all",
}: {
  kind?: "all" | "admin" | "store" | "automation";
}) {
  const [profile, setProfile] = useState<Profile | null>(null),
    [mode, setMode] = useState("loading"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [configurationError, setConfigurationError] = useState(""),
    [needsProfile, setNeedsProfile] = useState(false);
  async function refresh() {
    try {
      const r = await api("/me");
      setProfile(r.profile);
      setNeedsProfile(false);
      setError("");
    } catch (e) {
      setProfile(null);
      const message = (e as Error).message;
      if (message.includes("Complete your account")) setNeedsProfile(true);
      else throw e;
    }
  }
  useEffect(() => {
    api("/health")
      .then((r) => {
        setMode(r.mode);
        const clientIssue = firebaseConfigurationError(r.firebaseProjectId);
        const serverIssue = r.configurationIssues?.length
          ? `Server Firebase configuration is incomplete: ${r.configurationIssues.join("; ")}.`
          : "";
        setConfigurationError(
          clientIssue || (r.mode === "setup-required" ? serverIssue : ""),
        );
      })
      .catch((e) => {
        setMode("setup-required");
        setConfigurationError(`Cannot reach the Califnco API: ${e.message}`);
      });
    if (isBrowserDemo()) {
      refresh()
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
      return;
    }
    if (auth) {
      return onAuthStateChanged(auth, async (user) => {
        try {
          if (user) await refresh();
          else if (!demoToken) {
            setProfile(null);
            setNeedsProfile(false);
            setError("");
          }
        } catch (e) {
          setProfile(null);
          setError((e as Error).message);
        } finally {
          setLoading(false);
        }
      });
    }
    if (demoToken)
      refresh()
        .catch((e) => {
          setDemoToken("");
          setError(e.message);
        })
        .finally(() => setLoading(false));
    else setLoading(false);
  }, []);
  async function logout() {
    setDemoToken("");
    if (auth) await signOut(auth);
    setProfile(null);
    setNeedsProfile(false);
    setError("");
  }
  if (loading) return <Loading />;
  if (needsProfile && (kind === "admin" || kind === "automation"))
    return (
      <div className="profile-panel panel">
        <h1>Administrator setup required</h1>
        <p>
          This account needs an administrator profile. Follow the bootstrap
          steps in the setup guide.
        </p>
        <button className="secondary" onClick={logout}>
          Sign out
        </button>
      </div>
    );
  if (needsProfile)
    return (
      <div className="profile-panel panel">
        <h1>Complete your account</h1>
        <p>
          Your Firebase login exists. Choose your shopping role to finish setup.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            try {
              await api("/profile", "POST", {
                name: d.get("name"),
                phone: d.get("phone"),
                role: d.get("role"),
                businessName: d.get("businessName"),
              });
              await refresh();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <Field label="Name">
            <input name="name" required minLength={2} />
          </Field>
          <Field label="Phone">
            <input name="phone" required />
          </Field>
          <Field label="Role">
            <select name="role">
              <option value="customer">Customer</option>
              <option value="dealer">Dealer</option>
            </select>
          </Field>
          <Field label="Business name (dealers)">
            <input name="businessName" />
          </Field>
          <FormError error={error} />
          <button className="primary">Complete setup</button>
          <button type="button" className="secondary" onClick={logout}>
            Sign out
          </button>
        </form>
      </div>
    );
  if (!profile)
    return (
      <>
        <Auth
          mode={mode}
          refresh={refresh}
          configurationError={configurationError}
          roles={
            kind === "store"
              ? ["customer", "dealer"]
              : kind === "all"
                ? ["admin", "customer", "dealer"]
                : ["admin"]
          }
        />
        {error && (
          <div className="floating-error">
            <FormError error={error} />
          </div>
        )}
      </>
    );
  if (
    (kind === "store" && profile.role === "admin") ||
    ((kind === "admin" || kind === "automation") && profile.role !== "admin")
  )
    return (
      <div className="profile-panel panel">
        <h1>Use the right account</h1>
        <p>
          {kind === "store"
            ? "Sign in with a customer or dealer account to shop."
            : "An administrator account is required for this workspace."}
        </p>
        <button className="secondary" onClick={logout}>
          Sign out
        </button>
      </div>
    );
  const session = { profile, refresh, logout };
  return (
    <>
      {mode === "local-demo" && !isBrowserDemo() && (
        <div className="sample-banner">
          <strong>Local demo</strong>
          <span>
            Data is stored locally. Payments, messages, and bookings are simulated; no live account or provider is used.
          </span>
          <button onClick={logout}>Exit demo</button>
        </div>
      )}
      {isBrowserDemo() && (
        <div className="sample-banner">
          <strong>Sample workspace</strong>
          <span>
            Changes stay in this browser tab. No payments, messages, service
            bookings, or Instagram posts are sent.
          </span>
          <button onClick={logout}>Exit sample</button>
        </div>
      )}
      {profile.role === "admin" ? (
        <Admin session={session} automationOnly={kind === "automation"} />
      ) : (
        <Shop session={session} localDemo={mode === "local-demo"} />
      )}
    </>
  );
}
