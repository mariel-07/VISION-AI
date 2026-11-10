import type { Detection } from './store'
import { COCO_LABELS, computeLetterbox, decodeYoloOutput, rgbaToChw } from './yoloPostprocess'

/**
 * Motor de visión en el navegador: YOLOv8 (ONNX) ejecutado con ONNX Runtime Web (WASM).
 * Todo corre en el dispositivo de quien abre la página: no necesita servidor ni memoria de backend.
 *
 * Modelos (carpeta public/models/):
 *  - yolov8n.onnx            modelo general COCO (obligatorio)
 *  - epp.onnx + epp.labels.json   modelo EPP entrenado (opcional, solo escenario "Seguridad industrial")
 *    epp.labels.json puede ser una lista de clases o {"labels": [...], "size": 416} si el modelo
 *    se exportó con otro tamaño de entrada (más pequeño = más rápido).
 */

type OrtTensor = { data: Float32Array; dims: readonly number[] }
type OrtSession = {
  run: (feeds: Record<string, unknown>) => Promise<Record<string, OrtTensor>>
  inputNames: readonly string[]
  outputNames: readonly string[]
}
type OrtLibrary = {
  InferenceSession: { create: (source: string, options?: Record<string, unknown>) => Promise<OrtSession> }
  Tensor: new (type: 'float32', data: Float32Array, dims: number[]) => unknown
  env: { wasm: { wasmPaths?: string; numThreads?: number } }
}

declare global {
  interface Window { ort?: OrtLibrary }
}

const ORT_VERSION = '1.20.1'
const ORT_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`
const MODELS_BASE = `${import.meta.env.BASE_URL}models/`
const DEFAULT_SIZE = 640
const EPP_SCENARIO = 'Seguridad industrial'

type LoadedModel = {
  session: OrtSession
  labels: readonly string[]
  specialized: boolean
  name: string
  size: number
}

export type BrowserModelInfo = { name: string; specialized: boolean; labels: readonly string[] }

const loaded = new Map<string, Promise<LoadedModel>>()
let ortPromise: Promise<OrtLibrary> | null = null
let bundleHasWebGpu = false
let webGpuFailed = false
let activeProvider: 'webgpu' | 'wasm' = 'wasm'
let lastInfo: BrowserModelInfo = { name: 'YOLOv8n (COCO)', specialized: false, labels: COCO_LABELS }
let queue: Promise<unknown> = Promise.resolve()

function loadScript(file: string): Promise<OrtLibrary> {
  return new Promise<OrtLibrary>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `${ORT_BASE}${file}`
    script.async = true
    script.onload = () => {
      const ort = window.ort
      if (!ort) { reject(new Error('ONNX Runtime se descargó, pero no quedó disponible. Recarga la página.')); return }
      ort.env.wasm.wasmPaths = ORT_BASE
      // Varios hilos exigen aislamiento de origen cruzado; sin él se usa un solo hilo.
      ort.env.wasm.numThreads = window.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1
      resolve(ort)
    }
    script.onerror = () => { script.remove(); reject(new Error('No se pudo descargar ONNX Runtime desde el CDN. Comprueba tu conexión a Internet.')) }
    document.head.appendChild(script)
  })
}

function loadOrt(): Promise<OrtLibrary> {
  if (!ortPromise) {
    ortPromise = (async () => {
      // Con GPU (WebGPU) la inferencia es mucho más rápida; si no hay, se usa CPU (WASM).
      if ('gpu' in navigator) {
        try { const ort = await loadScript('ort.webgpu.min.js'); bundleHasWebGpu = true; return ort } catch { /* se intenta el bundle básico */ }
      }
      return loadScript('ort.min.js')
    })().catch(error => { ortPromise = null; throw error })
  }
  return ortPromise
}

async function warmUp(ort: OrtLibrary, session: OrtSession, size: number): Promise<void> {
  // Una inferencia en blanco: comprueba que el modelo corre de verdad y evita que el primer fotograma pague la compilación.
  const dummy = new ort.Tensor('float32', new Float32Array(3 * size * size), [1, 3, size, size])
  await session.run({ [session.inputNames[0]]: dummy })
}

async function createSession(ort: OrtLibrary, file: string, size: number): Promise<OrtSession> {
  const providers: Array<'webgpu' | 'wasm'> = bundleHasWebGpu && !webGpuFailed ? ['webgpu', 'wasm'] : ['wasm']
  let lastError: unknown
  for (const provider of providers) {
    try {
      const session = await ort.InferenceSession.create(`${MODELS_BASE}${file}`, { executionProviders: [provider], graphOptimizationLevel: 'all' })
      await warmUp(ort, session, size)
      activeProvider = provider
      return session
    } catch (cause) {
      lastError = cause
      if (provider === 'webgpu') { webGpuFailed = true; console.warn('WebGPU no disponible; se usa la CPU (WASM).', cause) }
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`No se pudo cargar el modelo ${file}. Verifica que exista en public/models/ y que su tamaño de entrada coincida con el indicado. (${detail})`)
}

async function readEppConfig(): Promise<{ labels: string[]; size: number } | null> {
  try {
    const response = await fetch(`${MODELS_BASE}epp.labels.json`, { cache: 'no-cache' })
    if (!response.ok) return null
    const parsed: unknown = await response.json() // si el servidor devuelve index.html, esto falla y se ignora
    let labels: unknown = parsed
    let size = DEFAULT_SIZE
    if (parsed && !Array.isArray(parsed) && typeof parsed === 'object') {
      const config = parsed as { labels?: unknown; size?: unknown }
      labels = config.labels
      if (typeof config.size === 'number' && Number.isInteger(config.size) && config.size >= 160 && config.size <= 1280 && config.size % 32 === 0) size = config.size
    }
    if (Array.isArray(labels) && labels.length && labels.every(item => typeof item === 'string')) return { labels: labels as string[], size }
    return null
  } catch {
    return null
  }
}

async function loadGeneral(ort: OrtLibrary): Promise<LoadedModel> {
  const session = await createSession(ort, 'yolov8n.onnx', DEFAULT_SIZE)
  return { session, labels: COCO_LABELS, specialized: false, size: DEFAULT_SIZE, name: `YOLOv8n (COCO) · ${activeProvider === 'webgpu' ? 'GPU' : 'CPU'}` }
}

async function loadModel(scenario?: string): Promise<LoadedModel> {
  const ort = await loadOrt()
  if (scenario === EPP_SCENARIO) {
    if (!loaded.has('epp')) {
      loaded.set('epp', (async () => {
        const config = await readEppConfig()
        if (!config) throw new Error('sin-modelo-epp')
        const { labels, size } = config
        const session = await createSession(ort, 'epp.onnx', size)
        return { session, labels, specialized: true, size, name: `YOLOv8 EPP (entrenado) · ${activeProvider === 'webgpu' ? 'GPU' : 'CPU'} · ${size}px` } as LoadedModel
      })())
    }
    try {
      const model = await loaded.get('epp')!
      lastInfo = { name: model.name, specialized: true, labels: model.labels }
      return model
    } catch (cause) {
      loaded.delete('epp')
      const silent = cause instanceof Error && cause.message === 'sin-modelo-epp'
      if (!silent) console.warn('Modelo EPP no disponible; se usa el modelo general.', cause)
      // continúa con el modelo general
    }
  }
  if (!loaded.has('general')) {
    loaded.set('general', loadGeneral(ort).catch(error => { loaded.delete('general'); throw error }))
  }
  const model = await loaded.get('general')!
  lastInfo = { name: model.name, specialized: false, labels: model.labels }
  return model
}

/** Descarga y prepara el modelo (úsalo para mostrar el estado "Cargando…" antes de analizar). */
export async function loadBrowserVisionModel(scenario?: string): Promise<BrowserModelInfo> {
  await loadModel(scenario)
  return lastInfo
}

/** Información del último modelo usado (nombre, si es especializado y sus etiquetas). */
export function getBrowserModelInfo(): BrowserModelInfo { return lastInfo }

let canvas: HTMLCanvasElement | null = null
function drawLetterboxed(input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement, width: number, height: number, size: number) {
  if (!canvas) canvas = document.createElement('canvas')
  if (canvas.width !== size || canvas.height !== size) { canvas.width = size; canvas.height = size }
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('El navegador no permite procesar imágenes en un lienzo.')
  const box = computeLetterbox(width, height, size)
  context.fillStyle = 'rgb(114,114,114)' // gris que usa YOLO para el relleno
  context.fillRect(0, 0, size, size)
  context.drawImage(input, box.padX, box.padY, Math.round(width * box.scale), Math.round(height * box.scale))
  return { box, pixels: context.getImageData(0, 0, size, size).data }
}

export async function detectBrowserObjects(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  threshold = .45,
  scenario?: string,
): Promise<{ detections: Detection[]; width: number; height: number; durationMs: number }> {
  const model = await loadModel(scenario)
  const ort = await loadOrt()
  const width = input instanceof HTMLVideoElement ? input.videoWidth : input instanceof HTMLImageElement ? input.naturalWidth : input.width
  const height = input instanceof HTMLVideoElement ? input.videoHeight : input instanceof HTMLImageElement ? input.naturalHeight : input.height
  if (!width || !height) throw new Error('La imagen o la cámara todavía no tiene dimensiones disponibles.')

  // Se serializan las inferencias: una sola sesión no debe ejecutarse en paralelo.
  const run = queue.then(async () => {
    const start = performance.now()
    const { box, pixels } = drawLetterboxed(input, width, height, model.size)
    const tensor = new ort.Tensor('float32', rgbaToChw(pixels, model.size), [1, 3, model.size, model.size])
    const outputs = await model.session.run({ [model.session.inputNames[0]]: tensor })
    const output = outputs[model.session.outputNames[0]]
    const raw = decodeYoloOutput(output.data, output.dims, model.labels, box, threshold)
    const detections: Detection[] = raw.map((item, index) => ({
      id: `browser-${Date.now()}-${index}`,
      label: item.label,
      classId: item.classId,
      confidence: item.confidence,
      x: item.x, y: item.y, width: item.width, height: item.height,
    }))
    return { detections, width, height, durationMs: performance.now() - start }
  })
  queue = run.catch(() => undefined)
  return run
}
