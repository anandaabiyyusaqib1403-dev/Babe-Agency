export function googleDriveOAuthFailureCode(errorCode) {
  if (errorCode === "invalid_grant") return "google_drive_reauth_required";
  if (errorCode === "invalid_client") return "google_drive_oauth_client_invalid";
  return "google_drive_authorization_failed";
}
