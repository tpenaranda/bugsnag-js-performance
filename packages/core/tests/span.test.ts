
import { Kind } from '@bugsnag/core-performance'
import {
  ControllableBackgroundingListener,
  InMemoryDelivery,
  IncrementingClock,
  StableIdGenerator,
  VALID_API_KEY,
  createTestClient,
  spanAttributesSource
} from '@bugsnag/js-performance-test-utilities'
import {
  InMemoryPersistence,
  SpanFactory,
  spanToJson,
  spanContextEquals,
  type SpanEnded
} from '../lib'
import Sampler from '../lib/sampler'

jest.useFakeTimers()

const jestLogger = {
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}

describe('SpanInternal', () => {
  describe('.setAttribute()', () => {
    test.each([
      { parameter: 'value', key: 'stringValue' },
      { parameter: true, key: 'boolValue' },
      { parameter: 0.5, key: 'doubleValue' },
      { parameter: 42, key: 'intValue', expected: '42' }
    ])('setAttribute results in an expected $key', ({ parameter, expected, key }) => {
      const clock = new IncrementingClock()
      const sampler = new Sampler(0.5)
      const delivery = { send: jest.fn() }
      const processor = { add: (span: SpanEnded) => delivery.send(spanToJson(span, clock)) }
      const spanFactory = new SpanFactory(
        processor,
        sampler,
        new StableIdGenerator(),
        spanAttributesSource,
        new IncrementingClock(),
        new ControllableBackgroundingListener(),
        jestLogger
      )

      const spanInternal = spanFactory.startSpan('span-name', { startTime: 1234 })
      spanInternal.setAttribute('bugsnag.test.attribute', parameter)

      spanFactory.endSpan(spanInternal, 5678)

      expect(delivery.send).toHaveBeenCalledWith(expect.objectContaining({
        attributes: expect.arrayContaining([{
          key: 'bugsnag.test.attribute',
          value: {
            [key]: expected || parameter
          }
        }])
      }))
    })
  })

  describe('.addEvent()', () => {
    it('enables adding Events to spans', () => {
      const clock = new IncrementingClock('1970-01-01T00:00:00.000Z')
      const sampler = new Sampler(0.5)
      const delivery = { send: jest.fn() }
      const processor = { add: (span: SpanEnded) => delivery.send(spanToJson(span, clock)) }
      const spanFactory = new SpanFactory(
        processor,
        sampler,
        new StableIdGenerator(),
        spanAttributesSource,
        new IncrementingClock(),
        new ControllableBackgroundingListener(),
        jestLogger
      )

      const spanInternal = spanFactory.startSpan('span-name', { startTime: 1234 })
      spanInternal.addEvent('bugsnag.test.event', 1234)

      spanFactory.endSpan(spanInternal, 5678)

      expect(delivery.send).toHaveBeenCalledWith(expect.objectContaining({
        events: [{
          name: 'bugsnag.test.event',
          timeUnixNano: '1234000000'
        }]
      }))
    })
  })
})

describe('SpanFactory', () => {
  describe('startSpan', () => {
    it('omits first class span attribute by default', () => {
      const clock = new IncrementingClock('1970-01-01T00:00:00.000Z')
      const sampler = new Sampler(0.5)
      const delivery = { send: jest.fn() }
      const processor = { add: (span: SpanEnded) => delivery.send(spanToJson(span, clock)) }
      const spanFactory = new SpanFactory(
        processor,
        sampler,
        new StableIdGenerator(),
        spanAttributesSource,
        new IncrementingClock(),
        new ControllableBackgroundingListener(),
        jestLogger
      )

      const span = spanFactory.startSpan('name')

      // @ts-expect-error 'attributes' is private but very awkward to test otherwise
      expect(span.attributes.attributes.has('bugsnag.span.first_class')).toBe(false)
    })

    it('creates first class spans when isFirstClass is true', () => {
      const clock = new IncrementingClock('1970-01-01T00:00:00.000Z')
      const sampler = new Sampler(0.5)
      const delivery = { send: jest.fn() }
      const processor = { add: (span: SpanEnded) => delivery.send(spanToJson(span, clock)) }
      const spanFactory = new SpanFactory(
        processor,
        sampler,
        new StableIdGenerator(),
        spanAttributesSource,
        new IncrementingClock(),
        new ControllableBackgroundingListener(),
        jestLogger
      )

      const span = spanFactory.startSpan('name', { isFirstClass: true })

      // @ts-expect-error 'attributes' is private but very awkward to test otherwise
      expect(span.attributes.attributes.get('bugsnag.span.first_class')).toBe(true)
    })

    it('does not create first class spans when isFirstClass is false', () => {
      const clock = new IncrementingClock('1970-01-01T00:00:00.000Z')
      const sampler = new Sampler(0.5)
      const delivery = { send: jest.fn() }
      const processor = { add: (span: SpanEnded) => delivery.send(spanToJson(span, clock)) }
      const spanFactory = new SpanFactory(
        processor,
        sampler,
        new StableIdGenerator(),
        spanAttributesSource,
        new IncrementingClock(),
        new ControllableBackgroundingListener(),
        jestLogger
      )

      const span = spanFactory.startSpan('name', { isFirstClass: false })

      // @ts-expect-error 'attributes' is private but very awkward to test otherwise
      expect(span.attributes.attributes.get('bugsnag.span.first_class')).toBe(false)
    })

    it.each([
      null,
      undefined,
      1,
      0,
      'true',
      'false',
      [true, false]
    ])('omits first class attribute when isFirstClass is %s', (isFirstClass) => {
      const clock = new IncrementingClock('1970-01-01T00:00:00.000Z')
      const sampler = new Sampler(0.5)
      const delivery = { send: jest.fn() }
      const processor = { add: (span: SpanEnded) => delivery.send(spanToJson(span, clock)) }
      const spanFactory = new SpanFactory(
        processor,
        sampler,
        new StableIdGenerator(),
        spanAttributesSource,
        new IncrementingClock(),
        new ControllableBackgroundingListener(),
        jestLogger
      )

      // @ts-expect-error 'isFirstClass' is the wrong type
      const span = spanFactory.startSpan('name', { isFirstClass })

      // @ts-expect-error 'attributes' is private but very awkward to test otherwise
      expect(span.attributes.attributes.has('bugsnag.span.first_class')).toBe(false)
    })
  })
})

describe('Span', () => {
  describe('client.startSpan()', () => {
    it('returns a Span', () => {
      const client = createTestClient()
      const span = client.startSpan('test span')
      expect(span).toStrictEqual({
        id: expect.any(String),
        traceId: expect.any(String),
        end: expect.any(Function),
        isValid: expect.any(Function)
      })
    })

    const invalidStartTimes: any[] = [
      { type: 'string', startTime: 'i am not a startTime' },
      { type: 'bigint', startTime: BigInt(9007199254740991) },
      { type: 'true', startTime: true },
      { type: 'false', startTime: false },
      { type: 'function', startTime: () => {} },
      { type: 'object', startTime: { property: 'test' } },
      { type: 'empty array', startTime: [] },
      { type: 'array', startTime: [1, 2, 3] },
      { type: 'symbol', startTime: Symbol('test') },
      { type: 'null', startTime: null },
      { type: 'undefined', startTime: undefined }
    ]

    invalidStartTimes.push(...invalidStartTimes.map(
      ({ type, startTime }) => ({
        type: `{ startTime: ${type} }`,
        startTime: { startTime }
      }))
    )

    it.each(invalidStartTimes)('uses default clock implementation if startTime is invalid ($type)', async ({ startTime }) => {
      const delivery = new InMemoryDelivery()
      const clock = new IncrementingClock('1970-01-01T00:00:00Z')
      const client = createTestClient({ deliveryFactory: () => delivery, clock })
      client.start({ apiKey: VALID_API_KEY })

      const span = client.startSpan('test span', startTime)
      span.end()

      await jest.runOnlyPendingTimersAsync()

      expect(delivery).toHaveSentSpan(expect.objectContaining({
        startTimeUnixNano: '1000000'
      }))
    })
  })

  describe('Span.end()', () => {
    it('can be ended without an endTime', async () => {
      const delivery = new InMemoryDelivery()
      const clock = new IncrementingClock('1970-01-01T00:00:00Z')
      const client = createTestClient({ deliveryFactory: () => delivery, clock })
      client.start({ apiKey: VALID_API_KEY })

      const span = client.startSpan('test span')
      span.end()

      await jest.runOnlyPendingTimersAsync()

      expect(delivery).toHaveSentSpan({
        spanId: 'a random 64 bit string',
        traceId: 'a random 128 bit string',
        kind: Kind.Client,
        name: 'test span',
        startTimeUnixNano: '1000000',
        endTimeUnixNano: '2000000',
        attributes: expect.any(Object),
        events: expect.any(Array)
      })
    })

    it('accepts a Date object as endTime', async () => {
      const clock = new IncrementingClock('2023-01-02T03:04:05.006Z')
      const delivery = new InMemoryDelivery()
      const client = createTestClient({ deliveryFactory: () => delivery, clock })
      client.start({ apiKey: VALID_API_KEY })

      const span = client.startSpan('test span')
      span.end(new Date('2023-01-02T03:04:05.008Z')) // 2ms after time origin

      await jest.runOnlyPendingTimersAsync()

      expect(delivery).toHaveSentSpan({
        spanId: 'a random 64 bit string',
        traceId: 'a random 128 bit string',
        attributes: expect.any(Object),
        events: expect.any(Array),
        kind: Kind.Client,
        name: 'test span',
        startTimeUnixNano: '1672628645007000000',
        endTimeUnixNano: '1672628645008000000'
      })
    })

    it('accepts a number of nanoseconds as endTime', async () => {
      const clock = new IncrementingClock('1970-01-01T00:00:00.000Z')
      const delivery = new InMemoryDelivery()

      const client = createTestClient({ deliveryFactory: () => delivery, clock })
      client.start({ apiKey: VALID_API_KEY })

      const span = client.startSpan('test span')
      span.end(4321)

      await jest.runOnlyPendingTimersAsync()

      expect(delivery).toHaveSentSpan({
        spanId: 'a random 64 bit string',
        traceId: 'a random 128 bit string',
        attributes: expect.any(Object),
        events: expect.any(Array),
        kind: Kind.Client,
        name: 'test span',
        startTimeUnixNano: '1000000',
        endTimeUnixNano: '4321000000'
      })
    })

    it('will always be sampled when probability is 1', async () => {
      const delivery = new InMemoryDelivery()
      const persistence = new InMemoryPersistence()

      const client = createTestClient({ deliveryFactory: () => delivery, persistence })
      client.start(VALID_API_KEY)

      await jest.runOnlyPendingTimersAsync()

      const span = client.startSpan('test span')
      span.end()

      await jest.runOnlyPendingTimersAsync()

      expect(delivery.requests).toHaveLength(1)
    })

    it('will always be discarded when probability is 0', async () => {
      const delivery = new InMemoryDelivery()
      const persistence = new InMemoryPersistence()
      await persistence.save('bugsnag-sampling-probability', { value: 0.0, time: Date.now() })

      const client = createTestClient({ deliveryFactory: () => delivery, persistence })
      client.start(VALID_API_KEY)

      await jest.runOnlyPendingTimersAsync()

      const span = client.startSpan('test span')
      span.end()

      await jest.runOnlyPendingTimersAsync()

      expect(delivery.requests).toHaveLength(0)
    })

    it('will sample spans based on their traceId', async () => {
      const delivery = new InMemoryDelivery()
      const persistence = new InMemoryPersistence()

      // 0.14 as the second span's trace ID results in a sampling rate greater
      // than this but the other two are smaller
      await persistence.save('bugsnag-sampling-probability', { value: 0.14, time: Date.now() })

      // trace IDs with known sampling rates; this allows us to check that the
      // first span is sampled and the second is discarded with a specific
      // sampling probability
      const traceIds = [
        '0123456789abcdeffedcba9876543210', // samplingRate: 0
        'a0b1c2d3e4f5a0b1c2d3e4f5a0b1c2d3', // samplingRate: 0.14902140296740024
        '7eb23db1d1456caa839b662f3729d23c' // samplingRate: 0.10653525779641589
      ]

      const idGenerator = {
        generate (bits: 64 | 128) {
          if (bits === 128) {
            const id = traceIds.shift()

            if (id) {
              return id
            }

            throw new Error('Too many trace IDs were generated!')
          }

          return 'a span ID'
        }
      }

      const client = createTestClient({
        deliveryFactory: () => delivery,
        idGenerator,
        persistence
      })

      client.start(VALID_API_KEY)

      await jest.runOnlyPendingTimersAsync()

      client.startSpan('span 1').end()
      client.startSpan('span 2').end()
      client.startSpan('span 3').end()

      await jest.runOnlyPendingTimersAsync()

      expect(delivery).toHaveSentSpan(expect.objectContaining({
        name: 'span 1'
      }))

      expect(delivery).not.toHaveSentSpan(expect.objectContaining({
        name: 'span 2'
      }))

      expect(delivery).toHaveSentSpan(expect.objectContaining({
        name: 'span 3'
      }))
    })

    it('will cancel any open spans if the app is backgrounded', async () => {
      const delivery = new InMemoryDelivery()
      const backgroundingListener = new ControllableBackgroundingListener()
      const logger = { warn: jest.fn(), debug: jest.fn(), error: jest.fn(), info: jest.fn() }
      const client = createTestClient({
        deliveryFactory: () => delivery,
        backgroundingListener
      })

      client.start({
        apiKey: VALID_API_KEY,
        logger
      })

      await jest.runOnlyPendingTimersAsync()

      // started in foreground and ended in background
      const movedToBackground = client.startSpan('moved-to-background')
      backgroundingListener.sendToBackground()
      movedToBackground.end()

      expect(logger.warn).toHaveBeenCalledWith('Attempted to end a Span which has already ended or been discarded.')
      expect(logger.warn).toHaveBeenCalledTimes(1)

      // started in background and ended in foreground
      const movedToForeground = client.startSpan('moved-to-foreground')
      backgroundingListener.sendToForeground()
      movedToForeground.end()

      expect(logger.warn).toHaveBeenCalledTimes(2)

      // entirely in background
      backgroundingListener.sendToBackground()
      const backgroundSpan = client.startSpan('entirely-in-background')
      backgroundSpan.end()

      expect(logger.warn).toHaveBeenCalledTimes(3)

      // started and ended in foreground but backgrounded during span
      backgroundingListener.sendToForeground()
      const backgroundedDuringSpan = client.startSpan('backgrounded-during-span')
      backgroundingListener.sendToBackground()
      backgroundingListener.sendToForeground()
      backgroundedDuringSpan.end()

      expect(logger.warn).toHaveBeenCalledTimes(4)

      // entirely in foreground (should be delivered)
      const inForeground = client.startSpan('entirely-in-foreground')
      inForeground.end()

      await jest.runOnlyPendingTimersAsync()

      expect(logger.warn).toHaveBeenCalledTimes(4)

      expect(delivery).not.toHaveSentSpan(expect.objectContaining({
        name: 'moved-to-background'
      }))

      expect(delivery).not.toHaveSentSpan(expect.objectContaining({
        name: 'moved-to-foreground'
      }))

      expect(delivery).not.toHaveSentSpan(expect.objectContaining({
        name: 'entirely-in-background'
      }))

      expect(delivery).not.toHaveSentSpan(expect.objectContaining({
        name: 'backgrounded-during-span'
      }))

      expect(delivery).toHaveSentSpan(expect.objectContaining({
        name: 'entirely-in-foreground'
      }))
    })

    it('will not end a span that has already been ended', async () => {
      const delivery = new InMemoryDelivery()
      const backgroundingListener = new ControllableBackgroundingListener()
      const logger = { warn: jest.fn(), debug: jest.fn(), error: jest.fn(), info: jest.fn() }
      const client = createTestClient({
        deliveryFactory: () => delivery,
        backgroundingListener
      })

      client.start({
        apiKey: VALID_API_KEY,
        logger
      })

      const span = client.startSpan('span-ended-once')
      span.end()

      await jest.runOnlyPendingTimersAsync()

      expect(logger.warn).not.toHaveBeenCalled()
      expect(delivery.requests).toHaveLength(1)
      expect(delivery).toHaveSentSpan(expect.objectContaining({
        name: 'span-ended-once'
      }))

      span.end()

      await jest.runOnlyPendingTimersAsync()

      expect(logger.warn).toHaveBeenCalledWith('Attempted to end a Span which has already ended or been discarded.')
      expect(delivery.requests).toHaveLength(1)
    })
  })
})

describe('SpanContext', () => {
  describe('SpanContext.isValid()', () => {
    it('returns false if the span has been ended', () => {
      const delivery = new InMemoryDelivery()
      const clock = new IncrementingClock('1970-01-01T00:00:00Z')
      const client = createTestClient({ deliveryFactory: () => delivery, clock })
      client.start({ apiKey: VALID_API_KEY })

      const span = client.startSpan('test span')
      expect(span.isValid()).toEqual(true)

      span.end()
      expect(span.isValid()).toEqual(false)
    })
  })
  describe('spanContextEquals()', () => {
    it.each([
      {
        span1: undefined,
        span2: undefined,
        expected: true
      },
      {
        span1: { id: '0123456789abcdef', traceId: '0123456789abcdeffedcba9876543210', isValid: () => true },
        span2: undefined,
        expected: false
      },
      {
        span1: undefined,
        span2: { id: '0123456789abcdef', traceId: '0123456789abcdeffedcba9876543210', isValid: () => true },
        expected: false
      },
      {
        span1: { id: '0123456789abcdef', traceId: '0123456789abcdeffedcba9876543210', isValid: () => true },
        span2: { id: '0123456789abcdef', traceId: '0123456789abcdeffedcba9876543210', isValid: () => true },
        expected: true
      },
      {
        span1: { id: '0123456789abcdef', traceId: '0123456789abcdeffedcba9876543210', isValid: () => true },
        span2: { id: '0123456789abcdef', traceId: '0123456789abcdeffedcba9876543210', isValid: () => false },
        expected: true
      },
      {
        span1: { id: '0123456789abcdef', traceId: '0123456789abcdeffedcba9876543210', isValid: () => true },
        span2: { id: '0123456789abcdef', traceId: 'a0b1c2d3e4f5a0b1c2d3e4f5a0b1c2d3', isValid: () => true },
        expected: false
      },
      {
        span1: { id: '0123456789abcdef', traceId: '0123456789abcdeffedcba9876543210', isValid: () => true },
        span2: { id: '9876543210fedcba', traceId: '0123456789abcdeffedcba9876543210', isValid: () => true },
        expected: false
      }
    ])('returns $expected given inputs $span1 and $span2', ({ span1, span2, expected }) => {
      expect(spanContextEquals(span1, span2)).toEqual(expected)
    })
  })
})
