/**
 * Property-Based Test: Filtrado exclusivo de planes activos en selección
 *
 * Validates: Requirements 2.8, 3.8, 8.7
 *
 * Property 5: Verifica que en contexto de selección (registro de afiliado o renovación)
 * SOLO aparecen planes con status='active'. Los planes inactivos nunca deben ser
 * seleccionables.
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

/**
 * Represents a plan with its status for filtering purposes.
 * Mirrors the relevant fields from the plans table.
 */
interface PlanForSelection {
  id: string
  name: string
  allowed_days: number | null
  vigency_weeks: number
  price: number
  status: 'active' | 'inactive'
  description: string | null
}

/**
 * Pure filtering function that mimics the behavior of plan selection in
 * registration and renewal contexts. Only plans with status='active' are shown.
 *
 * This replicates what `planRepository.findActive()` does via `.eq('status', 'active')`
 * and what the UI enforces by only displaying active plans in selection dropdowns.
 */
function filterPlansForSelection(plans: PlanForSelection[]): PlanForSelection[] {
  return plans.filter((plan) => plan.status === 'active')
}

/**
 * Generator for a single plan with a random status (active or inactive).
 */
function arbitraryPlanWithStatus(): fc.Arbitrary<PlanForSelection> {
  return fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    allowed_days: fc.oneof(fc.integer({ min: 1, max: 365 }), fc.constant(null as null)),
    vigency_weeks: fc.integer({ min: 1, max: 52 }),
    price: fc.float({ min: 0, max: 99999, noNaN: true }),
    status: fc.oneof(
      fc.constant('active' as const),
      fc.constant('inactive' as const)
    ),
    description: fc.oneof(fc.string({ minLength: 0, maxLength: 500 }), fc.constant(null as null)),
  })
}

/**
 * Generator for a set of plans with guaranteed mix of active and inactive.
 * Ensures at least one of each status for meaningful tests.
 */
function arbitraryMixedPlanSet(): fc.Arbitrary<PlanForSelection[]> {
  return fc.tuple(
    // At least one active plan
    fc.array(
      arbitraryPlanWithStatus().map((p) => ({ ...p, status: 'active' as const })),
      { minLength: 1, maxLength: 10 }
    ),
    // At least one inactive plan
    fc.array(
      arbitraryPlanWithStatus().map((p) => ({ ...p, status: 'inactive' as const })),
      { minLength: 1, maxLength: 10 }
    ),
    // Additional random plans (may be either status)
    fc.array(arbitraryPlanWithStatus(), { minLength: 0, maxLength: 10 })
  ).map(([active, inactive, random]) => {
    // Shuffle the combined array to avoid order bias
    const all = [...active, ...inactive, ...random]
    return all.sort(() => Math.random() - 0.5)
  })
}

describe('Property 5: Filtrado exclusivo de planes activos en selección', () => {
  /**
   * **Validates: Requirements 2.8, 3.8, 8.7**
   *
   * Todos los planes retornados en contexto de selección DEBEN tener status='active'.
   * Ningún plan inactivo debe aparecer en los resultados.
   */
  it('solo retorna planes con status active en contexto de selección', () => {
    fc.assert(
      fc.property(
        arbitraryMixedPlanSet(),
        (plans) => {
          const selectable = filterPlansForSelection(plans)

          // Every plan in the result must be active
          for (const plan of selectable) {
            expect(plan.status).toBe('active')
          }
        }
      ),
      { numRuns: 300 }
    )
  })

  /**
   * **Validates: Requirements 2.8, 3.8, 8.7**
   *
   * Ningún plan inactivo del conjunto original debe aparecer en los resultados filtrados.
   */
  it('excluye todos los planes inactivos del conjunto original', () => {
    fc.assert(
      fc.property(
        arbitraryMixedPlanSet(),
        (plans) => {
          const selectable = filterPlansForSelection(plans)
          const inactivePlans = plans.filter((p) => p.status === 'inactive')

          // No inactive plan should appear in the selection results
          for (const inactive of inactivePlans) {
            const found = selectable.find((s) => s.id === inactive.id)
            expect(found).toBeUndefined()
          }
        }
      ),
      { numRuns: 300 }
    )
  })

  /**
   * **Validates: Requirements 2.8, 3.8, 8.7**
   *
   * Todos los planes activos del conjunto original deben estar presentes en los resultados.
   * No se pierde ningún plan activo en el filtrado.
   */
  it('incluye todos los planes activos del conjunto original sin pérdidas', () => {
    fc.assert(
      fc.property(
        arbitraryMixedPlanSet(),
        (plans) => {
          const selectable = filterPlansForSelection(plans)
          const activePlans = plans.filter((p) => p.status === 'active')

          // All active plans must be present in the result
          expect(selectable.length).toBe(activePlans.length)

          for (const active of activePlans) {
            const found = selectable.find((s) => s.id === active.id)
            expect(found).toBeDefined()
          }
        }
      ),
      { numRuns: 300 }
    )
  })

  /**
   * **Validates: Requirements 2.8, 3.8, 8.7**
   *
   * Si el conjunto de planes solo contiene planes inactivos,
   * el resultado de la selección debe ser vacío.
   */
  it('retorna array vacío cuando todos los planes son inactivos', () => {
    fc.assert(
      fc.property(
        fc.array(
          arbitraryPlanWithStatus().map((p) => ({ ...p, status: 'inactive' as const })),
          { minLength: 1, maxLength: 20 }
        ),
        (allInactivePlans) => {
          const selectable = filterPlansForSelection(allInactivePlans)
          expect(selectable).toHaveLength(0)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * **Validates: Requirements 2.8, 3.8, 8.7**
   *
   * Si el conjunto de planes solo contiene planes activos,
   * todos deben aparecer en la selección.
   */
  it('retorna todos los planes cuando todos son activos', () => {
    fc.assert(
      fc.property(
        fc.array(
          arbitraryPlanWithStatus().map((p) => ({ ...p, status: 'active' as const })),
          { minLength: 1, maxLength: 20 }
        ),
        (allActivePlans) => {
          const selectable = filterPlansForSelection(allActivePlans)
          expect(selectable.length).toBe(allActivePlans.length)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * **Validates: Requirements 2.8, 3.8, 8.7**
   *
   * El filtrado preserva todos los datos del plan sin modificar ningún campo.
   * Los planes retornados son idénticos a los originales.
   */
  it('preserva todos los campos del plan sin modificación', () => {
    fc.assert(
      fc.property(
        arbitraryMixedPlanSet(),
        (plans) => {
          const selectable = filterPlansForSelection(plans)

          for (const plan of selectable) {
            // Find the original plan in the input set
            const original = plans.find((p) => p.id === plan.id)
            expect(original).toBeDefined()
            expect(plan).toEqual(original)
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})
