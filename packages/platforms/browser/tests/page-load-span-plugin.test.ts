/**
 * @jest-environment jsdom
 * @jest-environment-options { "url": "https://bugsnag.com/page-load-span-plugin", "referrer": "https://bugsnag.com" }
 */

import {
  InMemoryDelivery,
  IncrementingClock,
  VALID_API_KEY,
  createTestClient
} from '@bugsnag/js-performance-test-utilities'
import {
  PerformanceFake,
  PerformanceObserverManager,
  createPerformanceNavigationTimingFake,
  createPerformancePaintTimingFake,
  createPerformanceEventTimingFake,
  createLayoutShiftFake,
  createLargestContentfulPaintFake
} from './utilities'
import { FullPageLoadPlugin } from '../lib/auto-instrumentation/full-page-load-plugin'
import { createSchema } from '../lib/config'
import { type OnSettle } from '../lib/on-settle'
import { WebVitals } from '../lib/web-vitals'

jest.useFakeTimers()

describe('FullPageLoadPlugin', () => {
  it('Automatically creates and delivers a pageLoadSpan', () => {
    const manager = new PerformanceObserverManager()

    const performance = new PerformanceFake()
    performance.addEntry(createPerformanceNavigationTimingFake({ responseStart: 0.5 }))
    performance.addEntry(createPerformancePaintTimingFake({ startTime: 128 }))
    performance.addEntry(createPerformanceEventTimingFake({ startTime: 0.4, processingStart: 1 }))

    // session window 1: should be ignored as there's a later session window
    performance.addEntry(createLayoutShiftFake({ startTime: 1_000, value: 100 }))
    performance.addEntry(createLayoutShiftFake({ startTime: 1_100, value: 200 }))
    performance.addEntry(createLayoutShiftFake({ startTime: 1_200, value: 300 }))

    // session window 2: should be ignored as there's a later session window
    performance.addEntry(createLayoutShiftFake({ startTime: 5_000, value: 999 }))

    // session window 3: should be included as it's the latest session window
    performance.addEntry(createLayoutShiftFake({ startTime: 20_000, value: 10 }))
    performance.addEntry(createLayoutShiftFake({ startTime: 20_100, value: 20 }))
    performance.addEntry(createLayoutShiftFake({ startTime: 20_200, value: 30 }))

    const clock = new IncrementingClock('1970-01-01T00:00:00Z')
    const delivery = new InMemoryDelivery()
    const onSettle: OnSettle = (onSettleCallback) => { onSettleCallback(1234) }
    const webVitals = new WebVitals(performance, clock, manager.createPerformanceObserverFakeClass())
    const testClient = createTestClient({
      clock,
      deliveryFactory: () => delivery,
      schema: createSchema(window.location.hostname),
      plugins: (spanFactory) => [new FullPageLoadPlugin(document, window.location, spanFactory, webVitals, onSettle)]
    })

    // Trigger LCP event
    manager.queueEntry(createLargestContentfulPaintFake({ startTime: 64 }))
    manager.flushQueue()

    testClient.start({ apiKey: VALID_API_KEY })

    jest.runAllTimers()

    expect(delivery).toHaveSentSpan(expect.objectContaining({
      name: '[FullPageLoad]/page-load-span-plugin',
      events: [
        {
          name: 'fcp',
          timeUnixNano: '128000000'
        },
        {
          name: 'ttfb',
          timeUnixNano: '500000'
        },
        {
          name: 'fid_start',
          timeUnixNano: '400000'
        },
        {
          name: 'fid_end',
          timeUnixNano: '1000000'
        },
        {
          name: 'lcp',
          timeUnixNano: '64000000'
        }
      ]
    }))

    const deliveredSpanAttributes = delivery.requests[0].resourceSpans[0].scopeSpans[0].spans[0].attributes
    expect(deliveredSpanAttributes).toStrictEqual(expect.arrayContaining([
      {
        key: 'bugsnag.span.category',
        value: {
          stringValue: 'full_page_load'
        }
      },
      {
        key: 'bugsnag.browser.page.route',
        value: {
          stringValue: '/page-load-span-plugin'
        }
      },
      {
        key: 'bugsnag.browser.page.referrer',
        value: {
          stringValue: 'https://bugsnag.com/'
        }
      },
      {
        // cumulative layout shift
        key: 'bugsnag.metrics.cls',
        value: {
          // the total of session window 2
          intValue: '60'
        }
      }
    ]))

    const deliveredSpanEvents = delivery.requests[0].resourceSpans[0].scopeSpans[0].spans[0].events
    expect(deliveredSpanEvents).toStrictEqual(expect.arrayContaining([
      {
        name: 'ttfb',
        timeUnixNano: '500000'
      }
    ]))
  })

  it('Does not create a pageLoadSpan with autoInstrumentFullPageLoads set to false', () => {
    const clock = new IncrementingClock()
    const delivery = new InMemoryDelivery()
    const onSettle: OnSettle = (onSettleCallback) => { onSettleCallback(1234) }
    const manager = new PerformanceObserverManager()
    const Observer = manager.createPerformanceObserverFakeClass()
    const webVitals = new WebVitals(new PerformanceFake(), clock, Observer)
    const testClient = createTestClient({
      schema: createSchema(window.location.hostname),
      deliveryFactory: () => delivery,
      plugins: (spanFactory) => [new FullPageLoadPlugin(document, window.location, spanFactory, webVitals, onSettle)]
    })

    testClient.start({ apiKey: VALID_API_KEY, autoInstrumentFullPageLoads: false })

    jest.runAllTimers()

    expect(delivery.requests).toHaveLength(0)
  })

  describe('WebVitals', () => {
    describe('lcp', () => {
      it('uses the latest lcp entry (multiple entries)', () => {
        const manager = new PerformanceObserverManager()
        const performance = new PerformanceFake()

        const clock = new IncrementingClock('1970-01-01T00:00:00Z')
        const delivery = new InMemoryDelivery()
        const onSettle: OnSettle = (onSettleCallback) => { onSettleCallback(1234) }
        const webVitals = new WebVitals(performance, clock, manager.createPerformanceObserverFakeClass())
        const testClient = createTestClient({
          clock,
          deliveryFactory: () => delivery,
          schema: createSchema(window.location.hostname),
          plugins: (spanFactory) => [new FullPageLoadPlugin(document, window.location, spanFactory, webVitals, onSettle)]
        })

        // LCP events
        manager.queueEntry(createLargestContentfulPaintFake({ startTime: 8 }))
        manager.queueEntry(createLargestContentfulPaintFake({ startTime: 16 }))
        manager.queueEntry(createLargestContentfulPaintFake({ startTime: 64 }))
        manager.queueEntry(createLargestContentfulPaintFake({ startTime: 32 }))
        manager.flushQueue()

        testClient.start({ apiKey: VALID_API_KEY })

        jest.runAllTimers()

        expect(delivery).toHaveSentSpan(expect.objectContaining({
          name: '[FullPageLoad]/page-load-span-plugin',
          events: [
            {
              name: 'lcp',
              timeUnixNano: '32000000'
            }
          ]
        }))
      })

      it('uses the latest lcp entry (multiple batches)', () => {
        const manager = new PerformanceObserverManager()
        const performance = new PerformanceFake()

        const clock = new IncrementingClock('1970-01-01T00:00:00Z')
        const delivery = new InMemoryDelivery()
        const onSettle: OnSettle = (onSettleCallback) => { onSettleCallback(1234) }
        const webVitals = new WebVitals(performance, clock, manager.createPerformanceObserverFakeClass())
        const testClient = createTestClient({
          clock,
          deliveryFactory: () => delivery,
          schema: createSchema(window.location.hostname),
          plugins: (spanFactory) => [new FullPageLoadPlugin(document, window.location, spanFactory, webVitals, onSettle)]
        })

        // LCP events
        manager.queueEntry(createLargestContentfulPaintFake({ startTime: 8 }))
        manager.queueEntry(createLargestContentfulPaintFake({ startTime: 16 }))
        manager.flushQueue()

        manager.queueEntry(createLargestContentfulPaintFake({ startTime: 64 }))
        manager.queueEntry(createLargestContentfulPaintFake({ startTime: 32 }))
        manager.flushQueue()

        manager.queueEntry(createLargestContentfulPaintFake({ startTime: 64 }))
        manager.queueEntry(createLargestContentfulPaintFake({ startTime: 128 }))
        manager.flushQueue()

        testClient.start({ apiKey: VALID_API_KEY })

        jest.runAllTimers()

        expect(delivery).toHaveSentSpan(expect.objectContaining({
          name: '[FullPageLoad]/page-load-span-plugin',
          events: [
            {
              name: 'lcp',
              timeUnixNano: '128000000'
            }
          ]
        }))
      })
    })
  })
})
