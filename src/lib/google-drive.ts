import "server-only";
import { googleDriveOAuthFailureCode } from "./google-drive-errors.mjs";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export function getGoogleDriveRefreshToken() {
  return process.env.GOOGLE_DRIVE_REFRESH_TOKEN_NEXT || process.env.GOOGLE_DRIVE_REFRESH_TOKEN || "";
}

export async function getGoogleDriveAccessToken() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = getGoogleDriveRefreshToken();
  if (!clientId || !clientSecret || !refreshToken) throw new Error("google_drive_configuration_required");

  let response: Response;
  try {
    response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("google_drive_connection_failed");
  }
  if (!response.ok) {
    let errorCode = "";
    try { errorCode = String((await response.json() as { error?: unknown }).error ?? ""); } catch { /* Ignore provider response details. */ }
    throw new Error(googleDriveOAuthFailureCode(errorCode));
  }
  const token = await response.json() as { access_token?: string };
  if (!token.access_token) throw new Error("google_drive_access_token_missing");
  return token.access_token;
}
