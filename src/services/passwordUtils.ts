import type { PasswordStrength, PasswordStrengthResult, GeneratorSettings } from '../types'

// ─── Password Strength ────────────────────────────────────────────────────

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const checks = {
    minLength:    password.length >= 8,
    uppercase:    /[A-Z]/.test(password),
    lowercase:    /[a-z]/.test(password),
    numbers:      /[0-9]/.test(password),
    symbols:      /[^A-Za-z0-9]/.test(password),
    longEnough:   password.length >= 16,
    length16Plus: password.length >= 16,
    length24Plus: password.length >= 24,
  }

  let score = 0
  if (checks.minLength)   score += 20
  if (checks.uppercase)   score += 15
  if (checks.lowercase)   score += 15
  if (checks.numbers)     score += 20
  if (checks.symbols)     score += 20
  if (checks.longEnough)  score += 10

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

  if (!charset) {
    charset = CHAR_SETS.lowercase
  }

  const remaining = length - required.length
  const randomPart = Array.from({ length: Math.max(0, remaining) }, () =>
    charset[randomInt(charset.length)]
  )

  const all = [...required, ...randomPart]
  return shuffle(all).join('')
}

function randomInt(max: number): number {
  const array = new Uint32Array(1)
  window.crypto.getRandomValues(array)
  return array[0] % max
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
