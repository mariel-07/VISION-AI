/**
 * Pre y postprocesamiento de YOLOv8/YOLO11 (formato ONNX de Ultralytics).
 * Funciones puras, sin DOM: se pueden probar con Node.
 *
 * Salida esperada del modelo de detección: [1, 4 + nc, N]
 *   canales 0..3 = cx, cy, w, h (en píxeles del lienzo de entrada, p. ej. 640x640)
 *   canales 4..  = puntuación de cada clase (YOLOv8 no usa "objectness")
 * También se acepta la forma transpuesta [1, N, 4 + nc].
 */

export type Letterbox = { scale: number; padX: number; padY: number; srcWidth: number; srcHeight: number; size: number }

export type RawDetection = {
  classId: number
  label: string
  confidence: number
  /** Coordenadas normalizadas 0..1 respecto de la imagen original. */
  x: number
  y: number
  width: number
  height: number
}

/** Calcula cómo encajar la imagen original en un cuadrado size×size conservando proporción. */
export function computeLetterbox(srcWidth: number, srcHeight: number, size = 640): Letterbox {
  if (!(srcWidth > 0) || !(srcHeight > 0)) throw new Error('La imagen o el video todavía no tiene dimensiones disponibles.')
  const scale = Math.min(size / srcWidth, size / srcHeight)
  const newWidth = Math.round(srcWidth * scale)
  const newHeight = Math.round(srcHeight * scale)
  return { scale, padX: Math.floor((size - newWidth) / 2), padY: Math.floor((size - newHeight) / 2), srcWidth, srcHeight, size }
}

/** Convierte píxeles RGBA (canvas) a un tensor plano CHW float32 normalizado 0..1. */
export function rgbaToChw(rgba: Uint8ClampedArray, size: number): Float32Array {
  const plane = size * size
  const out = new Float32Array(3 * plane)
  for (let i = 0; i < plane; i++) {
    const p = i * 4
    out[i] = rgba[p] / 255
    out[plane + i] = rgba[p + 1] / 255
    out[2 * plane + i] = rgba[p + 2] / 255
  }
  return out
}

function iou(a: RawDetection, b: RawDetection): number {
  const ax2 = a.x + a.width, ay2 = a.y + a.height, bx2 = b.x + b.width, by2 = b.y + b.height
  const iw = Math.min(ax2, bx2) - Math.max(a.x, b.x)
  const ih = Math.min(ay2, by2) - Math.max(a.y, b.y)
  if (iw <= 0 || ih <= 0) return 0
  const inter = iw * ih
  return inter / (a.width * a.height + b.width * b.height - inter)
}

/** Supresión de no máximos por clase (elimina cajas duplicadas de un mismo objeto). */
export function nonMaxSuppression(items: RawDetection[], iouThreshold = 0.45, maxOutput = 100): RawDetection[] {
  const sorted = [...items].sort((a, b) => b.confidence - a.confidence)
  const kept: RawDetection[] = []
  for (const candidate of sorted) {
    if (kept.length >= maxOutput) break
    if (kept.every(k => k.classId !== candidate.classId || iou(k, candidate) <= iouThreshold)) kept.push(candidate)
  }
  return kept
}

/**
 * Decodifica la salida de YOLOv8 a detecciones normalizadas respecto de la imagen original.
 * @param data  tensor de salida aplanado
 * @param dims  forma del tensor, p. ej. [1, 84, 8400]
 */
export function decodeYoloOutput(
  data: ArrayLike<number>,
  dims: readonly number[],
  labels: readonly string[],
  box: Letterbox,
  threshold = 0.35,
  iouThreshold = 0.45,
): RawDetection[] {
  if (dims.length !== 3) throw new Error(`Salida del modelo con forma inesperada [${dims.join(', ')}]. Se esperaba [1, 4+clases, N].`)
  const [, d1, d2] = dims
  // Forma normal: canales(d1) < anclas(d2). Transpuesta: anclas(d1) > canales(d2).
  const transposed = d1 > d2
  const channels = transposed ? d2 : d1
  const anchors = transposed ? d1 : d2
  const numClasses = channels - 4
  if (numClasses < 1) throw new Error(`Salida del modelo con ${channels} canales: no parece un detector YOLOv8 (se esperan 4 + número de clases).`)
  if (labels.length && numClasses !== labels.length) {
    throw new Error(`El modelo tiene ${numClasses} clases pero el archivo de etiquetas lista ${labels.length}. Revisa que las etiquetas correspondan a este modelo.`)
  }
  const at = transposed
    ? (channel: number, anchor: number) => data[anchor * channels + channel]
    : (channel: number, anchor: number) => data[channel * anchors + anchor]

  const candidates: RawDetection[] = []
  for (let i = 0; i < anchors; i++) {
    let best = -1
    let bestScore = threshold
    for (let c = 0; c < numClasses; c++) {
      const score = at(4 + c, i)
      if (score > bestScore) { bestScore = score; best = c }
    }
    if (best < 0) continue
    const cx = at(0, i), cy = at(1, i), w = at(2, i), h = at(3, i)
    // De coordenadas del lienzo 640x640 a coordenadas de la imagen original.
    let x1 = (cx - w / 2 - box.padX) / box.scale
    let y1 = (cy - h / 2 - box.padY) / box.scale
    let x2 = (cx + w / 2 - box.padX) / box.scale
    let y2 = (cy + h / 2 - box.padY) / box.scale
    x1 = Math.max(0, Math.min(box.srcWidth, x1)); x2 = Math.max(0, Math.min(box.srcWidth, x2))
    y1 = Math.max(0, Math.min(box.srcHeight, y1)); y2 = Math.max(0, Math.min(box.srcHeight, y2))
    if (x2 - x1 < 1 || y2 - y1 < 1) continue
    candidates.push({
      classId: best,
      label: labels[best] ?? `clase_${best}`,
      confidence: bestScore,
      x: x1 / box.srcWidth,
      y: y1 / box.srcHeight,
      width: (x2 - x1) / box.srcWidth,
      height: (y2 - y1) / box.srcHeight,
    })
  }
  // Limita candidatos antes de NMS para mantener la latencia estable en escenas muy cargadas.
  candidates.sort((a, b) => b.confidence - a.confidence)
  return nonMaxSuppression(candidates.slice(0, 300), iouThreshold, 100)
}

export const COCO_LABELS: readonly string[] = [
  'person','bicycle','car','motorcycle','airplane','bus','train','truck','boat','traffic light','fire hydrant','stop sign','parking meter','bench','bird','cat','dog','horse','sheep','cow','elephant','bear','zebra','giraffe','backpack','umbrella','handbag','tie','suitcase','frisbee','skis','snowboard','sports ball','kite','baseball bat','baseball glove','skateboard','surfboard','tennis racket','bottle','wine glass','cup','fork','knife','spoon','bowl','banana','apple','sandwich','orange','broccoli','carrot','hot dog','pizza','donut','cake','chair','couch','potted plant','bed','dining table','toilet','tv','laptop','mouse','remote','keyboard','cell phone','microwave','oven','toaster','sink','refrigerator','book','clock','vase','scissors','teddy bear','hair drier','toothbrush',
]
