'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ReportFiltersComponent } from '@/components/reports/report-filters'
import { ReportTable } from '@/components/reports/report-table'
import { useReports, type ReportType, type ReportFilters } from '@/hooks/use-reports'

/** Tab definitions for report types */
const REPORT_TABS: { value: ReportType; label: string }[] = [
  { value: 'entries', label: 'Ingresos' },
  { value: 'renewals', label: 'Renovaciones' },
  { value: 'expired', label: 'Vencidos' },
  { value: 'active', label: 'Activos' },
  { value: 'expiring', label: 'Próximos a Vencer' },
  { value: 'entries-by-day', label: 'Ingresos/Día' },
  { value: 'entries-by-month', label: 'Ingresos/Mes' },
]

const VALID_TABS = REPORT_TABS.map(t => t.value)

/**
 * Página de informes con pestañas por tipo de informe.
 * Permite filtrar por rango de fechas, afiliado e instructor según el tipo.
 * La pestaña "Ingresos" y "Ingresos/Día" muestran por defecto los registros del día actual.
 * Soporta query param ?tab=expiring para navegación directa desde el dashboard.
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 13.4
 */
export default function ReportsPage() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const initialTab: ReportType = (tabParam && VALID_TABS.includes(tabParam as ReportType))
    ? tabParam as ReportType
    : 'entries'

  const [activeTab, setActiveTab] = useState<ReportType>(initialTab)
  const [filters, setFilters] = useState<ReportFilters>({})
  const { data, isLoading, error, message, fetchReport } = useReports()

  // Get today's date for default filters (Colombia timezone via browser locale)
  function getTodayStr(): string {
    const now = new Date()
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now)
    return parts
  }

  // Fetch report when tab changes — entries and entries-by-day default to today
  useEffect(() => {
    if (activeTab === 'entries' || activeTab === 'entries-by-day') {
      const today = getTodayStr()
      const todayFilters = { dateFrom: today, dateTo: today }
      setFilters(todayFilters)
      fetchReport(activeTab, todayFilters)
    } else {
      setFilters({})
      fetchReport(activeTab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  function handleSearch() {
    fetchReport(activeTab, filters)
  }

  function handleTabChange(value: string) {
    setActiveTab(value as ReportType)
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Informes</h2>
          <p className="text-muted-foreground">
            Consulta historial de ingresos, renovaciones y estado de membresías.
          </p>
        </div>
      </div>

      {/* Tabs for report types */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          {REPORT_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {REPORT_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="space-y-4">
            {/* Filters */}
            <ReportFiltersComponent
              reportType={tab.value}
              filters={filters}
              onFiltersChange={setFilters}
              onSearch={handleSearch}
              isLoading={isLoading}
            />

            {/* Loading state */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Cargando informe...</p>
              </div>
            )}

            {/* Error state */}
            {!isLoading && error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Empty state */}
            {!isLoading && !error && data.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">
                  {message || 'No se encontraron resultados para los filtros aplicados.'}
                </p>
              </div>
            )}

            {/* Data table */}
            {!isLoading && !error && data.length > 0 && (
              <div>
                <p className="mb-2 text-sm text-muted-foreground">
                  {data.length} resultado{data.length !== 1 ? 's' : ''} encontrado{data.length !== 1 ? 's' : ''}
                </p>
                <ReportTable reportType={tab.value} data={data} />
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
