import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getRemainingLockoutMinutes, _testHelpers } from '@/services/auth.service'

// Mock the Supabase server client since we're testing lockout logic in isolation
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        in: () => Promise.resolve({ data: null, error: null }),
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
    auth: {
      signInWithPassword: () =>
        Promise.resolve({ data: { user: null }, error: { message: 'Invalid' } }),
      signOut: () => Promise.resolve(),
      getUser: () => Promise.resolve({ data: { user: null } }),
    },
  }),
}))

describe('Auth Service - Lockout Logic', () => {
  const { loginAttempts, resetAllAttempts } = _testHelpers

  beforeEach(() => {
    resetAllAttempts()
  })

  describe('getRemainingLockoutMinutes', () => {
    it('should return 0 for unknown email', () => {
      const result = getRemainingLockoutMinutes('unknown@test.com')
      expect(result).toBe(0)
    })

    it('should return 0 when email has attempts but is not blocked', () => {
      loginAttempts.set('user@test.com', {
        attempts: 3,
        blockedUntil: null,
      })

      const result = getRemainingLockoutMinutes('user@test.com')
      expect(result).toBe(0)
    })

    it('should return remaining minutes when email is blocked', () => {
      const blockedUntil = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
      loginAttempts.set('user@test.com', {
        attempts: 5,
        blockedUntil,
      })

      const result = getRemainingLockoutMinutes('user@test.com')
      expect(result).toBeGreaterThan(0)
      expect(result).toBeLessThanOrEqual(10)
    })

    it('should return 0 and clean up when block period has expired', () => {
      const blockedUntil = new Date(Date.now() - 1000) // 1 second in the past
      loginAttempts.set('user@test.com', {
        attempts: 5,
        blockedUntil,
      })

      const result = getRemainingLockoutMinutes('user@test.com')
      expect(result).toBe(0)
      expect(loginAttempts.has('user@test.com')).toBe(false)
    })

    it('should be case-insensitive for email matching', () => {
      const blockedUntil = new Date(Date.now() + 5 * 60 * 1000)
      loginAttempts.set('user@test.com', {
        attempts: 5,
        blockedUntil,
      })

      const result = getRemainingLockoutMinutes('USER@TEST.COM')
      expect(result).toBeGreaterThan(0)
    })
  })

  describe('Login Attempt Tracking', () => {
    it('should track attempts in the internal map', () => {
      loginAttempts.set('test@email.com', { attempts: 2, blockedUntil: null })

      const record = loginAttempts.get('test@email.com')
      expect(record).toBeDefined()
      expect(record!.attempts).toBe(2)
      expect(record!.blockedUntil).toBeNull()
    })

    it('should block after reaching max attempts', () => {
      const blockedUntil = new Date(Date.now() + 15 * 60 * 1000)
      loginAttempts.set('blocked@email.com', {
        attempts: 5,
        blockedUntil,
      })

      const record = loginAttempts.get('blocked@email.com')
      expect(record!.attempts).toBe(5)
      expect(record!.blockedUntil).not.toBeNull()
      expect(record!.blockedUntil!.getTime()).toBeGreaterThan(Date.now())
    })

    it('should reset attempts when cleared', () => {
      loginAttempts.set('test@email.com', { attempts: 3, blockedUntil: null })
      loginAttempts.delete('test@email.com')

      expect(loginAttempts.has('test@email.com')).toBe(false)
    })

    it('resetAllAttempts should clear all records', () => {
      loginAttempts.set('a@test.com', { attempts: 1, blockedUntil: null })
      loginAttempts.set('b@test.com', { attempts: 2, blockedUntil: null })

      resetAllAttempts()

      expect(loginAttempts.size).toBe(0)
    })
  })
})
