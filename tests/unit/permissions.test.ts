import { describe, it, expect } from 'vitest'
import {
  checkPermission,
  assertPermission,
  PermissionDeniedError,
} from '@/lib/utils/permissions'

describe('checkPermission', () => {
  describe('admin role', () => {
    it('should allow all actions for admin', () => {
      expect(checkPermission('admin', 'create')).toBe(true)
      expect(checkPermission('admin', 'read')).toBe(true)
      expect(checkPermission('admin', 'update')).toBe(true)
      expect(checkPermission('admin', 'delete')).toBe(true)
      expect(checkPermission('admin', 'manage_settings')).toBe(true)
    })
  })

  describe('instructor role', () => {
    it('should allow create, read, update for instructor', () => {
      expect(checkPermission('instructor', 'create')).toBe(true)
      expect(checkPermission('instructor', 'read')).toBe(true)
      expect(checkPermission('instructor', 'update')).toBe(true)
    })

    it('should deny delete for instructor', () => {
      expect(checkPermission('instructor', 'delete')).toBe(false)
    })

    it('should deny manage_settings for instructor', () => {
      expect(checkPermission('instructor', 'manage_settings')).toBe(false)
    })
  })

  describe('invalid inputs', () => {
    it('should deny unknown roles', () => {
      expect(checkPermission('unknown', 'read')).toBe(false)
      expect(checkPermission('', 'read')).toBe(false)
    })

    it('should deny unknown actions', () => {
      expect(checkPermission('admin', 'unknown_action')).toBe(false)
      expect(checkPermission('instructor', 'unknown_action')).toBe(false)
    })
  })
})

describe('assertPermission', () => {
  it('should not throw for allowed actions', () => {
    expect(() => assertPermission('admin', 'delete')).not.toThrow()
    expect(() => assertPermission('instructor', 'create')).not.toThrow()
  })

  it('should throw PermissionDeniedError for denied actions', () => {
    expect(() => assertPermission('instructor', 'delete')).toThrow(
      PermissionDeniedError
    )
  })

  it('should include role and action in error message', () => {
    try {
      assertPermission('instructor', 'delete')
    } catch (err) {
      expect(err).toBeInstanceOf(PermissionDeniedError)
      expect((err as PermissionDeniedError).message).toContain('instructor')
      expect((err as PermissionDeniedError).message).toContain('delete')
      expect((err as PermissionDeniedError).statusCode).toBe(403)
    }
  })

  it('should throw for unknown roles', () => {
    expect(() => assertPermission('guest', 'read')).toThrow(
      PermissionDeniedError
    )
  })
})
