/**
 * Property-Based Test: Validación de PIN
 *
 * Validates: Requirements 3.3, 7.2
 *
 * Property 2: Verifica que SOLO cadenas de exactamente 4 dígitos numéricos (0000-9999)
 * pasan la validación del PIN.
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { updatePinSchema, createAffiliateSchema } from '@/lib/validators/affiliate.validator'

describe('Property 2: Validación de PIN', () => {
  /**
   * **Validates: Requirements 3.3, 7.2**
   *
   * Cualquier cadena de exactamente 4 dígitos numéricos (0000-9999) debe pasar la validación.
   */
  it('acepta SOLO cadenas de exactamente 4 dígitos numéricos', () => {
    fc.assert(
      fc.property(
        // Genera cadenas de exactamente 4 dígitos numéricos usando stringMatching
        fc.stringMatching(/^\d{4}$/),
        (validPin) => {
          const result = updatePinSchema.safeParse({ pin: validPin })
          expect(result.success).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * **Validates: Requirements 3.3, 7.2**
   *
   * Cadenas de longitud diferente a 4 (0-3, 5-10) con caracteres alfanuméricos y especiales
   * deben ser rechazadas por la validación.
   */
  it('rechaza cadenas con longitud diferente a 4', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Longitud 0-3
          fc.string({ minLength: 0, maxLength: 3 }),
          // Longitud 5-10
          fc.string({ minLength: 5, maxLength: 10 })
        ),
        (invalidPin) => {
          const result = updatePinSchema.safeParse({ pin: invalidPin })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * **Validates: Requirements 3.3, 7.2**
   *
   * Cadenas de exactamente 4 caracteres que contienen al menos un carácter no numérico
   * deben ser rechazadas.
   */
  it('rechaza cadenas de 4 caracteres que contienen caracteres no numéricos', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.integer({ min: 0, max: 3 }), // posición del carácter no numérico
          fc.stringMatching(/^[^0-9]$/), // un carácter no numérico
          fc.stringMatching(/^\d{3}$/) // 3 dígitos para el resto
        ),
        ([position, nonDigit, digits]) => {
          // Insertar el carácter no numérico en la posición indicada
          const chars = [...digits]
          chars.splice(position, 0, nonDigit)
          const pinWithNonDigit = chars.slice(0, 4).join('')

          const result = updatePinSchema.safeParse({ pin: pinWithNonDigit })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * **Validates: Requirements 3.3, 7.2**
   *
   * Cadenas aleatorias de longitud variable (0-10) con caracteres alfanuméricos y especiales:
   * solo las que son exactamente 4 dígitos numéricos pasan la validación.
   */
  it('la validación es equivalente a /^\\d{4}$/ para cadenas arbitrarias', () => {
    const pinRegex = /^\d{4}$/

    fc.assert(
      fc.property(
        // Genera cadenas aleatorias con longitud 0-10, incluyendo alfanuméricos y especiales
        fc.string({ minLength: 0, maxLength: 10 }),
        (arbitraryString) => {
          const result = updatePinSchema.safeParse({ pin: arbitraryString })
          const shouldPass = pinRegex.test(arbitraryString)

          expect(result.success).toBe(shouldPass)
        }
      ),
      { numRuns: 500 }
    )
  })

  /**
   * **Validates: Requirements 3.3**
   *
   * La misma validación aplica en el esquema de creación de afiliado.
   */
  it('el schema de creación de afiliado también valida el PIN con la misma regla', () => {
    const pinRegex = /^\d{4}$/

    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 10 }),
        (arbitraryPin) => {
          // Usamos datos válidos para el resto de campos, solo variamos el PIN
          const baseData = {
            document_id: '12345678',
            full_name: 'Test User',
            pin: arbitraryPin,
            birth_date: '1990-01-15',
            phone: '3001234567',
            plan_id: '00000000-0000-0000-0000-000000000001',
            observations: null,
          }

          const result = createAffiliateSchema.safeParse(baseData)
          const pinShouldPass = pinRegex.test(arbitraryPin)

          // Si el PIN es inválido, el parse debe fallar
          // Si el PIN es válido, el parse debe pasar (todos los demás campos son válidos)
          if (!pinShouldPass) {
            expect(result.success).toBe(false)
          } else {
            expect(result.success).toBe(true)
          }
        }
      ),
      { numRuns: 300 }
    )
  })
})
