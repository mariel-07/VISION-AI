import { makeId } from './store'

// ============================================================
// TIPOS DEL REPORTE
// ============================================================

export type PpeItemStatus = {
  item: string
  present: boolean
  status: 'Conforme' | 'Ausente / Crítico' | 'No requerido' | 'Parcial'
  details: string
}

export type GeminiAuditReport = {
  id: string
  timestamp: string
  scenario: string
  sceneDescription: string
  complianceScore: number
  riskLevel: 'Bajo' | 'Moderado' | 'Alto' | 'Crítico'
  oshaStatus: string
  ppeChecklist: PpeItemStatus[]
  hazardsIdentified: string[]
  correctiveActions: string[]
  executiveSummary: string
  inspectorNotes: string
  usedLiveApi: boolean
  modelUsed?: string
}

// ============================================================
// CONFIGURACIÓN DE GEMINI
// ============================================================

const GEMINI_API_KEY_STORAGE = 'vision_ai_gemini_api_key'
const GEMINI_MODEL_STORAGE = 'vision_ai_gemini_model'

// Modelos multimodales soportados oficialmente por Google AI Studio
// ============================================================
// MODELOS GEMINI ACTUALIZADOS
// ============================================================

export const AVAILABLE_GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite'
]

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash'

export function getGeminiModel(): string {
  try {
    const saved = localStorage.getItem(GEMINI_MODEL_STORAGE)
    if (saved && AVAILABLE_GEMINI_MODELS.includes(saved)) {
      return saved
    }
    const envModel = import.meta.env.VITE_GEMINI_MODEL
    if (envModel && AVAILABLE_GEMINI_MODELS.includes(envModel)) {
      return envModel
    }
    return DEFAULT_GEMINI_MODEL
  } catch {
    return DEFAULT_GEMINI_MODEL
  }
}

export function setGeminiModel(model: string): void {
  try {
    const clean = model.trim()
    if (clean) {
      localStorage.setItem(GEMINI_MODEL_STORAGE, clean)
    }
  } catch (error) {
    console.error('No se pudo guardar el modelo de Gemini:', error)
  }
}

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models'

// Reintentos para errores temporales
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 1200
const MAX_RETRY_DELAY = 8000

// ============================================================
// API KEY
// ============================================================

export function getGeminiApiKey(): string {
  try {
    return (
      localStorage.getItem(GEMINI_API_KEY_STORAGE) ||
      import.meta.env.VITE_GEMINI_API_KEY ||
      ''
    )
  } catch {
    return import.meta.env.VITE_GEMINI_API_KEY || ''
  }
}

export function setGeminiApiKey(key: string): void {
  try {
    const cleanKey = key.trim()

    if (cleanKey) {
      localStorage.setItem(GEMINI_API_KEY_STORAGE, cleanKey)
    } else {
      localStorage.removeItem(GEMINI_API_KEY_STORAGE)
    }
  } catch (error) {
    console.error(
      'No se pudo guardar la API Key de Gemini:',
      error
    )
  }
}

// ============================================================
// CONVERSIÓN DE IMÁGENES A BASE64
// ============================================================

export async function elementToBase64(
  element: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
): Promise<string> {
  const canvas = document.createElement('canvas')

  if (element instanceof HTMLVideoElement) {
    const width = element.videoWidth
    const height = element.videoHeight

    if (!width || !height || element.readyState < 2) {
      throw new Error(
        'La cámara todavía no está entregando fotogramas.'
      )
    }

    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error(
        'No se pudo preparar el fotograma de la cámara.'
      )
    }

    context.drawImage(element, 0, 0, width, height)

  } else if (element instanceof HTMLImageElement) {
    const width = element.naturalWidth
    const height = element.naturalHeight

    if (!width || !height || !element.complete) {
      throw new Error(
        'La imagen o cámara IP todavía no está disponible.'
      )
    }

    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('No se pudo preparar la imagen.')
    }

    try {
      context.drawImage(element, 0, 0, width, height)
    } catch {
      throw new Error(
        'No se pudo leer la cámara IP. Verifica que el servidor del flujo permita CORS.'
      )
    }

  } else {
    if (!element.width || !element.height) {
      throw new Error('El canvas no contiene una imagen.')
    }

    canvas.width = element.width
    canvas.height = element.height

    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('No se pudo preparar el canvas.')
    }

    context.drawImage(element, 0, 0)
  }

  try {
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1] || ''
  } catch {
    throw new Error(
      'No se pudo convertir la imagen. En cámaras IP revisa la configuración CORS.'
    )
  }
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const result = String(reader.result || '')
      const base64 = result.split(',')[1] || ''

      if (!base64) {
        reject(
          new Error('El archivo no contiene datos de imagen válidos.')
        )
      } else {
        resolve(base64)
      }
    }

    reader.onerror = () => {
      reject(
        new Error('No se pudo leer el archivo de imagen.')
      )
    }

    reader.readAsDataURL(file)
  })
}

// ============================================================
// PROMPT DE ANÁLISIS VISUAL GENERAL
// ============================================================

function buildGeneralVisionPrompt(
  detectedLabels: string[]
): string {
  const labelsText = detectedLabels.length
    ? `Detecciones preliminares del motor local (pueden ser incompletas): ${detectedLabels.join(', ')}.`
    : 'No hay detecciones preliminares del motor local.'

  return `
Eres VISION AI, un sistema experto de análisis visual multimodal.

Analiza directamente la imagen adjunta. El análisis es GENERAL:
no limites la interpretación a una fábrica, almacén, oficina,
retail, agricultura o transporte.

OBJETIVO:

Describe lo que realmente aparece en el fotograma:
entorno, objetos, personas, animales, herramientas, máquinas,
vehículos, muebles, productos, estructuras, superficies,
iluminación, orden y distribución.

REGLAS IMPORTANTES:

- Basa cada afirmación únicamente en evidencia visual.
- No inventes objetos, personas, cantidades, acciones ni infracciones.
- Si un elemento no se distingue, indícalo como no evaluable.
- No afirmes que una persona incumple EPP si no es claramente visible
  y aplicable al contexto.
- Diferencia un peligro observado de un riesgo posible o sospechado.
- Si no hay peligros evidentes, dilo expresamente.
- El puntaje es una estimación visual orientativa de 0 a 100.
- No presentes el resultado como certificación legal ni auditoría oficial OSHA/ISO.
- Responde en español claro y técnico.
- No inventes información que no aparezca en la imagen.

${labelsText}

Devuelve exclusivamente un JSON válido con esta estructura:

{
  "sceneDescription": "Descripción concreta y detallada de la escena visible",
  "complianceScore": 0,
  "riskLevel": "Bajo",
  "oshaStatus": "Evaluación visual general; no constituye certificación normativa",
  "ppeChecklist": [
    {
      "item": "Elemento observado",
      "present": true,
      "status": "Conforme",
      "details": "Evidencia visible o motivo por el que no es evaluable"
    }
  ],
  "hazardsIdentified": [
    "Peligro observado o posible riesgo claramente identificado"
  ],
  "correctiveActions": [
    "Recomendación concreta y proporcional al hallazgo"
  ],
  "executiveSummary": "Resumen breve de lo observado",
  "inspectorNotes": "Limitaciones, incertidumbres y notas del análisis"
}

Si no hay checklist aplicable, devuelve [].

Si no hay peligros identificables, devuelve hazardsIdentified como [].

Los valores permitidos para riskLevel son:
"Bajo", "Moderado", "Alto", "Crítico".

Los valores permitidos para status son:
"Conforme", "Ausente / Crítico", "No requerido", "Parcial".
`
}

// ============================================================
// ESPERA ENTRE REINTENTOS
// ============================================================

function wait(ms: number): Promise<void> {
  return new Promise(resolve => {
    window.setTimeout(resolve, ms)
  })
}

// ============================================================
// CÁLCULO DEL TIEMPO DE REINTENTO
// ============================================================

function getRetryDelay(
  attempt: number,
  response?: Response
): number {
  // Si Google envía Retry-After, intentamos respetarlo.
  const retryAfter = response?.headers.get('Retry-After')

  if (retryAfter) {
    const seconds = Number(retryAfter)

    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, MAX_RETRY_DELAY)
    }

    const retryDate = Date.parse(retryAfter)

    if (!Number.isNaN(retryDate)) {
      return Math.min(
        Math.max(0, retryDate - Date.now()),
        MAX_RETRY_DELAY
      )
    }
  }

  const exponentialDelay = Math.min(
    INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1),
    MAX_RETRY_DELAY
  )

  const jitter = Math.random() * 700

  return exponentialDelay + jitter
}

// ============================================================
// SOLICITUD A GEMINI CON REINTENTOS AUTOMÁTICOS
// ============================================================

async function fetchGeminiWithRetry(
  url: string,
  payload: unknown,
  apiKey: string,
  signal: AbortSignal
): Promise<Response> {
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (signal.aborted) {
      throw new DOMException(
        'La solicitud fue cancelada.',
        'AbortError'
      )
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(payload),
        signal
      })

      if (response.ok) {
        return response
      }

      const retryableStatuses = [
        408,
        429,
        500,
        502,
        503,
        504
      ]

      const canRetry = retryableStatuses.includes(
        response.status
      )

      if (!canRetry || attempt === MAX_RETRIES) {
        return response
      }

      const delay = getRetryDelay(attempt, response)

      console.warn(
        `[VISION AI] Gemini respondió ${response.status}. ` +
        `Reintento ${attempt}/${MAX_RETRIES} en ${Math.round(delay)} ms.`
      )

      await wait(delay)

    } catch (error) {
      if (
        error instanceof Error &&
        error.name === 'AbortError'
      ) {
        throw error
      }

      lastError = error

      if (attempt === MAX_RETRIES) {
        break
      }

      const delay = getRetryDelay(attempt)

      console.warn(
        `[VISION AI] Error de conexión con Gemini. ` +
        `Reintento ${attempt}/${MAX_RETRIES} en ${Math.round(delay)} ms.`,
        error
      )

      await wait(delay)
    }
  }

  throw new Error(
    `No se pudo conectar con Gemini después de ${MAX_RETRIES} intentos. ` +
    `Verifica tu conexión e inténtalo nuevamente. ` +
    `${lastError instanceof Error ? lastError.message : ''}`
  )
}

// ============================================================
// EXTRACCIÓN DEL JSON
// ============================================================

function extractJsonFromText(
  raw: string
): Record<string, unknown> {
  const clean = raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()

  const firstBrace = clean.indexOf('{')
  const lastBrace = clean.lastIndexOf('}')

  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error(
      'Gemini respondió, pero no devolvió un JSON válido para el reporte.'
    )
  }

  try {
    const parsed = JSON.parse(
      clean.slice(firstBrace, lastBrace + 1)
    )

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      throw new Error('La respuesta no es un objeto JSON.')
    }

    return parsed as Record<string, unknown>

  } catch {
    throw new Error(
      'No se pudo interpretar el JSON generado por Gemini. Intenta nuevamente.'
    )
  }
}

// ============================================================
// NORMALIZACIÓN DEL REPORTE
// ============================================================

function normalizeReport(
  parsed: Record<string, unknown>,
  modelName: string
): GeminiAuditReport {
  const validRisks: GeminiAuditReport['riskLevel'][] = [
    'Bajo',
    'Moderado',
    'Alto',
    'Crítico'
  ]

  const rawRisk = String(
    parsed.riskLevel || 'Moderado'
  )

  const validStatuses: PpeItemStatus['status'][] = [
    'Conforme',
    'Ausente / Crítico',
    'No requerido',
    'Parcial'
  ]

  const checklist: PpeItemStatus[] =
    Array.isArray(parsed.ppeChecklist)
      ? parsed.ppeChecklist.map((value): PpeItemStatus => {
          const item = (
            value && typeof value === 'object'
              ? value
              : {}
          ) as Record<string, unknown>

          const rawStatus = String(
            item.status || 'Parcial'
          )

          return {
            item: String(
              item.item || 'Elemento visual'
            ),

            present: item.present === true,

            status: validStatuses.includes(
              rawStatus as PpeItemStatus['status']
            )
              ? rawStatus as PpeItemStatus['status']
              : 'Parcial',

            details: String(
              item.details || 'Sin detalles adicionales.'
            )
          }
        })
      : []

  const scoreValue = Number(parsed.complianceScore)

  const score = Number.isFinite(scoreValue)
    ? Math.max(0, Math.min(100, scoreValue))
    : 0

  return {
    id: makeId('AUDIT-GEMINI'),

    timestamp: new Date().toISOString(),

    scenario: 'Análisis visual general',

    sceneDescription: String(
      parsed.sceneDescription ||
      'No se recibió una descripción de la escena.'
    ),

    complianceScore: score,

    riskLevel: validRisks.includes(
      rawRisk as GeminiAuditReport['riskLevel']
    )
      ? rawRisk as GeminiAuditReport['riskLevel']
      : 'Moderado',

    oshaStatus: String(
      parsed.oshaStatus ||
      'Evaluación visual general; no constituye certificación normativa.'
    ),

    ppeChecklist: checklist,

    hazardsIdentified: Array.isArray(
      parsed.hazardsIdentified
    )
      ? parsed.hazardsIdentified.map(String)
      : [],

    correctiveActions: Array.isArray(
      parsed.correctiveActions
    )
      ? parsed.correctiveActions.map(String)
      : [],

    executiveSummary: String(
      parsed.executiveSummary ||
      'Análisis visual completado.'
    ),

    inspectorNotes: String(
      parsed.inspectorNotes ||
      'Evaluación basada únicamente en el fotograma recibido.'
    ),

    usedLiveApi: true,

    modelUsed: `Google ${modelName}`
  }
}

// ============================================================
// FUNCIÓN PRINCIPAL DE AUDITORÍA MULTIMODAL
// ============================================================

export async function runIndustrialSafetyAudit(
  base64Image: string,
  detectedLabels: string[] = [],
  _scenario = 'Análisis general'
): Promise<GeminiAuditReport> {

  // ----------------------------------------------------------
  // VALIDACIONES
  // ----------------------------------------------------------

  const apiKey = getGeminiApiKey()

  if (!apiKey || apiKey.length < 8) {
    throw new Error(
      'Configura una API Key válida de Google AI Studio antes de generar el reporte.'
    )
  }

  if (!base64Image) {
    throw new Error(
      'No se recibió una imagen para analizar.'
    )
  }

  // ----------------------------------------------------------
  // CONFIGURAR TIEMPO MÁXIMO Y MODELOS
  // ----------------------------------------------------------

  const controller = new AbortController()

  // Tiempo total disponible, incluyendo los reintentos.
  const timeoutId = window.setTimeout(() => {
    controller.abort()
  }, 90000)

  const preferredModel = getGeminiModel()
  const candidateModels = [
    preferredModel,
    ...AVAILABLE_GEMINI_MODELS.filter(m => m !== preferredModel)
  ]

  // ----------------------------------------------------------
  // CONSTRUIR SOLICITUD
  // ----------------------------------------------------------

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: buildGeneralVisionPrompt(
              detectedLabels
            )
          },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image
            }
          }
        ]
      }
    ],

    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 1800,
      responseMimeType: 'application/json'
    }
  }

  try {
    let lastError: Error | null = null

    for (const currentModel of candidateModels) {
      const url = `${GEMINI_API_URL}/${currentModel}:generateContent`

      try {
        const response = await fetchGeminiWithRetry(
          url,
          payload,
          apiKey,
          controller.signal
        )

        const data = (await response.json().catch(() => ({}))) as {
          error?: {
            message?: string
            status?: string
          }
          candidates?: Array<{
            content?: {
              parts?: Array<{
                text?: string
              }>
            }
            finishReason?: string
          }>
        }

        if (!response.ok) {
          const detail = data.error?.message || `HTTP ${response.status}`

          // Si el modelo específico da 404, probamos el siguiente modelo disponible
          if (response.status === 404) {
            console.warn(
              `[VISION AI] El modelo ${currentModel} no está disponible (404). Intentando alternativa...`
            )
            lastError = new Error(
              `El modelo ${currentModel} no está disponible para esta API Key. Detalle: ${detail}`
            )
            continue
          }

          if (
            response.status === 400 ||
            response.status === 403 ||
            response.status === 401
          ) {
            throw new Error(
              `Google Gemini rechazó la solicitud (${response.status}). ` +
              `Verifica tu API Key de Google AI Studio y sus permisos. ` +
              `Detalle: ${detail}`
            )
          }

          if (response.status === 429) {
            throw new Error(
              `Se alcanzó la cuota de solicitudes de Gemini (429). ` +
              `Espera un momento antes de volver a intentarlo. ` +
              `Detalle: ${detail}`
            )
          }

          if (response.status === 503) {
            throw new Error(
              `Gemini continúa temporalmente saturado (503). ` +
              `Espera unos segundos y vuelve a generar el reporte. ` +
              `Detalle: ${detail}`
            )
          }

          throw new Error(
            `Error de Google Gemini (${response.status}): ${detail}`
          )
        }

        // ----------------------------------------------------
        // EXTRAER RESPUESTA EXITOSA
        // ----------------------------------------------------

        const rawText = data.candidates?.[0]?.content?.parts
          ?.map(part => part.text || '')
          .join('')
          .trim()

        if (!rawText) {
          const finishReason = data.candidates?.[0]?.finishReason
          throw new Error(
            `Gemini no devolvió contenido para el reporte. ` +
            `Motivo: ${finishReason || 'respuesta vacía'}. ` +
            `Comprueba que la imagen sea legible e inténtalo otra vez.`
          )
        }

        const parsed = extractJsonFromText(rawText)
        const report = normalizeReport(parsed, currentModel)

        // Guardamos el modelo que funcionó exitosamente
        setGeminiModel(currentModel)

        return report

      } catch (loopErr) {
        if (
          loopErr instanceof Error &&
          loopErr.name === 'AbortError'
        ) {
          throw loopErr
        }
        // Si no es un 404 que pueda resolverse con otro modelo, relanzar
        if (!(loopErr instanceof Error && loopErr.message.includes('404'))) {
          throw loopErr
        }
        lastError = loopErr
      }
    }

    throw (
      lastError ||
      new Error(
        'Ninguno de los modelos multimodales de Google Gemini estuvo disponible para esta clave de API.'
      )
    )

  } catch (error) {
    if (
      error instanceof Error &&
      error.name === 'AbortError'
    ) {
      throw new Error(
        'Gemini tardó más de 90 segundos en responder. ' +
        'Puede estar saturado o tu conexión ser lenta. Intenta nuevamente.'
      )
    }

    throw error

  } finally {
    window.clearTimeout(timeoutId)
  }
}

// ============================================================
// COMPROBAR CONEXIÓN CON GEMINI API
// ============================================================


export async function testGeminiConnection(
  customKey?: string
): Promise<{ success: boolean; model: string; message: string }> {

  const apiKey = (customKey || getGeminiApiKey()).trim()

  if (!apiKey || apiKey.length < 8) {
    return {
      success: false,
      model: '',
      message: 'Ingresa una API Key válida de Google AI Studio.'
    }
  }

  const preferredModel = getGeminiModel()

  const candidateModels = [
    preferredModel,
    ...AVAILABLE_GEMINI_MODELS.filter(
      model => model !== preferredModel
    )
  ]

  let lastDetail = ''

  for (const model of candidateModels) {

    const url = `${GEMINI_API_URL}/${model}:generateContent`

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: 'Responde únicamente con la palabra OK.'
            }
          ]
        }
      ],
      generationConfig: {
        maxOutputTokens: 10,
        temperature: 0
      }
    }

    // Máximo 3 intentos por modelo
    for (let attempt = 1; attempt <= 3; attempt++) {

      try {

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify(payload)
        })

        const data = await response.json().catch(() => ({})) as {
          error?: {
            message?: string
          }
        }

        if (response.ok) {

          setGeminiModel(model)

          return {
            success: true,
            model,
            message:
              `Conexión exitosa con Gemini. Modelo activo: ${model}.`
          }
        }

        lastDetail =
          data.error?.message || `HTTP ${response.status}`

        // Modelo no disponible: probar el siguiente
        if (response.status === 404) {
          break
        }

        // Errores que no se solucionan reintentando
        if (
          [400, 401, 403, 402].includes(response.status)
        ) {
          return {
            success: false,
            model,
            message:
              `Gemini rechazó la solicitud (${response.status}): ${lastDetail}`
          }
        }

        // Errores temporales
        const retryable = [
          408, 429, 500, 502, 503, 504
        ].includes(response.status)

        if (!retryable) {
          return {
            success: false,
            model,
            message:
              `Error de Gemini (${response.status}): ${lastDetail}`
          }
        }

        if (attempt < 3) {

          const delay =
            Math.min(1000 * Math.pow(2, attempt - 1), 8000)
            + Math.random() * 800

          console.warn(
            `[VISION AI] Gemini ${response.status}. ` +
            `Reintento ${attempt}/3 en ${Math.round(delay)} ms.`
          )

          await wait(delay)
        }

      } catch (error) {

        lastDetail =
          error instanceof Error
            ? error.message
            : String(error)

        if (attempt < 3) {

          const delay =
            1000 * Math.pow(2, attempt - 1)
            + Math.random() * 800

          await wait(delay)
        }
      }
    }
  }

  return {
    success: false,
    model: '',
    message:
      `No se pudo establecer conexión con Gemini. ` +
      `Se probaron los modelos disponibles y sus reintentos. ` +
      `Último detalle: ${lastDetail}. Intenta nuevamente más tarde.`
  }
}

