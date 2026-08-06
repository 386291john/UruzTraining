'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'
import type { ReportType, ReportFilters } from '@/hooks/use-reports'

interface ReportFiltersProps {
  reportType: ReportType
  filters: ReportFilters
  onFiltersChange: (filters: ReportFilters) => void
  onSearch: () => void
  isLoading: boolean
}

/** Reports that accept date range filters */
const DATE_FILTERABLE_REPORTS: ReportType[] = [
  'entries',
  'renewals',
  'entries-by-day',
  'entries-by-month',
]

/** Reports that accept affiliate/instructor filters */
const ENTITY_FILTERABLE_REPORTS: ReportType[] = [
  'entries',
  'renewals',
]

/**
 * Componente de filtros para informes.
 * Muestra controles de rango de fechas y filtros opcionales de afiliado/instructor
 * según el tipo de informe seleccionado.
 *
 * Validates: Requirements 11.1, 11.2, 11.6, 11.7
 */
export function ReportFiltersComponent({
  reportType,
  filters,
  onFiltersChange,
  onSearch,
  isLoading,
}: ReportFiltersProps) {
  const showDateFilters = DATE_FILTERABLE_REPORTS.includes(reportType)
  const showEntityFilters = ENTITY_FILTERABLE_REPORTS.includes(reportType)

  function handleChange(field: keyof ReportFilters, value: string) {
    onFiltersChange({ ...filters, [field]: value || undefined })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSearch()
  }

  // Reports without any filter still show a search button
  if (!showDateFilters && !showEntityFilters) {
    return (
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <Button type="submit" disabled={isLoading} size="sm">
          <Search className="mr-1 h-4 w-4" />
          {isLoading ? 'Cargando...' : 'Consultar'}
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {showDateFilters && (
          <>
            <div className="space-y-1">
              <label htmlFor="dateFrom" className="text-sm font-medium text-muted-foreground">
                Desde
              </label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom ?? ''}
                onChange={(e) => handleChange('dateFrom', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="dateTo" className="text-sm font-medium text-muted-foreground">
                Hasta
              </label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo ?? ''}
                onChange={(e) => handleChange('dateTo', e.target.value)}
              />
            </div>
          </>
        )}
        {showEntityFilters && (
          <>
            <div className="space-y-1">
              <label htmlFor="affiliateId" className="text-sm font-medium text-muted-foreground">
                ID Afiliado
              </label>
              <Input
                id="affiliateId"
                type="text"
                placeholder="UUID del afiliado"
                value={filters.affiliateId ?? ''}
                onChange={(e) => handleChange('affiliateId', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="instructorId" className="text-sm font-medium text-muted-foreground">
                ID Instructor
              </label>
              <Input
                id="instructorId"
                type="text"
                placeholder="UUID del instructor"
                value={filters.instructorId ?? ''}
                onChange={(e) => handleChange('instructorId', e.target.value)}
              />
            </div>
          </>
        )}
      </div>
      <Button type="submit" disabled={isLoading} size="sm">
        <Search className="mr-1 h-4 w-4" />
        {isLoading ? 'Cargando...' : 'Consultar'}
      </Button>
    </form>
  )
}
