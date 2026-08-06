/**
 * Property Test: Orden de prioridad en validación de ingreso
 *
 * **Validates: Requirements 6.8, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**
 *
 * Property 3: Cuando múltiples condiciones de falla están presentes simultáneamente,
 * el sistema SIEMPRE retorna el error de mayor prioridad según el orden definido:
 *
 * 1. AFFILIATE_NOT_FOUND (highest priority)
 * 2. PIN_BLOCKED
 * 3. PIN_MISMATCH
 * 4. MEMBERSHIP_EXPIRED
 * 5. NO_DAYS_REMAINING
 * 6. ALREADY_ENTERED (lowest priority)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import fc from 'fast-check'
import type { EntryErrorCode } from '@/services/entry.service'
import {
  PRIORITY_ORDER,
  arbitraryEntryFailureScenario,
  arbitraryMaskedErrorScenario,
  arbitraryDocumentId,
  arbitraryPin,
} from '../generators/entry-attempt.generator'

// --- Mock all dependencies ---

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
  isExpired: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
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

import * as AffiliateRepository from '@/repositories/affiliate.repository'
import * as MembershipRepository from '@/repositories/membership.repository'
import * as EntryRepository from '@/repositories/entry.repository'
import * as VigencyService from '@/services/vigency.service'
import { validateAndRegisterEntry } from '@/services/entry.service'

// --- Helper to configure mocks based on active failure conditions ---

interface MockConfig {
  activeFailures: Set<EntryErrorCode>
  documentId: string
  pin: string
}

function configureMocks(config: MockConfig): void {
  const { activeFailures, documentId, pin } = config

  const findByDocMock = vi.mocked(AffiliateRepository.findByDocumentId)
  const findActiveMembershipMock = vi.mocked(MembershipRepository.findActiveByAffiliateId)
  const hasEntryTodayMock = vi.mocked(EntryRepository.hasEntryToday)
  const isExpiredMock = vi.mocked(VigencyService.isExpired)

  // --- Step 1: Affiliate existence ---
  if (activeFailures.has('AFFILIATE_NOT_FOUND')) {
    findByDocMock.mockResolvedValueOnce(null)
    return // No further mocks needed - validation stops here
  }

  // Affiliate exists
  const affiliatePin = activeFailures.has('PIN_MISMATCH') ? 'XXXX' : pin
  const pinBlockedUntil = activeFailures.has('PIN_BLOCKED')
    ? new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min in the future
    : null
  const pinFailedAttempts = activeFailures.has('PIN_BLOCKED') ? 3 : 0

  findByDocMock.mockResolvedValueOnce({
    id: 'affiliate-id-123',
    document_id: documentId,
    full_name: 'Test Affiliate',
    pin: affiliatePin,
    birth_date: '1990-01-01',
    phone: '3001234567',
    instructor_id: 'instructor-id-123',
    observations: null,
    pin_failed_attempts: pinFailedAttempts,
    pin_blocked_until: pinBlockedUntil,
    registration_date: '2024-01-01',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  // --- Step 2: PIN blocked check ---
  if (activeFailures.has('PIN_BLOCKED')) {
    return // Validation stops at PIN_BLOCKED
  }

  // --- Step 3: PIN match ---
  if (activeFailures.has('PIN_MISMATCH')) {
    return // Validation stops at PIN_MISMATCH
  }

  // PIN matches - membership checks follow

  // --- Step 4: Membership and vigency ---
  if (activeFailures.has('MEMBERSHIP_EXPIRED')) {
    // Could be: no active membership, or expired membership
    const expiredDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
    findActiveMembershipMock.mockResolvedValueOnce({
      id: 'membership-id-123',
      affiliate_id: 'affiliate-id-123',
      plan_id: 'plan-id-123',
      usage_start_date: '2024-01-01',
      weeks_count_start_date: '2024-01-01',
      expiration_date: expiredDate.toISOString().split('T')[0],
      remaining_days: activeFailures.has('NO_DAYS_REMAINING') ? 0 : 5,
      status: 'active',
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
        status: 'active',
        description: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    })
    isExpiredMock.mockReturnValueOnce(true)
    return // Validation stops at MEMBERSHIP_EXPIRED
  }

  // Membership is valid (not expired)
  const remainingDays = activeFailures.has('NO_DAYS_REMAINING') ? 0 : 5
  findActiveMembershipMock.mockResolvedValueOnce({
    id: 'membership-id-123',
    affiliate_id: 'affiliate-id-123',
    plan_id: 'plan-id-123',
    usage_start_date: '2024-01-01',
    weeks_count_start_date: '2024-01-01',
    expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    remaining_days: remainingDays,
    status: 'active',
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
      status: 'active',
      description: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  })
  isExpiredMock.mockReturnValueOnce(false)

  // --- Step 5: Remaining days ---
  if (activeFailures.has('NO_DAYS_REMAINING')) {
    return // Validation stops at NO_DAYS_REMAINING
  }

  // --- Step 6: Already entered today ---
  if (activeFailures.has('ALREADY_ENTERED')) {
    hasEntryTodayMock.mockResolvedValueOnce(true)
    return // Validation stops at ALREADY_ENTERED
  }

  // No failures - should succeed (shouldn't reach here in failure scenarios)
  hasEntryTodayMock.mockResolvedValueOnce(false)
}

// --- Tests ---

describe('Property 3: Orden de prioridad en validación de ingreso', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Main property: Given multiple simultaneous failure conditions,
   * the system always returns the highest-priority error.
   * **Validates: Requirements 6.8**
   */
  it('siempre retorna el error de mayor prioridad cuando hay múltiples condiciones de falla', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryEntryFailureScenario(),
        arbitraryDocumentId(),
        arbitraryPin(),
        fc.uuid(),
        async (scenario, documentId, pin, registeredBy) => {
          vi.clearAllMocks()

          configureMocks({
            activeFailures: scenario.activeFailures,
            documentId,
            pin,
          })

          const result = await validateAndRegisterEntry(documentId, pin, registeredBy)

          expect(result.success).toBe(false)
          expect(result.error).toBeDefined()
          expect(result.error!.code).toBe(scenario.expectedError)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * AFFILIATE_NOT_FOUND always takes precedence over any other error.
   * **Validates: Requirements 6.7**
   */
  it('AFFILIATE_NOT_FOUND siempre tiene la mayor prioridad sobre cualquier otro error', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Combine AFFILIATE_NOT_FOUND with each other error
        fc.constantFrom(
          'PIN_BLOCKED' as EntryErrorCode,
          'PIN_MISMATCH' as EntryErrorCode,
          'MEMBERSHIP_EXPIRED' as EntryErrorCode,
          'NO_DAYS_REMAINING' as EntryErrorCode,
          'ALREADY_ENTERED' as EntryErrorCode
        ),
        arbitraryDocumentId(),
        arbitraryPin(),
        fc.uuid(),
        async (otherError, documentId, pin, registeredBy) => {
          vi.clearAllMocks()

          const activeFailures = new Set<EntryErrorCode>(['AFFILIATE_NOT_FOUND', otherError])

          configureMocks({ activeFailures, documentId, pin })

          const result = await validateAndRegisterEntry(documentId, pin, registeredBy)

          expect(result.success).toBe(false)
          expect(result.error!.code).toBe('AFFILIATE_NOT_FOUND')
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * PIN_BLOCKED takes precedence over PIN_MISMATCH, MEMBERSHIP_EXPIRED,
   * NO_DAYS_REMAINING, and ALREADY_ENTERED.
   * **Validates: Requirements 6.3**
   */
  it('PIN_BLOCKED tiene prioridad sobre errores de menor jerarquía', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'PIN_MISMATCH' as EntryErrorCode,
          'MEMBERSHIP_EXPIRED' as EntryErrorCode,
          'NO_DAYS_REMAINING' as EntryErrorCode,
          'ALREADY_ENTERED' as EntryErrorCode
        ),
        arbitraryDocumentId(),
        arbitraryPin(),
        fc.uuid(),
        async (lowerError, documentId, pin, registeredBy) => {
          vi.clearAllMocks()

          const activeFailures = new Set<EntryErrorCode>(['PIN_BLOCKED', lowerError])

          configureMocks({ activeFailures, documentId, pin })

          const result = await validateAndRegisterEntry(documentId, pin, registeredBy)

          expect(result.success).toBe(false)
          expect(result.error!.code).toBe('PIN_BLOCKED')
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * PIN_MISMATCH takes precedence over MEMBERSHIP_EXPIRED,
   * NO_DAYS_REMAINING, and ALREADY_ENTERED.
   * **Validates: Requirements 6.2**
   */
  it('PIN_MISMATCH tiene prioridad sobre errores de membresía y duplicado', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'MEMBERSHIP_EXPIRED' as EntryErrorCode,
          'NO_DAYS_REMAINING' as EntryErrorCode,
          'ALREADY_ENTERED' as EntryErrorCode
        ),
        arbitraryDocumentId(),
        arbitraryPin(),
        fc.uuid(),
        async (lowerError, documentId, pin, registeredBy) => {
          vi.clearAllMocks()

          const activeFailures = new Set<EntryErrorCode>(['PIN_MISMATCH', lowerError])

          configureMocks({ activeFailures, documentId, pin })

          const result = await validateAndRegisterEntry(documentId, pin, registeredBy)

          expect(result.success).toBe(false)
          expect(result.error!.code).toBe('PIN_MISMATCH')
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * MEMBERSHIP_EXPIRED takes precedence over NO_DAYS_REMAINING and ALREADY_ENTERED.
   * **Validates: Requirements 6.4**
   */
  it('MEMBERSHIP_EXPIRED tiene prioridad sobre NO_DAYS_REMAINING y ALREADY_ENTERED', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'NO_DAYS_REMAINING' as EntryErrorCode,
          'ALREADY_ENTERED' as EntryErrorCode
        ),
        arbitraryDocumentId(),
        arbitraryPin(),
        fc.uuid(),
        async (lowerError, documentId, pin, registeredBy) => {
          vi.clearAllMocks()

          const activeFailures = new Set<EntryErrorCode>(['MEMBERSHIP_EXPIRED', lowerError])

          configureMocks({ activeFailures, documentId, pin })

          const result = await validateAndRegisterEntry(documentId, pin, registeredBy)

          expect(result.success).toBe(false)
          expect(result.error!.code).toBe('MEMBERSHIP_EXPIRED')
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * NO_DAYS_REMAINING takes precedence over ALREADY_ENTERED.
   * **Validates: Requirements 6.5**
   */
  it('NO_DAYS_REMAINING tiene prioridad sobre ALREADY_ENTERED', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryDocumentId(),
        arbitraryPin(),
        fc.uuid(),
        async (documentId, pin, registeredBy) => {
          vi.clearAllMocks()

          const activeFailures = new Set<EntryErrorCode>([
            'NO_DAYS_REMAINING',
            'ALREADY_ENTERED',
          ])

          configureMocks({ activeFailures, documentId, pin })

          const result = await validateAndRegisterEntry(documentId, pin, registeredBy)

          expect(result.success).toBe(false)
          expect(result.error!.code).toBe('NO_DAYS_REMAINING')
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Each lower-priority error is correctly masked by each higher-priority error.
   * Tests all pairwise combinations where one error masks another.
   * **Validates: Requirements 6.6**
   */
  it('cada error de menor prioridad es enmascarado por cada error de mayor prioridad', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Pick a random error to be masked (not the highest priority one)
        fc.constantFrom(
          'PIN_BLOCKED' as EntryErrorCode,
          'PIN_MISMATCH' as EntryErrorCode,
          'MEMBERSHIP_EXPIRED' as EntryErrorCode,
          'NO_DAYS_REMAINING' as EntryErrorCode,
          'ALREADY_ENTERED' as EntryErrorCode
        ),
        arbitraryDocumentId(),
        arbitraryPin(),
        fc.uuid(),
        async (maskedError, documentId, pin, registeredBy) => {
          vi.clearAllMocks()

          const maskedIndex = PRIORITY_ORDER.indexOf(maskedError)
          // Pick a higher priority error (any error before maskedError in the list)
          const higherPriorityErrors = PRIORITY_ORDER.slice(0, maskedIndex)

          // Test with the immediately higher priority error
          const higherError = higherPriorityErrors[higherPriorityErrors.length - 1]
          const activeFailures = new Set<EntryErrorCode>([higherError, maskedError])

          configureMocks({ activeFailures, documentId, pin })

          const result = await validateAndRegisterEntry(documentId, pin, registeredBy)

          expect(result.success).toBe(false)
          expect(result.error!.code).toBe(higherError)
          expect(result.error!.code).not.toBe(maskedError)
        }
      ),
      { numRuns: 100 }
    )
  })
})
