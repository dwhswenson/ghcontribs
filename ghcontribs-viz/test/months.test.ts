import { describe, expect, it } from 'vitest'

import {
  assertMonth,
  isCompleteMonthRange,
  monthIsInRange,
  sourceMonthRange,
  validateMonthRange,
} from '../src/model/months.ts'

const source = { from: '2024-01', through: '2024-12' }

describe('month utilities', () => {
  it.each(['2024-01', '2024-12', '0000-06'])('accepts a real month %s', (month) => {
    expect(() => assertMonth(month)).not.toThrow()
  })

  it.each(['2024-1', '2024-00', '2024-13', '24-01', 'not-a-month'])(
    'rejects invalid month %s',
    (month) => {
      expect(() => assertMonth(month)).toThrow(RangeError)
    },
  )

  it('uses inclusive month bounds', () => {
    expect(monthIsInRange('2024-01', source)).toBe(true)
    expect(monthIsInRange('2024-12', source)).toBe(true)
    expect(monthIsInRange('2023-12', source)).toBe(false)
    expect(monthIsInRange('2025-01', source)).toBe(false)
  })

  it('validates and copies a range within the source', () => {
    const input = { from: '2024-03', through: '2024-06' }
    const result = validateMonthRange(input, source)
    expect(result).toEqual(input)
    expect(result).not.toBe(input)
    expect(Object.isFrozen(result)).toBe(true)
  })

  it.each([
    [{ from: '2024-13', through: '2024-13' }, 'real calendar month'],
    [{ from: '2024-07', through: '2024-06' }, 'must not be after'],
    [{ from: '2023-12', through: '2024-06' }, 'must be within'],
    [{ from: '2024-06', through: '2025-01' }, 'must be within'],
  ])('rejects invalid range %j', (range, message) => {
    expect(() => validateMonthRange(range, source)).toThrow(message)
  })

  it('validates the source range', () => {
    expect(
      sourceMonthRange({ first_month: '2024-01', last_month: '2024-12' }),
    ).toEqual(source)
    expect(() =>
      sourceMonthRange({ first_month: '2024-12', last_month: '2024-01' }),
    ).toThrow('first_month must not be after')
  })

  it('recognizes only the complete source range', () => {
    expect(isCompleteMonthRange(source, source)).toBe(true)
    expect(
      isCompleteMonthRange({ from: '2024-02', through: '2024-12' }, source),
    ).toBe(false)
  })
})
