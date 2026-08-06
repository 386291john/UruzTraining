'use client'

import { useRouter } from 'next/navigation'
import { Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AffiliateSearch } from '@/components/affiliates/affiliate-search'

/**
 * Affiliates main page with search and register button.
 *
 * Validates: Requirements 3.1, 3.8, 13.4
 */
export default function AffiliatesPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Afiliados</h1>
        </div>
        <Button onClick={() => router.push('/affiliates/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Registrar
        </Button>
      </div>

      {/* Search component */}
      <AffiliateSearch />
    </div>
  )
}
