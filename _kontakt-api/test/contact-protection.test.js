import assert from 'node:assert/strict'
import test from 'node:test'
import {
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
  assert.deepEqual(validateContact(validContact({ email: 'not-an-email' })).error, { da: 'E-mailadressen er ikke gyldig.', en: 'The e-mail address is not valid.' })
  assert.equal(validateContact(validContact({ elapsedMilliseconds: 1999 })).error.da, 'Beskeden kan sendes igen om et øjeblik.')
  assert.equal(validateContact(validContact({ message: 'x'.repeat(5001) })).error.da, 'Et eller flere felter overskrider den tilladte længde.')
  assert.equal(validateContact(validContact({ name: ' ' })).error.da, 'Navn, e-mail og besked skal udfyldes.')
  assert.equal(validateContact([]).error.da, 'Ugyldige data: navn, e-mail og besked mangler.')
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

test('strips the port that Azure adds to the forwarded-for address', () => {
  const ip = (forwardedFor) => getClientIp(new Request('https://example.test/api/contact', { headers: { 'x-forwarded-for': forwardedFor } }))
  assert.equal(ip('203.0.113.5:51234'), '203.0.113.5')
  assert.equal(ip('203.0.113.5:51234, 10.0.0.1:443'), '203.0.113.5')
  assert.equal(ip('[2001:db8::1]:443'), '2001:db8::1')
  assert.equal(ip('2001:db8::1'), '2001:db8::1')
})

// Grænsen pr. IP står fra SPEC-kontakt-ip-graense.md i Table Storage og testes mod Azurite i contact-rate-limit.test.js.
