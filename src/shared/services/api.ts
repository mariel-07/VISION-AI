/**
 * Configuración del servicio de visión.
 * En local usa el FastAPI del mismo equipo (puerto 8000).
 * En Vercel NO apunta a localhost: se debe definir VITE_API_URL y VITE_WS_URL
 * con la URL pública de un backend externo. Sin backend, el modo DEMO sigue disponible.
 */
const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
const isPrivateNetwork = /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname)
const isLocal = typeof window !== 'undefined' &&
  (hostname === 'localhost' || hostname === '127.0.0.1' || isPrivateNetwork)
const pageProtocol = typeof window !== 'undefined' ? window.location.protocol : 'http:'
const defaultHttp = isLocal ? `${pageProtocol}//${hostname}:8000` : ''
const defaultWs = isLocal ? `${pageProtocol === 'https:' ? 'wss:' : 'ws:'}//${hostname}:8000` : ''
const trimSlash = (value: string) => value.replace(/\/+$/, '')
export const API = trimSlash(import.meta.env.VITE_API_URL || defaultHttp)
const WS_BASE = trimSlash(import.meta.env.VITE_WS_URL || defaultWs)
export const WS = WS_BASE ? `${WS_BASE}/api/v1/stream` : ''

export async function health() {
  if (!API) throw new Error('No hay backend YOLO configurado. Puedes usar el modo DEMO o configurar VITE_API_URL en Vercel.')
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 7000)
  try {
    const response = await fetch(`${API}/health`, { signal: controller.signal })
    if (!response.ok) throw new Error('El servidor de visión no respondió correctamente.')
    return await response.json()
  } finally {
    window.clearTimeout(timeout)
  }
}

export type RestrictedZone = { x: number; y: number; width: number; height: number }

export async function inferImage(
  file: File,
  confidence: number,
  task: 'detect' | 'segment' = 'detect',
  scenario = 'Almacén inteligente',
  zone: RestrictedZone = { x: .72, y: .10, width: .25, height: .80 },
) {
  if (!API) throw new Error('El modo REAL necesita un backend YOLO público. Configura VITE_API_URL; el modo DEMO no necesita servidor.')
  const form = new FormData()
  form.append('file', file, file.name)
  form.append('confidence', String(confidence))
  form.append('task', task)
  form.append('scenario', scenario)
  form.append('zone_x', String(zone.x))
  form.append('zone_y', String(zone.y))
  form.append('zone_width', String(zone.width))
  form.append('zone_height', String(zone.height))
  const response = await fetch(`${API}/api/v1/infer`, { method: 'POST', body: form })
  if (!response.ok) {
    const data = await response.json().catch(() => ({ detail: 'Error de inferencia' }))
    throw new Error(data.detail || 'Error de inferencia')
  }
  return response.json()
}

export function streamUrl(
  scenario: string,
  task: 'detect' | 'segment' | 'combined' = 'detect',
  zone: RestrictedZone = { x: .72, y: .10, width: .25, height: .80 },
) {
  if (!WS) throw new Error('El modo de cámara REAL necesita VITE_WS_URL con una dirección WSS pública.')
  return `${WS}?scenario=${encodeURIComponent(scenario)}&task=${task}&zone_x=${zone.x}&zone_y=${zone.y}&zone_width=${zone.width}&zone_height=${zone.height}`
}
