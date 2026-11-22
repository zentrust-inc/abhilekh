// Abhilekh passkey (WebAuthn) checks. Zero dependencies: node:crypto only.
//
// What a passkey is here: the phone's own unlock (fingerprint, face or screen lock) signs a one-time challenge with a
// private key that never leaves the phone. The server keeps only the public key. Abhilekh never sees or stores a
// fingerprint or a face.
//
// Registration: the browser hands over the public key itself (getPublicKey, SPKI/DER), so no CBOR is parsed here.
// We still check everything that makes the answer trustworthy: the page's origin, our one-time challenge, the
// relying-party id hash, "user present" and "user verified" flags, and that the credential id inside the
// authenticator data is the one claimed. No attestation is asked for (attestation "none").
// Sign-in: the signature over authenticatorData || SHA-256(clientDataJSON) is checked against the stored key, and the
// signature counter may never go backwards (a copied key would show up there).
import { createHash, createPublicKey, verify } from 'node:crypto';

export const ALGS = [-7, -257]; // ES256 and RS256 (Windows Hello uses RS256). Nothing else is offered.
const FLAG_UP = 0x01, FLAG_UV = 0x04, FLAG_AT = 0x40;
const sha256 = b => createHash('sha256').update(b).digest();
const b64u = s => Buffer.from(String(s || ''), 'base64url');
export const toB64u = b => Buffer.from(b).toString('base64url');
const fail = m => { throw new Error(m); };

function clientData(raw, type, challenge, origin) {
  let c;
  try { c = JSON.parse(raw.toString('utf8')); } catch { fail('bad client data'); }
  if (c.type !== type) fail('wrong type');
  if (c.challenge !== challenge) fail('wrong challenge');
  if (c.origin !== origin) fail('wrong origin');
  if (c.crossOrigin === true) fail('cross-origin');
}

function authData(ad, rpId, needAttested) {
  if (ad.length < 37) fail('short authenticator data');
  if (!ad.subarray(0, 32).equals(sha256(rpId))) fail('wrong relying party');
  const flags = ad[32];
  if (!(flags & FLAG_UP)) fail('user not present');
  if (!(flags & FLAG_UV)) fail('user not verified');
  if (needAttested && !(flags & FLAG_AT)) fail('no credential data');
  return { signCount: ad.readUInt32BE(33), flags };
}

// Returns { id, publicKey (base64url SPKI), alg, signCount }, or throws.
export function verifyRegistration(r, { challenge, origin, rpId }) {
  clientData(b64u(r.clientDataJSON), 'webauthn.create', challenge, origin);
  const ad = b64u(r.authenticatorData);
  const { signCount } = authData(ad, rpId, true);
  if (ad.length < 55) fail('short credential data');
  const idLen = ad.readUInt16BE(53);
  if (idLen < 16 || idLen > 1023 || ad.length < 55 + idLen) fail('bad credential id');
  const id = toB64u(ad.subarray(55, 55 + idLen));
  if (id !== String(r.id || '')) fail('credential id mismatch');
  const alg = Number(r.publicKeyAlgorithm);
  if (!ALGS.includes(alg)) fail('unsupported algorithm');
  let key;
  try { key = createPublicKey({ key: b64u(r.publicKey), format: 'der', type: 'spki' }); } catch { fail('bad public key'); }
  const t = key.asymmetricKeyType, d = key.asymmetricKeyDetails || {};
  if (alg === -7 && !(t === 'ec' && d.namedCurve === 'prime256v1')) fail('key does not match algorithm');
  if (alg === -257 && !(t === 'rsa' && d.modulusLength >= 2048)) fail('key does not match algorithm');
  return { id, publicKey: toB64u(b64u(r.publicKey)), alg, signCount };
}

// Returns { signCount }, or throws. `pk` is the stored { publicKey, alg, signCount }.
export function verifyAssertion(r, pk, { challenge, origin, rpId }) {
  const raw = b64u(r.clientDataJSON);
  clientData(raw, 'webauthn.get', challenge, origin);
  const ad = b64u(r.authenticatorData);
  const { signCount } = authData(ad, rpId, false);
  const key = createPublicKey({ key: b64u(pk.publicKey), format: 'der', type: 'spki' });
  const ok = verify('sha256', Buffer.concat([ad, sha256(raw)]), key, b64u(r.signature));
  if (!ok) fail('bad signature');
  // Counters are optional (many authenticators stay at 0); when they are used they must go up.
  if ((signCount || pk.signCount) && signCount <= pk.signCount) fail('counter went backwards');
  return { signCount };
}
