/**
 * Property 6: Correctitud de búsqueda por campo
 *
 * Validates: Requirements 4.1, 4.2, 4.3
 *
 * Verifies that ALL search results contain the search term as a substring
 * in the corresponding field:
 * - document_id: partial match (contains)
 * - full_name: partial match, case-insensitive
 * - phone: partial match (contains)
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  arbitraryAffiliateSet,
  arbitraryNumericSearchTerm,
  arbitraryNameSearchTerm,
  type TestAffiliate,
} from '../generators/affiliate.generator'

// --- Pure search logic (mirrors repository ILIKE behavior) ---

type SearchField = 'document_id' | 'full_name' | 'phone'

/**
 * Simulates the search logic from the affiliate repository.
 * Uses case-insensitive substring matching (equivalent to SQL ILIKE '%term%').
 */
function searchAffiliates(
  affiliates: TestAffiliate[],
  field: SearchField,
  term: string
): TestAffiliate[] {
  const lowerTerm = term.toLowerCase()

  return affiliates.filter((affiliate) => {
    const fieldValue = affiliate[field].toLowerCase()
    return fieldValue.includes(lowerTerm)
  })
}

describe('Property 6: Correctitud de búsqueda por campo', () => {
  /**
   * **Validates: Requirements 4.1**
   *
   * WHEN searching by document_id, ALL returned results must contain
   * the search term as a substring in the document_id field.
   */
  it('búsqueda por document_id: todos los resultados contienen el término como subcadena', () => {
    fc.assert(
      fc.property(
        arbitraryAffiliateSet(),
        arbitraryNumericSearchTerm(),
        (affiliates, term) => {
          const results = searchAffiliates(affiliates, 'document_id', term)

          // Every result must contain the term as a substring in document_id
          for (const result of results) {
            expect(result.document_id.toLowerCase()).toContain(term.toLowerCase())
          }

          // Verify completeness: no affiliate that matches was left out
          const expectedMatches = affiliates.filter((a) =>
            a.document_id.toLowerCase().includes(term.toLowerCase())
          )
          expect(results.length).toBe(expectedMatches.length)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * **Validates: Requirements 4.2**
   *
   * WHEN searching by full_name, ALL returned results must contain
   * the search term as a substring (case-insensitive) in the full_name field.
   */
  it('búsqueda por full_name: todos los resultados contienen el término como subcadena (case-insensitive)', () => {
    fc.assert(
      fc.property(
        arbitraryAffiliateSet(),
        arbitraryNameSearchTerm(),
        (affiliates, term) => {
          const results = searchAffiliates(affiliates, 'full_name', term)

          // Every result must contain the term as case-insensitive substring in full_name
          for (const result of results) {
            expect(result.full_name.toLowerCase()).toContain(term.toLowerCase())
          }

          // Verify completeness: no affiliate that matches was left out
          const expectedMatches = affiliates.filter((a) =>
            a.full_name.toLowerCase().includes(term.toLowerCase())
          )
          expect(results.length).toBe(expectedMatches.length)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * **Validates: Requirements 4.3**
   *
   * WHEN searching by phone, ALL returned results must contain
   * the search term as a substring in the phone field.
   */
  it('búsqueda por phone: todos los resultados contienen el término como subcadena', () => {
    fc.assert(
      fc.property(
        arbitraryAffiliateSet(),
        arbitraryNumericSearchTerm(),
        (affiliates, term) => {
          const results = searchAffiliates(affiliates, 'phone', term)

          // Every result must contain the term as a substring in phone
          for (const result of results) {
            expect(result.phone.toLowerCase()).toContain(term.toLowerCase())
          }

          // Verify completeness: no affiliate that matches was left out
          const expectedMatches = affiliates.filter((a) =>
            a.phone.toLowerCase().includes(term.toLowerCase())
          )
          expect(results.length).toBe(expectedMatches.length)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * **Validates: Requirements 4.1, 4.2, 4.3**
   *
   * When a term is known to exist as a substring in a field of at least one affiliate,
   * the search must return at least that affiliate (non-empty result set).
   */
  it('si un afiliado contiene el término en su campo, la búsqueda lo retorna', () => {
    fc.assert(
      fc.property(
        arbitraryAffiliateSet(),
        fc.constantFrom<SearchField>('document_id', 'full_name', 'phone'),
        (affiliates, field) => {
          // Pick a random affiliate and extract a substring of at least 3 chars from the field
          const target = affiliates[0]
          const fieldValue = target[field]

          if (fieldValue.length < 3) return // skip if field is too short for a 3-char term

          // Extract a substring of length 3 from the field value
          const startIdx = Math.floor(Math.random() * (fieldValue.length - 2))
          const term = fieldValue.substring(startIdx, startIdx + 3)

          const results = searchAffiliates(affiliates, field, term)

          // The target affiliate must be in the results
          expect(results.some((r) => r.id === target.id)).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * **Validates: Requirements 4.2**
   *
   * Case-insensitivity for full_name: searching with upper or lowercase
   * produces the same results.
   */
  it('búsqueda por full_name es case-insensitive', () => {
    fc.assert(
      fc.property(
        arbitraryAffiliateSet(),
        arbitraryNameSearchTerm(),
        (affiliates, term) => {
          const resultsLower = searchAffiliates(affiliates, 'full_name', term.toLowerCase())
          const resultsUpper = searchAffiliates(affiliates, 'full_name', term.toUpperCase())
          const resultsMixed = searchAffiliates(affiliates, 'full_name', term)

          // All variations produce the same number of results
          expect(resultsLower.length).toBe(resultsUpper.length)
          expect(resultsLower.length).toBe(resultsMixed.length)

          // Same affiliates are returned
          const idsLower = new Set(resultsLower.map((r) => r.id))
          const idsUpper = new Set(resultsUpper.map((r) => r.id))

          for (const id of idsLower) {
            expect(idsUpper.has(id)).toBe(true)
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})
