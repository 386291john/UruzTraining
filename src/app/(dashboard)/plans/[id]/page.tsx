'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PlanForm } from '@/components/plans/plan-form'
import type { Plan, PlanFormData } from '@/hooks/use-plans'
import { toast } from '@/hooks/use-toast'

/**
 * Plan detail page. Displays plan information and allows editing via dialog.
 *
 * Validates: Requirements 2.3, 2.4
 */
export default function PlanDetailPage() {
  const params = useParams()
  const router = useRouter()
  const planId = params.id as string

  const [plan, setPlan] = useState<Plan | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    async function fetchPlan() {
      try {
        const res = await fetch(`/api/plans/${planId}`)
        const json = await res.json()

        if (!res.ok || !json.success) {
          toast({
            title: 'Error',
            description: json.error?.message || 'Plan no encontrado.',
            variant: 'destructive',
          })
          router.push('/plans')
          return
        }

        setPlan(json.data)
      } catch {
        toast({
          title: 'Error',
          description: 'Error de conexión.',
          variant: 'destructive',
        })
        router.push('/plans')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPlan()
  }, [planId, router])

  async function handleSubmit(data: PlanFormData) {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/plans/${planId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        toast({
          title: 'Error',
          description: json.error?.message || 'Error al actualizar.',
          variant: 'destructive',
        })
        return
      }

      setPlan(json.data)
      setFormOpen(false)
      toast({ title: 'Plan actualizado', description: `El plan "${json.data.name}" fue actualizado.` })
    } catch {
      toast({ title: 'Error', description: 'Error de conexión.', variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  function formatPrice(price: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(price)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Cargando plan...</p>
      </div>
    )
  }

  if (!plan) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/plans')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-2xl font-bold tracking-tight">{plan.name}</h2>
          <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
            {plan.status === 'active' ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Edit className="mr-2 h-4 w-4" />
          Editar
        </Button>
      </div>

      {/* Plan details */}
      <Card>
        <CardHeader>
          <CardTitle>Detalles del Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Días permitidos</dt>
              <dd className="mt-1 text-sm">
                {plan.allowed_days === null ? (
                  <Badge variant="secondary">Ilimitado</Badge>
                ) : (
                  `${plan.allowed_days} días`
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Vigencia</dt>
              <dd className="mt-1 text-sm">{plan.vigency_weeks} semanas</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Precio</dt>
              <dd className="mt-1 text-sm">{formatPrice(plan.price)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Estado</dt>
              <dd className="mt-1 text-sm capitalize">{plan.status === 'active' ? 'Activo' : 'Inactivo'}</dd>
            </div>
            {plan.description && (
              <div className="col-span-full">
                <dt className="text-sm font-medium text-muted-foreground">Descripción</dt>
                <dd className="mt-1 text-sm">{plan.description}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Edit form dialog */}
      <PlanForm
        open={formOpen}
        onOpenChange={setFormOpen}
        plan={plan}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
