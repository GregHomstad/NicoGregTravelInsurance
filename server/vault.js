/**
 * Secrets Vault — AES-256-GCM encrypted secrets engine
 * Encrypts BMI credentials at rest; decrypted only at runtime with VAULT_KEY.
 *
 * Usage:
 *   Encrypt:  node vault.js encrypt           (reads .env, writes vault.enc)
 *   Decrypt:  node vault.js decrypt            (prints decrypted secrets)
 *   Get:      vault.load(vaultKey) → { BMI_AUTH_USER, BMI_AUTH_KEY, ... }
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VAULT_PATH = join(__dirname, 'vault.enc');
const ENV_PATH = join(__dirname, '.env');

const ALGORITHM = 'aes-256-gcm';
const SALT_LEN = 32;
const IV_LEN = 16;
const TAG_LEN = 16;
const KEY_LEN = 32;

// Derive a 256-bit key from the master password using scrypt
function deriveKey(password, salt) {
  return scryptSync(password, salt, KEY_LEN, { N: 16384, r: 8, p: 1 });
}

/**
 * Encrypt a plaintext string → Buffer (salt + iv + authTag + ciphertext)
 */
export function encrypt(plaintext, password) {
  const salt = randomBytes(SALT_LEN);
  const key = deriveKey(password, salt);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Layout: [salt 32B][iv 16B][tag 16B][ciphertext ...]
  return Buffer.concat([salt, iv, tag, encrypted]);
}

/**
 * Decrypt a vault buffer → plaintext string
 */
export function decrypt(buffer, password) {
  const salt = buffer.subarray(0, SALT_LEN);
  const iv = buffer.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const tag = buffer.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
  const ciphertext = buffer.subarray(SALT_LEN + IV_LEN + TAG_LEN);

  const key = deriveKey(password, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Parse secrets from decrypted text (KEY=VALUE lines, ignoring comments/blanks)
 */
function parseSecrets(text) {
  const secrets = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    secrets[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return secrets;
}

/**
 * Load and decrypt the vault file → object of secrets
 */
export function load(vaultKey) {
  if (!vaultKey) throw new Error('VAULT_KEY is required to decrypt secrets');
  if (!existsSync(VAULT_PATH)) throw new Error(`Vault file not found: ${VAULT_PATH}`);
  const buf = readFileSync(VAULT_PATH);
  const plaintext = decrypt(buf, vaultKey);
  return parseSecrets(plaintext);
}

/**
 * Save secrets from .env → encrypted vault file
 */
export function seal(vaultKey) {
  if (!existsSync(ENV_PATH)) throw new Error(`.env file not found at ${ENV_PATH}`);
  const envContent = readFileSync(ENV_PATH, 'utf8');
  // Only encrypt sensitive keys (BMI credentials + API key)
  const lines = envContent.split('\n').filter(l => {
    const t = l.trim();
    return t.startsWith('BMI_AUTH_USER') ||
           t.startsWith('BMI_AUTH_KEY') ||
           t.startsWith('BMI_AGENT_ID') ||
           t.startsWith('PROXY_API_KEY');
  });
  if (lines.length === 0) throw new Error('No secrets found in .env to encrypt');
  const encrypted = encrypt(lines.join('\n'), vaultKey);
  writeFileSync(VAULT_PATH, encrypted);
  return lines.length;
}

// --- CLI ---
if (process.argv[1] && process.argv[1].endsWith('vault.js')) {
  const cmd = process.argv[2];
  const vaultKey = process.env.VAULT_KEY;

  if (!vaultKey) {
    console.error('Set VAULT_KEY environment variable first.\n  Example: set VAULT_KEY=my-master-password');
    process.exit(1);
  }

  if (cmd === 'encrypt' || cmd === 'seal') {
    const count = seal(vaultKey);
    console.log(`Encrypted ${count} secret(s) → server/vault.enc`);
    console.log('You can now delete server/.env (keep .env.example for reference).');
  } else if (cmd === 'decrypt' || cmd === 'show') {
    const secrets = load(vaultKey);
    console.log('Decrypted secrets:');
    for (const [k, v] of Object.entries(secrets)) {
      console.log(`  ${k} = ${v.slice(0, 4)}${'*'.repeat(Math.max(0, v.length - 4))}`);
    }
  } else {
    console.log('Usage: node vault.js <encrypt|decrypt>');
    console.log('  encrypt — reads .env, writes vault.enc');
    console.log('  decrypt — reads vault.enc, prints masked secrets');
  }
}
