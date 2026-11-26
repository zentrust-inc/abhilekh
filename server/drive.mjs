// Google Drive client for the app's shared drive (decided 25 Nov 2026: backups and paper originals go to Google).
// Zero dependencies: a service-account JWT (RS256, node:crypto) is exchanged for an access token, then Drive v3 REST.
// supportsAllDrives everywhere, because a service account has no storage of its own: the folder must be in a shared
// drive (Workspace), where files count against the organisation's pooled storage.
//
// Settings (Azure app settings only, never the repository): GOOGLE_BACKUP_SA_JSON (the service account's JSON key) and
// GOOGLE_BACKUP_FOLDER_ID (the shared drive, or a folder in it, where the service account is a Content manager).
import { createSign } from 'node:crypto';

const b64url = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export function createDrive({ credentials, fetchImpl = globalThis.fetch, now = () => Date.now() }) {
  if (!credentials?.client_email || !credentials?.private_key) throw new Error('GOOGLE_BACKUP_SA_JSON is not a service account key.');
  const tokenUri = credentials.token_uri || 'https://oauth2.googleapis.com/token';
  let cached = null;

  async function token() {
    const t = Math.floor(now() / 1000);
    if (cached && cached.exp - 60 > t) return cached.token;
    const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = b64url(JSON.stringify({ iss: credentials.client_email, scope: 'https://www.googleapis.com/auth/drive', aud: tokenUri, iat: t, exp: t + 3600 }));
    const sig = b64url(createSign('RSA-SHA256').update(head + '.' + claim).sign(credentials.private_key));
    const r = await fetchImpl(tokenUri, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: head + '.' + claim + '.' + sig }).toString() });
    if (r.status !== 200) throw new Error('Google token answered ' + r.status);
    const j = await r.json();
    cached = { token: j.access_token, exp: t + (j.expires_in || 3600) };
    return cached.token;
  }

  // One file, sent as it is (bytes unchanged). Returns the Drive file id.
  async function upload({ name, mime, body, parent }) {
    const boundary = 'abhilekh' + Math.random().toString(36).slice(2);
    const meta = JSON.stringify({ name, parents: [parent], mimeType: mime });
    const multipart = Buffer.concat([
      Buffer.from('--' + boundary + '\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n' + meta + '\r\n--' + boundary + '\r\ncontent-type: ' + mime + '\r\n\r\n'),
      Buffer.isBuffer(body) ? body : Buffer.from(String(body)),
      Buffer.from('\r\n--' + boundary + '--'),
    ]);
    const r = await fetchImpl(UPLOAD + '?uploadType=multipart&supportsAllDrives=true&fields=id', { method: 'POST', headers: { authorization: 'Bearer ' + await token(), 'content-type': 'multipart/related; boundary=' + boundary }, body: multipart });
    if (r.status !== 200) throw new Error('Google Drive upload answered ' + r.status);
    return (await r.json()).id;
  }

  // Same as upload, but returns Drive's own checksum and size so the caller can prove the bytes arrived unchanged.
  async function uploadChecked({ name, mime, body, parent }) {
    const boundary = 'abhilekh' + Math.random().toString(36).slice(2);
    const meta = JSON.stringify({ name, parents: [parent], mimeType: mime });
    const multipart = Buffer.concat([
      Buffer.from('--' + boundary + '\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n' + meta + '\r\n--' + boundary + '\r\ncontent-type: ' + mime + '\r\n\r\n'),
      Buffer.isBuffer(body) ? body : Buffer.from(String(body)),
      Buffer.from('\r\n--' + boundary + '--'),
    ]);
    const r = await fetchImpl(UPLOAD + '?uploadType=multipart&supportsAllDrives=true&fields=id,md5Checksum,size', { method: 'POST', headers: { authorization: 'Bearer ' + await token(), 'content-type': 'multipart/related; boundary=' + boundary }, body: multipart });
    if (r.status !== 200) throw new Error('Google Drive upload answered ' + r.status);
    return r.json();
  }

  // Replace the bytes of an existing file in place (same id, same name). Returns { id, md5Checksum, size }.
  async function update(id, { mime, body }) {
    const r = await fetchImpl(UPLOAD + '/' + encodeURIComponent(id) + '?uploadType=media&supportsAllDrives=true&fields=id,md5Checksum,size', { method: 'PATCH', headers: { authorization: 'Bearer ' + await token(), 'content-type': mime }, body: Buffer.isBuffer(body) ? body : Buffer.from(String(body)) });
    if (r.status !== 200) throw new Error('Google Drive update answered ' + r.status);
    return r.json();
  }

  // The folders a file is in.
  async function parents(id) {
    const r = await fetchImpl(API + '/' + encodeURIComponent(id) + '?supportsAllDrives=true&fields=parents', { headers: { authorization: 'Bearer ' + await token() } });
    if (r.status !== 200) throw new Error('Google Drive file answered ' + r.status);
    return (await r.json()).parents || [];
  }

  // Move a file to another folder of the same shared drive. The file keeps its id and its bytes.
  async function move(id, toFolder) {
    const from = await parents(id);
    if (from.includes(toFolder) && from.length === 1) return { id, parents: from, already: true };
    const q = '?supportsAllDrives=true&fields=id,parents&addParents=' + encodeURIComponent(toFolder) + '&removeParents=' + encodeURIComponent(from.filter(x => x !== toFolder).join(','));
    const r = await fetchImpl(API + '/' + encodeURIComponent(id) + q, { method: 'PATCH', headers: { authorization: 'Bearer ' + await token(), 'content-type': 'application/json' }, body: '{}' });
    if (r.status !== 200) throw new Error('Google Drive move answered ' + r.status);
    return r.json();
  }

  async function download(id) {
    const r = await fetchImpl(API + '/' + encodeURIComponent(id) + '?alt=media&supportsAllDrives=true', { headers: { authorization: 'Bearer ' + await token() } });
    if (r.status !== 200) throw new Error('Google Drive download answered ' + r.status);
    return Buffer.from(await r.arrayBuffer());
  }

  // A subfolder by name under parent, made once and then found again.
  async function folder(name, parent) {
    const q = "name = '" + name.replace(/'/g, "\\'") + "' and '" + parent + "' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
    const auth = { authorization: 'Bearer ' + await token() };
    const l = await fetchImpl(API + '?q=' + encodeURIComponent(q) + '&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id)', { headers: auth });
    if (l.status !== 200) throw new Error('Google Drive list answered ' + l.status);
    const found = (await l.json()).files || [];
    if (found.length) return found[0].id;
    const c = await fetchImpl(API + '?supportsAllDrives=true&fields=id', { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ name, parents: [parent], mimeType: 'application/vnd.google-apps.folder' }) });
    if (c.status !== 200) throw new Error('Google Drive folder answered ' + c.status);
    return (await c.json()).id;
  }

  // The newest file in a folder whose name starts with prefix (by name, so dated names sort by date). null if none.
  async function latest(prefix, parent) {
    const q = "name contains '" + prefix.replace(/'/g, "\\'") + "' and '" + parent + "' in parents and trashed = false";
    const l = await fetchImpl(API + '?q=' + encodeURIComponent(q) + '&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)&pageSize=100', { headers: { authorization: 'Bearer ' + await token() } });
    if (l.status !== 200) throw new Error('Google Drive list answered ' + l.status);
    const files = ((await l.json()).files || []).filter(f => f.name.startsWith(prefix)).sort((a, b) => a.name < b.name ? 1 : -1);
    return files[0] || null;
  }

  return { token, upload, uploadChecked, update, parents, move, download, folder, latest };
}
