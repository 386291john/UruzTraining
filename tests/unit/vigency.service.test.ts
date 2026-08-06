import { describe, it, expect } from 'vitest'
import {
  calculateVigency,
  isExpired,
  getDaysUntilExpiration,
  isWeekend,
  getNextMonday,
} from '@/services/vigency.service'

describe('VigencyService', () => {
  describe('isWeekend', () => {
    it('returns true for Friday', () => {
      // 2025-05-09 is a Friday
      expect(isWeekend(new Date(2025, 4, 9))).toBe(true)
    })

    it('returns true for Saturday', () => {
      // 2025-05-10 is a Saturday
      expect(isWeekend(new Date(2025, 4, 10))).toBe(true)
    })

    it('returns true for Sunday', () => {
      // 2025-05-11 is a Sunday
      expect(isWeekend(new Date(2025, 4, 11))).toBe(true)
    })

    it('returns false for Monday', () => {
      // 2025-05-12 is a Monday
      expect(isWeekend(new Date(2025, 4, 12))).toBe(false)
    })

    it('returns false for Tuesday', () => {
      // 2025-05-13 is a Tuesday
      expect(isWeekend(new Date(2025, 4, 13))).toBe(false)
    })

    it('returns false for Wednesday', () => {
      // 2025-05-14 is a Wednesday
      expect(isWeekend(new Date(2025, 4, 14))).toBe(false)
    })

    it('returns false for Thursday', () => {
      // 2025-05-15 is a Thursday
      expect(isWeekend(new Date(2025, 4, 15))).toBe(false)
    })
  })

  describe('getNextMonday', () => {
    it('returns next Monday from a Friday', () => {
      // 2025-05-09 (Friday) → 2025-05-12 (Monday)
      const result = getNextMonday(new Date(2025, 4, 9))
      expect(result).toEqual(new Date(2025, 4, 12))
    })

    it('returns next Monday from a Saturday', () => {
      // 2025-05-10 (Saturday) → 2025-05-12 (Monday)
      const result = getNextMonday(new Date(2025, 4, 10))
      expect(result).toEqual(new Date(2025, 4, 12))
    })

    it('returns next Monday from a Sunday', () => {
      // 2025-05-11 (Sunday) → 2025-05-12 (Monday)
      const result = getNextMonday(new Date(2025, 4, 11))
      expect(result).toEqual(new Date(2025, 4, 12))
    })
  })

  describe('calculateVigency', () => {
    describe('Mon-Thu acquisition (no rule dependency)', () => {
      it('sets both dates to acquisition date on Monday', () => {
        // 2025-05-12 is Monday
        const result = calculateVigency({
          acquisitionDate: new Date(2025, 4, 12),
          plan: { allowedDays: 6, vigencyWeeks: 2 },
          weekendStartRuleActive: true,
        })

        expect(result.usageStartDate).toEqual(new Date(2025, 4, 12))
        expect(result.weeksCountStartDate).toEqual(new Date(2025, 4, 12))
      })

      it('sets both dates to acquisition date on Thursday', () => {
        // 2025-05-15 is Thursday
        const result = calculateVigency({
          acquisitionDate: new Date(2025, 4, 15),
          plan: { allowedDays: 8, vigencyWeeks: 4 },
          weekendStartRuleActive: false,
        })

        expect(result.usageStartDate).toEqual(new Date(2025, 4, 15))
        expect(result.weeksCountStartDate).toEqual(new Date(2025, 4, 15))
      })

      it('calculates expiration correctly for Mon-Thu', () => {
        // Monday 2025-05-12, 2 weeks → 12 + 14 - 1 = 25 May (Sunday)
        const result = calculateVigency({
          acquisitionDate: new Date(2025, 4, 12),
          plan: { allowedDays: 6, vigencyWeeks: 2 },
          weekendStartRuleActive: true,
        })

        expect(result.expirationDate).toEqual(new Date(2025, 4, 25))
      })
    })

    describe('Fri-Sun acquisition with weekend rule ACTIVE', () => {
      it('usage starts at acquisition, weeks count from next Monday (Friday)', () => {
        // 2025-05-09 (Friday) → next Monday = 2025-05-12
        const result = calculateVigency({
          acquisitionDate: new Date(2025, 4, 9),
          plan: { allowedDays: 6, vigencyWeeks: 2 },
          weekendStartRuleActive: true,
        })

        expect(result.usageStartDate).toEqual(new Date(2025, 4, 9))
        expect(result.weeksCountStartDate).toEqual(new Date(2025, 4, 12))
      })

      it('usage starts at acquisition, weeks count from next Monday (Saturday)', () => {
        // 2025-05-10 (Saturday) → next Monday = 2025-05-12
        const result = calculateVigency({
          acquisitionDate: new Date(2025, 4, 10),
          plan: { allowedDays: 3, vigencyWeeks: 1 },
          weekendStartRuleActive: true,
        })

        expect(result.usageStartDate).toEqual(new Date(2025, 4, 10))
        expect(result.weeksCountStartDate).toEqual(new Date(2025, 4, 12))
      })

      it('usage starts at acquisition, weeks count from next Monday (Sunday)', () => {
        // 2025-05-11 (Sunday) → next Monday = 2025-05-12
        const result = calculateVigency({
          acquisitionDate: new Date(2025, 4, 11),
          plan: { allowedDays: 4, vigencyWeeks: 3 },
          weekendStartRuleActive: true,
        })

        expect(result.usageStartDate).toEqual(new Date(2025, 4, 11))
        expect(result.weeksCountStartDate).toEqual(new Date(2025, 4, 12))
      })

      it('calculates expiration from next Monday (design doc example)', () => {
        // Friday 2025-05-09, 2 weeks, rule active
        // weeksCountStart = Monday 12 May
        // expiration = 12 + 14 - 1 = 25 May (Sunday)
        const result = calculateVigency({
          acquisitionDate: new Date(2025, 4, 9),
          plan: { allowedDays: 6, vigencyWeeks: 2 },
          weekendStartRuleActive: true,
        })

        expect(result.expirationDate).toEqual(new Date(2025, 4, 25))
      })
    })

    describe('Fri-Sun acquisition with weekend rule INACTIVE', () => {
      it('sets both dates to acquisition date on Friday', () => {
        // 2025-05-09 (Friday), rule inactive
        const result = calculateVigency({
          acquisitionDate: new Date(2025, 4, 9),
          plan: { allowedDays: 6, vigencyWeeks: 2 },
          weekendStartRuleActive: false,
        })

        expect(result.usageStartDate).toEqual(new Date(2025, 4, 9))
        expect(result.weeksCountStartDate).toEqual(new Date(2025, 4, 9))
      })

      it('calculates expiration from acquisition date when rule inactive', () => {
        // Friday 2025-05-09, 2 weeks, rule inactive
        // expiration = 9 + 14 - 1 = 22 May (Thursday)
        const result = calculateVigency({
          acquisitionDate: new Date(2025, 4, 9),
          plan: { allowedDays: 6, vigencyWeeks: 2 },
          weekendStartRuleActive: false,
        })

        expect(result.expirationDate).toEqual(new Date(2025, 4, 22))
      })
    })

    describe('Expiration formula', () => {
      it('1 week plan expires 6 days after start', () => {
        // Monday 2025-05-12, 1 week → 12 + 7 - 1 = 18 May (Sunday)
        const result = calculateVigency({
          acquisitionDate: new Date(2025, 4, 12),
          plan: { allowedDays: null, vigencyWeeks: 1 },
          weekendStartRuleActive: true,
        })

        expect(result.expirationDate).toEqual(new Date(2025, 4, 18))
      })

      it('4 week plan expires 27 days after start', () => {
        // Monday 2025-05-12, 4 weeks → 12 + 28 - 1 = 8 June (Sunday)
        const result = calculateVigency({
          acquisitionDate: new Date(2025, 4, 12),
          plan: { allowedDays: null, vigencyWeeks: 4 },
          weekendStartRuleActive: true,
        })

        expect(result.expirationDate).toEqual(new Date(2025, 5, 8))
      })

      it('works with unlimited days plans', () => {
        // allowedDays = null (unlimited) should not affect calculation
        const result = calculateVigency({
          acquisitionDate: new Date(2025, 4, 12),
          plan: { allowedDays: null, vigencyWeeks: 2 },
          weekendStartRuleActive: true,
        })

        expect(result.usageStartDate).toEqual(new Date(2025, 4, 12))
        expect(result.weeksCountStartDate).toEqual(new Date(2025, 4, 12))
        expect(result.expirationDate).toEqual(new Date(2025, 4, 25))
      })
    })
  })

  describe('isExpired', () => {
    it('returns false when now is before end of expiration day', () => {
      const expirationDate = new Date(2025, 4, 25)
      const now = new Date(2025, 4, 25, 12, 0, 0) // noon of expiration day
      expect(isExpired(expirationDate, now)).toBe(false)
    })

    it('returns false at 23:59:59 of expiration day', () => {
      const expirationDate = new Date(2025, 4, 25)
      const now = new Date(2025, 4, 25, 23, 59, 59, 0)
      expect(isExpired(expirationDate, now)).toBe(false)
    })

    it('returns true when now is after end of expiration day', () => {
      const expirationDate = new Date(2025, 4, 25)
      const now = new Date(2025, 4, 26, 0, 0, 1) // just past midnight
      expect(isExpired(expirationDate, now)).toBe(true)
    })

    it('returns true when now is well past expiration', () => {
      const expirationDate = new Date(2025, 4, 25)
      const now = new Date(2025, 5, 10) // 2 weeks later
      expect(isExpired(expirationDate, now)).toBe(true)
    })

    it('returns false when now is before expiration day', () => {
      const expirationDate = new Date(2025, 4, 25)
      const now = new Date(2025, 4, 20)
      expect(isExpired(expirationDate, now)).toBe(false)
    })
  })

  describe('getDaysUntilExpiration', () => {
    it('returns correct days when not expired', () => {
      const expirationDate = new Date(2025, 4, 25)
      const now = new Date(2025, 4, 20)
      expect(getDaysUntilExpiration(expirationDate, now)).toBe(5)
    })

    it('returns 0 on expiration day', () => {
      const expirationDate = new Date(2025, 4, 25)
      const now = new Date(2025, 4, 25, 10, 0, 0)
      expect(getDaysUntilExpiration(expirationDate, now)).toBe(0)
    })

    it('returns 0 when already expired', () => {
      const expirationDate = new Date(2025, 4, 25)
      const now = new Date(2025, 4, 30)
      expect(getDaysUntilExpiration(expirationDate, now)).toBe(0)
    })

    it('returns 1 for the day before expiration', () => {
      const expirationDate = new Date(2025, 4, 25)
      const now = new Date(2025, 4, 24)
      expect(getDaysUntilExpiration(expirationDate, now)).toBe(1)
    })
  })
})
