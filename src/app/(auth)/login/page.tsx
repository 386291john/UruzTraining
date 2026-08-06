'use client'

import { Suspense, useState, useEffect, FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sessionMessage, setSessionMessage] = useState<string | null>(null)
  const { login, isLoading, error } = useAuth()
  const searchParams = useSearchParams()

  useEffect(() => {
    const message = searchParams.get('message')
    if (message === 'session_expired') {
      setSessionMessage('Tu sesión ha expirado. Inicia sesión nuevamente.')
    }
  }, [searchParams])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSessionMessage(null)
    await login(email, password)
  }

  const isLockout = error?.includes('bloqueada')

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">UruzTraining</CardTitle>
        <CardDescription>
          Ingresa tus credenciales para acceder al sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {sessionMessage && (
            <div
              role="alert"
              className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800"
            >
              {sessionMessage}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className={`rounded-md p-3 text-sm ${
                isLockout
                  ? 'bg-orange-50 border border-orange-200 text-orange-800'
                  : 'bg-destructive/10 border border-destructive/20 text-destructive'
              }`}
            >
              {isLockout ? (
                <span className="font-medium">Cuenta bloqueada — </span>
              ) : null}
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@correo.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Ingresando...' : 'Iniciar sesión'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">UruzTraining</CardTitle>
          <CardDescription>Cargando...</CardDescription>
        </CardHeader>
      </Card>
    }>
      <LoginForm />
    </Suspense>
  )
}
