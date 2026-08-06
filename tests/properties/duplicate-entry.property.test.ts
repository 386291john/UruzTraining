/**
 * Property Test: Prevención de ingreso duplicado por día
 *
 * **Validates: Requirements 6.6**
 *
 * Property 8: Cuando un afiliado ya tiene un ingreso registrado en una fecha D,
 * un segundo intento de ingreso en la misma fecha debe ser rechazado con error
 * de duplicidad (código 'ALREADY_ENTERED').
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'

// Mock supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: null, error: null })),
          limit: vi.fn(() => ({ data: [], error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ data: null, error: null })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({ data: { id: 'entry-id' }, error: null })),
        })),
      })),
    })),
  })),
}))

// Mock repositories
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

import * as AffiliateRepository from '@/repositories/affiliate.repository'
import * as MembershipRepository from '@/repositories/membership.repository'
import * as EntryRepository from '@/repositories/entry.repository'
import { validateAndRegisterEntry } from '@/services/entry.service'

// --- Generators ---

/** Generator for valid 4-digit PINs */
const validPin = fc.stringMatching(/^\d{4}$/)

/** Generator for valid document IDs (5–15 digits) */
const validDocumentId = fc.stringMatching(/^\d{5,15}$/)

/** Generator for affiliate names */
const validFullName = fc.stringMatching(/^[a-zA-Z][a-zA-Z ]{1,48}[a-zA-Z]$/)

/** Generator for UUIDs */
const validUuid = fc.uuid()

/** Generator for future expiration dates (ensuring membership is not expired) */
const futureDate = fc
  .integer({ min: 2026, max: 2030 })
  .chain((year) =>
    fc.integer({ min: 1, max: 12 }).chain((month) =>
      fc.integer({ min: 1, max: 28 }).map((day) => {
        const m = String(month).padStart(2, '0')
        const d = String(day).padStart(2, '0')
        return `${year}-${m}-${d}`
      })
    )
  )

/** Generator for remaining days (1–30 to ensure > 0) */
const positiveRemainingDays = fc.integer({ min: 1, max: 30 })

describe('Property 8: Prevención de ingreso duplicado por día', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('un segundo intento de ingreso en el mismo día es rechazado con ALREADY_ENTERED', async () => {
    await fc.assert(
      fc.asyncProperty(
        validDocumentId,
        validPin,
        validFullName,
        validUuid,
        validUuid,
        validUuid,
        futureDate,
        positiveRemainingDays,
        async (
          documentId,
          pin,
          fullName,
          affiliateId,
          membershipId,
          registeredBy,
          expirationDate,
          remainingDays
        ) => {
          vi.clearAllMocks()

          // Setup fake affiliate with valid data
          const fakeAffiliate = {
            id: affiliateId,
            document_id: documentId,
            full_name: fullName,
            pin: pin,
            birth_date: '1990-01-01',
            phone: '3001234567',
            instructor_id: registeredBy,
            observations: null,
            pin_failed_attempts: 0,
            pin_blocked_until: null,
            registration_date: '2025-01-01',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          // Setup fake active membership (not expired, with remaining days)
          const fakeMembership = {
            id: membershipId,
            affiliate_id: affiliateId,
            plan_id: 'plan-id-123',
            usage_start_date: '2025-01-01',
            weeks_count_start_date: '2025-01-01',
            expiration_date: expirationDate,
            remaining_days: remainingDays,
            status: 'active' as const,
            days_lost: 0,
            expired_detected_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            plans: { name: 'Plan Test' },
          }

          // --- Mock setup: affiliate exists, PIN matches, membership active ---
          const findByDocMock = vi.mocked(AffiliateRepository.findByDocumentId)
          const findActiveMembershipMock = vi.mocked(MembershipRepository.findActiveByAffiliateId)
          const hasEntryTodayMock = vi.mocked(EntryRepository.hasEntryToday)

          findByDocMock.mockResolvedValue(fakeAffiliate)
          findActiveMembershipMock.mockResolvedValue(fakeMembership)

          // Simulate: affiliate ALREADY has an entry today
          hasEntryTodayMock.mockResolvedValue(true)

          // --- Act: attempt a second entry on the same day ---
          const result = await validateAndRegisterEntry(documentId, pin, registeredBy)

          // --- Assert: entry is rejected with ALREADY_ENTERED ---
          expect(result.success).toBe(false)
          expect(result.error).toBeDefined()
          expect(result.error!.code).toBe('ALREADY_ENTERED')

          // Verify no new entry was created
          const createMock = vi.mocked(EntryRepository.create)
          expect(createMock).not.toHaveBeenCalled()

          // Verify the result contains no entry data
          expect(result.entry).toBeUndefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('un primer ingreso válido es aceptado pero un segundo intento es rechazado', async () => {
    await fc.assert(
      fc.asyncProperty(
        validDocumentId,
        validPin,
        validFullName,
        validUuid,
        validUuid,
        validUuid,
        futureDate,
        positiveRemainingDays,
        async (
          documentId,
          pin,
          fullName,
          affiliateId,
          membershipId,
          registeredBy,
          expirationDate,
          remainingDays
        ) => {
          vi.clearAllMocks()

          const fakeAffiliate = {
            id: affiliateId,
            document_id: documentId,
            full_name: fullName,
            pin: pin,
            birth_date: '1990-01-01',
            phone: '3001234567',
            instructor_id: registeredBy,
            observations: null,
            pin_failed_attempts: 0,
            pin_blocked_until: null,
            registration_date: '2025-01-01',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          const fakeMembership = {
            id: membershipId,
            affiliate_id: affiliateId,
            plan_id: 'plan-id-123',
            usage_start_date: '2025-01-01',
            weeks_count_start_date: '2025-01-01',
            expiration_date: expirationDate,
            remaining_days: remainingDays,
            status: 'active' as const,
            days_lost: 0,
            expired_detected_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            plans: { name: 'Plan Test' },
          }

          const findByDocMock = vi.mocked(AffiliateRepository.findByDocumentId)
          const findActiveMembershipMock = vi.mocked(MembershipRepository.findActiveByAffiliateId)
          const hasEntryTodayMock = vi.mocked(EntryRepository.hasEntryToday)
          const createEntryMock = vi.mocked(EntryRepository.create)

          findByDocMock.mockResolvedValue(fakeAffiliate)
          findActiveMembershipMock.mockResolvedValue(fakeMembership)

          // First attempt: no entry today → success
          hasEntryTodayMock.mockResolvedValueOnce(false)
          createEntryMock.mockResolvedValueOnce({
            id: 'new-entry-id',
            affiliate_id: affiliateId,
            membership_id: membershipId,
            entry_date: new Date().toISOString().split('T')[0],
            entry_time: new Date().toISOString(),
            registered_by: registeredBy,
            created_at: new Date().toISOString(),
          })

          const firstResult = await validateAndRegisterEntry(documentId, pin, registeredBy)
          expect(firstResult.success).toBe(true)
          expect(firstResult.entry).toBeDefined()
          expect(firstResult.entry!.affiliateName).toBe(fullName)

          // Reset call tracking for second attempt
          createEntryMock.mockClear()

          // Second attempt: already entered today → rejection
          hasEntryTodayMock.mockResolvedValueOnce(true)

          const secondResult = await validateAndRegisterEntry(documentId, pin, registeredBy)
          expect(secondResult.success).toBe(false)
          expect(secondResult.error!.code).toBe('ALREADY_ENTERED')

          // No new entry created on second attempt
          expect(createEntryMock).not.toHaveBeenCalled()
        }
      ),
      { numRuns: 50 }
    )
  })
})
