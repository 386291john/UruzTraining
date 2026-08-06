/**
 * SMS/WhatsApp notification provider — Twilio implementation.
 * Primary channel: SMS via Twilio phone number.
 * Fallback/Future: WhatsApp Content Templates (when Meta verifies the account).
 *
 * Configuration via environment variables:
 * - TWILIO_ACCOUNT_SID: Your Twilio Account SID
 * - TWILIO_AUTH_TOKEN: Your Twilio Auth Token
 * - TWILIO_SMS_FROM: Phone number for SMS (format: +19706993673)
 * - TWILIO_WHATSAPP_FROM: WhatsApp sender (format: whatsapp:+15553734946)
 *
 * Validates: Requirements 9.5
 */

import type { INotificationProvider, NotificationPayload, NotificationResult } from '@/services/notification.service'

/** Payload for sending a message using a Twilio Content Template */
export interface TemplatePayload {
  recipientPhone: string
  contentSid: string
  contentVariables: Record<string, string>
}

/**
 * Notification provider using Twilio.
 * Sends SMS as primary channel. WhatsApp templates available as future upgrade.
 */
export class WhatsAppNotificationProvider implements INotificationProvider {
  private accountSid: string
  private authToken: string
  private smsFrom: string
  private whatsappFrom: string

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID ?? ''
    this.authToken = process.env.TWILIO_AUTH_TOKEN ?? ''
    this.smsFrom = process.env.TWILIO_SMS_FROM ?? '+19706993673'
    this.whatsappFrom = process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+15553734946'
  }

  /**
   * Sends an SMS notification via Twilio.
   */
  async send(payload: NotificationPayload): Promise<NotificationResult> {
    if (!payload.recipientPhone || payload.recipientPhone.trim().length === 0) {
      return { success: false, error: 'Número de teléfono del destinatario no proporcionado.' }
    }

    if (!this.accountSid || !this.authToken) {
      console.warn('[SMS Provider] Twilio no configurado. Simulando envío.')
      console.log('[SMS Provider] Mensaje simulado:', {
        to: payload.recipientPhone,
        message: payload.message,
      })
      return { success: true, messageId: `simulated_${Date.now()}` }
    }

    try {
      const toNumber = this.formatPhoneNumber(payload.recipientPhone)
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`
      const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')

      const body = new URLSearchParams({
        From: this.smsFrom,
        To: toNumber,
        Body: payload.message,
      })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMsg = data.message || data.error_message || `Error HTTP ${response.status}`
        console.error('[SMS Provider] Error de Twilio:', errorMsg)
        return { success: false, error: errorMsg }
      }

      console.log(`[SMS Provider] Mensaje enviado. SID: ${data.sid}`)
      return { success: true, messageId: data.sid }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido al enviar SMS'
      console.error('[SMS Provider] Excepción:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * Sends a notification using template variables — builds plain text SMS.
   * When WhatsApp is verified, this can switch to ContentSid + ContentVariables.
   */
  async sendWithTemplate(payload: TemplatePayload): Promise<NotificationResult> {
    if (!payload.recipientPhone || payload.recipientPhone.trim().length === 0) {
      return { success: false, error: 'Número de teléfono del destinatario no proporcionado.' }
    }

    // Build plain text message from template variables
    const vars = payload.contentVariables
    let message: string

    // Detect welcome vs expiration based on number of variables
    if (vars['5']) {
      // Welcome: 1=nombre, 2=plan, 3=dias, 4=semanas, 5=vencimiento
      message = `Bienvenido a UruzTraining, ${vars['1']}! Tu plan: ${vars['2']} - ${vars['3']} dias disponibles para usar en ${vars['4']} semanas (hasta el ${vars['5']}). A entrenar!`
    } else {
      // Expiration: 1=nombre, 2=vencimiento, 3=dias_restantes
      message = `Hola ${vars['1']}, tu membresia vence el ${vars['2']} y te quedan ${vars['3']} dias disponibles. Renueva para seguir entrenando!`
    }

    return this.send({
      recipientPhone: payload.recipientPhone,
      affiliateName: vars['1'] || '',
      expirationDate: vars['2'] || '',
      message,
    })
  }

  /**
   * Checks delivery status of a message.
   */
  async getStatus(messageId: string): Promise<'sent' | 'delivered' | 'failed'> {
    if (!this.accountSid || !this.authToken) {
      return 'delivered'
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages/${messageId}.json`
      const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')

      const response = await fetch(url, {
        headers: { 'Authorization': `Basic ${credentials}` },
      })

      const data = await response.json()

      switch (data.status) {
        case 'delivered':
        case 'read':
          return 'delivered'
        case 'sent':
        case 'queued':
        case 'sending':
        case 'accepted':
          return 'sent'
        case 'failed':
        case 'undelivered':
          return 'failed'
        default:
          return 'sent'
      }
    } catch {
      return 'sent'
    }
  }

  /**
   * Formats a phone number for SMS.
   * Adds Colombia country code (+57) if not present.
   */
  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace('whatsapp:', '').trim()
    cleaned = cleaned.replace(/\D/g, '')

    if (!cleaned.startsWith('57') && cleaned.length === 10) {
      cleaned = '57' + cleaned
    }

    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned
    }

    return cleaned
  }
}
