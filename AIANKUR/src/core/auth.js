// core/auth.js
// Secure authentication with secret numeric code

import crypto from 'crypto';

const STORAGE_KEY = 'aiankur_secret_hash';

export function hashCode(code) {
    return crypto.createHash('sha256').update(code.toString()).digest('hex');
}

export function saveSecretHash(hash) {
    localStorage.setItem(STORAGE_KEY, hash);
}

export function getSecretHash() {
    return localStorage.getItem(STORAGE_KEY);
}

export function verifyCode(code) {
    const hash = getSecretHash();
    if (!hash) return false;
    return hash === hashCode(code);
}

export function setSecretCode(code) {
    saveSecretHash(hashCode(code));
}

// Helper to ensure initial code is set (call in app, not at module load)
export function ensureInitialSecretCode() {
    if (!getSecretHash()) {
        setSecretCode('621956');
    }
}
