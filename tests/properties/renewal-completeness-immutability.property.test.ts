/**
 * Property Test: Completitud e inmutabilidad de renovaciones
 *
 * **Validates: Requirements 8.4, 8.5**
 *
 * Property 9:
 * - Cada renovación produce un registro completo con: plan anterior, plan nuevo, fecha,
 *   instructor, días no utilizados y observaciones.
 * - El repositorio de renovaciones NO expone métodos update ni delete (inmutabilidad por diseño).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'

// Mock supabase server client
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
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({ data: { id: 'new-id' }, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ data: null, error: null })),
      })),
    })),
  })),
}))

// Mock repositories
vi.mock('@/repositories/plan.repository', () => ({
  findById: vi.fn(),
}))

vi.mock('@/repositories/membership.repository', () => ({
  findActiveByAffiliateId: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}))

vi.mock('@/repositories/renewal.repository', () => ({
  create: vi.fn(),
}))

vi.mock('@/repositories/affiliate.repository', () => ({
  update: vi.fn(),
}))

vi.mock('@/services/vigency.service', () => ({
  calculateVigency: vi.fn(() => ({
    usageStartDate: new Date('2025-06-01'),
    weeksCountStartDate: new Date('2025-06-02'),
    expirationDate: new Date('2025-06-15'),
  })),
}))

import * as PlanRepository from '@/repositories/plan.repository'
import * as MembershipRepository from '@/repositories/membership.repository'
import * as RenewalRepository from '@/repositories/renewal.repository'
import { renew } from '@/services/renewal.service'

// --- Generators ---

/** Generator for valid UUIDs */
const validUuid = fc.uuid()

/** Generator for plan names */
const planName = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0)

/** Generator for allowed days (1-365 or null for unlimited) */
const allowedDays = fc.oneof(fc.integer({ min: 1, max: 365 }), fc.constant(null as null))

/** Generator for vigency weeks */
const vigencyWeeks = fc.integer({ min: 1, max: 52 })

/** Generator for remaining days of current membership (0-365 or null) */
const remainingDays = fc.oneof(fc.integer({ min: 0, max: 365 }), fc.constant(null as null))

/** Generator for observations (null or string up to 500 chars) */
const observations = fc.oneof(
  fc.constant(undefined as undefined),
  fc.string({ minLength: 0, maxLength: 500 })
)

describe('Property 9: Completitud e inmutabilidad de renovaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cada renovación produce un registro con todos los campos requeridos (plan anterior, plan nuevo, fecha, instructor, días no utilizados, observaciones)', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUuid, // affiliateId
        validUuid, // previousPlanId
        validUuid, // newPlanId
        validUuid, // previousMembershipId
        validUuid, // performedBy (instructor)
        planName, // newPlanName
        allowedDays, // new plan allowed days
        vigencyWeeks, // new plan vigency weeks
        remainingDays, // current membership remaining days
        observations, // renewal observations
        async (
          affiliateId,
          previousPlanId,
          newPlanId,
          previousMembershipId,
          performedBy,
          newPlanName,
          newAllowedDays,
          newVigencyWeeks,
          currentRemainingDays,
          renewalObservations
        ) => {
          vi.clearAllMocks()

          // Setup: new plan is active and available
          const findPlanMock = vi.mocked(PlanRepository.findById)
          findPlanMock.mockResolvedValue({
            id: newPlanId,
            instructor_id: performedBy,
            name: newPlanName,
            allowed_days: newAllowedDays,
            vigency_weeks: newVigencyWeeks,
            price: 50000,
            status: 'active',
            description: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any)

          // Setup: active membership exists
          const findActiveMembershipMock = vi.mocked(MembershipRepository.findActiveByAffiliateId)
          findActiveMembershipMock.mockResolvedValue({
            id: previousMembershipId,
            affiliate_id: affiliateId,
            plan_id: previousPlanId,
            usage_start_date: '2025-01-01',
            weeks_count_start_date: '2025-01-01',
            expiration_date: '2025-06-30',
            remaining_days: currentRemainingDays,
            status: 'active',
            days_lost: 0,
            expired_detected_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any)

          // Setup: membership update succeeds
          const updateMembershipMock = vi.mocked(MembershipRepository.update)
          updateMembershipMock.mockResolvedValue({} as any)

          // Setup: new membership creation succeeds
          const newMembershipId = 'new-membership-id'
          const createMembershipMock = vi.mocked(MembershipRepository.create)
          createMembershipMock.mockResolvedValue({
            id: newMembershipId,
            affiliate_id: affiliateId,
            plan_id: newPlanId,
            usage_start_date: '2025-06-01',
            weeks_count_start_date: '2025-06-02',
            expiration_date: '2025-06-15',
            remaining_days: newAllowedDays,
            status: 'active',
            days_lost: 0,
            expired_detected_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any)

          // Setup: renewal creation captures the data passed
          const createRenewalMock = vi.mocked(RenewalRepository.create)
          const createdRenewalDate = new Date().toISOString()
          createRenewalMock.mockImplementation(async (data: any) => ({
            id: 'renewal-id',
            affiliate_id: data.affiliate_id,
            previous_plan_id: data.previous_plan_id,
            new_plan_id: data.new_plan_id,
            previous_membership_id: data.previous_membership_id,
            new_membership_id: data.new_membership_id,
            renewal_date: createdRenewalDate,
            performed_by: data.performed_by,
            unused_days: data.unused_days,
            observations: data.observations,
            created_at: createdRenewalDate,
          }))

          // Act: perform the renewal
          const input = {
            affiliateId,
            newPlanId,
            observations: renewalObservations,
          }

          await renew(input, performedBy)

          // Assert: renewal repository was called with all required fields
          expect(createRenewalMock).toHaveBeenCalledTimes(1)
          const renewalData = createRenewalMock.mock.calls[0][0]

          // Verify completeness: all required fields are present and correct
          // 1. Plan anterior
          expect(renewalData.previous_plan_id).toBe(previousPlanId)

          // 2. Plan nuevo
          expect(renewalData.new_plan_id).toBe(newPlanId)

          // 3. Instructor que realiza la operación
          expect(renewalData.performed_by).toBe(performedBy)

          // 4. Días no utilizados del plan anterior
          const expectedUnusedDays = currentRemainingDays ?? 0
          expect(renewalData.unused_days).toBe(expectedUnusedDays)

          // 5. Observaciones
          expect(renewalData.observations).toBe(renewalObservations ?? null)

          // 6. Membership references (for date tracking via membership)
          expect(renewalData.previous_membership_id).toBe(previousMembershipId)
          expect(renewalData.new_membership_id).toBe(newMembershipId)

          // 7. Affiliate reference
          expect(renewalData.affiliate_id).toBe(affiliateId)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('el repositorio de renovaciones NO expone métodos update ni delete (inmutabilidad por diseño)', async () => {
    // Dynamically import the actual (unmocked) source to inspect its exports.
    // vi.importActual returns the real module regardless of mocks.
    const actualModule = await vi.importActual<Record<string, unknown>>(
      '@/repositories/renewal.repository'
    )
    const exportedKeys = Object.keys(actualModule)

    await fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), (_seed) => {
        // The repository should expose 'create' (for INSERTs)
        expect(exportedKeys).toContain('create')

        // The repository MUST NOT expose 'update' or 'delete' methods
        expect(exportedKeys).not.toContain('update')
        expect(exportedKeys).not.toContain('delete')
        expect(exportedKeys).not.toContain('remove')
        expect(exportedKeys).not.toContain('destroy')
      }),
      { numRuns: 10 }
    )
  })

  it('el registro de renovación siempre refleja los unused_days correctos (0 si era null/ilimitado)', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUuid, // affiliateId
        validUuid, // newPlanId
        validUuid, // performedBy
        remainingDays, // current remaining days (may be null for unlimited plans)
        async (affiliateId, newPlanId, performedBy, currentRemainingDays) => {
          vi.clearAllMocks()

          // Setup: active plan
          vi.mocked(PlanRepository.findById).mockResolvedValue({
            id: newPlanId,
            instructor_id: performedBy,
            name: 'Test Plan',
            allowed_days: 12,
            vigency_weeks: 4,
            price: 50000,
            status: 'active',
            description: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any)

          // Setup: current membership with the specific remaining_days
          vi.mocked(MembershipRepository.findActiveByAffiliateId).mockResolvedValue({
            id: 'prev-membership-id',
            affiliate_id: affiliateId,
            plan_id: 'prev-plan-id',
            usage_start_date: '2025-01-01',
            weeks_count_start_date: '2025-01-01',
            expiration_date: '2025-06-30',
            remaining_days: currentRemainingDays,
            status: 'active',
            days_lost: 0,
            expired_detected_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any)

          vi.mocked(MembershipRepository.update).mockResolvedValue({} as any)
          vi.mocked(MembershipRepository.create).mockResolvedValue({
            id: 'new-membership-id',
            affiliate_id: affiliateId,
            plan_id: newPlanId,
            usage_start_date: '2025-06-01',
            weeks_count_start_date: '2025-06-02',
            expiration_date: '2025-06-15',
            remaining_days: 12,
            status: 'active',
            days_lost: 0,
            expired_detected_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any)

          const createRenewalMock = vi.mocked(RenewalRepository.create)
          createRenewalMock.mockImplementation(async (data: any) => ({
            id: 'renewal-id',
            ...data,
            renewal_date: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }))

          // Act
          await renew({ affiliateId, newPlanId }, performedBy)

          // Assert: unused_days is correctly calculated
          const renewalData = createRenewalMock.mock.calls[0][0]
          const expectedUnusedDays = currentRemainingDays ?? 0
          expect(renewalData.unused_days).toBe(expectedUnusedDays)
          expect(typeof renewalData.unused_days).toBe('number')
          expect(renewalData.unused_days).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})
