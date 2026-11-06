import { open, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
const worksheet = process.env.GOOGLE_SHEETS_WORKSHEET || "Reminder Queue";
const testId = "TEST-BABE-SHEETS-CONNECTION";
const lockPath = join(tmpdir(), "babe-agency-google-sheets-connection-test.lock");

function reportFailure(stage, error) {
  console.error(JSON.stringify({ ok: false, stage, error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
}

function quotedSheetName(name) {
  return `'${name.replaceAll("'", "''")}'`;
}

function rangeUrl(range) {
  return encodeURIComponent(`${quotedSheetName(worksheet)}!${range}`);
}

function apiError(stage, status) {
  if (status === 401) return `${stage}_unauthorized_check_oauth_token`;
  if (status === 403) return `${stage}_permission_denied_check_oauth_scope_and_spreadsheet_sharing`;
  if (status === 404) return `${stage}_not_found_check_spreadsheet_id_and_worksheet_name`;
  if (status === 400) return `${stage}_bad_request_check_spreadsheet_id_worksheet_and_range`;
  return `${stage}_http_${status}`;
}

async function refreshAccessToken() {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    let oauthError = `http_${response.status}`;
    try {
      const body = await response.json();
      if (typeof body.error === "string") oauthError = body.error;
    } catch {}
    throw new Error(`google_oauth_refresh_failed_${oauthError}`);
  }
  const token = await response.json();
  if (typeof token.access_token !== "string") throw new Error("google_oauth_access_token_missing");

  const infoUrl = new URL("https://oauth2.googleapis.com/tokeninfo");
  infoUrl.searchParams.set("access_token", token.access_token);
  const infoResponse = await fetch(infoUrl, { cache: "no-store" });
  if (!infoResponse.ok) throw new Error(`google_oauth_scope_check_http_${infoResponse.status}`);
  const info = await infoResponse.json();
  const scopes = String(info.scope || "").split(/\s+/).filter(Boolean);
  const writableScopes = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.file",
  ];
  const grantedScopes = scopes.filter(scope => writableScopes.includes(scope));
  if (grantedScopes.length === 0) throw new Error("google_oauth_missing_writable_sheets_scope");
  return { accessToken: token.access_token, grantedScopes };
}

async function fetchJson(url, options, stage) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(apiError(stage, response.status));
  return response.json();
}

async function acquireLock() {
  try {
    return await open(lockPath, "wx");
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const lockPid = Number((await readFile(lockPath, "utf8").catch(() => "")).trim());
    let processIsRunning = false;
    if (Number.isInteger(lockPid) && lockPid > 0) {
      try {
        process.kill(lockPid, 0);
        processIsRunning = true;
      } catch (processError) {
        processIsRunning = processError?.code === "EPERM";
      }
    }
    if (!processIsRunning) {
      await unlink(lockPath).catch(() => {});
      return open(lockPath, "wx");
    }
    throw new Error("google_sheets_test_already_running");
  }
}

export async function runGoogleSheetsConnectionTest() {
  const missing = [
    ["GOOGLE_SHEETS_SPREADSHEET_ID", spreadsheetId],
    ["GOOGLE_DRIVE_CLIENT_ID", clientId],
    ["GOOGLE_DRIVE_CLIENT_SECRET", clientSecret],
    ["GOOGLE_DRIVE_REFRESH_TOKEN", refreshToken],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(", ")}`);

  const { accessToken, grantedScopes } = await refreshAccessToken();
  const authHeaders = { Authorization: `Bearer ${accessToken}` };
  const spreadsheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,properties(title),sheets(properties(sheetId,title))`;
  const spreadsheet = await fetchJson(spreadsheetUrl, { headers: authHeaders, cache: "no-store" }, "spreadsheet_metadata");
  const target = spreadsheet.sheets?.find(sheet => sheet.properties?.title === worksheet);
  if (!target) throw new Error(`google_sheets_worksheet_not_found_${worksheet.replaceAll(/\s+/g, "_")}`);

  const valuesBase = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values`;
  const idRange = rangeUrl("A:A");
  const rows = await fetchJson(`${valuesBase}/${idRange}?majorDimension=COLUMNS`, { headers: authHeaders, cache: "no-store" }, "worksheet_read");
  const ids = rows.values?.[0] ?? [];
  const existingRows = ids.flatMap((id, index) => id === testId ? [index + 1] : []);
  if (existingRows.length > 1) throw new Error("google_sheets_test_duplicate_rows_detected_no_new_row_written");

  let rowNumber;
  let appended = false;
  if (existingRows.length === 1) {
    rowNumber = existingRows[0];
  } else {
    if (process.env.BABE_ZAPIER_PAUSED !== "true") {
      throw new Error("append_blocked_set_BABE_ZAPIER_PAUSED_true_only_after_pausing_the_zap_to_prevent_email");
    }
    const appendAllowed = process.env.BABE_SHEETS_TEST_ALLOW_APPEND === "true";
    if (!appendAllowed) throw new Error("append_not_enabled_set_BABE_SHEETS_TEST_ALLOW_APPEND_true_to_run_the_authorized_test");

    const lock = await acquireLock();
    try {
      await lock.writeFile(`${process.pid}\n`);
      const recheck = await fetchJson(`${valuesBase}/${idRange}?majorDimension=COLUMNS`, { headers: authHeaders, cache: "no-store" }, "worksheet_duplicate_check");
      const refreshedIds = recheck.values?.[0] ?? [];
      const refreshedRows = refreshedIds.flatMap((id, index) => id === testId ? [index + 1] : []);
      if (refreshedRows.length > 1) throw new Error("google_sheets_test_duplicate_rows_detected_no_new_row_written");
      if (refreshedRows.length === 1) {
        rowNumber = refreshedRows[0];
      } else {
        const row = [
          testId,
          "",
          "TEST-BABE Google Sheets connectivity check",
          "BABE AGENCY Test",
          "",
          "",
          "",
          "TEST ONLY",
          "TEST-BABE — Sheets connection check (do not send)",
          "TEST ONLY. No reminder or email. Zapier must be paused for this test.",
          new Date().toISOString(),
          "TEST ONLY — NOT AN EMAIL REMINDER",
        ];
        const appendUrl = `${valuesBase}/${rangeUrl("A:L")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS&includeValuesInResponse=true`;
        const result = await fetchJson(appendUrl, {
          method: "POST",
          headers: { ...authHeaders, "content-type": "application/json" },
          body: JSON.stringify({ values: [row] }),
          cache: "no-store",
        }, "worksheet_append");
        if (result.updates?.updatedRows !== 1) throw new Error("google_sheets_append_response_did_not_confirm_one_row");
        const match = String(result.updates?.updatedRange || "").match(/!A(\d+):L\d+$/);
        if (!match) throw new Error("google_sheets_append_response_missing_updated_range");
        rowNumber = Number(match[1]);
        appended = true;
      }
    } finally {
      await lock.close();
      await unlink(lockPath).catch(() => {});
    }
  }

  const rowUrl = `${valuesBase}/${rangeUrl(`A${rowNumber}:L${rowNumber}`)}?majorDimension=ROWS`;
  const persisted = await fetchJson(rowUrl, { headers: authHeaders, cache: "no-store" }, "worksheet_readback");
  const actualRow = persisted.values?.[0];
  if (actualRow?.[0] !== testId) throw new Error("google_sheets_readback_mismatch_test_row_not_verified");

  return {
    ok: true,
    spreadsheetTitle: spreadsheet.properties?.title ?? null,
    worksheet,
    scopes: grantedScopes,
    testRowId: testId,
    rowNumber,
    appended,
    readbackVerified: true,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await runGoogleSheetsConnectionTest();
    console.log(JSON.stringify(result));
  } catch (error) {
    reportFailure("google_sheets_connection_test", error);
  }
}
