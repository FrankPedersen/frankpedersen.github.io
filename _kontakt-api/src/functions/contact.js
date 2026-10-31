import { EmailClient } from '@azure/communication-email'
import { app } from '@azure/functions'
import { buildContactEmail } from '../contact-email.js'
import { MESSAGES, errorBody, messageBody } from '../contact-messages.js'
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
      return jsonResponse(415, errorBody(MESSAGES.notJson))
    }

    const contentLength = Number(request.headers.get('content-length') || 0)
    if (Number.isFinite(contentLength) && contentLength > 10_000) {
      return jsonResponse(413, errorBody(MESSAGES.tooLarge))
    }

    let body
    try {
      const rawBody = await request.text()
      if (new TextEncoder().encode(rawBody).byteLength > 10_000) {
        return jsonResponse(413, errorBody(MESSAGES.tooLarge))
      }
      body = JSON.parse(rawBody)
    } catch {
      return jsonResponse(400, errorBody(MESSAGES.invalidJson))
    }

    const contact = validateContact(body)
    if ('error' in contact) {
      return jsonResponse(400, errorBody(contact.error))
    }

    if (contact.spam) {
      return jsonResponse(200, messageBody(MESSAGES.sent))
    }

    const connectionString = process.env.COMMUNICATION_SERVICES_CONNECTION_STRING
    const senderAddress = process.env.CONTACT_SENDER
    const recipientAddress = process.env.CONTACT_RECIPIENT

    if (!connectionString || !senderAddress || !recipientAddress) {
      context.error('Contact API is missing required Azure Communication Services settings.')
      return jsonResponse(503, errorBody(MESSAGES.notConfigured))
    }

    const rateLimit = checkRateLimit(getClientIp(request))
    if (!rateLimit.allowed) {
      const response = jsonResponse(429, errorBody(MESSAGES.rateLimited))
      response.headers['Retry-After'] = String(rateLimit.retryAfterSeconds)
      return response
    }

    try {
      const emailClient = new EmailClient(connectionString)
      const poller = await emailClient.beginSend(buildContactEmail(contact, senderAddress, recipientAddress))
      const result = await poller.pollUntilDone()

      if (result.status !== 'Succeeded') {
        context.error(`Contact email delivery returned status: ${result.status}.`)
        return jsonResponse(502, errorBody(MESSAGES.notDelivered))
      }

      return jsonResponse(200, messageBody(MESSAGES.sent))
    } catch (error) {
      context.error(
        'Contact email delivery failed.',
        error instanceof Error ? error.message : 'Unknown error',
      )
      return jsonResponse(502, errorBody(MESSAGES.notDelivered))
    }
  },
})
