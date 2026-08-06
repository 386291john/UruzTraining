/**
 * Property Test: Bloqueo por intentos fallidos de PIN
 *
 * **Validates: Requirements 1.7, 6.3**
 *
 * Property 14: Tras 3 intentos fallidos consecutivos de PIN, el sistema bloquea
 * el acceso durante 15 minutos. Un intento exitoso previo resetea el contador a 0.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'

// Mock dependencies
vi.mock('@/repositories/affiliate.repository', () => ({
  findByDocumentId: vi.fn(),
}))

vi.mock('@/repositories/membership.repository', () => ({
  findActiveByAffiliateId: vi.fn(),
}))

vi.mock('@/repositories/entry.repository', () => ({
  hasEntryToday: vi.fn(),
  create: vi.fn(),
}))

vi.mock('@/services/vigency.service', () => ({
  isExpired: vi.fn(() => false),
}))

// Mock supabase client for the inline update calls in entry.service.ts
const mockUpdate = vi.fn()
const mockEq = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: mockUpdate,
    })),
  })),
}))

import * as AffiliateRepository from '@/repositories/affiliate.repository'
import * as MembershipRepository from '@/repositories/membership.repository'
import * as EntryRepository from '@/repositories/entry.repository'
import { validateAndRegisterEntry } from '@/services/entry.service'

// --- Generators ---

/** Generates a valid 4-digit PIN */
const validPin = fc.stringMatching(/^\d{4}$/)

/** Generates a wrong PIN that differs from the correct one */
const wrongPinFor = (correctPin: string) =>
  validPin.filter((p) => p !== correctPin)

/** Generates a valid document ID (5-15 numeric characters) */
const validDocumentId = fc.stringMatching(/^\d{5,15}$/)

/** Generates a number of failed attempts between 1 and 5 */
const failedAttemptCount = fc.integer({ min: 1, max: 5 })

/** Generates a number of successful attempts before failure (0 to 3) */
const successfulAttemptsBeforeFailure = fc.integer({ min: 1, max: 3 })

// --- Helpers ---

function createFakeAffiliate(
  documentId: string,
  pin: string,
  failedAttempts: number = 0,
  blockedUntil: string | null = null
) {
  return {
    id: 'affiliate-id-' + documentId,
    document_id: documentId,
    full_name: 'Test User',
    pin,
    birth_date: '1990-01-01',
    phone: '3001234567',
    instructor_id: 'instructor-id-123',
    observations: null,
    pin_failed_attempts: failedAttempts,
    pin_blocked_until: blockedUntil,
    registration_date: '2024-01-01',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function createFakeMembership(affiliateId: string) {
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + 30)

  return {
    id: 'membership-id-123',
    affiliate_id: affiliateId,
    plan_id: 'plan-id-123',
    usage_start_date: '2024-01-01',
    weeks_count_start_date: '2024-01-01',
    expiration_date: futureDate.toISOString().split('T')[0],
    remaining_days: 10,
    status: 'active' as const,
    days_lost: 0,
    expired_detected_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    plans: {
      id: 'plan-id-123',
      instructor_id: 'instructor-id-123',
      name: 'Plan Test',
      allowed_days: 12,
      vigency_weeks: 4,
      price: 50000,
      status: 'active' as const,
      description: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  }
}

// --- Tests ---

describe('Property 14: Bloqueo por intentos fallidos de PIN', () => {
  const registeredBy = 'instructor-uuid-123'

  beforeEach(() => {
    vi.clearAllMocks()
    // Setup the supabase update mock chain
    mockEq.mockReturnValue({ data: null, error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
  })

  it('al alcanzar el umbral de 3 intentos fallidos consecutivos, se bloquea durante 15 minutos', async () => {
    await fc.assert(
      fc.asyncProperty(
        validDocumentId,
        validPin,
        failedAttemptCount,
        async (documentId, correctPin, numAttempts) => {
          vi.clearAllMocks()
          mockEq.mockReturnValue({ data: null, error: null })
          mockUpdate.mockReturnValue({ eq: mockEq })

          const findByDocMock = vi.mocked(AffiliateRepository.findByDocumentId)

          // Generate a wrong PIN
          const wrongPin = correctPin === '0000' ? '1111' : '0000'

          // Simulate sequential failed attempts
          let currentFailedAttempts = 0

          for (let i = 0; i < numAttempts; i++) {
            // Each call returns the affiliate with the current failed attempt count
            const affiliate = createFakeAffiliate(
              documentId,
              correctPin,
              currentFailedAttempts,
              null
            )
            findByDocMock.mockResolvedValueOnce(affiliate)

            const result = await validateAndRegisterEntry(documentId, wrongPin, registeredBy)

            expect(result.success).toBe(false)
            expect(result.error).toBeDefined()

            currentFailedAttempts++

            if (currentFailedAttempts >= 3) {
              // Should be blocked after reaching threshold
              expect(result.error!.code).toBe('PIN_MISMATCH')
              expect(result.error!.metadata?.blocked).toBe(true)

              // Verify that the update was called with pin_blocked_until set
              expect(mockUpdate).toHaveBeenLastCalledWith(
                expect.objectContaining({
                  pin_failed_attempts: currentFailedAttempts,
                  pin_blocked_until: expect.any(String),
                })
              )

              // Verify the blocked_until is approximately 15 minutes in the future
              const lastCall = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1][0]
              const blockedUntil = new Date(lastCall.pin_blocked_until)
              const now = new Date()
              const diffMinutes = (blockedUntil.getTime() - now.getTime()) / (1000 * 60)

              // Should be approximately 15 minutes (allow 1 minute tolerance for test execution)
              expect(diffMinutes).toBeGreaterThan(14)
              expect(diffMinutes).toBeLessThanOrEqual(16)
            } else {
              // Not yet blocked, just PIN_MISMATCH
              expect(result.error!.code).toBe('PIN_MISMATCH')
              expect(result.error!.metadata?.blocked).toBe(false)
              expect(result.error!.metadata?.failedAttempts).toBe(currentFailedAttempts)
            }
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it('un intento exitoso de PIN resetea el contador de intentos fallidos a 0', async () => {
    await fc.assert(
      fc.asyncProperty(
        validDocumentId,
        validPin,
        successfulAttemptsBeforeFailure,
        async (documentId, correctPin, previousFailedAttempts) => {
          vi.clearAllMocks()
          mockEq.mockReturnValue({ data: null, error: null })
          mockUpdate.mockReturnValue({ eq: mockEq })

          const findByDocMock = vi.mocked(AffiliateRepository.findByDocumentId)
          const findActiveMembershipMock = vi.mocked(MembershipRepository.findActiveByAffiliateId)
          const hasEntryTodayMock = vi.mocked(EntryRepository.hasEntryToday)
          const createEntryMock = vi.mocked(EntryRepository.create)

          const affiliateId = 'affiliate-id-' + documentId

          // Affiliate has previous failed attempts (1-3 but not yet blocked)
          const affiliate = createFakeAffiliate(
            documentId,
            correctPin,
            previousFailedAttempts,
            null
          )
          findByDocMock.mockResolvedValueOnce(affiliate)

          // Setup for successful entry
          const membership = createFakeMembership(affiliateId)
          findActiveMembershipMock.mockResolvedValueOnce(membership)
          hasEntryTodayMock.mockResolvedValueOnce(false)
          createEntryMock.mockResolvedValueOnce({
            id: 'entry-id-123',
            affiliate_id: affiliateId,
            membership_id: membership.id,
            entry_date: new Date().toISOString().split('T')[0],
            entry_time: new Date().toISOString(),
            registered_by: registeredBy,
            created_at: new Date().toISOString(),
          })

          // Successful entry with the correct PIN
          const result = await validateAndRegisterEntry(documentId, correctPin, registeredBy)

          expect(result.success).toBe(true)

          // Verify that the counter was reset to 0
          expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
              pin_failed_attempts: 0,
              pin_blocked_until: null,
            })
          )
        }
      ),
      { numRuns: 50 }
    )
  })

  it('si el PIN está bloqueado (blocked_until > now), retorna error PIN_BLOCKED sin importar el PIN', async () => {
    await fc.assert(
      fc.asyncProperty(
        validDocumentId,
        validPin,
        validPin,
        async (documentId, correctPin, anyPin) => {
          vi.clearAllMocks()
          mockEq.mockReturnValue({ data: null, error: null })
          mockUpdate.mockReturnValue({ eq: mockEq })

          const findByDocMock = vi.mocked(AffiliateRepository.findByDocumentId)

          // Affiliate is currently blocked (blocked_until is 10 minutes from now)
          const futureBlock = new Date()
          futureBlock.setMinutes(futureBlock.getMinutes() + 10)

          const affiliate = createFakeAffiliate(
            documentId,
            correctPin,
            3,
            futureBlock.toISOString()
          )
          findByDocMock.mockResolvedValueOnce(affiliate)

          const result = await validateAndRegisterEntry(documentId, anyPin, registeredBy)

          expect(result.success).toBe(false)
          expect(result.error!.code).toBe('PIN_BLOCKED')
          expect(result.error!.metadata?.remainingMinutes).toBeGreaterThan(0)
          expect(result.error!.metadata?.remainingMinutes).toBeLessThanOrEqual(10)
        }
      ),
      { numRuns: 50 }
    )
  })
})
