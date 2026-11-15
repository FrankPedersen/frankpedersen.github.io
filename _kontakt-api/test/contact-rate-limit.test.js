// Accepttestene i SPEC-kontakt-ip-graense.md: højst 3 beskeder pr. IP pr. 15 minutter på tværs af instanser.
//
// Tælleren står i Table Storage (Azurite i testene) med en HMAC af IP'en, én række pr. hash og 15-minutters vindue, og
// optimistisk samtidighed med ETag. Fejler lageret, går beskeden igennem, og fejlen logges uden IP og hash.
// Azurite startes med npx første gang, den bruges; kontoen og nøglen er Azurites faste udviklingskonto, ikke en hemmelighed.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer, connect } from 'node:net'
import { after, before, test } from 'node:test'
import { TableClient, TableServiceClient } from '@azure/data-tables'
import {
  MAX_REQUESTS,
  RateLimiter,
  TABLE_NAME,
  hashIp,
  rateLimiterFromEnvironment,
  windowKey,
} from '../src/contact-rate-limit.js'
import { checkRateLimit } from '../src/contact-protection.js'

const AZURITE = 'azurite@3.37.0'
const KEY = 'testnoegle-ikke-hemmelig'
const IP = '203.0.113.7'
// 13. november 2026 kl. 12:20:00 UTC, midt i vinduet 12:15–12:30.
const T0 = Date.UTC(2026, 10, 13, 12, 20, 0) / 1000
const WINDOWS = process.platform === 'win32'

let azurite
let connectionString

function freePort() {
  return new Promise((resolve) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)) })
  })
}

function answers(port) {
  return new Promise((resolve) => {
    const socket = connect(port, '127.0.0.1')
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('error', () => resolve(false))
  })
}

before(async () => {
  const port = await freePort()
  const args = ['--yes', '-p', AZURITE, 'azurite-table', '--inMemoryPersistence', '--tableHost', '127.0.0.1',
    '--tablePort', String(port), '--skipApiVersionCheck', '--silent', '--disableTelemetry']
  // På Windows er npx en .cmd-fil, der kræver en skal; argumenterne er faste, så de samles til én kommando.
  azurite = WINDOWS
    ? spawn(`npx ${args.join(' ')}`, { stdio: 'ignore', shell: true })
    : spawn('npx', args, { stdio: 'ignore', detached: true })
  for (let i = 0; i < 240; i++) { // første gang henter npx Azurite
    if (await answers(port)) break
    if (azurite.exitCode !== null) throw new Error('Azurite stoppede ved start')
    await new Promise((r) => setTimeout(r, 500))
  }
  if (!(await answers(port))) throw new Error('Azurite svarede ikke')
  connectionString = 'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;'
    + 'AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;'
    + `TableEndpoint=http://127.0.0.1:${port}/devstoreaccount1;`
})

after(() => {
  if (!azurite) return
  if (WINDOWS) spawnSync('taskkill', ['/T', '/F', '/PID', String(azurite.pid)])
  else process.kill(-azurite.pid, 'SIGTERM')
})

/** En tom tabel i Azurite for hver test. */
async function newTable() {
  const name = `kontaktgraense${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}`
  await TableServiceClient.fromConnectionString(connectionString, { allowInsecureConnection: true }).createTable(name)
  return name
}

/** En "instans": sin egen forbindelse til samme tabel og sit eget ur. */
function instance(name, clock, key = KEY) {
  const table = TableClient.fromConnectionString(connectionString, name, { allowInsecureConnection: true })
  return new RateLimiter(table, key, { now: () => clock.now })
}

function recordingLog() {
  const lines = []
  return { lines, warn: (...a) => lines.push(a.join(' ')), log: (...a) => lines.push(a.join(' ')), error: (...a) => lines.push(a.join(' ')) }
}

// 1. På tværs af instanser

test('to instanser mod samme tabel lader tilsammen 3 beskeder igennem; den 4. afvises', async () => {
  const name = await newTable()
  const clock = { now: T0 }
  const a = instance(name, clock)
  const b = instance(name, clock)
  assert.equal(MAX_REQUESTS, 3)
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(await (i % 2 ? a : b).check(IP), { allowed: true }, `besked ${i + 1}`)
    clock.now += 20
  }
  const fourth = await a.check(IP)
  assert.equal(fourth.allowed, false)
  assert.ok(fourth.retryAfterSeconds >= 1 && fourth.retryAfterSeconds <= 900, String(fourth.retryAfterSeconds))
  assert.equal((await b.check(IP)).allowed, false)
  // En anden IP har sin egen tæller.
  assert.deepEqual(await a.check('198.51.100.2'), { allowed: true })
})

test('checkRateLimit giver samme svar som før: 3 igennem, så Retry-After til vinduets slutning', async () => {
  const name = await newTable()
  const clock = { now: T0 }
  const limiter = instance(name, clock)
  for (let i = 0; i < 3; i++) assert.deepEqual(await checkRateLimit(IP, { limiter }), { allowed: true })
  // Vinduet 12:15–12:30 slutter om 600 sekunder.
  assert.deepEqual(await checkRateLimit(IP, { limiter }), { allowed: false, retryAfterSeconds: 600 })
  // Uden IP er der ingen grænse, som før.
  assert.deepEqual(await checkRateLimit(null, { limiter }), { allowed: true })
})

// 2. Nyt vindue

test('i næste 15-minutters vindue må samme IP sende igen', async () => {
  const name = await newTable()
  const clock = { now: T0 }
  const a = instance(name, clock)
  for (let i = 0; i < 3; i++) assert.equal((await a.check(IP)).allowed, true)
  assert.equal((await a.check(IP)).allowed, false)
  clock.now = Date.UTC(2026, 10, 13, 12, 30, 0) / 1000
  assert.deepEqual(await a.check(IP), { allowed: true })
})

test('vinduerne følger uret i 15 minutter, og nøglen er starten i UTC', () => {
  assert.equal(windowKey(Date.UTC(2026, 10, 13, 12, 14, 59) / 1000), '202611131200')
  assert.equal(windowKey(Date.UTC(2026, 10, 13, 12, 15, 0) / 1000), '202611131215')
  assert.equal(windowKey(Date.UTC(2026, 10, 13, 23, 59, 59) / 1000), '202611132345')
})

// 3. Samtidighed

test('10 samtidige kald fra samme IP giver præcis 3 igennem', async () => {
  const name = await newTable()
  const clock = { now: T0 }
  const a = instance(name, clock)
  const b = instance(name, clock)
  const answersFromBoth = await Promise.all(Array.from({ length: 10 }, (_, i) => (i % 2 ? a : b).check(IP)))
  assert.equal(answersFromBoth.filter((s) => s.allowed).length, 3)
})

// 4. Sletning

test('sletningen fjerner et vindue, der begyndte for 15 minutter siden, og lader et på 10 minutter stå', async () => {
  const name = await newTable()
  const clock = { now: Date.UTC(2026, 10, 13, 12, 20, 0) / 1000 }
  const a = instance(name, clock)
  assert.equal((await a.check(IP)).allowed, true) // vinduet 12:15
  clock.now = Date.UTC(2026, 10, 13, 12, 25, 0) / 1000 // vinduet begyndte for 10 minutter siden
  assert.equal(await a.deleteOldWindows(), 0)
  clock.now = Date.UTC(2026, 10, 13, 12, 30, 0) / 1000 // vinduet begyndte for 15 minutter siden
  assert.equal((await a.check(IP)).allowed, true) // vinduet 12:30 bliver stående
  assert.equal(await a.deleteOldWindows(), 1)
  const table = TableClient.fromConnectionString(connectionString, name, { allowInsecureConnection: true })
  const rows = []
  for await (const r of table.listEntities()) rows.push(r.partitionKey)
  assert.deepEqual(rows, ['202611131230'])
})

test('sletningen er en timer-funktion, der kører hvert 5. minut', () => {
  const source = readFileSync(new URL('../src/functions/contact-cleanup.js', import.meta.url), 'utf-8')
  assert.match(source, /app\.timer\(/)
  assert.match(source, /schedule: '0 \*\/5 \* \* \* \*'/)
  assert.match(source, /deleteOldWindows\(\)/)
})

// 5. Ingen IP

test('rækken har en HMAC af IP\'en og kun antal, ikke IP\'en', async () => {
  const name = await newTable()
  const clock = { now: T0 }
  await instance(name, clock).check(IP)
  const table = TableClient.fromConnectionString(connectionString, name, { allowInsecureConnection: true })
  const rows = []
  for await (const r of table.listEntities()) rows.push(r)
  assert.equal(rows.length, 1)
  const [row] = rows
  assert.match(row.rowKey, /^[0-9a-f]{64}$/)
  assert.equal(row.rowKey, hashIp(KEY, IP))
  assert.equal(row.partitionKey, '202611131215')
  assert.deepEqual(Object.keys(row).filter((k) => !['partitionKey', 'rowKey', 'etag', 'timestamp'].includes(k)), ['antal'])
  assert.ok(!JSON.stringify(row).includes(IP))
  assert.equal(TABLE_NAME, 'kontaktgraense')
})

test('ingen fil i repoet har en værdi for IP_HASH_KEY', () => {
  const files = spawnSync('git', ['ls-files', '-z'], { cwd: new URL('../..', import.meta.url), encoding: 'utf-8' }).stdout
    .split('\0').filter(Boolean)
  assert.ok(files.length > 50)
  const value = /IP_HASH_KEY["'`]?\s*[:=]\s*["'`]?[A-Za-z0-9+/=_-]{8,}/
  for (const file of files) {
    let text
    try { text = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf-8') } catch { continue }
    assert.doesNotMatch(text, value, file)
  }
})

// 6. Fejl i lageret, og grænsen slået fra

test('et lager, der fejler, giver en advarsel i loggen, og beskeden går igennem', async () => {
  const brokenTable = {
    getEntity: async () => { const e = new Error('lageret svarer ikke'); e.name = 'RestError'; throw e },
  }
  const limiter = new RateLimiter(brokenTable, KEY, { now: () => T0 })
  const log = recordingLog()
  assert.deepEqual(await checkRateLimit(IP, { limiter, log }), { allowed: true })
  assert.deepEqual(log.lines, ['kontakt: grænse-lageret fejlede (RestError)'])
  for (const line of log.lines) {
    assert.ok(!line.includes(IP) && !line.includes(hashIp(KEY, IP)), line)
  }
})

test('mangler IP_HASH_KEY eller lageret, er grænsen slået fra, og beskeden går igennem', async () => {
  assert.equal(rateLimiterFromEnvironment({}), null)
  assert.equal(rateLimiterFromEnvironment({ IP_HASH_KEY: KEY }), null)
  assert.equal(rateLimiterFromEnvironment({ AzureWebJobsStorage: 'UseDevelopmentStorage=true' }), null)
  const log = recordingLog()
  assert.deepEqual(await checkRateLimit(IP, { limiter: null, log }), { allowed: true })
  assert.deepEqual(log.lines, ['kontakt: grænsen er slået fra'])
})

test('SDK\'ens log holdes på advarsler og fejl, også når AZURE_LOG_LEVEL beder om mere', () => {
  const code = "const { getLogLevel } = await import('@azure/logger'); await import('./src/contact-rate-limit.js'); console.log(getLogLevel())"
  for (const level of ['info', 'verbose']) {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
      cwd: new URL('..', import.meta.url), encoding: 'utf-8', env: { ...process.env, AZURE_LOG_LEVEL: level },
    })
    assert.equal(r.stdout.trim().split('\n').pop(), 'warning', `${level}: ${r.stderr}`)
  }
})
