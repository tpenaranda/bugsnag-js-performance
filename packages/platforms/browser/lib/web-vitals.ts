import { type Clock, type SpanInternal } from '@bugsnag/js-performance-core'

interface PerformanceWithNavigationTiming {
  getEntriesByType: typeof performance.getEntriesByType
  timing: {
    responseStart: number
    navigationStart: number
  }
}

export class WebVitals {
  private performance: PerformanceWithNavigationTiming
  private clock: Clock

  constructor (performance: PerformanceWithNavigationTiming, clock: Clock) {
    this.performance = performance
    this.clock = clock
  }

  attachTo (span: SpanInternal) {
    const timeToFirstByte = this.timeToFirstByte()

    if (timeToFirstByte) {
      span.addEvent('ttfb', timeToFirstByte)
    }
  }

  private timeToFirstByte () {
    const entry = this.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming

    let responseStart: number

    if (entry) {
      responseStart = entry.responseStart
    } else {
      responseStart = this.performance.timing.responseStart - this.performance.timing.navigationStart
    }

    // only use responseStart if it's valid (between 0 and the current time)
    // any other value cannot be valid because it would mean the response
    // started immediately or hasn't happened yet!
    if (responseStart > 0 && responseStart < this.clock.now()) {
      return responseStart
    }

    return undefined
  }
}