/**
 * Property Test: Unicidad de notificación por período de vencimiento
 *
 * **Validates: Requirements 9.3**
 *
 * Property 11: Al ejecutar la verificación de notificaciones múltiples veces
 * para el mismo par (afiliado, membresía), se genera como máximo UNA notificación,
 * sin duplicados en ejecuciones posteriores.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'

// Mock supabase admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'system_config') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: { value: { days: 2 } },
                error: null,
              })),
            })),
          })),
        }
      }
      if (table === 'memberships') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              gte: vi.fn(() => ({
                lte: vi.fn(() => ({
                  order: vi.fn(() => ({
                    data: mockExpiringMemberships,
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        }
      }
      if (table === 'notifications') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: { attempts: 0 },
                error: null,
              })),
            })),
          })),
        }
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ data: null, error: null })),
          })),
        })),
      }
    }),
  })),
}))

// Mock notification repository
vi.mock('@/repositories/notification.repository', () => ({
  findByAffiliateMembershipAndType: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}))

// Mock WhatsApp service
vi.mock('@/services/whatsapp.service', () => ({
  WhatsAppNotificationProvider: class MockWhatsAppProvider {
    async send() {
      return { success: true, messageId: 'msg-123' }
    }
    async getStatus() {
      return 'delivered'
    }
  },
}))

import * as NotificationRepository from '@/repositories/notification.repository'
import { checkAndNotifyExpiringMemberships } from '@/services/notification.service'

// Variable to control what memberships are returned by the mocked Supabase query
let mockExpiringMemberships: unknown[] = []

// --- Generators ---

/** Generator for UUIDs */
const validUuid = fc.uuid()

/** Generator for affiliate names */
const validFullName = fc.stringMatching(/^[a-zA-Z][a-zA-Z ]{1,28}[a-zA-Z]$/)

/** Generator for phone numbers (7-15 digits) */
const validPhone = fc.stringMatching(/^\d{7,15}$/)

/** Generator for document IDs (5-15 digits) */
const validDocumentId = fc.stringMatching(/^\d{5,15}$/)

/** Generator for future expiration dates within threshold */
const futureExpirationDate = fc
  .integer({ min: 2026, max: 2028 })
  .chain((year) =>
    fc.integer({ min: 1, max: 12 }).chain((month) =>
      fc.integer({ min: 1, max: 28 }).map((day) => {
        const m = String(month).padStart(2, '0')
        const d = String(day).padStart(2, '0')
        return `${year}-${m}-${d}`
      })
    )
  )

/** Generator for number of consecutive executions (2 to 5) */
const executionCount = fc.integer({ min: 2, max: 5 })

describe('Property 11: Unicidad de notificación por período de vencimiento', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExpiringMemberships = []
  })

  it('ejecutar checkAndNotifyExpiringMemberships múltiples veces para el mismo par (afiliado, membresía) genera como máximo UNA notificación', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUuid,
        validUuid,
        validFullName,
        validPhone,
        validDocumentId,
        futureExpirationDate,
        executionCount,
        async (
          affiliateId,
          membershipId,
          fullName,
          phone,
          documentId,
          expirationDate,
          numExecutions
        ) => {
          vi.clearAllMocks()

          // Setup: configure a single expiring membership
          mockExpiringMemberships = [
            {
              id: membershipId,
              affiliate_id: affiliateId,
              plan_id: 'plan-123',
              usage_start_date: '2025-01-01',
              weeks_count_start_date: '2025-01-01',
              expiration_date: expirationDate,
              remaining_days: 5,
              status: 'active',
              affiliates: {
                id: affiliateId,
                full_name: fullName,
                phone: phone,
                document_id: documentId,
              },
            },
          ]

          const findByAffMock = vi.mocked(NotificationRepository.findByAffiliateMembershipAndType)
          const createMock = vi.mocked(NotificationRepository.create)

          // First execution: no existing notification → should create one
          findByAffMock.mockResolvedValueOnce(null)
          createMock.mockResolvedValueOnce({
            id: 'notif-001',
            affiliate_id: affiliateId,
            membership_id: membershipId,
            notification_type: 'expiration_reminder',
            status: 'pending',
            attempts: 0,
            last_attempt_at: null,
            next_retry_at: null,
            phone_used: phone,
            error_message: null,
            external_message_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })

          await checkAndNotifyExpiringMemberships()

          // Assert: exactly one notification was created in the first execution
          expect(createMock).toHaveBeenCalledTimes(1)
          expect(createMock).toHaveBeenCalledWith(
            expect.objectContaining({
              affiliate_id: affiliateId,
              membership_id: membershipId,
              notification_type: 'expiration_reminder',
            })
          )

          // Subsequent executions: notification already exists → should NOT create again
          const existingNotification = {
            id: 'notif-001',
            affiliate_id: affiliateId,
            membership_id: membershipId,
            notification_type: 'expiration_reminder',
            status: 'sent',
            attempts: 1,
            last_attempt_at: new Date().toISOString(),
            next_retry_at: null,
            phone_used: phone,
            error_message: null,
            external_message_id: 'msg-123',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          for (let i = 1; i < numExecutions; i++) {
            createMock.mockClear()

            // findByAffiliateMembershipAndType returns the existing notification
            findByAffMock.mockResolvedValueOnce(existingNotification)

            const result = await checkAndNotifyExpiringMemberships()

            // Assert: no new notification created
            expect(createMock).not.toHaveBeenCalled()

            // Assert: the existing one was skipped
            expect(result.skipped).toBe(1)
            expect(result.sent).toBe(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('el servicio verifica existencia de notificación antes de crear una nueva para cada par (afiliado, membresía)', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUuid,
        validUuid,
        validFullName,
        validPhone,
        validDocumentId,
        futureExpirationDate,
        async (affiliateId, membershipId, fullName, phone, documentId, expirationDate) => {
          vi.clearAllMocks()

          // Setup: configure an expiring membership
          mockExpiringMemberships = [
            {
              id: membershipId,
              affiliate_id: affiliateId,
              plan_id: 'plan-123',
              usage_start_date: '2025-01-01',
              weeks_count_start_date: '2025-01-01',
              expiration_date: expirationDate,
              remaining_days: 3,
              status: 'active',
              affiliates: {
                id: affiliateId,
                full_name: fullName,
                phone: phone,
                document_id: documentId,
              },
            },
          ]

          const findByAffMock = vi.mocked(NotificationRepository.findByAffiliateMembershipAndType)
          const createMock = vi.mocked(NotificationRepository.create)

          // Simulate: notification already exists for this pair
          findByAffMock.mockResolvedValue({
            id: 'existing-notif',
            affiliate_id: affiliateId,
            membership_id: membershipId,
            notification_type: 'expiration_reminder',
            status: 'sent',
            attempts: 1,
            last_attempt_at: new Date().toISOString(),
            next_retry_at: null,
            phone_used: phone,
            error_message: null,
            external_message_id: 'msg-abc',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })

          const result = await checkAndNotifyExpiringMemberships()

          // Assert: findByAffiliateMembershipAndType was called to check for duplicates
          expect(findByAffMock).toHaveBeenCalledWith(
            affiliateId,
            membershipId,
            'expiration_reminder'
          )

          // Assert: no new notification was created since one already exists
          expect(createMock).not.toHaveBeenCalled()

          // Assert: the membership was counted as skipped
          expect(result.skipped).toBe(1)
          expect(result.sent).toBe(0)
          expect(result.failed).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})
