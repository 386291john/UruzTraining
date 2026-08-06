/**
 * Property 17: Paginación no excede tamaño máximo
 * Property 18: Búsqueda rechaza términos cortos
 *
 * Validates: Requirements 4.6, 4.8
 *
 * Property 17: Generates variable-size affiliate result sets and simulates
 * in-memory pagination to verify that each page contains at most 20 records.
 *
 * Property 18: Generates search terms with length < 3 and verifies that
 * the searchAffiliateSchema rejects them with a validation error.
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { searchAffiliateSchema } from '@/lib/validators/affiliate.validator'
import { PAGINATION } from '@/lib/utils/constants'

// --- In-memory pagination logic (mirrors repository behavior) ---

interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * Simulates pagination over an array of items, using the same logic
 * as the affiliate repository (page-based, max DEFAULT_PAGE_SIZE per page).
 */
function paginate<T>(
  items: T[],
  page: number,
  pageSize: number = PAGINATION.DEFAULT_PAGE_SIZE
): PaginatedResult<T> {
  const effectivePageSize = Math.min(pageSize, PAGINATION.DEFAULT_PAGE_SIZE)
  const total = items.length
  const totalPages = Math.ceil(total / effectivePageSize) || 1
  const safePage = Math.max(1, Math.min(page, totalPages))
  const start = (safePage - 1) * effectivePageSize
  const data = items.slice(start, start + effectivePageSize)

  return {
    data,
    total,
    page: safePage,
    pageSize: effectivePageSize,
    totalPages,
  }
}

// --- Generators ---

/** Generates a simple affiliate record for pagination testing. */
function arbitraryAffiliate() {
  return fc.record({
    id: fc.uuid(),
    document_id: fc.stringMatching(/^\d{5,15}$/),
    full_name: fc.stringMatching(/^[a-zA-Z][a-zA-Z ]{2,48}[a-zA-Z]$/),
    phone: fc.stringMatching(/^\d{7,15}$/),
    plan_name: fc.string({ minLength: 3, maxLength: 50 }),
    status: fc.constantFrom('active', 'expired'),
    expiration_date: fc.integer({ min: 0, max: 1095 }).map(offset => {
      const base = new Date(2024, 0, 1)
      base.setDate(base.getDate() + offset)
      return base.toISOString().split('T')[0]
    }),
  })
}

/** Generates arrays of affiliates with variable sizes (0 to 100). */
function arbitraryAffiliateList() {
  return fc.array(arbitraryAffiliate(), { minLength: 0, maxLength: 100 })
}

/** Generates a valid page number. */
function arbitraryPageNumber() {
  return fc.integer({ min: 1, max: 20 })
}

/** Generates search terms with length 0, 1, or 2 (shorter than the minimum of 3). */
function arbitraryShortSearchTerm() {
  return fc.string({ minLength: 0, maxLength: 2 })
}

/** Generates a valid search field. */
function arbitrarySearchField() {
  return fc.constantFrom('document_id' as const, 'full_name' as const, 'phone' as const)
}

describe('Property 17: Paginación no excede tamaño máximo', () => {
  /**
   * **Validates: Requirements 4.6**
   *
   * WHEN search results are paginated, each page MUST contain at most
   * PAGINATION.DEFAULT_PAGE_SIZE (20) records.
   */
  it('cada página contiene máximo 20 registros independientemente del tamaño del conjunto', () => {
    fc.assert(
      fc.property(
        arbitraryAffiliateList(),
        arbitraryPageNumber(),
        (affiliates, page) => {
          const result = paginate(affiliates, page)

          // Core property: page size never exceeds the maximum
          expect(result.data.length).toBeLessThanOrEqual(PAGINATION.DEFAULT_PAGE_SIZE)

          // Additional invariant: page size is non-negative
          expect(result.data.length).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 300 }
    )
  })

  /**
   * **Validates: Requirements 4.6**
   *
   * The total number of items across all pages equals the total count.
   */
  it('la suma de elementos de todas las páginas es igual al total', () => {
    fc.assert(
      fc.property(
        arbitraryAffiliateList(),
        (affiliates) => {
          const totalPages = Math.ceil(affiliates.length / PAGINATION.DEFAULT_PAGE_SIZE) || 1
          let totalItems = 0

          for (let page = 1; page <= totalPages; page++) {
            const result = paginate(affiliates, page)
            totalItems += result.data.length
          }

          expect(totalItems).toBe(affiliates.length)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * **Validates: Requirements 4.6**
   *
   * The totalPages calculation is consistent with page size and total items.
   */
  it('totalPages es consistente con el total de elementos y el tamaño de página', () => {
    fc.assert(
      fc.property(
        arbitraryAffiliateList(),
        (affiliates) => {
          const result = paginate(affiliates, 1)

          const expectedTotalPages = Math.ceil(affiliates.length / PAGINATION.DEFAULT_PAGE_SIZE) || 1
          expect(result.totalPages).toBe(expectedTotalPages)
          expect(result.total).toBe(affiliates.length)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * **Validates: Requirements 4.6**
   *
   * Even when pageSize is requested larger than DEFAULT_PAGE_SIZE,
   * the effective page size is clamped to DEFAULT_PAGE_SIZE (20).
   */
  it('pageSize solicitado mayor a 20 se limita al máximo de 20', () => {
    fc.assert(
      fc.property(
        arbitraryAffiliateList(),
        fc.integer({ min: 21, max: 200 }),
        (affiliates, requestedPageSize) => {
          const result = paginate(affiliates, 1, requestedPageSize)

          // Even with a larger requested pageSize, data is capped at 20
          expect(result.data.length).toBeLessThanOrEqual(PAGINATION.DEFAULT_PAGE_SIZE)
        }
      ),
      { numRuns: 200 }
    )
  })
})

describe('Property 18: Búsqueda rechaza términos cortos', () => {
  /**
   * **Validates: Requirements 4.8**
   *
   * IF a search term has fewer than 3 characters,
   * THEN the searchAffiliateSchema MUST reject it with a validation error.
   */
  it('términos de búsqueda con longitud < 3 son rechazados por el esquema de validación', () => {
    fc.assert(
      fc.property(
        arbitraryShortSearchTerm(),
        arbitrarySearchField(),
        (shortTerm, field) => {
          const result = searchAffiliateSchema.safeParse({
            field,
            term: shortTerm,
          })

          // The validation must fail
          expect(result.success).toBe(false)

          // The error must reference the 'term' field
          if (!result.success) {
            const termErrors = result.error.issues.filter(
              (issue) => issue.path.includes('term')
            )
            expect(termErrors.length).toBeGreaterThan(0)
          }
        }
      ),
      { numRuns: 300 }
    )
  })

  /**
   * **Validates: Requirements 4.8**
   *
   * Terms of exactly 3 characters or more should pass the term validation
   * (given valid field and term format).
   */
  it('términos de búsqueda con longitud >= 3 pasan la validación del campo term', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 50 }),
        arbitrarySearchField(),
        (validTerm, field) => {
          const result = searchAffiliateSchema.safeParse({
            field,
            term: validTerm,
          })

          // If validation fails, it should NOT be because of the term length
          if (!result.success) {
            const termMinLengthErrors = result.error.issues.filter(
              (issue) =>
                issue.path.includes('term') &&
                issue.code === 'too_small'
            )
            expect(termMinLengthErrors.length).toBe(0)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * **Validates: Requirements 4.8**
   *
   * The error message for short terms indicates the minimum character requirement.
   */
  it('el mensaje de error indica la cantidad mínima de caracteres requerida', () => {
    fc.assert(
      fc.property(
        arbitraryShortSearchTerm(),
        arbitrarySearchField(),
        (shortTerm, field) => {
          const result = searchAffiliateSchema.safeParse({
            field,
            term: shortTerm,
          })

          if (!result.success) {
            const termErrors = result.error.issues.filter(
              (issue) => issue.path.includes('term')
            )
            // At least one error message should mention "3" (the minimum)
            const hasMinLengthMessage = termErrors.some(
              (issue) => issue.message.includes('3')
            )
            expect(hasMinLengthMessage).toBe(true)
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})
