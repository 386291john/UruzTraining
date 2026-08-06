'use client'

import { DoorOpen } from 'lucide-react'
import { useEntry } from '@/hooks/use-entry'
import { EntryForm } from '@/components/entry/entry-form'
import { EntryResultView } from '@/components/entry/entry-result'

/**
 * Página de control de ingreso al gimnasio.
 * Muestra el formulario cuando no hay resultado, y el resultado cuando existe.
 * Diseño limpio y minimalista para uso repetitivo durante toda la jornada.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 13.4, 14.4
 */
export default function EntryPage() {
  const { validateEntry, lastResult, isProcessing, clearResult } = useEntry()

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-8">
        <DoorOpen className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Control de Ingreso</h1>
      </div>

      {/* Content: Form or Result */}
      {lastResult ? (
        <EntryResultView result={lastResult} onClear={clearResult} />
      ) : (
        <EntryForm onSubmit={validateEntry} isProcessing={isProcessing} />
      )}
    </div>
  )
}
