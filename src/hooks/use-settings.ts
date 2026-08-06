'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from '@/hooks/use-toast'

/**
 * Shape of a single config entry from the API.
 */
export interface SettingEntry {
  key: string
  value: Record<string, unknown>
  description: string | null
  updated_at: string | null
}

/**
 * Typed representation of all system settings with their nested values.
 */
export interface SystemSettings {
  weekend_start_rule: { active: boolean }
  notification_threshold_days: { days: number }
  notification_time: { hour: number; minute: number }
  notification_template: { template: string }
  login_lockout_minutes: { minutes: number }
  login_max_attempts: { attempts: number }
  pin_lockout_minutes: { minutes: number }
  pin_max_attempts: { attempts: number }
}

type SettingsMap = Record<string, Record<string, unknown>>

interface UseSettingsReturn {
  settings: SystemSettings
  isLoading: boolean
  savingKey: string | null
  updateLocal: (key: string, value: Record<string, unknown>) => void
  saveSetting: (key: string) => Promise<void>
  refetch: () => Promise<void>
}

const DEFAULT_SETTINGS: SystemSettings = {
  weekend_start_rule: { active: true },
  notification_threshold_days: { days: 2 },
  notification_time: { hour: 6, minute: 0 },
  notification_template: { template: '' },
  login_lockout_minutes: { minutes: 15 },
  login_max_attempts: { attempts: 5 },
  pin_lockout_minutes: { minutes: 15 },
  pin_max_attempts: { attempts: 3 },
}

/**
 * Hook para gestionar la configuración del sistema.
 * Consume GET /api/settings y PUT /api/settings/[key].
 * Maneja estado local, guardado individual por clave, y notificaciones de éxito/error.
 *
 * Validates: Requirements 5.5, 9.1, 9.4, 13.4
 */
export function useSettings(): UseSettingsReturn {
  const [settingsMap, setSettingsMap] = useState<SettingsMap>({})
  const [isLoading, setIsLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/settings')
      const json = await res.json()
      if (json.success && json.data) {
        const map: SettingsMap = {}
        json.data.forEach((entry: SettingEntry) => {
          map[entry.key] = entry.value as Record<string, unknown>
        })
        setSettingsMap(map)
      }
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las configuraciones.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const updateLocal = useCallback((key: string, value: Record<string, unknown>) => {
    setSettingsMap((prev) => ({ ...prev, [key]: value }))
  }, [])

  const saveSetting = useCallback(async (key: string) => {
    const value = settingsMap[key]
    if (!value) return

    setSavingKey(key)
    try {
      const res = await fetch(`/api/settings/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: 'Guardado',
          description: `Configuración actualizada correctamente.`,
        })
      } else {
        toast({
          title: 'Error',
          description: json.error?.message || 'No se pudo guardar la configuración.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Error de conexión al guardar.',
        variant: 'destructive',
      })
    } finally {
      setSavingKey(null)
    }
  }, [settingsMap])

  // Build typed settings from the raw map with safe defaults
  const settings: SystemSettings = {
    weekend_start_rule: {
      active: (settingsMap.weekend_start_rule?.active as boolean) ?? DEFAULT_SETTINGS.weekend_start_rule.active,
    },
    notification_threshold_days: {
      days: (settingsMap.notification_threshold_days?.days as number) ?? DEFAULT_SETTINGS.notification_threshold_days.days,
    },
    notification_time: {
      hour: (settingsMap.notification_time?.hour as number) ?? DEFAULT_SETTINGS.notification_time.hour,
      minute: (settingsMap.notification_time?.minute as number) ?? DEFAULT_SETTINGS.notification_time.minute,
    },
    notification_template: {
      template: (settingsMap.notification_template?.template as string) ?? DEFAULT_SETTINGS.notification_template.template,
    },
    login_lockout_minutes: {
      minutes: (settingsMap.login_lockout_minutes?.minutes as number) ?? DEFAULT_SETTINGS.login_lockout_minutes.minutes,
    },
    login_max_attempts: {
      attempts: (settingsMap.login_max_attempts?.attempts as number) ?? DEFAULT_SETTINGS.login_max_attempts.attempts,
    },
    pin_lockout_minutes: {
      minutes: (settingsMap.pin_lockout_minutes?.minutes as number) ?? DEFAULT_SETTINGS.pin_lockout_minutes.minutes,
    },
    pin_max_attempts: {
      attempts: (settingsMap.pin_max_attempts?.attempts as number) ?? DEFAULT_SETTINGS.pin_max_attempts.attempts,
    },
  }

  return {
    settings,
    isLoading,
    savingKey,
    updateLocal,
    saveSetting,
    refetch: fetchSettings,
  }
}
