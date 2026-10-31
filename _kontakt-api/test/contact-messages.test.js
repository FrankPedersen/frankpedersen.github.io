import assert from 'node:assert/strict'
import test from 'node:test'
import { MESSAGES, errorBody, messageBody } from '../src/contact-messages.js'

test('every message has Danish and English text', () => {
  for (const [key, message] of Object.entries(MESSAGES)) {
    assert.ok(message.da && message.en, key)
  }
})

test('responses carry both languages so the page shows the one it is in', () => {
  assert.deepEqual(errorBody(MESSAGES.invalidEmail), { error: 'E-mailadressen er ikke gyldig.', errorEn: 'The e-mail address is not valid.' })
  assert.deepEqual(messageBody(MESSAGES.sent), { message: 'Tak for din besked. Den er sendt.', messageEn: 'Thank you for your message. It has been sent.' })
})

test('the rewritten messages are descriptive, not imperative (SPEC-beskrivende-form, A2)', () => {
  assert.equal(MESSAGES.invalidData.da, 'Ugyldige data: navn, e-mail og besked mangler.')
  assert.equal(MESSAGES.missingFields.da, 'Navn, e-mail og besked skal udfyldes.')
  assert.equal(MESSAGES.tooFast.da, 'Beskeden kan sendes igen om et øjeblik.')
  assert.equal(MESSAGES.invalidEmail.da, 'E-mailadressen er ikke gyldig.')
  assert.equal(MESSAGES.rateLimited.da, 'Du har sendt flere beskeder på kort tid; om lidt kan du sende igen.')
})
