'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { useAffiliates, type SearchField } from '@/hooks/use-affiliates'

/**
 * Affiliate search component with auto-load on mount, real-time filtering,
 * field selector, results table, and pagination (max 20 per page).
 *
 * - Loads all affiliates when the page opens
 * - Filters as you type (after 3 characters)
 * - Shows full list when search is empty
 *
 * Validates: Requirements 3.1, 3.8, 4.1, 4.2, 4.3, 13.4
 */
export function AffiliateSearch() {
  const router = useRouter()
  const {
    results,
    total,
    page,
    totalPages,
    isLoading,
    error,
    searchAffiliates,
  } = useAffiliates()

  const [field, setField] = useState<SearchField>('full_name')
  const [term, setTerm] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load all affiliates on mount
  useEffect(() => {
    searchAffiliates('___', 'full_name', 1) // Will return all via the API fallback
    // Load all by searching with a broad term — we'll use a special endpoint
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadAll() {
    // Fetch all affiliates (first page) without search term
    try {
      const res = await fetch('/api/affiliates?search=*&field=full_name&page=1')
      // If the API requires min 3 chars, we'll handle it in the search handler
    } catch {
      // silent
    }
    // Use a broad search to load initial list
    searchAffiliates('   ', 'full_name', 1)
  }

  // Debounced search — triggers as the user types
  const handleTermChange = useCallback(
    (value: string) => {
      setTerm(value)

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(() => {
        if (value.length >= 3) {
          searchAffiliates(value, field, 1)
        } else if (value.length === 0) {
          // When cleared, reload all
          searchAffiliates('%%%', field, 1)
        }
      }, 300)
    },
    [field, searchAffiliates]
  )

  function handleSearch(pageNum: number = 1) {
    if (term.length >= 3) {
      searchAffiliates(term, field, pageNum)
    } else {
      searchAffiliates('%%%', field, pageNum)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'active':
        return <Badge variant="default">Activa</Badge>
      case 'expired':
        return <Badge variant="secondary">Vencida</Badge>
      case 'no_membership':
        return <Badge variant="outline">Sin membresía</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—'
    const parts = dateStr.split('T')[0].split('-')
    if (parts.length === 3) {
      const [year, month, day] = parts
      return `${parseInt(day)}/${parseInt(month)}/${year}`
    }
    return dateStr
  }

  return (
    <div className="space-y-4">
      {/* Search controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:w-48">
          <label className="mb-1 block text-sm font-medium">Buscar por</label>
          <Select
            value={field}
            onValueChange={(v) => setField(v as SearchField)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="document_id">Documento</SelectItem>
              <SelectItem value="full_name">Nombre</SelectItem>
              <SelectItem value="phone">Celular</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-1 gap-2">
          <div className="flex-1">
            <Input
              placeholder="Buscar afiliado..."
              value={term}
              onChange={(e) => handleTermChange(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <Button
            onClick={() => handleSearch()}
            disabled={isLoading}
          >
            <Search className="mr-2 h-4 w-4" />
            Buscar
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      )}

      {/* No results */}
      {!isLoading && results.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">No se encontraron afiliados.</p>
        </div>
      )}

      {/* Results table (desktop) */}
      {!isLoading && results.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {total} afiliado{total !== 1 ? 's' : ''}
          </p>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Vencimiento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((affiliate) => (
                  <TableRow
                    key={affiliate.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/affiliates/${affiliate.id}`)}
                  >
                    <TableCell className="font-medium">
                      {affiliate.full_name}
                    </TableCell>
                    <TableCell>{affiliate.document_id}</TableCell>
                    <TableCell>{affiliate.plan_name || '—'}</TableCell>
                    <TableCell>{getStatusBadge(affiliate.status)}</TableCell>
                    <TableCell>
                      {formatDate(affiliate.expiration_date)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Results cards (mobile) */}
          <div className="grid gap-3 md:hidden">
            {results.map((affiliate) => (
              <Card
                key={affiliate.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/affiliates/${affiliate.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{affiliate.full_name}</p>
                    {getStatusBadge(affiliate.status)}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1 text-sm text-muted-foreground">
                    <span>Doc: {affiliate.document_id}</span>
                    <span>Plan: {affiliate.plan_name || '—'}</span>
                    <span className="col-span-2">
                      Vence: {formatDate(affiliate.expiration_date)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => handleSearch(page - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => handleSearch(page + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
