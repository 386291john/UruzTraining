'use client'

import { Settings, Save, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/hooks/use-auth'
import { useSettings } from '@/hooks/use-settings'

/**
 * Settings page for system configuration.
 * Admins can edit and save settings; instructors view in read-only mode.
 *
 * Validates: Requirements 5.5, 9.1, 9.4, 13.4
 */
export default function SettingsPage() {
  const { user } = useAuth()
  const { settings, isLoading, savingKey, updateLocal, saveSetting } = useSettings()

  const isAdmin = user?.role === 'admin'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-muted-foreground" />
          <h2 className="text-2xl font-bold tracking-tight">Configuración</h2>
        </div>
        {!isAdmin && (
          <Badge variant="secondary">Solo lectura</Badge>
        )}
      </div>

      {/* Section: Vigencia */}
      <Card>
        <CardHeader>
          <CardTitle>Vigencia</CardTitle>
          <CardDescription>
            Reglas de cálculo para fechas de inicio de membresía.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="weekend_start_rule">Regla de inicio de fin de semana</Label>
              <p className="text-sm text-muted-foreground">
                Si está activa, las membresías adquiridas en fin de semana inician el conteo de semanas el lunes siguiente.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="weekend_start_rule"
                  checked={settings.weekend_start_rule.active}
                  disabled={!isAdmin}
                  onCheckedChange={(checked) =>
                    updateLocal('weekend_start_rule', { active: checked })
                  }
                  aria-label="Regla de inicio de fin de semana"
                />
                <span className="text-sm font-medium min-w-[55px]">
                  {settings.weekend_start_rule.active ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={savingKey === 'weekend_start_rule'}
                  onClick={() => saveSetting('weekend_start_rule')}
                >
                  {savingKey === 'weekend_start_rule' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <><Save className="h-4 w-4 mr-1" /> Guardar</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section: Notificaciones */}
      <Card>
        <CardHeader>
          <CardTitle>Notificaciones</CardTitle>
          <CardDescription>
            Configuración de alertas de vencimiento de membresías.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Umbral de notificación */}
          <div className="flex items-end justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="notification_threshold_days">Umbral de notificación (días antes de vencimiento)</Label>
              <Input
                id="notification_threshold_days"
                type="number"
                value={settings.notification_threshold_days.days}
                min={1}
                max={30}
                disabled={!isAdmin}
                onChange={(e) =>
                  updateLocal('notification_threshold_days', { days: Number(e.target.value) })
                }
                className="max-w-[200px]"
              />
            </div>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                disabled={savingKey === 'notification_threshold_days'}
                onClick={() => saveSetting('notification_threshold_days')}
              >
                {savingKey === 'notification_threshold_days' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <><Save className="h-4 w-4 mr-1" /> Guardar</>
                )}
              </Button>
            )}
          </div>

          {/* Hora de verificación */}
          <div className="flex items-end justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="notification_time_hour">Hora de verificación diaria</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="notification_time_hour"
                  type="number"
                  value={settings.notification_time.hour}
                  min={0}
                  max={23}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    updateLocal('notification_time', {
                      hour: Number(e.target.value),
                      minute: settings.notification_time.minute,
                    })
                  }
                  className="w-[80px]"
                  aria-label="Hora"
                />
                <span className="text-muted-foreground font-bold">:</span>
                <Input
                  id="notification_time_minute"
                  type="number"
                  value={settings.notification_time.minute}
                  min={0}
                  max={59}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    updateLocal('notification_time', {
                      hour: settings.notification_time.hour,
                      minute: Number(e.target.value),
                    })
                  }
                  className="w-[80px]"
                  aria-label="Minuto"
                />
              </div>
            </div>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                disabled={savingKey === 'notification_time'}
                onClick={() => saveSetting('notification_time')}
              >
                {savingKey === 'notification_time' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <><Save className="h-4 w-4 mr-1" /> Guardar</>
                )}
              </Button>
            )}
          </div>

          {/* Plantilla de mensaje */}
          <div className="space-y-2">
            <div className="flex items-end justify-between gap-4">
              <Label htmlFor="notification_template">Plantilla de mensaje de notificación</Label>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={savingKey === 'notification_template'}
                  onClick={() => saveSetting('notification_template')}
                >
                  {savingKey === 'notification_template' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <><Save className="h-4 w-4 mr-1" /> Guardar</>
                  )}
                </Button>
              )}
            </div>
            <Textarea
              id="notification_template"
              value={settings.notification_template.template}
              maxLength={1024}
              placeholder="Escribe el mensaje de notificación..."
              disabled={!isAdmin}
              rows={4}
              onChange={(e) =>
                updateLocal('notification_template', { template: e.target.value })
              }
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Placeholders disponibles: <code className="bg-muted px-1 rounded">{'{{nombre}}'}</code>, <code className="bg-muted px-1 rounded">{'{{fecha_vencimiento}}'}</code>
              </p>
              <p className="text-xs text-muted-foreground">
                {settings.notification_template.template.length}/1024 caracteres
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section: Seguridad */}
      <Card>
        <CardHeader>
          <CardTitle>Seguridad</CardTitle>
          <CardDescription>
            Configuración de bloqueo por intentos fallidos de autenticación.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Login lockout minutes */}
          <div className="flex items-end justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="login_lockout_minutes">Bloqueo login — minutos</Label>
              <p className="text-xs text-muted-foreground">
                Tiempo de bloqueo tras exceder intentos fallidos de inicio de sesión.
              </p>
              <Input
                id="login_lockout_minutes"
                type="number"
                value={settings.login_lockout_minutes.minutes}
                min={1}
                max={60}
                disabled={!isAdmin}
                onChange={(e) =>
                  updateLocal('login_lockout_minutes', { minutes: Number(e.target.value) })
                }
                className="max-w-[200px]"
              />
            </div>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                disabled={savingKey === 'login_lockout_minutes'}
                onClick={() => saveSetting('login_lockout_minutes')}
              >
                {savingKey === 'login_lockout_minutes' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <><Save className="h-4 w-4 mr-1" /> Guardar</>
                )}
              </Button>
            )}
          </div>

          {/* Login max attempts */}
          <div className="flex items-end justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="login_max_attempts">Bloqueo login — intentos máximos</Label>
              <p className="text-xs text-muted-foreground">
                Número de intentos de inicio de sesión antes de bloquear.
              </p>
              <Input
                id="login_max_attempts"
                type="number"
                value={settings.login_max_attempts.attempts}
                min={1}
                max={10}
                disabled={!isAdmin}
                onChange={(e) =>
                  updateLocal('login_max_attempts', { attempts: Number(e.target.value) })
                }
                className="max-w-[200px]"
              />
            </div>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                disabled={savingKey === 'login_max_attempts'}
                onClick={() => saveSetting('login_max_attempts')}
              >
                {savingKey === 'login_max_attempts' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <><Save className="h-4 w-4 mr-1" /> Guardar</>
                )}
              </Button>
            )}
          </div>

          {/* PIN lockout minutes */}
          <div className="flex items-end justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="pin_lockout_minutes">Bloqueo PIN — minutos</Label>
              <p className="text-xs text-muted-foreground">
                Tiempo de bloqueo tras exceder intentos fallidos de PIN de ingreso.
              </p>
              <Input
                id="pin_lockout_minutes"
                type="number"
                value={settings.pin_lockout_minutes.minutes}
                min={1}
                max={60}
                disabled={!isAdmin}
                onChange={(e) =>
                  updateLocal('pin_lockout_minutes', { minutes: Number(e.target.value) })
                }
                className="max-w-[200px]"
              />
            </div>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                disabled={savingKey === 'pin_lockout_minutes'}
                onClick={() => saveSetting('pin_lockout_minutes')}
              >
                {savingKey === 'pin_lockout_minutes' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <><Save className="h-4 w-4 mr-1" /> Guardar</>
                )}
              </Button>
            )}
          </div>

          {/* PIN max attempts */}
          <div className="flex items-end justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="pin_max_attempts">Bloqueo PIN — intentos máximos</Label>
              <p className="text-xs text-muted-foreground">
                Número de intentos fallidos de PIN antes de bloquear el ingreso.
              </p>
              <Input
                id="pin_max_attempts"
                type="number"
                value={settings.pin_max_attempts.attempts}
                min={1}
                max={10}
                disabled={!isAdmin}
                onChange={(e) =>
                  updateLocal('pin_max_attempts', { attempts: Number(e.target.value) })
                }
                className="max-w-[200px]"
              />
            </div>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                disabled={savingKey === 'pin_max_attempts'}
                onClick={() => saveSetting('pin_max_attempts')}
              >
                {savingKey === 'pin_max_attempts' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <><Save className="h-4 w-4 mr-1" /> Guardar</>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
