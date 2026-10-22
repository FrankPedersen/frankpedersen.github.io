const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX_REQUESTS = 3
const MINIMUM_FORM_TIME_MS = 2000
const MAX_RATE_LIMIT_ENTRIES = 5000

const contactAttempts = new Map()

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

export function checkRateLimit(clientIp, now = Date.now()) {
  if (!clientIp) return { allowed: true }

  const attempt = contactAttempts.get(clientIp)
  if (!attempt || attempt.expiresAt <= now) {
    if (contactAttempts.size >= MAX_RATE_LIMIT_ENTRIES) {
      for (const [ip, entry] of contactAttempts) {
        if (entry.expiresAt <= now) contactAttempts.delete(ip)
      }
    }

    if (contactAttempts.size >= MAX_RATE_LIMIT_ENTRIES) {
      return { allowed: false, retryAfterSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) }
    }

    contactAttempts.set(clientIp, {
      count: 1,
      expiresAt: now + RATE_LIMIT_WINDOW_MS,
    })
    return { allowed: true }
  }

  if (attempt.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((attempt.expiresAt - now) / 1000)),
    }
  }

  attempt.count += 1
  return { allowed: true }
}

export function validateContact(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Ugyldige data. Send navn, e-mail og besked.' }
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const website = typeof body.website === 'string' ? body.website.trim() : ''
  const elapsedMilliseconds = body.elapsedMilliseconds

  if (!name || !email || !message) {
    return { error: 'Udfyld navn, e-mail og besked.' }
  }

  if (website) return { name, email, message, spam: true }

  if (
    !Number.isSafeInteger(elapsedMilliseconds)
    || elapsedMilliseconds < MINIMUM_FORM_TIME_MS
    || elapsedMilliseconds > 24 * 60 * 60 * 1000
  ) {
    return { error: 'Vent et øjeblik, og prøv at sende beskeden igen.' }
  }

  if (name.length > 120 || email.length > 254 || message.length > 5000) {
    return { error: 'Et eller flere felter overskrider den tilladte længde.' }
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { error: 'Indtast en gyldig e-mailadresse.' }
  }

  return { name, email, message, spam: false }
}
