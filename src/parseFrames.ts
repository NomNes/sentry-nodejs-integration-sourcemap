import { StackFrame } from '@sentry/types/dist/stackframe'
import { readFileSync } from 'fs'
import { resolve as pathResolve, dirname } from 'path'
import { SourceMapConsumer } from 'source-map'

async function parseFrame (frame: StackFrame): Promise<StackFrame | null> {
  if (!frame.in_app) {
    return frame
  }
  if (!frame.filename) {
    return null
  }
  const content = readFileSync(frame.filename, 'utf-8').split('\n')
  const lastLine = content[content.length - 1]
  if (lastLine.indexOf('sourceMappingURL') >= 0) {
    const sourceMapPath = pathResolve(dirname(frame.filename), lastLine.replace(/.*?=(.*?)$/, '$1'))
    const sourceMapRaw = readFileSync(sourceMapPath, 'utf-8')
    const result = await new Promise(resolve => {
      SourceMapConsumer.with(sourceMapRaw, null, consumer => {
        if (frame.filename && frame.lineno && frame.colno) {
          const original = consumer.originalPositionFor({ line: frame.lineno, column: frame.colno })
          if (!original.source) {
            return resolve(false)
          }
          frame.filename = pathResolve(dirname(frame.filename), original.source)
          frame.colno = original.column || undefined
          frame.lineno = original.line || undefined
          if (frame.lineno) {
            const sourceRaw = readFileSync(frame.filename, 'utf-8').split('\n')
            // eslint-disable-next-line @typescript-eslint/camelcase
            frame.context_line = sourceRaw[frame.lineno - 1]
            if (frame.lineno > 1) {
              let preStart = frame.lineno - 7
              if (preStart < 0) {
                preStart = 0
              }
              // eslint-disable-next-line @typescript-eslint/camelcase
              frame.pre_context = sourceRaw.slice(preStart, frame.lineno - 1)
            }
            if (frame.lineno < sourceRaw.length) {
              let postEnd = frame.lineno + 7
              if (postEnd >= sourceRaw.length) {
                postEnd = sourceRaw.length - 1
              }
              // eslint-disable-next-line @typescript-eslint/camelcase
              frame.post_context = sourceRaw.slice(frame.lineno, postEnd)
            }
          }
        }
        return resolve(true)
      })
    })
    if (!result) {
      return null
    }
  }
  return frame
}

export default async function parseFrames (frames: StackFrame[]): Promise<StackFrame[]> {
  if (frames.length) {
    const parsedFrames: StackFrame[] = []
    for (const frame of frames) {
      const parsed = await parseFrame(frame)
      if (parsed) {
        parsedFrames.push(parsed)
      }
    }
    return parsedFrames
  }
  return frames
}
