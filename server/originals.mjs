// Where the originals (paper photos) are kept: exactly the bytes the phone sent, never changed, never overwritten.
// Named by their SHA-256 only, so a file name says nothing about the person or the paper.
//
// In production: the Google shared drive, folder "originals" (made once under GOOGLE_BACKUP_FOLDER_ID).
// Without the Google settings (tests, local runs): DATA_DIR/originals on the app's own disk.
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };

export function localOriginals(dir) {
  mkdirSync(dir, { recursive: true });
  return {
    name: 'local',
    async put(sha256, mime, buf) {
      const f = sha256 + '.' + EXT[mime];
      if (!existsSync(join(dir, f))) writeFileSync(join(dir, f), buf, { flag: 'wx' }); // never overwrite
      return 'local:' + f;
    },
    async get(ref) { return readFileSync(join(dir, ref.slice('local:'.length))); },
  };
}

export function driveOriginals(drive, parentId) {
  let folderId = null;
  return {
    name: 'google',
    async put(sha256, mime, buf) {
      folderId = folderId || await drive.folder('originals', parentId);
      return 'drive:' + await drive.upload({ name: sha256 + '.' + EXT[mime], mime, body: buf, parent: folderId });
    },
    async get(ref) { return drive.download(ref.slice('drive:'.length)); },
  };
}
