import { createConfiguration } from '@bugsnag/js-performance-test-utilities'
import { type ReactNativeConfiguration } from '../lib/config'
import resourceAttributesSource from '../lib/resource-attributes-source'

describe('resourceAttributesSource', () => {
  it('includes all expected attributes (iOS)', async () => {
    const configuraiton = createConfiguration<ReactNativeConfiguration>({ releaseStage: 'test', appVersion: '1.0.0', appName: 'Test App', codeBundleId: '12345678' })
    const resourceAttributes = await resourceAttributesSource(configuraiton)

    expect(resourceAttributes.toJson()).toEqual(expect.arrayContaining([
      {
        key: 'bugsnag.app.code_bundle_id',
        value: { stringValue: '12345678' }
      },
      {
        key: 'deployment.environment',
        value: { stringValue: 'test' }
      },
      {
        key: 'device.id',
        value: { stringValue: 'unknown' }
      },
      {
        key: 'device.manufacturer',
        value: { stringValue: 'Apple' }
      },
      {
        key: 'device.model.identifier',
        value: { stringValue: 'unknown' }
      },
      {
        key: 'os.type',
        value: { stringValue: 'darwin' }
      },
      {
        key: 'os.name',
        value: { stringValue: 'ios' }
      },
      {
        key: 'os.version',
        value: { stringValue: '1.2.3' }
      },
      {
        key: 'service.name',
        value: { stringValue: 'Test App' }
      },
      {
        key: 'service.version',
        value: { stringValue: '1.0.0' }
      },
      {
        key: 'telemetry.sdk.name',
        value: { stringValue: 'bugsnag.performance.reactnative' }
      },
      {
        key: 'telemetry.sdk.version',
        value: { stringValue: '__VERSION__' }
      }
    ]))
  })
})