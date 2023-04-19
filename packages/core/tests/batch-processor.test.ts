import { BatchProcessor } from '../lib/batch-processor'
import Sampler from '../lib/sampler'
import {
  IncrementingClock,
  InMemoryDelivery,
  resourceAttributesSource,
  createConfiguration,
  createEndedSpan
} from '@bugsnag/js-performance-test-utilities'

jest.useFakeTimers()

describe('BatchProcessor', () => {
  it('delivers after reaching the specified span limit', () => {
    const delivery = new InMemoryDelivery()
    const batchProcessor = new BatchProcessor(
      delivery,
      createConfiguration(),
      resourceAttributesSource,
      new IncrementingClock('1970-01-01T00:00:00Z'),
      { add: jest.fn(), flush: jest.fn() },
      new Sampler(1.0)
    )

    // add 99 spans
    for (let i = 0; i < 99; i++) {
      batchProcessor.add(createEndedSpan())
    }

    expect(delivery.requests).toHaveLength(0)

    batchProcessor.add(createEndedSpan())

    expect(delivery.requests).toHaveLength(1)
  })

  it('delivers after the specified time limit', () => {
    const delivery = new InMemoryDelivery()
    const batchProcessor = new BatchProcessor(
      delivery,
      createConfiguration(),
      resourceAttributesSource,
      new IncrementingClock('1970-01-01T00:00:00Z'),
      { add: jest.fn(), flush: jest.fn() },
      new Sampler(1.0)
    )

    batchProcessor.add(createEndedSpan())

    expect(delivery.requests).toHaveLength(0)

    jest.advanceTimersByTime(30_000)

    expect(delivery.requests).toHaveLength(1)
  })

  it('restarts the timer when calling .add()', () => {
    const delivery = new InMemoryDelivery()
    const batchProcessor = new BatchProcessor(
      delivery,
      createConfiguration(),
      resourceAttributesSource,
      new IncrementingClock('1970-01-01T00:00:00Z'),
      { add: jest.fn(), flush: jest.fn() },
      new Sampler(1.0)
    )

    batchProcessor.add(createEndedSpan())

    jest.advanceTimersByTime(20_000)
    expect(delivery.requests).toHaveLength(0)

    batchProcessor.add(createEndedSpan())

    jest.advanceTimersByTime(20_000)
    expect(delivery.requests).toHaveLength(0)

    jest.advanceTimersByTime(10_000)
    expect(delivery.requests).toHaveLength(1)
  })

  it('prevents delivery if releaseStage not in enabledReleaseStages', () => {
    const delivery = new InMemoryDelivery()
    const batchProcessor = new BatchProcessor(
      delivery,
      createConfiguration({ enabledReleaseStages: ['production'], releaseStage: 'test' }),
      resourceAttributesSource,
      new IncrementingClock('1970-01-01T00:00:00Z'),
      { add: jest.fn(), flush: jest.fn() },
      new Sampler(1.0)
    )

    batchProcessor.add(createEndedSpan())

    jest.runAllTimers()

    expect(delivery.requests).toHaveLength(0)
  })

  it('adds delivery payload to a retry queue if delivery fails and response code is retryable', async () => {
    const delivery = new InMemoryDelivery()
    const retryQueue = { add: jest.fn(), flush: jest.fn() }
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }

    const batchProcessor = new BatchProcessor(
      delivery,
      createConfiguration({ logger }),
      resourceAttributesSource,
      new IncrementingClock('1970-01-01T00:00:00Z'),
      retryQueue,
      new Sampler(1.0)
    )

    delivery.setNextResponseState('failure-retryable')

    batchProcessor.add(createEndedSpan())

    await jest.runAllTimersAsync()

    expect(delivery.requests).toHaveLength(1)
    expect(retryQueue.add).toHaveBeenCalled()
    expect(retryQueue.flush).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith('delivery failed, adding to retry queue')
  })

  it('does not add delivery payload to a retry queue if delivery fails and response code is not retryable', async () => {
    const delivery = new InMemoryDelivery()
    const retryQueue = { add: jest.fn(), flush: jest.fn() }
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }

    const batchProcessor = new BatchProcessor(
      delivery,
      createConfiguration({ logger }),
      resourceAttributesSource,
      new IncrementingClock('1970-01-01T00:00:00Z'),
      retryQueue,
      new Sampler(1.0)
    )

    delivery.setNextResponseState('failure-discard')

    batchProcessor.add(createEndedSpan())

    await jest.runAllTimersAsync()

    expect(delivery.requests).toHaveLength(1)
    expect(retryQueue.add).not.toHaveBeenCalled()
    expect(retryQueue.flush).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith('delivery failed')
  })

  it('flushes retry queue after a successful delivery', async () => {
    const delivery = new InMemoryDelivery()
    const retryQueue = { add: jest.fn(), flush: jest.fn() }
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }

    const batchProcessor = new BatchProcessor(
      delivery,
      createConfiguration({ logger }),
      resourceAttributesSource,
      new IncrementingClock('1970-01-01T00:00:00Z'),
      retryQueue,
      new Sampler(1.0)
    )

    batchProcessor.add(createEndedSpan())

    await jest.runAllTimersAsync()

    expect(delivery.requests).toHaveLength(1)
    expect(retryQueue.add).not.toHaveBeenCalled()
    expect(retryQueue.flush).toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('updates the sampling probability when the response returns a new probability', async () => {
    const delivery = new InMemoryDelivery()
    const sampler = new Sampler(1.0)

    const batchProcessor = new BatchProcessor(
      delivery,
      createConfiguration(),
      resourceAttributesSource,
      new IncrementingClock('1970-01-01T00:00:00Z'),
      { add: jest.fn(), flush: jest.fn() },
      sampler
    )

    batchProcessor.add(createEndedSpan())

    delivery.setNextSamplingProbability(0.0)

    expect(sampler.probability).toBe(1.0)

    await jest.runAllTimersAsync()

    expect(sampler.probability).toBe(0.0)
    expect(delivery.requests).toHaveLength(1)
  })

  it('discards ended spans if samplingRate is higher than the samplingProbability', async () => {
    const clock = new IncrementingClock('1970-01-01T00:00:00Z')
    const delivery = new InMemoryDelivery()
    const retryQueue = { add: jest.fn(), flush: jest.fn() }
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    const configuration = createConfiguration({ logger })
    const sampler = new Sampler(0.5)
    const batchProcessor = new BatchProcessor(delivery, configuration, resourceAttributesSource, clock, retryQueue, sampler)

    const span = createEndedSpan({ name: 'Span 01', samplingRate: Math.floor(0.75 * 0xffffffff) })
    batchProcessor.add(span)

    await jest.runAllTimersAsync()

    expect(delivery.requests).toHaveLength(1)
    expect(delivery).not.toHaveSentSpan(expect.objectContaining({
      name: 'Span 01'
    }))
  })
})
