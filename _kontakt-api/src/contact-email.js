export const CONTACT_SUBJECT = 'Ny besked fra Kontraktbridge'

export function buildContactEmail(contact, senderAddress, recipientAddress) {
  return {
    senderAddress,
    content: {
      subject: CONTACT_SUBJECT,
      plainText: [
        `Navn: ${contact.name}`,
        `E-mail: ${contact.email}`,
        '',
        'Besked:',
        contact.message,
      ].join('\n'),
    },
    recipients: {
      to: [{ address: recipientAddress }],
    },
    replyTo: [{ address: contact.email, displayName: contact.name }],
  }
}
