import type { Month, VisualizationIndex } from '../data/types.ts'

export interface MonthRange {
  readonly from: Month
  readonly through: Month
}

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/

export function assertMonth(value: string, label = 'month'): asserts value is Month {
  const match = MONTH_PATTERN.exec(value)
  if (match === null) {
    throw new RangeError(`${label} must use YYYY-MM format: ${value}`)
  }

  const monthNumber = Number(match[2])
  if (monthNumber < 1 || monthNumber > 12) {
    throw new RangeError(`${label} must be a real calendar month: ${value}`)
  }
}

export function sourceMonthRange(
  source: VisualizationIndex['source'],
): MonthRange {
  assertMonth(source.first_month, 'source first_month')
  assertMonth(source.last_month, 'source last_month')
  if (source.first_month > source.last_month) {
    throw new RangeError('source first_month must not be after last_month')
  }
  return Object.freeze({
    from: source.first_month,
    through: source.last_month,
  })
}

export function validateMonthRange(
  range: MonthRange,
  source: MonthRange,
): MonthRange {
  assertMonth(range.from, 'month range from')
  assertMonth(range.through, 'month range through')
  if (range.from > range.through) {
    throw new RangeError('month range from must not be after through')
  }
  if (range.from < source.from || range.through > source.through) {
    throw new RangeError(
      `month range ${range.from} through ${range.through} must be within ` +
        `${source.from} through ${source.through}`,
    )
  }
  return Object.freeze({ from: range.from, through: range.through })
}

export function monthIsInRange(month: Month, range: MonthRange): boolean {
  return month >= range.from && month <= range.through
}

export function isCompleteMonthRange(
  range: MonthRange,
  source: MonthRange,
): boolean {
  return range.from === source.from && range.through === source.through
}
