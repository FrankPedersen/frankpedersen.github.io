import assert from 'node:assert/strict'
import test from 'node:test'
import { buildContactEmail, CONTACT_SUBJECT } from '../src/contact-email.js'

// SPEC-kontaktformular.md, del 1: emnelinjen er "Ny besked fra Kontraktbridge", og afsenderens adresse er svar-til.

const contact = { name: 'Ada Lovelace', email: 'ada@example.com', message: 'Hej fra bridgebordet.' }

test('the subject is "Ny besked fra Kontraktbridge"', () => {
  assert.equal(CONTACT_SUBJECT, 'Ny besked fra Kontraktbridge')
  const email = buildContactEmail(contact, 'afsender@example.net', 'modtager@example.net')
  assert.equal(email.content.subject, 'Ny besked fra Kontraktbridge')
})

test('the email goes to the recipient with the sender as reply-to', () => {
  const email = buildContactEmail(contact, 'afsender@example.net', 'modtager@example.net')
  assert.equal(email.senderAddress, 'afsender@example.net')
  assert.deepEqual(email.recipients, { to: [{ address: 'modtager@example.net' }] })
  assert.deepEqual(email.replyTo, [{ address: 'ada@example.com', displayName: 'Ada Lovelace' }])
  assert.equal(email.content.plainText, 'Navn: Ada Lovelace\nE-mail: ada@example.com\n\nBesked:\nHej fra bridgebordet.')
})
