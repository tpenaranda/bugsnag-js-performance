import { BatchProcessor } from '../lib/batch-processor'
import { randomUUID } from 'crypto'
import { SpanAttributes, type Delivery, type SpanEnded } from '../lib'
import {
  IncrementingClock,
  resourceAttributesSource,
  createConfiguration
} from '@bugsnag/js-performance-test-utilities'

jest.useFakeTimers()

function generateSpan (): SpanEnded {
  const span: SpanEnded = {
    attributes: new SpanAttributes(new Map()),
    endTime: 12345,
    id: randomUUID(),
    name: 'test span',
    kind: 1,
    startTime: 12345,
    traceId: randomUUID()
  }

  return span
}

describe('BatchProcessor', () => {
  it('delivers after reaching the specified span limit', () => {
    const clock = new IncrementingClock('1970-01-01T00:00:00Z')
    const delivery: Delivery = { send: jest.fn(() => Promise.resolve({ state: 'success' })) }
    const retryQueue = { add: jest.fn(), flush: jest.fn() }
    const batchProcessor = new BatchProcessor(delivery, createConfiguration(), resourceAttributesSource, clock, retryQueue)

    // add 99 spans
    for (let i = 0; i < 99; i++) {
      batchProcessor.add(generateSpan())
    }

    expect(delivery.send).not.toHaveBeenCalled()

    batchProcessor.add(generateSpan())

    expect(delivery.send).toHaveBeenCalledTimes(1)
  })

  it('delivers after the specified time limit', () => {
    const clock = new IncrementingClock('1970-01-01T00:00:00Z')
    const delivery: Delivery = { send: jest.fn(() => Promise.resolve({ state: 'success' })) }
    const retryQueue = { add: jest.fn(), flush: jest.fn() }
    const batchProcessor = new BatchProcessor(delivery, createConfiguration(), resourceAttributesSource, clock, retryQueue)
    batchProcessor.add(generateSpan())
    expect(delivery.send).not.toHaveBeenCalled()

    jest.advanceTimersByTime(30_000)

    expect(delivery.send).toHaveBeenCalledTimes(1)
  })

  it('restarts the timer when calling .add()', () => {
    const clock = new IncrementingClock('1970-01-01T00:00:00Z')
    const delivery: Delivery = { send: jest.fn(() => Promise.resolve({ state: 'success' })) }
    const retryQueue = { add: jest.fn(), flush: jest.fn() }
    const batchProcessor = new BatchProcessor(delivery, createConfiguration(), resourceAttributesSource, clock, retryQueue)
    batchProcessor.add(generateSpan())
    jest.advanceTimersByTime(20_000)
    expect(delivery.send).not.toHaveBeenCalled()
    batchProcessor.add(generateSpan())
    jest.advanceTimersByTime(20_000)
    expect(delivery.send).not.toHaveBeenCalled()
    jest.advanceTimersByTime(10_000)
    expect(delivery.send).toHaveBeenCalledTimes(1)
  })

  it('prevents delivery if releaseStage not in enabledReleaseStages', () => {
    const clock = new IncrementingClock('1970-01-01T00:00:00Z')
    const delivery: Delivery = { send: jest.fn(() => Promise.resolve({ state: 'success' })) }
    const retryQueue = { add: jest.fn(), flush: jest.fn() }
    const configuration = createConfiguration({ enabledReleaseStages: ['production'], releaseStage: 'test' })
    const batchProcessor = new BatchProcessor(delivery, configuration, resourceAttributesSource, clock, retryQueue)
    batchProcessor.add(generateSpan())
    jest.runAllTimers()
    expect(delivery.send).not.toHaveBeenCalled()
  })

  it('adds delivery payload to a retry queue if delivery fails and response code is retryable', async () => {
    const clock = new IncrementingClock('1970-01-01T00:00:00Z')
    const delivery: Delivery = { send: jest.fn(() => Promise.resolve({ state: 'failure-retryable' })) }
    const retryQueue = { add: jest.fn(), flush: jest.fn() }
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    const batchProcessor = new BatchProcessor(delivery, createConfiguration({ logger }), resourceAttributesSource, clock, retryQueue)
    batchProcessor.add(generateSpan())
    await jest.runAllTimersAsync()
    expect(delivery.send).toHaveBeenCalled()
    expect(retryQueue.add).toHaveBeenCalled()
    expect(retryQueue.flush).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith('delivery failed, adding to retry queue')
  })

  it('does not add delivery payload to a retry queue if delivery fails and response code is not retryable', async () => {
    const clock = new IncrementingClock('1970-01-01T00:00:00Z')
    const delivery: Delivery = { send: jest.fn(() => Promise.resolve({ state: 'failure-discard' })) }
    const retryQueue = { add: jest.fn(), flush: jest.fn() }
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    const batchProcessor = new BatchProcessor(delivery, createConfiguration({ logger }), resourceAttributesSource, clock, retryQueue)
    batchProcessor.add(generateSpan())
    await jest.runAllTimersAsync()
    expect(delivery.send).toHaveBeenCalled()
    expect(retryQueue.add).not.toHaveBeenCalled()
    expect(retryQueue.flush).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith('delivery failed')
  })

  it('flushes retry queue after a successful delivery', async () => {
    const clock = new IncrementingClock('1970-01-01T00:00:00Z')
    const delivery: Delivery = { send: jest.fn(() => Promise.resolve({ state: 'success' })) }
    const retryQueue = { add: jest.fn(), flush: jest.fn() }
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    const batchProcessor = new BatchProcessor(delivery, createConfiguration({ logger }), resourceAttributesSource, clock, retryQueue)
    batchProcessor.add(generateSpan())
    await jest.runAllTimersAsync()
    expect(delivery.send).toHaveBeenCalled()
    expect(retryQueue.add).not.toHaveBeenCalled()
    expect(retryQueue.flush).toHaveBeenCalled()
  })
})