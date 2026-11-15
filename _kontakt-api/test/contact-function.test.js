import assert from 'node:assert/strict'
import test from 'node:test'

// Funktionen kan indlæses uden for Azure (@azure/functions springer registreringen over i test).
test('the contact function module loads', async () => {
  await assert.doesNotReject(import('../src/functions/contact.js'))
})

// Timer-funktionen, der sletter grænsens gamle vinduer (SPEC-kontakt-ip-graense.md).
test('the cleanup timer module loads', async () => {
  await assert.doesNotReject(import('../src/functions/contact-cleanup.js'))
})
