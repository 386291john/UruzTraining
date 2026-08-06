'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from '@/hooks/use-toast'

/**
 * Plan type matching API response shape.
 */
export interface Plan {
  id: string
  name: string
  allowed_days: number | null
  vigency_weeks: number
  price: number
  status: 'active' | 'inactive'
  description: string | null
  instructor_id: string
  created_at: string
  updated_at: string
}

export interface PlanFormData {
  name: string
  allowed_days: number | null
  vigency_weeks: number
  price: number
  status: 'active' | 'inactive'
  description?: string | null
}

interface PaginatedResponse {
  data: Plan[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface UsePlansReturn {
  plans: Plan[]
  total: number
  page: number
  totalPages: number
  isLoading: boolean
  error: string | null
  fetchPlans: (page?: number) => Promise<void>
  createPlan: (data: PlanFormData) => Promise<Plan | null>
  updatePlan: (id: string, data: Partial<PlanFormData>) => Promise<Plan | null>
  deletePlan: (id: string) => Promise<boolean>
}

/**
 * Hook para operaciones CRUD de planes.
 * Consume los endpoints /api/plans y maneja estados de carga y error.
 *
 * Validates: Requirements 2.1, 2.3, 2.4, 2.7, 2.8
 */
export function usePlans(): UsePlansReturn {
  const [plans, setPlans] = useState<Plan[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPlans = useCallback(async (pageNum: number = 1) => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/plans?page=${pageNum}&pageSize=20`)
      const json = await res.json()

      if (!res.ok || !json.success) {
        const msg = json.error?.message || 'Error al obtener planes.'
        setError(msg)
        return
      }

      const result: PaginatedResponse = json.data
      setPlans(result.data)
      setTotal(result.total)
      setPage(result.page)
      setTotalPages(result.totalPages)
    } catch {
      setError('Error de conexión al obtener planes.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  const createPlan = useCallback(
    async (data: PlanFormData): Promise<Plan | null> => {
      try {
        const res = await fetch('/api/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        const json = await res.json()

        if (!res.ok || !json.success) {
          const msg = json.error?.message || 'Error al crear el plan.'
          toast({ title: 'Error', description: msg, variant: 'destructive' })
          return null
        }

        toast({ title: 'Plan creado', description: `El plan "${json.data.name}" fue creado exitosamente.` })
        await fetchPlans(page)
        return json.data
      } catch {
        toast({ title: 'Error', description: 'Error de conexión al crear el plan.', variant: 'destructive' })
        return null
      }
    },
    [fetchPlans, page]
  )

  const updatePlan = useCallback(
    async (id: string, data: Partial<PlanFormData>): Promise<Plan | null> => {
      try {
        const res = await fetch(`/api/plans/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        const json = await res.json()

        if (!res.ok || !json.success) {
          const msg = json.error?.message || 'Error al actualizar el plan.'
          toast({ title: 'Error', description: msg, variant: 'destructive' })
          return null
        }

        toast({ title: 'Plan actualizado', description: `El plan "${json.data.name}" fue actualizado.` })
        await fetchPlans(page)
        return json.data
      } catch {
        toast({ title: 'Error', description: 'Error de conexión al actualizar el plan.', variant: 'destructive' })
        return null
      }
    },
    [fetchPlans, page]
  )

  const deletePlan = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/plans/${id}`, {
          method: 'DELETE',
        })

        const json = await res.json()

        if (!res.ok || !json.success) {
          const msg = json.error?.message || 'Error al eliminar el plan.'
          toast({ title: 'Error', description: msg, variant: 'destructive' })
          return false
        }

        toast({ title: 'Plan eliminado', description: 'El plan fue eliminado exitosamente.' })
        await fetchPlans(page)
        return true
      } catch {
        toast({ title: 'Error', description: 'Error de conexión al eliminar el plan.', variant: 'destructive' })
        return false
      }
    },
    [fetchPlans, page]
  )

  return {
    plans,
    total,
    page,
    totalPages,
    isLoading,
    error,
    fetchPlans,
    createPlan,
    updatePlan,
    deletePlan,
  }
}
