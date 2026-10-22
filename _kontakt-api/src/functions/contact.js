import { EmailClient } from '@azure/communication-email'
import { app } from '@azure/functions'
import { buildContactEmail } from '../contact-email.js'
import {
  checkRateLimit,
  getClientIp,
  validateContact,
} from '../contact-protection.js'

function jsonResponse(status, body) {
  return {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
    jsonBody: body,
  }
}

app.http('contact', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'contact',
  handler: async (request, context) => {
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.toLowerCase().includes('application/json')) {
      return jsonResponse(415, { error: 'Anmodningen skal sendes som JSON.' })
    }

    const contentLength = Number(request.headers.get('content-length') || 0)
    if (Number.isFinite(contentLength) && contentLength > 10_000) {
      return jsonResponse(413, { error: 'Beskeden er for stor.' })
    }

    let body
    try {
      const rawBody = await request.text()
      if (new TextEncoder().encode(rawBody).byteLength > 10_000) {
        return jsonResponse(413, { error: 'Beskeden er for stor.' })
      }
      body = JSON.parse(rawBody)
    } catch {
      return jsonResponse(400, { error: 'Anmodningen indeholder ugyldig JSON.' })
    }

    const contact = validateContact(body)
    if ('error' in contact) {
      return jsonResponse(400, { error: contact.error })
    }

    if (contact.spam) {
      return jsonResponse(200, { message: 'Tak for din besked. Den er sendt.' })
    }

    const connectionString = process.env.COMMUNICATION_SERVICES_CONNECTION_STRING
    const senderAddress = process.env.CONTACT_SENDER
    const recipientAddress = process.env.CONTACT_RECIPIENT

    if (!connectionString || !senderAddress || !recipientAddress) {
      context.error('Contact API is missing required Azure Communication Services settings.')
      return jsonResponse(503, {
        error: 'Kontaktformularen er ikke konfigureret endnu. Prøv igen senere.',
      })
    }

    const rateLimit = checkRateLimit(getClientIp(request))
    if (!rateLimit.allowed) {
      const response = jsonResponse(429, {
        error: 'Du har sendt flere beskeder på kort tid. Vent lidt, før du prøver igen.',
      })
      response.headers['Retry-After'] = String(rateLimit.retryAfterSeconds)
      return response
    }

    try {
      const emailClient = new EmailClient(connectionString)
      const poller = await emailClient.beginSend(buildContactEmail(contact, senderAddress, recipientAddress))
      const result = await poller.pollUntilDone()

      if (result.status !== 'Succeeded') {
        context.error(`Contact email delivery returned status: ${result.status}.`)
        return jsonResponse(502, {
          error: 'Beskeden kunne ikke afleveres. Prøv igen senere.',
        })
      }

      return jsonResponse(200, { message: 'Tak for din besked. Den er sendt.' })
    } catch (error) {
      context.error(
        'Contact email delivery failed.',
        error instanceof Error ? error.message : 'Unknown error',
      )
      return jsonResponse(502, {
        error: 'Beskeden kunne ikke afleveres. Prøv igen senere.',
      })
    }
  },
})
