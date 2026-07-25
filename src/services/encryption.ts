import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'crypto'
import type { PasswordStrength, PasswordStrengthResult, GeneratorSettings } from '../types'

// ─── Constants ────────────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16    // bytes
const TAG_LENGTH = 16   // bytes
const KEY_LENGTH = 32   // bytes (256-bit)
const PBKDF2_ITERATIONS = 100_000
const PBKDF2_DIGEST = 'sha256'

// ─── Key Derivation ───────────────────────────────────────────────────────

/**
 * Derives a 32-byte encryption key from master password using PBKDF2.
 * Called once on successful login; result kept only in memory.
 */
export function deriveEncryptionKey(masterPassword: string, salt: string): Buffer {
  const saltBuffer = Buffer.from(salt, 'hex')
  return pbkdf2Sync(
    masterPassword,
    saltBuffer,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    PBKDF2_DIGEST
  )
}

// ─── Encryption ───────────────────────────────────────────────────────────

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a string in format: "iv_hex:authTag_hex:ciphertext_hex"
 */
export function encrypt(plaintext: string, key: Buffer): string {
  if (!plaintext) return ''

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])

  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypts a string produced by encrypt().
 * Returns the original plaintext or throws if tampered.
 */
export function decrypt(encryptedString: string, key: Buffer): string {
  if (!encryptedString) return ''

  const parts = encryptedString.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted string format')
  }

  const [ivHex, authTagHex, ciphertextHex] = parts

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}

// ─── Password Strength ────────────────────────────────────────────────────

/**
 * Evaluates password strength and returns a detailed result.
 */
export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const checks = {
    minLength:   password.length >= 8,
    uppercase:   /[A-Z]/.test(password),
    lowercase:   /[a-z]/.test(password),
    numbers:     /[0-9]/.test(password),
    symbols:     /[^A-Za-z0-9]/.test(password),
    longEnough:  password.length >= 16,
    length16Plus: password.length >= 16,
    length24Plus: password.length >= 24,
  }

  // Score from 0–100
  let score = 0
  if (checks.minLength)   score += 20
  if (checks.uppercase)   score += 15
  if (checks.lowercase)   score += 15
  if (checks.numbers)     score += 20
  if (checks.symbols)     score += 20
  if (checks.longEnough)  score += 10

  // Extra points for very long passwords
  if (password.length >= 24) score = Math.min(100, score + 5)
  if (password.length >= 32) score = Math.min(100, score + 5)

  let strength: PasswordStrength
  if (score >= 70) {
    strength = 'strong'
  } else if (score >= 40) {
    strength = 'medium'
  } else {
    strength = 'weak'
  }

  return { strength, score, checks }
}

// ─── Password Generator ───────────────────────────────────────────────────

const CHAR_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers:   '0123456789',
  symbols:   '!@#$%^&*()-_=+[]{}|;:,.<>?',
  similar:   'O0lI1',
}

/**
 * Generates a cryptographically secure random password.
 */
export function generatePassword(settings: GeneratorSettings): string {
  const {
    length,
    uppercase,
    lowercase,
    numbers,
    symbols,
    excludeSimilar,
  } = settings

  let charset = ''
  const required: string[] = []

  if (uppercase) {
    let chars = CHAR_SETS.uppercase
    if (excludeSimilar) chars = chars.split('').filter(c => !CHAR_SETS.similar.includes(c)).join('')
    charset += chars
    required.push(chars[randomInt(chars.length)])
  }
  if (lowercase) {
    let chars = CHAR_SETS.lowercase
    if (excludeSimilar) chars = chars.split('').filter(c => !CHAR_SETS.similar.includes(c)).join('')
    charset += chars
    required.push(chars[randomInt(chars.length)])
  }
  if (numbers) {
    let chars = CHAR_SETS.numbers
    if (excludeSimilar) chars = chars.split('').filter(c => !CHAR_SETS.similar.includes(c)).join('')
    charset += chars
    required.push(chars[randomInt(chars.length)])
  }
  if (symbols) {
    const chars = CHAR_SETS.symbols
    charset += chars
    required.push(chars[randomInt(chars.length)])
  }

  // Fallback: if no sets selected, use lowercase
  if (!charset) {
    charset = CHAR_SETS.lowercase
  }

  // Fill the rest randomly
  const remaining = length - required.length
  const randomPart = Array.from({ length: Math.max(0, remaining) }, () =>
    charset[randomInt(charset.length)]
  )

  // Shuffle all characters together
  const all = [...required, ...randomPart]
  return shuffle(all).join('')
}

/**
 * Cryptographically secure random integer in [0, max)
 */
function randomInt(max: number): number {
  const bytes = randomBytes(4)
  return bytes.readUInt32BE(0) % max
}

/**
 * Fisher-Yates shuffle using crypto random
 */
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// ─── Vault Export Encryption ──────────────────────────────────────────────

/**
 * Encrypts an entire vault export using a key derived from the master password.
 * Used for backup files.
 */
export function encryptVaultExport(data: string, masterPassword: string): string {
  const salt = randomBytes(32)
  const key = pbkdf2Sync(masterPassword, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST)
  const encrypted = encrypt(data, key)
  return `${salt.toString('hex')}:${encrypted}`
}

/**
 * Decrypts a vault export produced by encryptVaultExport().
 */
export function decryptVaultExport(encryptedData: string, masterPassword: string): string {
  const colonIndex = encryptedData.indexOf(':')
  const saltHex = encryptedData.substring(0, 64)           // 32 bytes = 64 hex chars
  const rest = encryptedData.substring(65)                  // skip salt + ':'
  const salt = Buffer.from(saltHex, 'hex')
  const key = pbkdf2Sync(masterPassword, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST)
  return decrypt(rest, key)
}
