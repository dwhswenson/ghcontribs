import type { Month, VisualizationIndex } from '../data/types.ts'

export interface MonthRange {
  readonly from: Month
  readonly through: Month
}

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/

function monthParts(month: Month): { year: number; monthIndex: number } {
  assertMonth(month)
  const [year, monthNumber] = month.split('-').map(Number)
  return { year: year!, monthIndex: monthNumber! - 1 }
}

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

export function monthOffset(month: Month, source: MonthRange): number {
  const validated = validateMonthRange({ from: month, through: month }, source)
  const value = monthParts(validated.from)
  const first = monthParts(source.from)
  return (value.year - first.year) * 12 + value.monthIndex - first.monthIndex
}

export function monthFromOffset(offset: number, source: MonthRange): Month {
  if (!Number.isInteger(offset)) {
    throw new RangeError(`month offset must be an integer: ${String(offset)}`)
  }
  const count = monthSpan(source)
  if (offset < 0 || offset >= count) {
    throw new RangeError(`month offset must be between 0 and ${count - 1}: ${offset}`)
  }
  const first = monthParts(source.from)
  const absoluteMonth = first.year * 12 + first.monthIndex + offset
  const year = Math.floor(absoluteMonth / 12)
  const monthNumber = absoluteMonth % 12 + 1
  return `${String(year).padStart(4, '0')}-${String(monthNumber).padStart(2, '0')}`
}

export function monthSpan(source: MonthRange): number {
  const validated = validateMonthRange(source, source)
  const first = monthParts(validated.from)
  const last = monthParts(validated.through)
  return (last.year - first.year) * 12 + last.monthIndex - first.monthIndex + 1
}

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatMonth(month: Month): string {
  const { year, monthIndex } = monthParts(month)
  const date = new Date(0)
  date.setUTCFullYear(year, monthIndex, 1)
  date.setUTCHours(0, 0, 0, 0)
  return MONTH_FORMATTER.format(date)
}
