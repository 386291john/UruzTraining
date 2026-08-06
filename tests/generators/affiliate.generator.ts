/**
 * Fast-check generator factories for affiliate-related property tests.
 *
 * NOTE: These are factory functions that accept a `fast-check` instance
 * to avoid module resolution issues with vitest mocking.
 * Usage: const generators = createAffiliateGenerators(fc)
 */

import type * as FC from 'fast-check'

/**
 * Creates affiliate generators using the provided fast-check instance.
 * This pattern avoids issues where generators imported from a separate file
 * produce Arbitrary instances from a different fast-check module copy.
 */
export function createAffiliateGenerators(fc: typeof FC) {
  /** Generates a valid document_id: 5–15 numeric characters. */
  const validDocumentId = fc.stringMatching(/^\d{5,15}$/)

  /** Generates a valid full_name: 3–100 characters (letters and spaces). */
  const validFullName = fc.stringMatching(/^[a-zA-Z][a-zA-Z ]{1,48}[a-zA-Z]$/)

  /** Generates a valid PIN: exactly 4 numeric digits. */
  const validPin = fc.stringMatching(/^\d{4}$/)

  /** Generates a valid phone number: 7–15 numeric characters. */
  const validPhone = fc.stringMatching(/^\d{7,15}$/)

  /** Generates a valid birth_date string (ISO format) that is not in the future. */
  const validBirthDate = fc
    .date({ min: new Date(1940, 0, 1), max: new Date(2010, 11, 31) })
    .map((d) => d.toISOString().split('T')[0])

  /** Generates a complete valid affiliate registration input object. */
  const validAffiliateInput = fc.record({
    document_id: validDocumentId,
    full_name: validFullName,
    pin: validPin,
    birth_date: validBirthDate,
    phone: validPhone,
    plan_id: fc.uuid(),
    observations: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
  })

  /** Generates a pair of affiliate inputs with the SAME document_id (for duplicate testing). */
  const duplicateDocumentIdPair = validDocumentId.chain((docId) =>
    fc.tuple(
      validAffiliateInput.map((input) => ({ ...input, document_id: docId })),
      validAffiliateInput.map((input) => ({ ...input, document_id: docId }))
    )
  )

  return {
    validDocumentId,
    validFullName,
    validPin,
    validPhone,
    validBirthDate,
    validAffiliateInput,
    duplicateDocumentIdPair,
  }
}
