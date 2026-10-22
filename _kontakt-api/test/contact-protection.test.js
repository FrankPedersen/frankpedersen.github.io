import assert from 'node:assert/strict'
import test from 'node:test'
import {
  checkRateLimit,
  getClientIp,
  validateContact,
} from '../src/contact-protection.js'

function validContact(overrides = {}) {
  return {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    message: 'Hej fra køkkenet.',
    elapsedMilliseconds: 3000,
    ...overrides,
  }
}

test('accepts a valid contact and trims its fields', () => {
  assert.deepEqual(validateContact(validContact({
    name: ' Ada Lovelace ',
    email: ' ada@example.com ',
    message: ' Hej fra køkkenet. ',
  })), {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    message: 'Hej fra køkkenet.',
    spam: false,
  })
})

test('rejects invalid fields and submissions that are too fast', () => {
  assert.equal(validateContact(validContact({ email: 'not-an-email' })).error, 'Indtast en gyldig e-mailadresse.')
  assert.equal(validateContact(validContact({ elapsedMilliseconds: 1999 })).error, 'Vent et øjeblik, og prøv at sende beskeden igen.')
  assert.equal(validateContact(validContact({ message: 'x'.repeat(5001) })).error, 'Et eller flere felter overskrider den tilladte længde.')
})

test('marks a filled honeypot as spam', () => {
  assert.equal(validateContact(validContact({ website: 'https://spam.example' })).spam, true)
})

test('extracts the client address from the forwarded-for header', () => {
  const request = new Request('https://example.test/api/contact', {
    headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
  })
  assert.equal(getClientIp(request), '203.0.113.5')
})

test('allows three requests per IP in a 15-minute window and then blocks', () => {
  const ip = `rate-limit-test-${crypto.randomUUID()}`
  const start = 1_000_000

  assert.deepEqual(checkRateLimit(ip, start), { allowed: true })
  assert.deepEqual(checkRateLimit(ip, start + 1), { allowed: true })
  assert.deepEqual(checkRateLimit(ip, start + 2), { allowed: true })
  assert.deepEqual(checkRateLimit(ip, start + 3), {
    allowed: false,
    retryAfterSeconds: 900,
  })
  assert.deepEqual(checkRateLimit(ip, start + 15 * 60 * 1000), { allowed: true })
})
