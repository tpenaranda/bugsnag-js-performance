import { type InternalConfiguration, type Plugin, type SpanFactory } from '@bugsnag/core-performance'
import { type BrowserConfiguration } from '../config'

interface ResourceTiming extends PerformanceResourceTiming {
  responseStatus?: number // https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/responseStatus
}

export function getHTTPFlavor (protocol: string) {
  switch (protocol) {
    case 'http/1.0':
      return '1.0'
    case 'http/1.1':
      return '1.1'
    case 'h2':
    case 'h2c':
      return '2.0'
    case 'h3':
      return '3.0'
    case 'spdy/1':
    case 'spdy/2':
    case 'spdy/3':
      return 'SPDY'
    default:
      return protocol
  }
}

function resourceLoadSupported (PerformanceObserverClass: typeof PerformanceObserver) {
  return PerformanceObserverClass &&
    Array.isArray(PerformanceObserverClass.supportedEntryTypes) &&
    PerformanceObserverClass.supportedEntryTypes.includes('resource')
}

export class ResourceLoadPlugin implements Plugin<BrowserConfiguration> {
  constructor (
    private readonly spanFactory: SpanFactory,
    private readonly PerformanceObserverClass: typeof PerformanceObserver
  ) {}

  configure (configuration: InternalConfiguration<BrowserConfiguration>) {
    if (!resourceLoadSupported(this.PerformanceObserverClass)) return

    const observer = new this.PerformanceObserverClass((list) => {
      const entries = list.getEntries() as ResourceTiming[]

      for (const entry of entries) {
        if (['fetch', 'xmlhttprequest'].includes(entry.initiatorType)) return

        const parentContext = this.spanFactory.firstSpanContext

        if (parentContext) {
          const url = new URL(entry.name)
          const name = url.href.replace(url.search, '')

          const span = this.spanFactory.startSpan(`[ResourceLoad]${name}`, {
            parentContext,
            startTime: entry.startTime,
            makeCurrentContext: false
          })

          span.setAttribute('bugsnag.span.category', 'resource_load')
          span.setAttribute('http.url', entry.name)
          span.setAttribute('http.flavor', getHTTPFlavor(entry.nextHopProtocol))
          span.setAttribute('http.response_content_length', entry.encodedBodySize)
          span.setAttribute('http.response_content_length_uncompressed', entry.decodedBodySize)

          if (entry.responseStatus) {
            span.setAttribute('http.status_code', entry.responseStatus)
          }

          this.spanFactory.endSpan(span, entry.responseEnd)
        }
      }
    })

    observer.observe({ type: 'resource', buffered: true })
  }
}
