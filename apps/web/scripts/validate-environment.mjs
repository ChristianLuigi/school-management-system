const isProduction = process.env.NODE_ENV === "production";

function fail(message) {
  throw new Error(`Invalid web environment: ${message}`);
}

function parseHttpUrl(name, value, { httpsRequired = false } = {}) {
  if (!value) fail(`${name} is required.`);
  let parsed;
  try { parsed = new URL(value); } catch { fail(`${name} must be an absolute URL.`); }
  if (!["http:", "https:"].includes(parsed.protocol)) fail(`${name} must use HTTP or HTTPS.`);
  if (httpsRequired && parsed.protocol !== "https:") fail(`${name} must use HTTPS in production.`);
  if (parsed.username || parsed.password) fail(`${name} must not contain credentials.`);
  return parsed.origin;
}

export function validateWebEnvironment() {
  if (!isProduction) return;
  const publicOrigin = parseHttpUrl("APP_PUBLIC_URL", process.env.APP_PUBLIC_URL, {
    httpsRequired: process.env.ALLOW_INSECURE_PUBLIC_URL !== "true",
  });
  parseHttpUrl("API_BASE_URL", process.env.API_BASE_URL);
  const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? publicOrigin)
    .split(",").map((value) => value.trim()).filter(Boolean)
    .map((value) => parseHttpUrl("TRUSTED_ORIGINS", value));
  if (!trustedOrigins.includes(publicOrigin)) fail("TRUSTED_ORIGINS must include APP_PUBLIC_URL.");
  const cookieName = process.env.AUTH_COOKIE_NAME ?? "__Host-almac_session";
  if (!cookieName.startsWith("__Host-")) fail("AUTH_COOKIE_NAME must use the __Host- prefix in production.");
  const storageRoot = process.env.UPLOAD_STORAGE_ROOT;
  if (!storageRoot || !storageRoot.startsWith("/")) fail("UPLOAD_STORAGE_ROOT must be an absolute container path.");
}