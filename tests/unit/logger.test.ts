import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logServerError, logServerWarning } from '@/lib/utils/logger'

describe('logServerError', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('should log error with all context fields', () => {
    const error = new Error('Something went wrong')
    error.stack = 'Error: Something went wrong\n    at file.ts:10'

    logServerError(error, {
      operation: 'POST /api/affiliates',
      userId: 'user-123',
      method: 'POST',
      path: '/api/affiliates',
      metadata: { affiliateId: 'aff-1' },
    })

    expect(console.error).toHaveBeenCalledTimes(1)
    const call = (console.error as any).mock.calls[0]
    expect(call[0]).toBe('[UruzTraining Error]')

    const logged = JSON.parse(call[1])
    expect(logged.level).toBe('error')
    expect(logged.operation).toBe('POST /api/affiliates')
    expect(logged.message).toBe('Something went wrong')
    expect(logged.stack).toContain('at file.ts:10')
    expect(logged.userId).toBe('user-123')
    expect(logged.method).toBe('POST')
    expect(logged.path).toBe('/api/affiliates')
    expect(logged.metadata).toEqual({ affiliateId: 'aff-1' })
    expect(logged.timestamp).toBeDefined()
  })

  it('should handle non-Error thrown values', () => {
    logServerError('string error', {
      operation: 'GET /api/plans',
    })

    expect(console.error).toHaveBeenCalledTimes(1)
    const call = (console.error as any).mock.calls[0]
    const logged = JSON.parse(call[1])
    expect(logged.message).toBe('string error')
    expect(logged.stack).toBeUndefined()
  })

  it('should include a valid ISO timestamp', () => {
    logServerError(new Error('test'), { operation: 'test-op' })

    const call = (console.error as any).mock.calls[0]
    const logged = JSON.parse(call[1])
    const timestamp = new Date(logged.timestamp)
    expect(timestamp.toISOString()).toBe(logged.timestamp)
  })

  it('should handle minimal context (only operation)', () => {
    logServerError(new Error('test'), { operation: 'minimal-op' })

    const call = (console.error as any).mock.calls[0]
    const logged = JSON.parse(call[1])
    expect(logged.operation).toBe('minimal-op')
    expect(logged.userId).toBeUndefined()
    expect(logged.method).toBeUndefined()
    expect(logged.path).toBeUndefined()
  })
})

describe('logServerWarning', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('should log warning with context', () => {
    logServerWarning('Something unusual', {
      operation: 'notification-check',
      userId: 'admin-1',
    })

    expect(console.warn).toHaveBeenCalledTimes(1)
    const call = (console.warn as any).mock.calls[0]
    expect(call[0]).toBe('[UruzTraining Warning]')

    const logged = JSON.parse(call[1])
    expect(logged.level).toBe('warn')
    expect(logged.message).toBe('Something unusual')
    expect(logged.operation).toBe('notification-check')
    expect(logged.userId).toBe('admin-1')
  })
})
