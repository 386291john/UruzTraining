'use client'

import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ReportType } from '@/hooks/use-reports'

/** Column definition for the report table */
interface ColumnDef {
  key: string
  label: string
  format?: (value: unknown) => string
  render?: (value: unknown) => React.ReactNode
}

interface ReportTableProps {
  reportType: ReportType
  data: Record<string, unknown>[]
}

/** Format a date string to locale, avoiding timezone shift for date-only strings */
function formatDate(value: unknown): string {
  if (!value || typeof value !== 'string') return '-'
  // For date-only strings (YYYY-MM-DD), parse manually to avoid UTC shift
  const dateOnly = value.split('T')[0]
  const parts = dateOnly.split('-')
  if (parts.length === 3) {
    const [year, month, day] = parts
    return `${parseInt(day)}/${parseInt(month)}/${year}`
  }
  const date = new Date(value)
  if (isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

/** Format a time string (HH:MM:SS or HH:MM) to locale time */
function formatTime(value: unknown): string {
  if (!value || typeof value !== 'string') return '-'
  // If it's just a time string (HH:MM:SS), display HH:MM
  const timeMatch = value.match(/^(\d{2}):(\d{2})/)
  if (timeMatch) return `${timeMatch[1]}:${timeMatch[2]}`
  return String(value)
}

/** Format remaining days — NULL means unlimited, low values get badge treatment */
function formatRemainingDays(value: unknown): string {
  if (value === null || value === undefined) return 'Ilimitado'
  return String(value)
}

/**
 * Render a remaining days cell with urgency badge if needed.
 */
function renderRemainingDays(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <Badge variant="secondary">Ilimitado</Badge>
  }
  const days = Number(value)
  if (days <= 3) {
    return <Badge variant="destructive">{days} días</Badge>
  }
  if (days <= 7) {
    return <Badge variant="default">{days} días</Badge>
  }
  return String(days)
}

/** Column configurations per report type */
const COLUMNS_BY_TYPE: Record<ReportType, ColumnDef[]> = {
  entries: [
    { key: 'entry_date', label: 'Fecha', format: formatDate },
    { key: 'entry_time', label: 'Hora', format: formatTime },
    { key: 'affiliate_name', label: 'Afiliado' },
    { key: 'document_id', label: 'Documento' },
    { key: 'instructor_name', label: 'Instructor' },
  ],
  renewals: [
    { key: 'renewal_date', label: 'Fecha', format: formatDate },
    { key: 'affiliate_name', label: 'Afiliado' },
    { key: 'document_id', label: 'Documento' },
    { key: 'previous_plan_name', label: 'Plan Anterior' },
    { key: 'new_plan_name', label: 'Plan Nuevo' },
    { key: 'instructor_name', label: 'Instructor' },
  ],
  expired: [
    { key: 'full_name', label: 'Nombre' },
    { key: 'document_id', label: 'Documento' },
    { key: 'plan_name', label: 'Plan' },
    { key: 'expiration_date', label: 'Fecha Vencimiento', format: formatDate },
    { key: 'instructor_name', label: 'Instructor' },
  ],
  active: [
    { key: 'full_name', label: 'Nombre' },
    { key: 'document_id', label: 'Documento' },
    { key: 'plan_name', label: 'Plan' },
    { key: 'remaining_days', label: 'Días Restantes', format: formatRemainingDays, render: renderRemainingDays },
    { key: 'expiration_date', label: 'Fecha Vencimiento', format: formatDate },
    { key: 'instructor_name', label: 'Instructor' },
  ],
  expiring: [
    { key: 'full_name', label: 'Nombre' },
    { key: 'document_id', label: 'Documento' },
    { key: 'plan_name', label: 'Plan' },
    { key: 'remaining_days', label: 'Días Restantes', format: formatRemainingDays, render: renderRemainingDays },
    { key: 'expiration_date', label: 'Fecha Vencimiento', format: formatDate },
  ],
  'entries-by-day': [
    { key: 'date', label: 'Fecha', format: formatDate },
    { key: 'count', label: 'Ingresos' },
  ],
  'entries-by-month': [
    { key: 'month', label: 'Mes' },
    { key: 'count', label: 'Ingresos' },
  ],
}

/**
 * Componente genérico de tabla de informes.
 * Renderiza diferentes columnas según el tipo de informe.
 * En móvil muestra tarjetas; en desktop muestra tabla.
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 13.1, 13.4
 */
export function ReportTable({ reportType, data }: ReportTableProps) {
  const columns = COLUMNS_BY_TYPE[reportType] ?? []

  if (data.length === 0) {
    return null
  }

  function getCellValue(row: Record<string, unknown>, col: ColumnDef): string {
    const value = row[col.key]
    if (col.format) return col.format(value)
    if (value === null || value === undefined) return '-'
    return String(value)
  }

  function renderCell(row: Record<string, unknown>, col: ColumnDef): React.ReactNode {
    const value = row[col.key]
    if (col.render) return col.render(value)
    return getCellValue(row, col)
  }

  return (
    <>
      {/* Table with horizontal scroll on all screen sizes */}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className="whitespace-nowrap">{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, idx) => (
              <TableRow key={(row.id as string) ?? (row.affiliate_id as string) ?? idx}>
                {columns.map((col) => (
                  <TableCell key={col.key} className="whitespace-nowrap">
                    {renderCell(row, col)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card view (hidden on md+) */}
      <div className="grid gap-3 md:hidden">
        {data.map((row, idx) => (
          <Card key={(row.id as string) ?? (row.affiliate_id as string) ?? idx}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {getCellValue(row, columns[0])}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {columns.slice(1).map((col) => (
                <div key={col.key} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{col.label}</span>
                  <span className="font-medium">{renderCell(row, col)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
