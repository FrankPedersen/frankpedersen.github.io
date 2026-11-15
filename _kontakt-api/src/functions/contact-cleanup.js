import { app } from '@azure/functions'
import { rateLimiterFromEnvironment } from '../contact-rate-limit.js'

// Sletter grænsens vinduer, når de begyndte for mindst 15 minutter siden, så en hash af en IP står højst 20 minutter
// (SPEC-kontakt-ip-graense.md, src/contact-rate-limit.js).
app.timer('deleteContactWindows', {
  schedule: '0 */5 * * * *',
  runOnStartup: false,
  useMonitor: false,
  handler: async (timer, context) => {
    const limiter = rateLimiterFromEnvironment()
    if (!limiter) {
      context.warn('kontakt: grænsen er slået fra')
      return
    }
    try {
      context.log(`kontakt: slettede ${await limiter.deleteOldWindows()} gamle vinduer`)
    } catch (error) {
      context.warn(`kontakt: sletning af vinduer fejlede (${error?.name || 'Error'})`)
    }
  },
})
