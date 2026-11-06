# Google Drive setup

The application and background worker use server-side OAuth credentials. Do not place credentials in `NEXT_PUBLIC_*`, source files, logs, or browser code. `.env.local` is ignored by Git.

## Google Cloud configuration

1. Enable the Google Drive API in the existing Google Cloud project and use the existing OAuth 2.0 Web application client.
2. Add `http://localhost:53682/oauth2callback` to that client's authorized redirect URIs.
3. Add `https://www.googleapis.com/auth/drive` to the OAuth consent screen's allowed scopes. The current integration browses and writes beneath an existing agency folder ID, and `drive.file` alone does not guarantee access to that pre-existing folder or other pre-existing files. `drive` grants broad Drive access and is a restricted Google scope; apply the consent-screen verification or test-user requirements shown by Google before authorizing an account.
4. Use the agency Google account that owns, or has edit access to, the configured `GOOGLE_DRIVE_ROOT_FOLDER_ID` folder.

## Local authorization

Confirm the server-only `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, and `GOOGLE_DRIVE_ROOT_FOLDER_ID` values are set in `.env.local`. Then run:

```powershell
npm.cmd run drive:authorize
```

Complete Google's consent screen in the browser that opens. The setup command uses Authorization Code Flow with PKCE, `state`, offline access, and explicit consent. It checks root-folder access, uploads a temporary PDF, reads its metadata, deletes that test file, and only then writes a new token as `GOOGLE_DRIVE_REFRESH_TOKEN_NEXT` in `.env.local`. It does not print the token or modify the existing `GOOGLE_DRIVE_REFRESH_TOKEN` used by the Sheets integration.

Restart the Next.js app and background worker after the setup reports success. The app and worker prefer the new Drive-only token. If Google returns `invalid_grant`, run the authorization command again after reviewing the existing `GOOGLE_DRIVE_REFRESH_TOKEN_NEXT` entry. The command refuses to overwrite an already populated rotated-token variable.

## Runtime behavior

- Document uploads and generated invoice/report PDFs are stored in Drive, with metadata in Supabase. PDFs also keep a private Supabase Storage fallback for existing preview flows.
- File reads are proxied through authenticated application routes; the integration does not make files public.
- Invoice PDFs are processed by the existing background worker. Report and invoice Drive upload failures leave the private PDF copy available and record a clear warning.
- Monthly and social report files are indexed in `agency_documents` and linked to their immutable `report_pdf_jobs` version row.
