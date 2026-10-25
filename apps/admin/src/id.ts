// getRandomValues also works on HTTP development origins, where randomUUID
// is unavailable. These identifiers are for uniqueness, never authentication.
export function clientId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return (
    Date.now().toString(36) +
    "-" +
    Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  );
}
