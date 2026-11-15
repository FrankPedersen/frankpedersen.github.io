// Grænse pr. IP på tværs af instanser (SPEC-kontakt-ip-graense.md): højst 3 beskeder pr. IP pr. 15 minutter.
//
// Tælleren står i Table Storage i funktionens eget lager (`AzureWebJobsStorage`, tabellen `kontaktgraense`): én række
// pr. 15-minutters vindue (PartitionKey, fx `202611131215` i UTC) og pr. HMAC-SHA256 af IP'en med nøglen i
// app-indstillingen `IP_HASH_KEY` (RowKey). Rækken har kun `antal`. Opdateringer bruger optimistisk samtidighed med
// ETag, så to instanser ikke tæller samme besked dobbelt eller mister en. IP'en selv gemmes og logges aldrig, og
// hashen logges ikke. Modellen er Post Mortems grænse (postmortem/api/postmortem/graense.py).
//
// Timer-funktionen i src/functions/contact-cleanup.js kører hvert 5. minut og sletter vinduer, der begyndte for mindst
// 15 minutter siden; en hash står derfor højst 20 minutter. Fejler lageret, går beskeden igennem, og fejlen logges
// med fejltypen.
import { createHmac } from 'node:crypto'
import { TableClient, odata } from '@azure/data-tables'
import { getLogLevel, setLogLevel } from '@azure/logger'

// SDK'en logger kun, når AZURE_LOG_LEVEL er sat, og på info og verbose står hashen i adresserne til Table Storage:
// højst advarsler og fejl, så hashen ikke ender i Application Insights.
if (['info', 'verbose'].includes(getLogLevel())) setLogLevel('warning')

export const TABLE_NAME = 'kontaktgraense'
export const MAX_REQUESTS = 3
export const WINDOW_SECONDS = 15 * 60 // vinduerne følger uret (12:00–12:15, 12:15–12:30 …)
export const DELETE_AFTER_SECONDS = 15 * 60 // fra vinduets start; jobbet kører hvert 5. minut, så højst 20 minutter
const ATTEMPTS = 8 // genforsøg ved samtidige opdateringer (ETag)
const TIMEOUT_MS = 5000 // en besked må ikke vente længe på tælleren

export function hashIp(key, ip) {
  return createHmac('sha256', key).update(ip, 'utf8').digest('hex')
}

function windowStart(seconds) {
  return Math.floor(seconds / WINDOW_SECONDS) * WINDOW_SECONDS
}

/** Vinduets PartitionKey: starten i UTC som ÅÅÅÅMMDDTTMM, så nøglerne sorterer efter tid. */
export function windowKey(seconds) {
  return new Date(windowStart(seconds) * 1000).toISOString().slice(0, 16).replace(/[-T:]/g, '')
}

const status = (error) => error?.statusCode

export class RateLimiter {
  constructor(table, key, { maxRequests = MAX_REQUESTS, now = () => Date.now() / 1000 } = {}) {
    this.table = table
    this.key = key
    this.maxRequests = maxRequests
    this.now = now
  }

  /** { allowed: true }, eller { allowed: false, retryAfterSeconds } til vinduets slutning. */
  async check(ip, log = console) {
    try {
      return await this.#count(ip, log)
    } catch (error) {
      // Lageret svarer ikke, forkert forbindelse osv.: beskeden går igennem.
      log.warn(`kontakt: grænse-lageret fejlede (${error?.name || 'Error'})`)
      return { allowed: true }
    }
  }

  async #count(ip, log) {
    const now = this.now()
    const partitionKey = windowKey(now)
    const rowKey = hashIp(this.key, ip)
    const options = () => ({ abortSignal: AbortSignal.timeout(TIMEOUT_MS) })
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      let row
      try {
        row = await this.table.getEntity(partitionKey, rowKey, options())
      } catch (error) {
        if (status(error) !== 404) throw error
        try {
          await this.table.createEntity({ partitionKey, rowKey, antal: 1 }, options())
          return { allowed: true }
        } catch (createError) {
          if (status(createError) === 409) continue // en anden instans oprettede rækken lige før
          throw createError
        }
      }
      if (row.antal >= this.maxRequests) {
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(windowStart(now) + WINDOW_SECONDS - now)) }
      }
      try {
        await this.table.updateEntity({ partitionKey, rowKey, antal: row.antal + 1 }, 'Replace',
          { etag: row.etag, ...options() })
        return { allowed: true }
      } catch (updateError) {
        if (status(updateError) === 412) continue // en anden instans talte imellem; læs igen
        throw updateError
      }
    }
    log.warn(`kontakt: grænse-lageret var optaget ${ATTEMPTS} gange; beskeden går igennem`)
    return { allowed: true }
  }

  /** Sletter vinduer, der begyndte for mindst DELETE_AFTER_SECONDS siden. Giver antallet af slettede rækker. */
  async deleteOldWindows() {
    const limit = windowKey(this.now() - DELETE_AFTER_SECONDS)
    const rows = []
    const query = { filter: odata`PartitionKey le ${limit}`, select: ['PartitionKey', 'RowKey'] }
    for await (const row of this.table.listEntities({ queryOptions: query })) rows.push(row)
    for (const row of rows) await this.table.deleteEntity(row.partitionKey, row.rowKey)
    return rows.length
  }
}

let cached = null

/** Tælleren fra app-indstillingerne, eller null, når IP_HASH_KEY eller lageret mangler. */
export function rateLimiterFromEnvironment(env = process.env) {
  const key = env.IP_HASH_KEY
  const connectionString = env.AzureWebJobsStorage
  if (!key || !connectionString) return null
  if (cached?.key !== key || cached?.connectionString !== connectionString) {
    const table = TableClient.fromConnectionString(connectionString, TABLE_NAME, { retryOptions: { maxRetries: 2 } })
    cached = { key, connectionString, limiter: new RateLimiter(table, key) }
  }
  return cached.limiter
}
