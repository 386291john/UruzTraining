import { describe, it, expect } from 'vitest'
import { PAGINATION, FIELD_LIMITS } from '@/lib/utils/constants'

describe('Vitest Setup', () => {
  it('should run tests correctly', () => {
    expect(1 + 1).toBe(2)
  })

  it('should resolve @/ path aliases', () => {
    expect(PAGINATION.DEFAULT_PAGE_SIZE).toBe(20)
    expect(FIELD_LIMITS.PIN_LENGTH).toBe(4)
  })
})
