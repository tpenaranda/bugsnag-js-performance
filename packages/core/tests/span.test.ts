import { createTestClient, InMemoryProcessor, IncrementingClock } from './utilities'

describe('Span', () => {
  describe('client.startSpan()', () => {
    it('returns a Span', () => {
      const client = createTestClient()
      const span = client.startSpan('test span')
      expect(span).toStrictEqual({ end: expect.any(Function) })
    })

    test.each([
      { type: 'string', startTime: 'i am not a startTime' },
      { type: 'bigint', startTime: BigInt(9007199254740991) },
      { type: 'boolean', startTime: true },
      { type: 'function', startTime: () => {} },
      { type: 'object', startTime: { property: 'test' } },
      { type: 'object', startTime: [] },
      { type: 'symbol', startTime: Symbol('test') }
    ])('uses default clock implementation if startTime is invalid ($type)', ({ startTime }) => {
      const processor = new InMemoryProcessor()
      const client = createTestClient({ processor })
      client.start({ apiKey: 'test-api-key' })

      // @ts-expect-error startTime will be invalid
      const span = client.startSpan('test span', startTime)
      span.end()

      expect(processor).toHaveProcessedSpan(expect.objectContaining({
        startTime: 1
      }))
    })
  })

  describe('Span.end()', () => {
    it('can be ended without an endTime', () => {
      const processor = new InMemoryProcessor()
      const client = createTestClient({ processor })

      const span = client.startSpan('test span')
      span.end()

      expect(processor).toHaveProcessedSpan({
        id: 'a random 64 bit string',
        traceId: 'a random 128 bit string',
        kind: 'client',
        name: 'test span',
        startTime: 1,
        endTime: 2
      })
      expect(processor.spans).toHaveLength(1)
    })

    it('accepts a Date object as endTime', () => {
      const processor = new InMemoryProcessor()
      const clock = new IncrementingClock('2023-01-02T03:04:05.006Z')
      const client = createTestClient({ processor, clock })

      const span = client.startSpan('test span')
      span.end(new Date('2023-01-02T03:04:05.008Z')) // 2ms after time origin

      expect(processor).toHaveProcessedSpan({
        id: 'a random 64 bit string',
        traceId: 'a random 128 bit string',
        kind: 'client',
        name: 'test span',
        startTime: 1,
        endTime: 2_000_000 // 2ms in nanoseconds
      })
      expect(processor.spans).toHaveLength(1)
    })

    it('accepts a number of nanoseconds as endTime', () => {
      const processor = new InMemoryProcessor()
      const client = createTestClient({ processor })

      const span = client.startSpan('test span')
      span.end(4321)

      expect(processor).toHaveProcessedSpan({
        id: 'a random 64 bit string',
        traceId: 'a random 128 bit string',
        kind: 'client',
        name: 'test span',
        startTime: 1,
        endTime: 4321
      })
      expect(processor.spans).toHaveLength(1)
    })
  })
})