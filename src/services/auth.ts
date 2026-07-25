import argon2 from 'argon2'
import { randomBytes } from 'crypto'
import { deriveEncryptionKey } from './encryption'

// ─── Constants ────────────────────────────────────────────────────────────

const SALT_LENGTH = 32 // bytes

// argon2id options — tuned for security vs. reasonable verification time
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,    // 64 MB
  timeCost: 3,          // 3 iterations
  parallelism: 4,
}

// ─── Master Password Hashing ──────────────────────────────────────────────

/**
 * Called during vault setup.
 * Generates a random salt and hashes the master password with argon2id.
 * Returns the hash and the salt (both stored in app_settings).
 * The master password itself is NEVER stored.
 */
export async function hashMasterPassword(
  masterPassword: string
): Promise<{ hash: string; salt: string }> {
  const saltBuffer = randomBytes(SALT_LENGTH)
  const salt = saltBuffer.toString('hex')

  const hash = await argon2.hash(masterPassword, {
    ...ARGON2_OPTIONS,
    salt: saltBuffer,
    raw: false,           // return encoded string
  })

  return { hash, salt }
}

/**
 * Verifies an entered password against the stored hash.
 * Returns true if correct.
 */
export async function verifyMasterPassword(
  enteredPassword: string,
  storedHash: string
): Promise<boolean> {
  try {
    return await argon2.verify(storedHash, enteredPassword)
  } catch {
    return false
  }
}

/**
 * Derives the AES-256 encryption key from the master password.
 * Called after successful login; key is kept only in memory.
 */
export function deriveKey(masterPassword: string, salt: string): Buffer {
  return deriveEncryptionKey(masterPassword, salt)
}

/**
 * Changes the master password:
 * 1. Verifies the current password
 * 2. Re-hashes with a new salt
 * 3. Returns new hash + salt + the new derived encryption key
 *    so the caller can re-encrypt all stored data
 */
export async function changeMasterPassword(
  currentPassword: string,
  newPassword: string,
  storedHash: string
): Promise<{ newHash: string; newSalt: string; newKey: Buffer } | null> {
  const valid = await verifyMasterPassword(currentPassword, storedHash)
  if (!valid) return null

  const { hash: newHash, salt: newSalt } = await hashMasterPassword(newPassword)
  const newKey = deriveKey(newPassword, newSalt)

  return { newHash, newSalt, newKey }
}
