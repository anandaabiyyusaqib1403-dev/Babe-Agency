import test from "node:test";
import assert from "node:assert/strict";
import { googleDriveOAuthFailureCode } from "../src/lib/google-drive-errors.mjs";

test("expired or revoked refresh token requests reauthorization", () => {
  assert.equal(googleDriveOAuthFailureCode("invalid_grant"), "google_drive_reauth_required");
});

test("bad OAuth client configuration gets a safe diagnostic code", () => {
  assert.equal(googleDriveOAuthFailureCode("invalid_client"), "google_drive_oauth_client_invalid");
});

test("unknown Google OAuth errors do not expose provider response details", () => {
  assert.equal(googleDriveOAuthFailureCode("sensitive_provider_detail"), "google_drive_authorization_failed");
});
