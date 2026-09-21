import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Valam AI — Capacitor configuration (Android).
 *
 * The web UI in `frontend/src` is the SAME React/Vite app that ships to the
 * browser; Capacitor wraps the built `dist/` bundle in a native Android shell.
 *
 * WHY `server.hostname` IS SET (do not remove without reading this):
 *   The backend issues its rotating refresh token as an httpOnly cookie with
 *   `SameSite=Lax`, scoped to `/api/v1/auth` (see backend/app/config.py). Lax
 *   cookies are only sent on SAME-SITE requests. Capacitor's default WebView
 *   origin is `https://localhost`, which is a DIFFERENT site from
 *   `api.valam.in` — the cookie would be treated as cross-site and silently
 *   dropped, breaking silent login persistence after the access token (15 min)
 *   expires or the app restarts.
 *
 *   Running the WebView on origin `https://app.valam.in` makes the app and the
 *   API share the registrable site `valam.in`, so the Lax cookie is sent and
 *   the session persists. `app.valam.in` must therefore also be listed in the
 *   backend's `CORS_ORIGINS` (it is, in .env.example / deploy/README.md).
 *
 *   This is an ORIGIN label for the local WebView only — assets are still served
 *   from the app bundle by Capacitor's asset loader; nothing is fetched from the
 *   network for `app.valam.in` itself.
 */
const config: CapacitorConfig = {
  appId: "in.valam.app",
  appName: "Valam AI",
  webDir: "dist",
  server: {
    androidScheme: "https",
    hostname: "app.valam.in",
  },
  android: {
    // Never allow the WebView to upgrade/mix plain HTTP: the app talks to the
    // HTTPS API only (enforced natively by network_security_config.xml too).
    allowMixedContent: false,
  },
};

export default config;
