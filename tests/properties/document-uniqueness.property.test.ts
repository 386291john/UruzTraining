/**
 * Property Test: Unicidad de documento de identidad
 *
 * **Validates: Requirements 3.2**
 *
 * Property 7: Cuando se intenta registrar un afiliado con un document_id que ya existe,
 * el sistema debe rechazar el segundo registro con error de duplicado y el registro
 * original no se modifica.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'

// Mock the repositories and supabase
vi.mock('@/repositories/affiliate.repository', () => ({
  findByDocumentId: vi.fn(),
  create: vi.fn(),
}))

vi.mock('@/repositories/membership.repository', () => ({
  create: vi.fn(),
}))

vi.mock('@/repositories/plan.repository', () => ({
  findById: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { value: { active: true } },
            error: null,
          })),
        })),
      })),
    })),
  })),
}))

import * as affiliateRepository from '@/repositories/affiliate.repository'
import * as membershipRepository from '@/repositories/membership.repository'
import * as planRepository from '@/repositories/plan.repository'
import {
  registerAffiliate,
  DuplicateDocumentError,
} from '@/services/affiliate.service'

// --- Inline Generators ---

const validDocumentId = fc.stringMatching(/^\d{5,15}$/)
const validFullName = fc.stringMatching(/^[a-zA-Z][a-zA-Z ]{1,48}[a-zA-Z]$/)
const validPin = fc.stringMatching(/^\d{4}$/)
const validPhone = fc.stringMatching(/^\d{7,15}$/)
const validBirthDate = fc
  .date({ min: new Date(1940, 0, 1), max: new Date(2010, 11, 31) })
  .map((d) => d.toISOString().split('T')[0])

const validAffiliateInput = fc.record({
  document_id: validDocumentId,
  full_name: validFullName,
  pin: validPin,
  birth_date: validBirthDate,
  phone: validPhone,
  plan_id: fc.uuid(),
  observations: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
})

const duplicateDocumentIdPair = validDocumentId.chain((docId) =>
  fc.tuple(
    validAffiliateInput.map((input) => ({ ...input, document_id: docId })),
    validAffiliateInput.map((input) => ({ ...input, document_id: docId }))
  )
)

describe('Property 7: Unicidad de documento de identidad', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('el segundo intento de registro con document_id duplicado es rechazado y el original no se modifica', async () => {
    await fc.assert(
      fc.asyncProperty(
        duplicateDocumentIdPair,
        fc.uuid(),
        async ([firstInput, secondInput], instructorId) => {
          vi.clearAllMocks()

          const fakePlan = {
            id: firstInput.plan_id,
            instructor_id: instructorId,
            name: 'Plan Test',
            allowed_days: 12,
            vigency_weeks: 4,
            price: 50000,
            status: 'active' as const,
            description: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          const fakeAffiliate = {
            id: 'fake-affiliate-id-123',
            document_id: firstInput.document_id,
            full_name: firstInput.full_name,
            pin: firstInput.pin,
            birth_date: firstInput.birth_date,
            phone: firstInput.phone,
            instructor_id: instructorId,
            observations: firstInput.observations ?? null,
            pin_failed_attempts: 0,
            pin_blocked_until: null,
            registration_date: new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          const fakeMembership = {
            id: 'fake-membership-id-123',
            affiliate_id: fakeAffiliate.id,
            plan_id: firstInput.plan_id,
            usage_start_date: new Date().toISOString().split('T')[0],
            weeks_count_start_date: new Date().toISOString().split('T')[0],
            expiration_date: new Date().toISOString().split('T')[0],
            remaining_days: 12,
            status: 'active' as const,
            days_lost: 0,
            expired_detected_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          // --- Setup mocks ---
          const findByDocMock = vi.mocked(affiliateRepository.findByDocumentId)
          const createAffiliateMock = vi.mocked(affiliateRepository.create)
          const createMembershipMock = vi.mocked(membershipRepository.create)
          const findPlanMock = vi.mocked(planRepository.findById)

          // First call: no duplicate found → registration succeeds
          findByDocMock.mockResolvedValueOnce(null)
          findPlanMock.mockResolvedValueOnce(fakePlan)
          createAffiliateMock.mockResolvedValueOnce(fakeAffiliate)
          createMembershipMock.mockResolvedValueOnce(fakeMembership)

          // First registration should succeed
          const result = await registerAffiliate(firstInput, instructorId)
          expect(result.affiliate.document_id).toBe(firstInput.document_id)

          // --- Second registration: document_id NOW exists ---
          findByDocMock.mockResolvedValueOnce(fakeAffiliate)

          // Second registration must throw DuplicateDocumentError
          await expect(
            registerAffiliate(secondInput, instructorId)
          ).rejects.toThrow(DuplicateDocumentError)

          // Verify create was NOT called for the second attempt
          expect(createAffiliateMock).toHaveBeenCalledTimes(1)

          // Verify the original affiliate data was not modified
          expect(createAffiliateMock).toHaveBeenCalledWith(
            expect.objectContaining({
              document_id: firstInput.document_id,
              full_name: firstInput.full_name,
              pin: firstInput.pin,
            })
          )
        }
      ),
      { numRuns: 50 }
    )
  })
})
