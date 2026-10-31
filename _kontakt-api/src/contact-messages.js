// Alle svar fra kontakt-API'et på dansk og engelsk. Om mig viser det sprog, siden står på
// (error/errorEn og message/messageEn), så ordlyden kun står her (SPEC-beskrivende-form, A2).
export const MESSAGES = {
  sent: { da: 'Tak for din besked. Den er sendt.', en: 'Thank you for your message. It has been sent.' },
  invalidData: { da: 'Ugyldige data: navn, e-mail og besked mangler.', en: 'Invalid data: the name, e-mail and message are missing.' },
  missingFields: { da: 'Navn, e-mail og besked skal udfyldes.', en: 'The name, e-mail and message must be filled in.' },
  tooFast: { da: 'Beskeden kan sendes igen om et øjeblik.', en: 'The message can be sent again in a moment.' },
  tooLong: { da: 'Et eller flere felter overskrider den tilladte længde.', en: 'One or more fields are longer than allowed.' },
  invalidEmail: { da: 'E-mailadressen er ikke gyldig.', en: 'The e-mail address is not valid.' },
  notJson: { da: 'Anmodningen skal sendes som JSON.', en: 'The request must be sent as JSON.' },
  tooLarge: { da: 'Beskeden er for stor.', en: 'The message is too long.' },
  invalidJson: { da: 'Anmodningen indeholder ugyldig JSON.', en: 'The request contains invalid JSON.' },
  notConfigured: { da: 'Kontaktformularen er ikke konfigureret endnu. Prøv igen senere.', en: 'The contact form is not set up yet. Please try again later.' },
  rateLimited: { da: 'Du har sendt flere beskeder på kort tid; om lidt kan du sende igen.', en: 'You have sent several messages in a short time; you can send again shortly.' },
  notDelivered: { da: 'Beskeden kunne ikke afleveres. Prøv igen senere.', en: 'The message could not be delivered. Please try again later.' },
}

export function errorBody(message) {
  return { error: message.da, errorEn: message.en }
}

export function messageBody(message) {
  return { message: message.da, messageEn: message.en }
}
