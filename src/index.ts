import { Integration, Stacktrace } from '@sentry/types'
import parseFrames from './parseFrames'

const IntegrationSourcemap: Integration = {
  name: 'IntegrationSourcemap',
  setupOnce (addGlobalEventProcessor): void {
    addGlobalEventProcessor(async event => {
      if (event.exception && event.exception.values) {
        const promises = []
        for (let i = 0; i < event.exception.values.length; i++) {
          const exception = event.exception.values[i]
          if (exception.stacktrace && exception.stacktrace.frames) {
            promises.push(parseFrames(exception.stacktrace.frames).then(frames => {
              (exception.stacktrace as Stacktrace).frames = frames
            }))
          }
        }
        await Promise.all(promises)
      }
      return event
    })
  },
}

export default IntegrationSourcemap
