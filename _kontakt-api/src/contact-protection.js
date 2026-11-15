import { MESSAGES } from './contact-messages.js'
import { rateLimiterFromEnvironment } from './contact-rate-limit.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MINIMUM_FORM_TIME_MS = 2000

// Azure Functions sender adressen som "ip:port" (IPv6 som "[ip]:port"), og porten skifter med hver forbindelse.
function withoutPort(address) {
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(address)
  if (bracketed) return bracketed[1]
  return /^[\d.]+:\d+$/.test(address) ? address.slice(0, address.lastIndexOf(':')) : address
}

export function getClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const clientIp = forwardedFor?.split(',')[0]?.trim()
    || request.headers.get('x-client-ip')?.trim()

  return clientIp ? withoutPort(clientIp) : null
}

// Højst 3 beskeder pr. IP pr. 15 minutter på tværs af instanser; tælleren står i Table Storage (src/contact-rate-limit.js,
// SPEC-kontakt-ip-graense.md). Uden IP er der ingen grænse. Mangler IP_HASH_KEY eller lageret, er grænsen slået fra, og
// beskeden går igennem.
export async function checkRateLimit(clientIp, { limiter = rateLimiterFromEnvironment(), log = console } = {}) {
  if (!clientIp) return { allowed: true }
  if (!limiter) {
    log.warn('kontakt: grænsen er slået fra')
    return { allowed: true }
  }
  return limiter.check(clientIp, log)
}

export function validateContact(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: MESSAGES.invalidData }
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const website = typeof body.website === 'string' ? body.website.trim() : ''
  const elapsedMilliseconds = body.elapsedMilliseconds

  if (!name || !email || !message) {
    return { error: MESSAGES.missingFields }
  }

  if (website) return { name, email, message, spam: true }

  if (
    !Number.isSafeInteger(elapsedMilliseconds)
    || elapsedMilliseconds < MINIMUM_FORM_TIME_MS
    || elapsedMilliseconds > 24 * 60 * 60 * 1000
  ) {
    return { error: MESSAGES.tooFast }
  }

  if (name.length > 120 || email.length > 254 || message.length > 5000) {
    return { error: MESSAGES.tooLong }
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { error: MESSAGES.invalidEmail }
  }

  return { name, email, message, spam: false }
}
