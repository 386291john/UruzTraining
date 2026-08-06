/**
 * Property 15: Validación de entrada rechaza datos inválidos con errores específicos
 *
 * Genera datos de afiliado con campos inválidos (nombre vacío, document_id fuera de rango,
 * fecha futura, etc.) y verifica que cada violación produce un error específico mencionando
 * el campo y la regla violada.
 *
 * **Validates: Requirements 2.7, 3.6**
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { createAffiliateSchema } from '@/lib/validators/affiliate.validator'

// Valid base data to use when testing individual field violations
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_BASE = {
  document_id: '12345678',
  full_name: 'Juan Pérez López',
  pin: '1234',
  birth_date: '2000-01-15',
  phone: '3001234567',
  plan_id: VALID_UUID,
  observations: null,
}

describe('Property 15: Validación de entrada rechaza datos inválidos con errores específicos', () => {
  /**
   * Sub-property: document_id must be 5-15 numeric digits.
   * Generate strings that violate this (too short, too long, or containing non-digits).
   */
  it('rechaza document_id con longitud fuera de rango (< 5 dígitos)', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^\d{1,4}$/),
        (shortDocId) => {
          const input = { ...VALID_BASE, document_id: shortDocId }
          const result = createAffiliateSchema.safeParse(input)
          expect(result.success).toBe(false)
          if (!result.success) {
            const issues = result.error.issues
            const docIssue = issues.find((i) => i.path.includes('document_id'))
            expect(docIssue).toBeDefined()
            expect(docIssue!.message).toContain('al menos 5')
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it('rechaza document_id con longitud excesiva (> 15 dígitos)', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^\d{16,25}$/),
        (longDocId) => {
          const input = { ...VALID_BASE, document_id: longDocId }
          const result = createAffiliateSchema.safeParse(input)
          expect(result.success).toBe(false)
          if (!result.success) {
            const issues = result.error.issues
            const docIssue = issues.find((i) => i.path.includes('document_id'))
            expect(docIssue).toBeDefined()
            expect(docIssue!.message).toContain('exceder 15')
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it('rechaza document_id con caracteres no numéricos', () => {
    fc.assert(
      fc.property(
        // Generate strings of length 5-15 that contain at least one non-digit
        fc.stringMatching(/^[a-zA-Z0-9]{5,15}$/).filter((s) => !/^\d+$/.test(s)),
        (invalidDocId) => {
          const input = { ...VALID_BASE, document_id: invalidDocId }
          const result = createAffiliateSchema.safeParse(input)
          expect(result.success).toBe(false)
          if (!result.success) {
            const issues = result.error.issues
            const docIssue = issues.find((i) => i.path.includes('document_id'))
            expect(docIssue).toBeDefined()
            expect(docIssue!.message).toContain('dígitos numéricos')
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Sub-property: full_name must be 3-100 characters.
   */
  it('rechaza full_name con menos de 3 caracteres', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 2 }),
        (shortName) => {
          const input = { ...VALID_BASE, full_name: shortName }
          const result = createAffiliateSchema.safeParse(input)
          expect(result.success).toBe(false)
          if (!result.success) {
            const issues = result.error.issues
            const nameIssue = issues.find((i) => i.path.includes('full_name'))
            expect(nameIssue).toBeDefined()
            expect(nameIssue!.message).toContain('al menos 3')
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it('rechaza full_name con más de 100 caracteres', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 101, maxLength: 200 }),
        (longName) => {
          const input = { ...VALID_BASE, full_name: longName }
          const result = createAffiliateSchema.safeParse(input)
          expect(result.success).toBe(false)
          if (!result.success) {
            const issues = result.error.issues
            const nameIssue = issues.find((i) => i.path.includes('full_name'))
            expect(nameIssue).toBeDefined()
            expect(nameIssue!.message).toContain('exceder')
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Sub-property: pin must be exactly 4 numeric digits.
   */
  it('rechaza PIN que no tiene exactamente 4 dígitos numéricos', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Too short (1-3 digits)
          fc.stringMatching(/^\d{1,3}$/),
          // Too long (5-8 digits)
          fc.stringMatching(/^\d{5,8}$/),
          // Exactly 4 chars but with non-digits
          fc.stringMatching(/^[a-zA-Z!@#]{4}$/)
        ),
        (invalidPin) => {
          const input = { ...VALID_BASE, pin: invalidPin }
          const result = createAffiliateSchema.safeParse(input)
          expect(result.success).toBe(false)
          if (!result.success) {
            const issues = result.error.issues
            const pinIssue = issues.find((i) => i.path.includes('pin'))
            expect(pinIssue).toBeDefined()
            // The error should mention PIN length or digit requirement
            expect(
              pinIssue!.message.includes('4 dígitos') || pinIssue!.message.includes('exactamente')
            ).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Sub-property: birth_date must not be in the future.
   */
  it('rechaza birth_date en el futuro', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3650 }), // 1 to ~10 years in the future
        (daysInFuture) => {
          const futureDate = new Date()
          futureDate.setDate(futureDate.getDate() + daysInFuture)
          const futureDateStr = futureDate.toISOString().split('T')[0]

          const input = { ...VALID_BASE, birth_date: futureDateStr }
          const result = createAffiliateSchema.safeParse(input)
          expect(result.success).toBe(false)
          if (!result.success) {
            const issues = result.error.issues
            const dateIssue = issues.find((i) => i.path.includes('birth_date'))
            expect(dateIssue).toBeDefined()
            expect(dateIssue!.message).toContain('futura')
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Sub-property: phone must be 7-15 numeric digits.
   */
  it('rechaza phone con longitud fuera de rango (< 7 dígitos)', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^\d{1,6}$/),
        (shortPhone) => {
          const input = { ...VALID_BASE, phone: shortPhone }
          const result = createAffiliateSchema.safeParse(input)
          expect(result.success).toBe(false)
          if (!result.success) {
            const issues = result.error.issues
            const phoneIssue = issues.find((i) => i.path.includes('phone'))
            expect(phoneIssue).toBeDefined()
            expect(phoneIssue!.message).toContain('al menos')
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it('rechaza phone con longitud excesiva (> 20 dígitos)', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^\d{21,30}$/),
        (longPhone) => {
          const input = { ...VALID_BASE, phone: longPhone }
          const result = createAffiliateSchema.safeParse(input)
          expect(result.success).toBe(false)
          if (!result.success) {
            const issues = result.error.issues
            const phoneIssue = issues.find((i) => i.path.includes('phone'))
            expect(phoneIssue).toBeDefined()
            expect(phoneIssue!.message).toContain('exceder')
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it('rechaza phone con caracteres no numéricos', () => {
    fc.assert(
      fc.property(
        // Generate strings with 7-15 chars that include at least one non-digit
        fc.stringMatching(/^[a-zA-Z0-9]{7,15}$/).filter((s) => !/^\d+$/.test(s)),
        (invalidPhone) => {
          const input = { ...VALID_BASE, phone: invalidPhone }
          const result = createAffiliateSchema.safeParse(input)
          expect(result.success).toBe(false)
          if (!result.success) {
            const issues = result.error.issues
            const phoneIssue = issues.find((i) => i.path.includes('phone'))
            expect(phoneIssue).toBeDefined()
            expect(phoneIssue!.message).toContain('dígitos numéricos')
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Sub-property: observations cannot exceed 500 characters.
   */
  it('rechaza observations con más de 500 caracteres', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 501, maxLength: 700 }),
        (longObs) => {
          const input = { ...VALID_BASE, observations: longObs }
          const result = createAffiliateSchema.safeParse(input)
          expect(result.success).toBe(false)
          if (!result.success) {
            const issues = result.error.issues
            const obsIssue = issues.find((i) => i.path.includes('observations'))
            expect(obsIssue).toBeDefined()
            expect(obsIssue!.message).toContain('exceder')
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Sub-property: Valid data should pass validation (sanity check).
   * Ensures the schema accepts properly formatted data.
   */
  it('acepta datos válidos correctamente formateados', () => {
    // Generate past dates as strings using integer days offset from a base
    const pastDateArb = fc.integer({ min: 0, max: 365 * 80 }).map((daysAgo) => {
      const d = new Date('2025-01-01')
      d.setDate(d.getDate() - daysAgo)
      return d.toISOString().split('T')[0]
    })

    fc.assert(
      fc.property(
        fc.record({
          document_id: fc.stringMatching(/^\d{5,15}$/),
          full_name: fc.string({ minLength: 3, maxLength: 100 }),
          pin: fc.stringMatching(/^\d{4}$/),
          birth_date: pastDateArb,
          phone: fc.stringMatching(/^\d{7,15}$/),
          plan_id: fc.uuid(),
          observations: fc.oneof(
            fc.constant(null),
            fc.string({ minLength: 0, maxLength: 500 })
          ),
        }),
        (validData) => {
          const result = createAffiliateSchema.safeParse(validData)
          expect(result.success).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})
