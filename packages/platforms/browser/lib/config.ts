import { schema, type CoreSchema } from '@bugsnag/js-performance-core'

export function createSchema (hostname: string): CoreSchema {
  return {
    ...schema,
    releaseStage: {
      ...schema.releaseStage,
      defaultValue: hostname === 'localhost' ? 'development' : 'production'
    }
  }
}