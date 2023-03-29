import * as validation from '../lib/validation'

describe('validation', () => {
  const nonObjects: Array<{ type: string, value: any }> = [
    { type: 'bigint', value: BigInt(9007199254740991) },
    { type: 'boolean', value: true },
    { type: 'empty string', value: '' },
    { type: 'string', value: 'hello' },
    { type: 'function', value: () => {} },
    { type: 'number', value: 12345 },
    { type: 'array', value: [] },
    { type: 'symbol', value: Symbol('test') },
    { type: 'null', value: null },
    { type: 'undefined', value: undefined },
    { type: 'class', value: class { a () {} } }
  ]

  const nonStrings = nonObjects.filter(({ value }) => typeof value !== 'string')

  describe('isObject', () => {
    it.each(nonObjects)('fails validation with $type', ({ value, type }) => {
      expect(validation.isObject(value)).toBe(false)
    })

    it('passes validation with an empty object', () => {
      expect(validation.isObject({})).toBe(true)
    })

    it('passes validation with an object with properties', () => {
      const object = { a: 1, b: 2, c: { d: 4, e: 5 } }

      expect(validation.isObject(object)).toBe(true)
    })

    it('passes validation with an instance', () => {
      const Abc = class { a () {} }

      expect(validation.isObject(new Abc())).toBe(true)
    })
  })

  describe('isString', () => {
    it.each(nonStrings)('fails validation with $type', ({ value, type }) => {
      expect(validation.isString(value)).toBe(false)
    })

    it('passes validation with an empty string', () => {
      expect(validation.isString('')).toBe(true)
    })

    it('passes validation with a non-empty string', () => {
      expect(validation.isString('hi')).toBe(true)
    })
  })

  describe('isStringWithLength', () => {
    it.each(nonStrings.concat([
      { type: 'empty string', value: '' }
    ]))('fails validation with $type', ({ value, type }) => {
      expect(validation.isStringWithLength(value)).toBe(false)
    })

    it('passes validation with a 1 character string', () => {
      expect(validation.isString('a')).toBe(true)
    })

    it('passes validation with a long string', () => {
      expect(validation.isString('hello '.repeat(1024))).toBe(true)
    })
  })

  describe('isStringArray', () => {
    it.each([
      ...nonObjects.filter(({ type }) => type !== 'array'),
      ...nonStrings.map(({ type, value }) => ({ type: `array of ${type}`, value: [value] }))
    ])('fails validation with $type', ({ value, type }) => {
      expect(validation.isStringArray(value)).toBe(false)
    })

    it('passes validation with an array of strings', () => {
      expect(validation.isStringArray(['production', 'development'])).toBe(true)
    })

    it('passes validation with an empty array', () => {
      expect(validation.isStringArray([])).toBe(true)
    })
  })

  describe('isLogger', () => {
    it.each(nonObjects.concat([
      { type: 'empty object', value: {} },
      { type: 'object with some properties', value: { a: 1, b: 2 } },
      {
        type: 'object with subset of keys',
        value: { debug: jest.fn(), info: jest.fn(), warn: jest.fn() }
      },
      {
        type: 'object with the right keys but not functions',
        value: { debug: 1, info: 2, warn: 3, error: 4 }
      }
    ]))('fails validation with $type', ({ value, type }) => {
      expect(validation.isLogger(value)).toBe(false)
    })

    it('passes validation with a valid logger object', () => {
      const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }

      expect(validation.isLogger(logger)).toBe(true)
    })

    it('passes validation with a valid logger class instance', () => {
      const Logger = class {
        debug () {}
        info () {}
        warn () {}
        error () {}
      }

      expect(validation.isLogger(new Logger())).toBe(true)
    })

    it('passes validation with the console object', () => {
      expect(validation.isLogger(console)).toBe(true)
    })
  })
})