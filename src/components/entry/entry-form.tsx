'use client'

import { useState, useRef, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DoorOpen, Loader2 } from 'lucide-react'

interface EntryFormProps {
  onSubmit: (documentId: string, pin: string) => Promise<void>
  isProcessing: boolean
}

/**
 * Formulario de control de ingreso.
 * Campos: Documento_ID (auto-focus, grande) + PIN (4 dígitos, password).
 * Diseñado para uso rápido y repetido por el staff.
 *
 * Validates: Requirements 6.1, 6.2, 6.7, 13.4, 14.4
 */
export function EntryForm({ onSubmit, isProcessing }: EntryFormProps) {
  const [documentId, setDocumentId] = useState('')
  const [pin, setPin] = useState('')
  const documentInputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    if (!documentId.trim() || !pin.trim()) return

    await onSubmit(documentId.trim(), pin.trim())
    setDocumentId('')
    setPin('')
    documentInputRef.current?.focus()
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center gap-2">
          <DoorOpen className="h-6 w-6 text-primary" />
          <CardTitle className="text-xl">Control de Ingreso</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Document ID */}
          <div className="space-y-2">
            <Label htmlFor="document-id" className="text-base font-medium">
              Documento de Identidad
            </Label>
            <Input
              ref={documentInputRef}
              id="document-id"
              type="text"
              inputMode="numeric"
              placeholder="Número de documento"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              disabled={isProcessing}
              autoFocus
              className="h-12 text-lg"
              autoComplete="off"
            />
          </div>

          {/* PIN */}
          <div className="space-y-2">
            <Label htmlFor="pin" className="text-base font-medium">
              PIN
            </Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              placeholder="4 dígitos"
              value={pin}
              onChange={(e) => {
                // Only allow up to 4 numeric characters
                const value = e.target.value.replace(/\D/g, '').slice(0, 4)
                setPin(value)
              }}
              disabled={isProcessing}
              maxLength={4}
              className="h-12 text-lg tracking-widest"
              autoComplete="off"
            />
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            className="w-full h-14 text-lg font-semibold"
            disabled={isProcessing || !documentId.trim() || pin.length !== 4}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <DoorOpen className="mr-2 h-5 w-5" />
                Registrar Ingreso
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
