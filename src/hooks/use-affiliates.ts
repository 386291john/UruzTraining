'use client'

import { useState, useCallback } from 'react'
import { toast } from '@/hooks/use-toast'

/**
 * Affiliate type matching the search API response shape.
 */
export interface AffiliateSearchResult {
  id: string
  document_id: string
  full_name: string
  phone: string | null
  plan_name: string | null
  status: string
  expiration_date: string | null
}

/**
 * Renewal history entry type.
 */
export interface RenewalHistoryEntry {
  renewed_at: string
  previous_plan_name: string
  new_plan_name: string
  instructor_id: string | null
  unused_days: number | null
  observations: string | null
}

/**
 * Affiliate profile type from GET /api/affiliates/[id]
 */
export interface AffiliateProfile {
  id: string
  document_id: string
  full_name: string
  phone: string | null
  birth_date: string | null
  observations: string | null
  instructor_id: string
  created_at: string
  updated_at: string
  membership: {
    plan_name: string
    allowed_days: number | null
    days_remaining: number | null
    expiration_date: string | null
    status: string
  } | null
  renewal_history?: RenewalHistoryEntry[]
}

export interface AffiliateFormData {
  document_id: string
  full_name: string
  pin: string
  birth_date: string
  phone: string
  plan_id: string
  observations?: string | null
}

export interface RenewAffiliateData {
  newPlanId: string
  newInstructorId?: string
  observations?: string
}

export type SearchField = 'document_id' | 'full_name' | 'phone'

interface PaginatedSearchResponse {
  data: AffiliateSearchResult[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface UseAffiliatesReturn {
  results: AffiliateSearchResult[]
  total: number
  page: number
  totalPages: number
  isLoading: boolean
  error: string | null
  profile: AffiliateProfile | null
  isLoadingProfile: boolean
  searchAffiliates: (term: string, field: SearchField, page?: number) => Promise<void>
  registerAffiliate: (data: AffiliateFormData) => Promise<{ id: string } | null>
  updatePin: (id: string, pin: string) => Promise<boolean>
  getProfile: (id: string) => Promise<void>
  renewAffiliate: (id: string, data: RenewAffiliateData) => Promise<boolean>
}

/**
 * Hook para operaciones de afiliados:
 * búsqueda paginada (max 20), registro, actualización de PIN, y consulta de perfil.
 *
 * Validates: Requirements 3.1, 3.8, 4.1, 4.2, 4.3, 4.6, 4.7, 4.8, 7.1
 */
export function useAffiliates(): UseAffiliatesReturn {
  const [results, setResults] = useState<AffiliateSearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<AffiliateProfile | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)

  const searchAffiliates = useCallback(
    async (term: string, field: SearchField, pageNum: number = 1) => {
      setIsLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          search: term,
          field,
          page: pageNum.toString(),
        })

        const res = await fetch(`/api/affiliates?${params}`)
        const json = await res.json()

        if (!res.ok || !json.success) {
          const msg = json.error?.message || 'Error al buscar afiliados.'
          setError(msg)
          setResults([])
          return
        }

        const result: PaginatedSearchResponse = json.data
        setResults(result.data)
        setTotal(result.total)
        setPage(result.page)
        setTotalPages(result.totalPages)
      } catch {
        setError('Error de conexión al buscar afiliados.')
        setResults([])
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const registerAffiliate = useCallback(
    async (data: AffiliateFormData): Promise<{ id: string } | null> => {
      try {
        const res = await fetch('/api/affiliates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        const json = await res.json()

        if (!res.ok || !json.success) {
          const msg = json.error?.message || 'Error al registrar afiliado.'
          toast({ title: 'Error', description: msg, variant: 'destructive' })
          return null
        }

        toast({
          title: 'Afiliado registrado',
          description: `${json.data.affiliate?.full_name || json.data.full_name} fue registrado exitosamente.`,
        })
        return { id: json.data.affiliate?.id || json.data.id }
      } catch {
        toast({
          title: 'Error',
          description: 'Error de conexión al registrar afiliado.',
          variant: 'destructive',
        })
        return null
      }
    },
    []
  )

  const updatePin = useCallback(
    async (id: string, pin: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/affiliates/${id}/pin`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin }),
        })

        const json = await res.json()

        if (!res.ok || !json.success) {
          const msg = json.error?.message || 'Error al actualizar el PIN.'
          toast({ title: 'Error', description: msg, variant: 'destructive' })
          return false
        }

        toast({
          title: 'PIN actualizado',
          description: 'El PIN fue actualizado exitosamente.',
        })
        return true
      } catch {
        toast({
          title: 'Error',
          description: 'Error de conexión al actualizar PIN.',
          variant: 'destructive',
        })
        return false
      }
    },
    []
  )

  const getProfile = useCallback(async (id: string) => {
    setIsLoadingProfile(true)
    setProfile(null)

    try {
      const res = await fetch(`/api/affiliates/${id}`)
      const json = await res.json()

      if (!res.ok || !json.success) {
        const msg = json.error?.message || 'Error al obtener perfil.'
        toast({ title: 'Error', description: msg, variant: 'destructive' })
        return
      }

      setProfile(json.data)
    } catch {
      toast({
        title: 'Error',
        description: 'Error de conexión al obtener perfil.',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingProfile(false)
    }
  }, [])

  const renewAffiliate = useCallback(
    async (id: string, data: RenewAffiliateData): Promise<boolean> => {
      try {
        const res = await fetch(`/api/affiliates/${id}/renew`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        const json = await res.json()

        if (!res.ok || !json.success) {
          const msg = json.error?.message || 'Error al renovar membresía.'
          toast({ title: 'Error', description: msg, variant: 'destructive' })
          return false
        }

        toast({
          title: 'Membresía renovada',
          description: 'La membresía fue renovada exitosamente.',
        })
        return true
      } catch {
        toast({
          title: 'Error',
          description: 'Error de conexión al renovar membresía.',
          variant: 'destructive',
        })
        return false
      }
    },
    []
  )

  return {
    results,
    total,
    page,
    totalPages,
    isLoading,
    error,
    profile,
    isLoadingProfile,
    searchAffiliates,
    registerAffiliate,
    updatePin,
    getProfile,
    renewAffiliate,
  }
}
