import { API } from './api'

export type TelegramConfig = {
  botToken: string
  chatId: string
  enabled: boolean
  cooldownSeconds: number
}

const STORAGE_KEYS = {
  token: 'vision_ai_telegram_bot_token',
  chatId: 'vision_ai_telegram_chat_id',
  enabled: 'vision_ai_telegram_alerts_enabled',
  cooldown: 'vision_ai_telegram_cooldown_seconds'
}

export function getTelegramConfig(): TelegramConfig {
  try {
    const token =
      localStorage.getItem(STORAGE_KEYS.token) ||
      import.meta.env.VITE_TELEGRAM_BOT_TOKEN ||
      ''
    const chatId =
      localStorage.getItem(STORAGE_KEYS.chatId) ||
      import.meta.env.VITE_TELEGRAM_CHAT_ID ||
      ''
    const storedEnabled = localStorage.getItem(STORAGE_KEYS.enabled)
    const envEnabled = import.meta.env.VITE_TELEGRAM_ALERTS_ENABLED
    const enabled =
      storedEnabled !== null
        ? storedEnabled === 'true'
        : envEnabled !== undefined
        ? envEnabled === 'true' || envEnabled === true
        : Boolean(token && chatId)

    const rawCooldown =
      localStorage.getItem(STORAGE_KEYS.cooldown) ||
      import.meta.env.VITE_TELEGRAM_COOLDOWN_SECONDS ||
      '45'
    const cooldownSeconds = Number(rawCooldown)

    return {
      botToken: token.trim(),
      chatId: chatId.trim(),
      enabled,
      cooldownSeconds:
        Number.isFinite(cooldownSeconds) && cooldownSeconds >= 5
          ? cooldownSeconds
          : 45
    }
  } catch {
    return {
      botToken: import.meta.env.VITE_TELEGRAM_BOT_TOKEN || '',
      chatId: import.meta.env.VITE_TELEGRAM_CHAT_ID || '',
      enabled: false,
      cooldownSeconds: 45
    }
  }
}

export function setTelegramConfig(config: Partial<TelegramConfig>): void {
  try {
    if (config.botToken !== undefined) {
      const cleanToken = config.botToken.trim()
      if (cleanToken) {
        localStorage.setItem(STORAGE_KEYS.token, cleanToken)
      } else {
        localStorage.removeItem(STORAGE_KEYS.token)
      }
    }

    if (config.chatId !== undefined) {
      const cleanChatId = config.chatId.trim()
      if (cleanChatId) {
        localStorage.setItem(STORAGE_KEYS.chatId, cleanChatId)
      } else {
        localStorage.removeItem(STORAGE_KEYS.chatId)
      }
    }

    if (config.enabled !== undefined) {
      localStorage.setItem(STORAGE_KEYS.enabled, String(config.enabled))
    }

    if (config.cooldownSeconds !== undefined) {
      localStorage.setItem(
        STORAGE_KEYS.cooldown,
        String(Math.max(5, config.cooldownSeconds))
      )
    }
  } catch (error) {
    console.error('Error al guardar configuración de Telegram:', error)
  }
}

// Control anti-ráfaga en memoria
const recentAlertTimestamps = new Map<string, number>()
let lastAnyAlertTimestamp = 0

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Envía una notificación de alerta alta o crítica a Telegram.
 * Incluye protección contra inundación (anti-spam / cooldown).
 */
export async function sendTelegramAlert(alert: {
  severity: string
  message: string
  scenario?: string
}): Promise<{ sent: boolean; reason?: string }> {
  const isHighSeverity =
    alert.severity === 'Alta' || alert.severity === 'Crítica'

  // Solo las alertas de severidad Alta o Crítica se despachan al celular
  if (!isHighSeverity) {
    return {
      sent: false,
      reason: 'La severidad no califica para alerta inmediata (solo Alta/Crítica)'
    }
  }

  const config = getTelegramConfig()

  if (!config.enabled) {
    return { sent: false, reason: 'Notificaciones a Telegram desactivadas' }
  }

  if (!config.botToken || !config.chatId) {
    return {
      sent: false,
      reason: 'Falta Bot Token o Chat ID de Telegram'
    }
  }

  const now = Date.now()

  // Evitar ráfagas masivas en vivo: mínimo 3 segundos entre cualquier mensaje
  if (now - lastAnyAlertTimestamp < 3000) {
    return { sent: false, reason: 'Límite de ráfaga global activo (3s)' }
  }

  // Deduplicación por mensaje exacto y severidad durante el cooldown configurado
  const alertKey = `${alert.severity}:${alert.message.trim()}`
  const lastSent = recentAlertTimestamps.get(alertKey) || 0
  const cooldownMs = config.cooldownSeconds * 1000

  if (now - lastSent < cooldownMs) {
    const remaining = Math.ceil((cooldownMs - (now - lastSent)) / 1000)
    return {
      sent: false,
      reason: `Alerta repetida en cooldown (${remaining}s restantes)`
    }
  }

  const formattedTime = new Date().toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  const formattedDate = new Date().toLocaleDateString('es-ES')
  const icon = alert.severity === 'Crítica' ? '🚨⛔' : '⚠️🔴'

  const messageText =
`${icon} <b>VISION AI - ALERTA ${alert.severity.toUpperCase()}</b>
━━━━━━━━━━━━━━━━━━━━
🏢 <b>Escenario:</b> ${escapeHtml(alert.scenario || 'General')}
⚠️ <b>Incidente:</b> ${escapeHtml(alert.message)}
⏰ <b>Hora:</b> ${formattedTime} (${formattedDate})
━━━━━━━━━━━━━━━━━━━━
📱 <i>Acción requerida: Verifique la estación de monitoreo inmediatamente.</i>`

  try {
    // 1. Intentar enviar a través del backend FastAPI si está disponible
    if (API) {
      try {
        const controller = new AbortController()
        const timeout = window.setTimeout(() => controller.abort(), 4000)
        const res = await fetch(`${API}/api/v1/notifications/alert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            severity: alert.severity,
            message: alert.message,
            scenario: alert.scenario || 'General',
            token: config.botToken,
            chat_id: config.chatId
          }),
          signal: controller.signal
        })
        window.clearTimeout(timeout)
        if (res.ok) {
          recentAlertTimestamps.set(alertKey, now)
          lastAnyAlertTimestamp = now
          return { sent: true }
        }
      } catch {
        // Si el backend falla o está apagado, continúa directamente con la API de Telegram
      }
    }

    // 2. Envío directo a Telegram Bot API (funciona en Edge, Demo o sin servidor Python)
    const response = await fetch(
      `https://api.telegram.org/bot${config.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: messageText,
          parse_mode: 'HTML'
        })
      }
    )

    const result = (await response.json().catch(() => ({}))) as {
      ok?: boolean
      description?: string
    }

    if (response.ok && result.ok) {
      recentAlertTimestamps.set(alertKey, now)
      lastAnyAlertTimestamp = now
      return { sent: true }
    }

    return {
      sent: false,
      reason: result.description || `HTTP ${response.status}`
    }
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Envía un mensaje de prueba a Telegram para comprobar credenciales y conectividad.
 */
export async function testTelegramNotification(
  token?: string,
  chatId?: string
): Promise<{ success: boolean; message: string }> {
  const config = getTelegramConfig()
  const useToken = (token ?? config.botToken).trim()
  const useChatId = (chatId ?? config.chatId).trim()

  if (!useToken || !useChatId) {
    return {
      success: false,
      message: 'Ingresa tanto el Bot Token como el Chat ID de Telegram.'
    }
  }

  const testMessage =
`🔔 <b>VISION AI - VINCULACIÓN EXITOSA</b>
━━━━━━━━━━━━━━━━━━━━
✅ <b>El canal de notificaciones a tu celular está funcionando correctamente.</b>
⏰ <b>Hora:</b> ${new Date().toLocaleTimeString('es-ES')}
📡 Las alertas de prioridad <b>Alta</b> y <b>Crítica</b> de la planta llegarán inmediatamente a este chat.
━━━━━━━━━━━━━━━━━━━━
<i>VISION AI Platform 2.5</i>`

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${useToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: useChatId,
          text: testMessage,
          parse_mode: 'HTML'
        })
      }
    )

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      description?: string
    }

    if (res.ok && data.ok) {
      return {
        success: true,
        message: '¡Mensaje de prueba recibido en tu Telegram! Conexión verificada exitosamente.'
      }
    }

    const desc = data.description || `HTTP ${res.status}`
    if (res.status === 401 || desc.includes('Unauthorized')) {
      return {
        success: false,
        message: 'Bot Token no válido. Verifica que hayas copiado el token completo de @BotFather.'
      }
    }
    if (res.status === 400 && desc.includes('chat not found')) {
      return {
        success: false,
        message: 'Chat ID no encontrado. Recuerda abrir tu bot en Telegram y presionar "Iniciar" (/start).'
      }
    }

    return {
      success: false,
      message: `Telegram rechazó la solicitud: ${desc}`
    }
  } catch (err) {
    return {
      success: false,
      message: `Error de red al conectar con Telegram: ${
        err instanceof Error ? err.message : String(err)
      }`
    }
  }
}

