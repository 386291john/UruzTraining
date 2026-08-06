import fc from 'fast-check'

/**
 * Generates a random Date covering all days of the week (Mon-Sun).
 * Uses a base date range within a reasonable timeframe (2020-2030).
 */
export function arbitraryDate(): fc.Arbitrary<Date> {
  // Generate dates from 2020-01-01 to 2030-12-31
  const minTimestamp = new Date(2020, 0, 1).getTime()
  const maxTimestamp = new Date(2030, 11, 31).getTime()

  return fc
    .integer({ min: minTimestamp, max: maxTimestamp })
    .map((ts) => {
      const d = new Date(ts)
      // Normalize to start of day to avoid time zone issues
      return new Date(d.getFullYear(), d.getMonth(), d.getDate())
    })
}

/**
 * Generates a Date that falls on a specific day of the week.
 * @param dayOfWeek 0=Sunday, 1=Monday, ..., 6=Saturday
 */
export function arbitraryDateOnDay(dayOfWeek: number): fc.Arbitrary<Date> {
  return arbitraryDate().map((d) => {
    const currentDay = d.getDay()
    const diff = dayOfWeek - currentDay
    const adjusted = new Date(d.getTime())
    adjusted.setDate(adjusted.getDate() + diff)
    return new Date(adjusted.getFullYear(), adjusted.getMonth(), adjusted.getDate())
  })
}

/**
 * Generates a Date that falls on Mon-Thu (weekdays, excluding Fri).
 */
export function arbitraryWeekdayDate(): fc.Arbitrary<Date> {
  return fc
    .integer({ min: 1, max: 4 }) // 1=Mon, 2=Tue, 3=Wed, 4=Thu
    .chain((day) => arbitraryDateOnDay(day))
}

/**
 * Generates a Date that falls on Fri, Sat, or Sun.
 * Friday=5, Saturday=6, Sunday=0
 */
export function arbitraryWeekendDate(): fc.Arbitrary<Date> {
  return fc
    .constantFrom(0, 5, 6) // Sunday=0, Friday=5, Saturday=6
    .chain((day) => arbitraryDateOnDay(day))
}
