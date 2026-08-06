'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AffiliateProfile } from '@/components/affiliates/affiliate-profile'
import { useAffiliates } from '@/hooks/use-affiliates'

/**
 * Affiliate profile page. Fetches and displays profile data by ID.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.6, 4.7, 4.8, 7.1, 13.4
 */
export default function AffiliateProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { profile, isLoadingProfile, getProfile } = useAffiliates()

  const id = params.id as string

  useEffect(() => {
    if (id) {
      getProfile(id)
    }
  }, [id, getProfile])

  if (isLoadingProfile) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Cargando perfil...</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No se pudo cargar el perfil del afiliado.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/affiliates')}
        >
          Volver a búsqueda
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/affiliates')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver
      </Button>

      {/* Profile component */}
      <AffiliateProfile
        profile={profile}
        onPinUpdated={() => getProfile(id)}
        onRenewed={() => getProfile(id)}
      />
    </div>
  )
}
