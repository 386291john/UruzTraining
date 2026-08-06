/**
 * Property Test: Lógica de reintentos de notificación
 *
 * **Validates: Requirements 9.6**
 *
 * Property 12: Generar notificaciones con diferentes valores de attempts (0-5) y status.
 * Verificar:
 *   - Si attempts < 3, next_retry_at = last_attempt_at + 5 min (se programa reintento)
 *   - Si attempts >= 3, fallo definitivo sin más reintentos (next_retry_at = null, status = 'failed')
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'

// --- Constants matching the service implementation ---
const MAX_ATTEMPTS = 3
const RETRY_INTERVAL_MINUTES = 5

// --- Mock dependencies ---

const mockNotificationRepoUpdate = vi.fn()
const mockNotificationRepoFindPendingForRetry = vi.fn()

vi.mock('@/repositories/notification.repository', () => ({
  update: (...args: unknown[]) => mockNotificationRepoUpdate(...args),
  findPendingForRetry: () => mockNotificationRepoFindPendingForRetry(),
  findByAffiliateMembershipAndType: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue({ id: 'notif-123' }),
}))

// Mock provider that always fails
const mockProviderSend = vi.fn()

vi.mock('@/services/whatsapp.service', () => ({
  WhatsAppNotificationProvider: class {
    send = mockProviderSend
    getStatus = vi.fn().mockResolvedValue('failed')
  },
}))

// Mock supabase admin client
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}))

// Import after mocks
import { retryFailedNotifications, setProvider, type INotificationProvider, type NotificationPayload } from '@/services/notification.service'

// --- Generators ---

/** Generates an attempts value between 0 and 5 */
const attemptsGen = fc.integer({ min: 0, max: 5 })

/** Generates a notification status */
const statusGen = fc.constantFrom('pending', 'sent', 'delivered', 'failed', 'skipped')

/** Generates a valid ISO timestamp for last_attempt_at */
const lastAttemptAtGen = fc.date({
  min: new Date('2024-01-01'),
  max: new Date('2025-12-31'),
}).map((d) => d.toISOString())

/** Generates a notification ID */
const notificationIdGen = fc.uuid()

// --- Pure logic under test ---

/**
 * Pure function that replicates the retry decision logic from the notification service.
 * This extracts the core algorithm so we can verify it as a property.
 *
 * Given a notification with current attempts:
 * - If newAttempts (currentAttempts + 1) >= MAX_ATTEMPTS → mark as 'failed', next_retry_at = null
 * - If newAttempts < MAX_ATTEMPTS → keep 'pending', next_retry_at = now + 5 min
 */
function computeRetryDecision(
  currentAttempts: number,
  lastAttemptAt: Date
): {
  shouldRetry: boolean
  newStatus: string
  newAttempts: number
  nextRetryAt: Date | null
} {
  const newAttempts = currentAttempts + 1

  if (newAttempts >= MAX_ATTEMPTS) {
    return {
      shouldRetry: false,
      newStatus: 'failed',
      newAttempts,
      nextRetryAt: null,
    }
  }

  const nextRetryAt = new Date(lastAttemptAt)
  nextRetryAt.setMinutes(nextRetryAt.getMinutes() + RETRY_INTERVAL_MINUTES)

  return {
    shouldRetry: true,
    newStatus: 'pending',
    newAttempts,
    nextRetryAt,
  }
}

// --- Tests ---

describe('Property 12: Lógica de reintentos de notificación', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('si attempts < 3 tras el fallo, next_retry_at = last_attempt_at + 5 minutos y sigue como pending', () => {
    fc.assert(
      fc.property(
        // Generate attempts 0, 1 (so newAttempts = 1 or 2, which is < 3)
        fc.integer({ min: 0, max: 1 }),
        lastAttemptAtGen,
        (currentAttempts, lastAttemptAtStr) => {
          const lastAttemptAt = new Date(lastAttemptAtStr)
          const decision = computeRetryDecision(currentAttempts, lastAttemptAt)

          // Should schedule retry
          expect(decision.shouldRetry).toBe(true)
          expect(decision.newStatus).toBe('pending')
          expect(decision.newAttempts).toBe(currentAttempts + 1)
          expect(decision.newAttempts).toBeLessThan(MAX_ATTEMPTS)

          // next_retry_at should be exactly 5 minutes after last_attempt_at
          expect(decision.nextRetryAt).not.toBeNull()
          const expectedRetryTime = new Date(lastAttemptAt)
          expectedRetryTime.setMinutes(expectedRetryTime.getMinutes() + RETRY_INTERVAL_MINUTES)

          expect(decision.nextRetryAt!.getTime()).toBe(expectedRetryTime.getTime())
        }
      ),
      { numRuns: 200 }
    )
  })

  it('si attempts >= 3 tras el fallo, se marca como failed definitivamente sin más reintentos', () => {
    fc.assert(
      fc.property(
        // Generate attempts 2, 3, 4 (so newAttempts = 3, 4, 5 which is >= MAX_ATTEMPTS)
        fc.integer({ min: 2, max: 5 }),
        lastAttemptAtGen,
        (currentAttempts, lastAttemptAtStr) => {
          const lastAttemptAt = new Date(lastAttemptAtStr)
          const decision = computeRetryDecision(currentAttempts, lastAttemptAt)

          // Should NOT retry — permanent failure
          expect(decision.shouldRetry).toBe(false)
          expect(decision.newStatus).toBe('failed')
          expect(decision.newAttempts).toBe(currentAttempts + 1)
          expect(decision.newAttempts).toBeGreaterThanOrEqual(MAX_ATTEMPTS)

          // next_retry_at should be null (no more retries scheduled)
          expect(decision.nextRetryAt).toBeNull()
        }
      ),
      { numRuns: 200 }
    )
  })

  it('la lógica de reintento del servicio real actualiza correctamente en caso de fallo (attempts < 3)', async () => {
    await fc.assert(
      fc.asyncProperty(
        notificationIdGen,
        fc.integer({ min: 0, max: 1 }),
        async (notifId, currentAttempts) => {
          vi.clearAllMocks()

          // Setup: A notification eligible for retry with attempts < 3
          const notification = {
            id: notifId,
            affiliate_id: 'aff-001',
            membership_id: 'mem-001',
            notification_type: 'expiration_reminder',
            status: 'pending',
            attempts: currentAttempts,
            last_attempt_at: new Date().toISOString(),
            next_retry_at: new Date().toISOString(),
            phone_used: '3001234567',
            error_message: 'Previous error',
            external_message_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          // Mock findPendingForRetry to return our notification
          mockNotificationRepoFindPendingForRetry.mockResolvedValue([notification])

          // Mock supabase from() calls for reading affiliate and membership
          mockFrom.mockImplementation((table: string) => {
            if (table === 'affiliates') {
              return {
                select: () => ({
                  eq: () => ({
                    single: () => Promise.resolve({
                      data: { full_name: 'Test User', phone: '3001234567', document_id: '12345678' },
                      error: null,
                    }),
                  }),
                }),
              }
            }
            if (table === 'memberships') {
              return {
                select: () => ({
                  eq: () => ({
                    single: () => Promise.resolve({
                      data: { expiration_date: '2025-06-15' },
                      error: null,
                    }),
                  }),
                }),
              }
            }
            if (table === 'system_config') {
              return {
                select: () => ({
                  eq: () => ({
                    single: () => Promise.resolve({
                      data: { value: { template: 'Hola {{nombre}}, vence {{fecha_vencimiento}}' } },
                      error: null,
                    }),
                  }),
                }),
              }
            }
            if (table === 'notifications') {
              return {
                select: () => ({
                  eq: () => ({
                    single: () => Promise.resolve({
                      data: { attempts: currentAttempts },
                      error: null,
                    }),
                  }),
                }),
              }
            }
            return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }
          })

          // Provider always fails
          mockProviderSend.mockResolvedValue({ success: false, error: 'Timeout' })

          // Execute retry
          await retryFailedNotifications()

          // Verify update was called
          expect(mockNotificationRepoUpdate).toHaveBeenCalled()

          // Get the update call arguments
          const updateCall = mockNotificationRepoUpdate.mock.calls[0]
          const [updateId, updateData] = updateCall

          expect(updateId).toBe(notifId)
          expect(updateData.attempts).toBe(currentAttempts + 1)
          expect(updateData.status).toBe('pending') // Still pending since attempts < 3
          expect(updateData.last_attempt_at).toBeDefined()
          expect(updateData.next_retry_at).toBeDefined()
          expect(updateData.next_retry_at).not.toBeNull()

          // Verify next_retry_at is approximately 5 minutes after last_attempt_at
          const lastAttempt = new Date(updateData.last_attempt_at)
          const nextRetry = new Date(updateData.next_retry_at)
          const diffMs = nextRetry.getTime() - lastAttempt.getTime()
          const diffMinutes = diffMs / (1000 * 60)

          expect(diffMinutes).toBeCloseTo(RETRY_INTERVAL_MINUTES, 0)
        }
      ),
      { numRuns: 30 }
    )
  })

  it('la lógica de reintento del servicio real marca como failed cuando attempts >= 3', async () => {
    await fc.assert(
      fc.asyncProperty(
        notificationIdGen,
        fc.integer({ min: 2, max: 4 }),
        async (notifId, currentAttempts) => {
          vi.clearAllMocks()

          // Setup: A notification that has already exhausted or will exhaust retries
          const notification = {
            id: notifId,
            affiliate_id: 'aff-002',
            membership_id: 'mem-002',
            notification_type: 'expiration_reminder',
            status: 'pending',
            attempts: currentAttempts,
            last_attempt_at: new Date().toISOString(),
            next_retry_at: new Date().toISOString(),
            phone_used: '3009876543',
            error_message: 'Delivery failed',
            external_message_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          mockNotificationRepoFindPendingForRetry.mockResolvedValue([notification])

          // Mock supabase from() calls
          mockFrom.mockImplementation((table: string) => {
            if (table === 'affiliates') {
              return {
                select: () => ({
                  eq: () => ({
                    single: () => Promise.resolve({
                      data: { full_name: 'Another User', phone: '3009876543', document_id: '87654321' },
                      error: null,
                    }),
                  }),
                }),
              }
            }
            if (table === 'memberships') {
              return {
                select: () => ({
                  eq: () => ({
                    single: () => Promise.resolve({
                      data: { expiration_date: '2025-07-01' },
                      error: null,
                    }),
                  }),
                }),
              }
            }
            if (table === 'system_config') {
              return {
                select: () => ({
                  eq: () => ({
                    single: () => Promise.resolve({
                      data: { value: { template: 'Hola {{nombre}}, vence {{fecha_vencimiento}}' } },
                      error: null,
                    }),
                  }),
                }),
              }
            }
            if (table === 'notifications') {
              return {
                select: () => ({
                  eq: () => ({
                    single: () => Promise.resolve({
                      data: { attempts: currentAttempts },
                      error: null,
                    }),
                  }),
                }),
              }
            }
            return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }
          })

          // Provider always fails
          mockProviderSend.mockResolvedValue({ success: false, error: 'Service unavailable' })

          // Execute retry
          await retryFailedNotifications()

          // Verify update was called
          expect(mockNotificationRepoUpdate).toHaveBeenCalled()

          const updateCall = mockNotificationRepoUpdate.mock.calls[0]
          const [updateId, updateData] = updateCall

          expect(updateId).toBe(notifId)
          expect(updateData.attempts).toBe(currentAttempts + 1)
          expect(updateData.status).toBe('failed') // Permanently failed
          expect(updateData.next_retry_at).toBeNull() // No more retries
          expect(updateData.last_attempt_at).toBeDefined()
          expect(updateData.error_message).toBeDefined()
        }
      ),
      { numRuns: 30 }
    )
  })

  it('el intervalo de reintento es siempre exactamente 5 minutos para cualquier fecha base', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        fc.integer({ min: 0, max: 1 }),
        (baseDate, currentAttempts) => {
          const decision = computeRetryDecision(currentAttempts, baseDate)

          if (decision.shouldRetry && decision.nextRetryAt) {
            const diffMs = decision.nextRetryAt.getTime() - baseDate.getTime()
            const diffMinutes = diffMs / (1000 * 60)

            // The interval should always be exactly 5 minutes
            expect(diffMinutes).toBe(RETRY_INTERVAL_MINUTES)
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})
