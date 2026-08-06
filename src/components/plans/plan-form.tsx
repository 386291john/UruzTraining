'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import type { Plan, PlanFormData } from '@/hooks/use-plans'

/**
 * Form schema for plan creation/editing.
 * The "unlimited" checkbox controls whether allowed_days is null.
 */
const planFormSchema = z
  .object({
    name: z
      .string()
      .min(1, 'El nombre es obligatorio.')
      .max(100, 'El nombre no puede exceder 100 caracteres.'),
    unlimited: z.boolean(),
    allowed_days: z
      .union([z.coerce.number().int().min(1, 'Debe ser al menos 1 día.'), z.literal('')])
      .optional(),
    vigency_weeks: z.coerce
      .number()
      .int('Debe ser un entero.')
      .min(1, 'Debe ser al menos 1 semana.'),
    price: z.coerce
      .number()
      .min(0, 'El precio no puede ser negativo.'),
    status: z.enum(['active', 'inactive']),
    description: z.string().max(500, 'Máximo 500 caracteres.').optional(),
  })
  .refine(
    (data) => {
      if (!data.unlimited) {
        return data.allowed_days !== '' && data.allowed_days !== undefined
      }
      return true
    },
    {
      message: 'Los días permitidos son obligatorios si no es ilimitado.',
      path: ['allowed_days'],
    }
  )

type PlanFormValues = z.infer<typeof planFormSchema>

interface PlanFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan?: Plan | null
  onSubmit: (data: PlanFormData) => Promise<void>
  isSubmitting?: boolean
}

/**
 * Dialog form for creating or editing a plan.
 * Uses react-hook-form with Zod resolver for validation.
 * Checkbox "Días ilimitados" disables the allowed_days input.
 *
 * Validates: Requirements 2.1, 2.7, 2.8
 */
export function PlanForm({
  open,
  onOpenChange,
  plan,
  onSubmit,
  isSubmitting = false,
}: PlanFormProps) {
  const isEditing = !!plan

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema) as any,
    defaultValues: {
      name: '',
      unlimited: false,
      allowed_days: '',
      vigency_weeks: 1,
      price: 0,
      status: 'active',
      description: '',
    },
  })

  // Reset form when dialog opens or plan changes
  useEffect(() => {
    if (open) {
      if (plan) {
        form.reset({
          name: plan.name,
          unlimited: plan.allowed_days === null,
          allowed_days: plan.allowed_days ?? '',
          vigency_weeks: plan.vigency_weeks,
          price: plan.price,
          status: plan.status as 'active' | 'inactive',
          description: plan.description ?? '',
        })
      } else {
        form.reset({
          name: '',
          unlimited: false,
          allowed_days: '',
          vigency_weeks: 1,
          price: 0,
          status: 'active',
          description: '',
        })
      }
    }
  }, [open, plan, form])

  const unlimited = form.watch('unlimited')

  async function handleSubmit(values: PlanFormValues) {
    const formData: PlanFormData = {
      name: values.name,
      allowed_days: values.unlimited ? null : (values.allowed_days as number),
      vigency_weeks: values.vigency_weeks,
      price: values.price,
      status: values.status,
      description: values.description || null,
    }

    await onSubmit(formData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Plan' : 'Nuevo Plan'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica los datos del plan.'
              : 'Completa los datos para crear un nuevo plan.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Plan Mensual" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Unlimited checkbox */}
            <FormField
              control={form.control}
              name="unlimited"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked)
                        if (checked) {
                          form.setValue('allowed_days', '')
                        }
                      }}
                    />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">
                    Días ilimitados
                  </FormLabel>
                </FormItem>
              )}
            />

            {/* Allowed days */}
            <FormField
              control={form.control}
              name="allowed_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Días permitidos</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Ej: 30"
                      disabled={unlimited}
                      {...field}
                      value={unlimited ? '' : field.value}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Vigency weeks */}
            <FormField
              control={form.control}
              name="vigency_weeks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Semanas de vigencia</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} placeholder="Ej: 4" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Price */}
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Precio</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} step="0.01" placeholder="Ej: 50000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar estado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="inactive">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descripción opcional del plan..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
