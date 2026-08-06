'use client'

import { useState } from 'react'
import { Plus, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlanForm } from '@/components/plans/plan-form'
import { PlanList } from '@/components/plans/plan-list'
import { usePlans, type Plan, type PlanFormData } from '@/hooks/use-plans'

/**
 * Plans management page.
 * Shows list of plans with create/edit/delete functionality.
 *
 * Validates: Requirements 2.1, 2.3, 2.4, 2.7, 2.8
 */
export default function PlansPage() {
  const { plans, isLoading, createPlan, updatePlan, deletePlan, fetchPlans, page, totalPages } = usePlans()
  const [formOpen, setFormOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleCreate() {
    setEditingPlan(null)
    setFormOpen(true)
  }

  function handleEdit(plan: Plan) {
    setEditingPlan(plan)
    setFormOpen(true)
  }

  async function handleSubmit(data: PlanFormData) {
    setIsSubmitting(true)
    try {
      if (editingPlan) {
        const result = await updatePlan(editingPlan.id, data)
        if (result) {
          setFormOpen(false)
          setEditingPlan(null)
        }
      } else {
        const result = await createPlan(data)
        if (result) {
          setFormOpen(false)
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string): Promise<boolean> {
    return deletePlan(id)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-muted-foreground" />
          <h2 className="text-2xl font-bold tracking-tight">Planes</h2>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Plan
        </Button>
      </div>

      {/* Plan list */}
      <PlanList
        plans={plans}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => fetchPlans(page - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => fetchPlans(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* Form dialog */}
      <PlanForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditingPlan(null)
        }}
        plan={editingPlan}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
