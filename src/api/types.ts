/**
 * FileLu API response type definitions.
 *
 * Non-obvious quirks (see MEMORY.md):
 * - Upload URLs use HTTP not HTTPS — encrypt before uploading
 * - sess_id is tied to the specific upload server URL
 * - storage_used can be null for premium accounts
 * - storage_left returns "inf" as a string for unlimited accounts
 * - Upload response is a JSON array: [{file_code, file_status}]
 * - Upload form field must be named "file_0" (not "file" or "upload")
 */

/** Response from GET /api/account/info?key=KEY */
export interface AccountInfoResponse {
  msg: string;
  status: number;
  server_time: string;
  result: {
    email: string;
    /** null for some premium accounts */
    storage_used: string | null;
    premium_expire: string;
    /** "inf" for unlimited premium accounts — not a numeric string */
    storage_left: string;
  };
}

/** Response from GET /api/upload/server?key=KEY */
export interface UploadServerResponse {
  status: number;
  /** Session ID — tied to the specific upload server URL; must use together */
  sess_id: string;
  /** Upload server URL — uses HTTP (not HTTPS!) */
  result: string;
  msg: string;
  server_time: string;
}

/** Single file entry in the upload response array */
export interface UploadResult {
  /** e.g. "b578rni0e1ka" — use to construct file URL */
  file_code: string;
  /** Status string e.g. "OK" */
  file_status: string;
}

/** Parsed account info returned to callers */
export interface AccountInfo {
  email: string;
  storageUsed: string | null;
  storageLeft: string;
  premiumExpire: string;
}

/** Parsed upload server info returned to callers */
export interface UploadServer {
  url: string;
  sessId: string;
}
