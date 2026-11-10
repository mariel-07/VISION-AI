import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Cpu,
  Download,
  Eye,
  ImagePlus,
  Play,
  Radio,
  RefreshCw,
  Scan,
  ShieldAlert,
  Sparkles,
  Upload,
  Volume2,
  Wifi
} from 'lucide-react'
import { useAuth } from '../../auth/services/AuthContext'
import { detectBrowserObjects, getBrowserModelInfo, loadBrowserVisionModel } from '../../../shared/services/browserVision'
import {
  addAlerts,
  filterDetectionsByScenario,
  getSettings,
  makeId,
  saveAnalysis,
  type Analysis,
  type Detection
} from '../../../shared/services/store'
import {
  elementToBase64,
  fileToBase64,
  getGeminiApiKey,
  runIndustrialSafetyAudit,
  setGeminiApiKey,
  testGeminiConnection,
  type GeminiAuditReport
} from '../../../shared/services/geminiVision'
import { sendTelegramAlert } from '../../../shared/services/telegramService'
import {
  getAvailableVideoDevices,
  IP_STREAM_PRESETS,
  startHardwareCameraStream,
  type CameraDevice,
  type IpStreamPreset
} from '../../../shared/services/cameraManager'

const scenarios = [
  'Seguridad industrial',
  'Almacén inteligente',
  'Control de calidad',
  'Retail',
  'Transporte y logística',
  'Agricultura'
] as const
type Scenario = typeof scenarios[number]
type Task = 'detect' | 'segment' | 'patterns' | 'combined'
type Pattern = { name: string; confidence: string; evidence: string }
type ApiAlert = { severity: 'Baja' | 'Media' | 'Alta' | 'Crítica'; message: string }
type InferResult = {
  detections: Detection[]
  width: number
  height: number
  duration_ms: number
  engine: string
  patterns: Pattern[]
  alerts: ApiAlert[]
  specialized_model: boolean
  model_notice: string
}



export default function AnalysisPage() {
  const { user } = useAuth()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ipImageRef = useRef<HTMLImageElement>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const streamRef = useRef<MediaStream | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const previewRef = useRef('')
  const liveAlertKeys = useRef<Set<string>>(new Set())
  const liveAnalysisId = useRef('')
  const liveAnalysisCreatedAt = useRef('')
  const audioContextRef = useRef<AudioContext | null>(null)
  const alarmEnabledRef = useRef(false)
  const browserBusyRef = useRef(false)
  const lastPersistRef = useRef(0)

  const [searchParams] = useSearchParams()
  const urlScenario = searchParams.get('scenario') as Scenario | null

  // Estado general
  const [engineMode, setEngineMode] = useState<'edge' | 'gemini' | 'sim'>('edge')
  const [source, setSource] = useState<'image' | 'camera_hw' | 'camera_ip' | 'simulator'>('image')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [scenario, setScenario] = useState<Scenario>(() => {
    if (urlScenario && scenarios.includes(urlScenario)) return urlScenario
    const saved = getSettings().scenario as Scenario
    return scenarios.includes(saved) ? saved : 'Seguridad industrial'
  })
  const [task, setTask] = useState<Task>('combined')
  const [confidence, setConfidence] = useState(getSettings().confidence)

  // Referencias para ciclos asíncronos continuos (cámara en vivo) y re-filtrado en caliente
  const scenarioRef = useRef<Scenario>(scenario)
  scenarioRef.current = scenario
  const confidenceRef = useRef(confidence)
  confidenceRef.current = confidence
  const rawDetectionsRef = useRef<Detection[]>([])
  const [status, setStatus] = useState('Estación de inspección lista')
  const [busy, setBusy] = useState(false)
  const [alarmEnabled, setAlarmEnabled] = useState(false)
  const [live, setLive] = useState(false)
  const [detections, setDetections] = useState<Detection[]>([])
  const [metrics, setMetrics] = useState<InferResult | null>(null)
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [liveAlerts, setLiveAlerts] = useState<ApiAlert[]>([])
  const [error, setError] = useState('')
  const [zone, setZone] = useState({ x: 0.65, y: 0.12, width: 0.32, height: 0.78 })

  // Selección de cámaras de hardware (USB / Bluetooth / Integrada)
  const [videoDevices, setVideoDevices] = useState<CameraDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [showDeviceModal, setShowDeviceModal] = useState(false)

  // Selección de cámara IP / RTSP / Stream
  const [selectedIpPreset, setSelectedIpPreset] = useState<IpStreamPreset>(IP_STREAM_PRESETS[0])
  const [customIpUrl, setCustomIpUrl] = useState('')
  const [showIpModal, setShowIpModal] = useState(false)

  // Auditoría Multimodal Gemini
  const [auditReport, setAuditReport] = useState<GeminiAuditReport | null>(null)
  const [auditingGemini, setAuditingGemini] = useState(false)
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState(getGeminiApiKey())
  const [showKeyConfig, setShowKeyConfig] = useState(false)

  // Inicialización y carga de dispositivos
  useEffect(() => {
    getAvailableVideoDevices().then(devices => {
      setVideoDevices(devices)
      if (devices.length > 0) setSelectedDeviceId(devices[0].deviceId)
    })

    return () => {
      stopCamera()
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
      if (audioContextRef.current) void audioContextRef.current.close()
    }
  }, [])

  // Redibujado de canvas sobreimpreso
  useEffect(() => {
    if ((!preview && !live) || !canvasRef.current) return
    drawOverlay()
  }, [detections, preview, metrics, live, zone, scenario])

  function toggleAlarm() {
    if (!alarmEnabledRef.current) {
      try {
        const context = new AudioContext()
        audioContextRef.current = context
        void context.resume()
        alarmEnabledRef.current = true
        setAlarmEnabled(true)
        setStatus('Alarma sonora habilitada para infracciones de seguridad')
      } catch {
        setError('El navegador no permitió inicializar el sintetizador de audio.')
      }
    } else {
      alarmEnabledRef.current = false
      setAlarmEnabled(false)
      setStatus('Alarma sonora deshabilitada')
    }
  }

  function playAlarm() {
    const context = audioContextRef.current
    if (!alarmEnabledRef.current || !context) return
    try {
      const osc = context.createOscillator()
      const gain = context.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(880, context.currentTime)
      osc.frequency.exponentialRampToValueAtTime(440, context.currentTime + 0.35)
      gain.gain.value = 0.08
      osc.connect(gain)
      gain.connect(context.destination)
      osc.start()
      osc.stop(context.currentTime + 0.35)
    } catch {}
  }

  function shouldSound(items: ApiAlert[]) {
    if (items.some(item => item.severity === 'Alta' || item.severity === 'Crítica')) {
      playAlarm()
    }
  }

  function stopCamera() {
    if (timerRef.current !== undefined) {
      window.clearInterval(timerRef.current)
      timerRef.current = undefined
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setLive(false)
    setStatus('Transmisión detenida')
  }

  function drawOverlay() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = metrics?.width || imageRef.current?.naturalWidth || ipImageRef.current?.naturalWidth || canvas.width || 640
    const h = metrics?.height || imageRef.current?.naturalHeight || ipImageRef.current?.naturalHeight || canvas.height || 360
    canvas.width = w
    canvas.height = h
    ctx.clearRect(0, 0, w, h)

    // Zona restringida o de exclusión
    if (scenario === 'Almacén inteligente' || scenario === 'Seguridad industrial') {
      ctx.save()
      ctx.setLineDash([8, 6])
      ctx.strokeStyle = '#ef4444'
      ctx.fillStyle = 'rgba(239, 68, 68, 0.12)'
      ctx.lineWidth = Math.max(2, w / 450)
      ctx.fillRect(zone.x * w, zone.y * h, zone.width * w, zone.height * h)
      ctx.strokeRect(zone.x * w, zone.y * h, zone.width * w, zone.height * h)
      ctx.setLineDash([])

      // Cabecera de la zona
      ctx.fillStyle = '#ef4444'
      const tag = '⚠ ZONA EXCLUSIÓN OSHA · RIESGO CRÍTICO'
      ctx.font = `bold ${Math.max(11, Math.round(w / 70))}px sans-serif`
      const tw = ctx.measureText(tag).width
      ctx.fillRect(zone.x * w, Math.max(0, zone.y * h - 22), tw + 14, 22)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(tag, zone.x * w + 7, Math.max(15, zone.y * h - 6))
      ctx.restore()
    }

    // Detecciones con bounding box y máscaras
    detections.forEach((d, i) => {
      const x = d.x * w
      const y = d.y * h
      const bw = d.width * w
      const bh = d.height * h
      const isViolation = d.label.toLowerCase().includes('no_') || d.label.toLowerCase().includes('sin')
      const color = isViolation ? '#ef4444' : `hsl(${(i * 70 + 190) % 360} 85% 48%)`

      // Máscara si existe
      if (d.mask && d.mask.length > 2) {
        ctx.beginPath()
        d.mask.forEach((p, j) => (j === 0 ? ctx.moveTo(p[0] * w, p[1] * h) : ctx.lineTo(p[0] * w, p[1] * h)))
        ctx.closePath()
        ctx.fillStyle = `${color}44`
        ctx.fill()
        ctx.strokeStyle = color
        ctx.lineWidth = Math.max(2, w / 400)
        ctx.stroke()
      }

      // Caja delimitadora
      ctx.strokeStyle = color
      ctx.lineWidth = Math.max(2, Math.round(w / 400))
      ctx.strokeRect(x, y, bw, bh)

      // Etiqueta profesional
      ctx.fillStyle = color
      const label = `${d.label.toUpperCase()}${d.trackId ? ` #${d.trackId}` : ''} ${(d.confidence * 100).toFixed(0)}%`
      ctx.font = `bold ${Math.max(11, Math.round(w / 65))}px sans-serif`
      const tw = ctx.measureText(label).width
      ctx.fillRect(x, Math.max(0, y - 24), tw + 12, 22)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(label, x + 6, Math.max(16, y - 8))
    })
  }

  function onFile(f?: File) {
    if (!f) return
    setError('')
    const ext = f.name.toLowerCase().split('.').pop()
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) && !['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) {
      setError('Formato no soportado. Selecciona un archivo JPG, PNG o WEBP.')
      return
    }
    if (f.size > 15 * 1024 * 1024) {
      setError('La imagen supera el límite máximo de 15 MB.')
      return
    }
    const next = URL.createObjectURL(f)
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = next
    stopCamera()
    setFile(f)
    setPreview(next)
    setSource('image')
    setDetections([])
    setMetrics(null)
    setPatterns([])
    setLiveAlerts([])
    setStatus(`Imagen cargada: ${f.name}`)
  }

  /**
   * Filtra las detecciones crudas dejando ÚNICAMENTE las clases que pertenecen
   * al escenario especificado (o activo) y que están habilitadas.
   */
  function filterEnabledClasses(items: Detection[], targetScenario?: string): Detection[] {
    const sc = targetScenario || scenarioRef.current || scenario
    return filterDetectionsByScenario(items, sc)
  }

  function evaluateScene(found: Detection[], targetScenario?: string) {
    const sc = targetScenario || scenarioRef.current || scenario
    const p: Pattern[] = []
    const a: ApiAlert[] = []
    const norm = (t: string) => t.toLowerCase().replace(/[\s-]+/g, '_')
    const count = (names: string[]) => found.filter(item => names.includes(norm(item.label))).length

    const people = found.filter(item => norm(item.label) === 'person' || norm(item.label) === 'operario' || norm(item.label) === 'worker')
    const helmets = count(['helmet', 'hardhat', 'casco', 'safety_helmet'])
    const noHelmet = count(['no_helmet', 'sin_casco', 'no_hardhat', 'head'])
    const vests = count(['vest', 'chaleco', 'safety_vest'])
    const noVest = count(['no_vest', 'sin_chaleco'])
    const forklifts = count(['forklift', 'montacargas'])
    const trucks = count(['truck', 'camion', 'trailer'])

    if (sc === 'Seguridad industrial') {
      const totalWorkers = Math.max(people.length, helmets + noHelmet, vests + noVest)
      if (totalWorkers > 0) {
        p.push({
          name: 'Censo de Personal en Planta',
          confidence: 'YOLOv8 Edge Industrial',
          evidence: `${totalWorkers} operario(s) detectados · ${helmets} casco(s) · ${vests} chaleco(s) verificados.`
        })

        if (noHelmet > 0) {
          p.push({
            name: 'Infracción Crítica OSHA 1910.135',
            confidence: 'Clase de Red Neuronal',
            evidence: `${noHelmet} trabajador(es) identificados sin casco en zona de riesgo de impacto.`
          })
          a.push({
            severity: 'Crítica',
            message: `Infracción de EPP Crítica: ${noHelmet} operario(s) sin casco reglamentario en línea operativa.`
          })
        }

        if (noVest > 0) {
          p.push({
            name: 'Infracción Visibilidad EN ISO 20471',
            confidence: 'Clase de Red Neuronal',
            evidence: `${noVest} trabajador(es) sin chaleco reflectante en zona de circulación.`
          })
          a.push({
            severity: 'Alta',
            message: `Falta de Chaleco: ${noVest} operario(s) sin prenda de alta visibilidad.`
          })
        }

        if (forklifts > 0) {
          p.push({
            name: 'Interacción Hombre-Máquina',
            confidence: 'Regla de Proximidad',
            evidence: `${forklifts} montacargas operando simultáneamente con personal a pie.`
          })
          a.push({
            severity: 'Alta',
            message: 'Riesgo de Atropello: Operación simultánea de montacargas y trabajadores en el mismo radio.'
          })
        }

        if (noHelmet === 0 && noVest === 0 && (helmets > 0 || vests > 0)) {
          p.push({
            name: 'Cumplimiento Normativo Satisfactorio',
            confidence: 'Verificación Automatizada',
            evidence: 'Todo el personal visualizado cuenta con sus implementos de protección reglamentarios.'
          })
        }
      } else {
        p.push({
          name: 'Área Despejada',
          confidence: 'YOLOv8 Edge',
          evidence: 'No se localiza personal dentro del encuadre actual de seguridad industrial.'
        })
      }

      // Zona de exclusión
      const insideZone = people.filter(item => {
        const cx = item.x + item.width / 2
        const cy = item.y + item.height / 2
        return cx >= zone.x && cx <= zone.x + zone.width && cy >= zone.y && cy <= zone.y + zone.height
      })

      if (insideZone.length > 0) {
        p.push({
          name: 'Incursión en Perímetro Restringido',
          confidence: 'Geometría Espacial',
          evidence: `${insideZone.length} persona(s) dentro de la zona de exclusión de maquinaria.`
        })
        a.push({
          severity: 'Crítica',
          message: `ALERTA DE PARO: ${insideZone.length} operario(s) dentro de la zona de exclusión restringida.`
        })
      }
    } else if (sc === 'Almacén inteligente') {
      const boxes = count(['box', 'caja', 'carton'])
      const pallets = count(['pallet', 'pallets', 'tarima'])
      const packages = count(['package', 'paquete'])

      if (forklifts > 0) {
        p.push({
          name: 'Tráfico de Carretillas Elevadoras',
          confidence: 'Detección Almacén',
          evidence: `${forklifts} montacargas activo(s) en la nave logística.`
        })
        if (people.length > 0) {
          a.push({
            severity: 'Alta',
            message: `Alerta de Interacción Logística: ${forklifts} montacargas y ${people.length} peatón(es) en zona compartida.`
          })
        }
      }
      if (boxes + pallets + packages > 0) {
        p.push({
          name: 'Inventario de Carga en Escena',
          confidence: 'Clases de Almacén',
          evidence: `${boxes} caja(s), ${pallets} pallet(s), ${packages} paquete(s) detectados.`
        })
      }
      if (found.length === 0) {
        p.push({
          name: 'Pasillo Logístico Despejado',
          confidence: 'Filtro Almacén',
          evidence: 'No se detectan elementos de almacén en este encuadre.'
        })
      }
    } else if (sc === 'Control de calidad') {
      const products = count(['product', 'producto', 'pieza'])
      const bottles = count(['bottle', 'botella'])
      const defects = count(['defect', 'defecto', 'falla'])
      const scratches = count(['scratch', 'rayon'])
      const cracks = count(['crack', 'grieta'])

      if (products + bottles > 0) {
        p.push({
          name: 'Piezas en Línea de Inspección',
          confidence: 'Control de Calidad',
          evidence: `${products + bottles} producto(s)/botella(s) ubicados para inspección óptica.`
        })
      }
      if (defects + scratches + cracks > 0) {
        p.push({
          name: 'Anomalías Superficiales Detectadas',
          confidence: 'Detección de Defectos',
          evidence: `${defects + scratches + cracks} anomalía(s) identificadas (rayones/grietas).`
        })
        a.push({
          severity: 'Alta',
          message: `Defecto de Calidad: ${defects + scratches + cracks} producto(s) presentan imperfecciones visuales.`
        })
      }
      if (found.length === 0) {
        p.push({
          name: 'Línea Libre de Objetivos',
          confidence: 'Filtro Calidad',
          evidence: 'No se registran productos o defectos del catálogo de calidad en el encuadre.'
        })
      }
    } else if (sc === 'Retail') {
      const shoppers = people.length
      const bags = count(['handbag', 'suitcase', 'backpack'])
      const bottles = count(['bottle', 'cup'])

      if (shoppers > 0) {
        p.push({
          name: 'Monitoreo de Aforo Comercial',
          confidence: 'Detección Retail',
          evidence: `${shoppers} cliente(s) en tienda · ${bags} bolso(s)/maleta(s) · ${bottles} envase(s)/artículo(s).`
        })
        if (shoppers >= 4) {
          a.push({
            severity: 'Media',
            message: `Aglomeración en Pasillo: ${shoppers} personas en el mismo sector comercial.`
          })
        }
      }
      if (found.length === 0) {
        p.push({
          name: 'Zona Comercial Despejada',
          confidence: 'Filtro Retail',
          evidence: 'Sin presencia de clientes ni artículos comerciales en el encuadre.'
        })
      }
    } else if (sc === 'Transporte y logística') {
      const cars = count(['car', 'auto'])
      const buses = count(['bus', 'autobus'])
      const motos = count(['motorcycle', 'moto'])
      const bikes = count(['bicycle', 'bicicleta'])
      const totalVehicles = trucks + cars + buses + motos + bikes

      if (totalVehicles > 0) {
        p.push({
          name: 'Tráfico en Patio de Maniobras',
          confidence: 'Detección Transporte',
          evidence: `${totalVehicles} vehículo(s) detectado(s) (${trucks} camiones, ${cars} autos, ${buses} buses, ${motos} motos, ${bikes} bicis).`
        })
      }
      if (found.length === 0) {
        p.push({
          name: 'Patio de Maniobras Despejado',
          confidence: 'Filtro Transporte',
          evidence: 'No se detectan vehículos de transporte en la zona de encuadre.'
        })
      }
    } else if (sc === 'Agricultura') {
      const apples = count(['apple', 'manzana'])
      const bananas = count(['banana', 'platano'])
      const oranges = count(['orange', 'naranja'])
      const plants = count(['plant', 'potted_plant', 'leaf'])
      const totalProduce = apples + bananas + oranges

      if (totalProduce > 0 || plants > 0) {
        p.push({
          name: 'Clasificación de Cultivos y Frutas',
          confidence: 'Detección Agrícola',
          evidence: `${totalProduce} fruta(s) (${apples} manzanas, ${bananas} plátanos, ${oranges} naranjas) · ${plants} elemento(s) vegetal(es).`
        })
      }
      if (found.length === 0) {
        p.push({
          name: 'Sector Agrícola sin Objetivos',
          confidence: 'Filtro Agrícola',
          evidence: 'No se detectan frutas ni cultivos del catálogo en el encuadre actual.'
        })
      }
    } else {
      p.push({
        name: `Actividad en ${sc}`,
        confidence: 'YOLOv8 Edge',
        evidence: `${found.length} elemento(s) pertenecientes al escenario detectados.`
      })
    }

    return { patterns: p, alerts: a }
  }

  // Ejecución de inferencia Edge en Navegador (YOLOv8 ONNX client-side)
  async function runEdgeAnalysis() {
    if (!file || !imageRef.current) {
      setError('Por favor carga una imagen o activa la cámara para analizar.')
      return
    }

    setBusy(true)
    setError('')
    setStatus('Iniciando inferencia Edge (YOLOv8 ONNX en este dispositivo)…')

    try {
      await loadBrowserVisionModel(scenario)
      const result = await detectBrowserObjects(imageRef.current, confidence, scenario)
      rawDetectionsRef.current = result.detections
      const filteredDetections = filterEnabledClasses(result.detections, scenario)
      const evaluated = evaluateScene(filteredDetections, scenario)

      const inferResult: InferResult = {
        detections: filteredDetections,
        width: result.width,
        height: result.height,
        duration_ms: result.durationMs,
        engine: 'IA EDGE (NAVEGADOR)',
        patterns: evaluated.patterns,
        alerts: evaluated.alerts,
        specialized_model: getBrowserModelInfo().specialized,
        model_notice: `YOLOv8 Edge · Escenario "${scenario}" · ${filteredDetections.length} objeto(s) válido(s) · ${result.durationMs.toFixed(0)} ms`
      }

      setMetrics(inferResult)
      setDetections(inferResult.detections)
      setPatterns(inferResult.patterns)
      setLiveAlerts(inferResult.alerts)
      shouldSound(inferResult.alerts)
      setStatus(`Análisis completado · ${inferResult.detections.length} detecciones · ${inferResult.duration_ms.toFixed(0)} ms`)

      // Guardar en repositorio empresarial local
      const analysisRecord: Analysis = {
        id: makeId('AN'),
        createdAt: new Date().toISOString(),
        sourceName: file.name,
        scenario,
        mode: task,
        engine: 'IA EDGE (NAVEGADOR)',
        durationMs: inferResult.duration_ms,
        plantZone: 'Estación de Inspección 01',
        detections: inferResult.detections,
        patterns: inferResult.patterns.map(p => `${p.name}: ${p.evidence}`),
        alerts: inferResult.alerts.map(a => a.message),
        imageData: preview,
        width: inferResult.width,
        height: inferResult.height,
        volumeCm3: 35000,
        status: 'COMPLETADO',
        createdBy: user?.name || 'Operador HSE'
      }
      saveAnalysis(analysisRecord)

      // Registrar alertas en Centro de Alertas
      if (inferResult.alerts.length > 0) {
        addAlerts(
          inferResult.alerts.map(a => ({
            id: makeId('ALT'),
            analysisId: analysisRecord.id,
            createdAt: analysisRecord.createdAt,
            severity: a.severity,
            message: `[INSPECCIÓN EDGE] ${a.message}`,
            status: 'Nueva',
            scenario,
            zone: 'Estación de Inspección 01',
            assignedSupervisor: user?.name || 'Supervisor de Seguridad'
          }))
        )

        // Despachar inmediatamente a Telegram alertas Alta y Crítica
        inferResult.alerts
          .filter(a => a.severity === 'Alta' || a.severity === 'Crítica')
          .forEach(a => {
            void sendTelegramAlert({
              severity: a.severity,
              message: a.message,
              scenario
            })
          })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error ejecutando inferencia en el navegador.')
      setStatus('Error de inferencia Edge')
    } finally {
      setBusy(false)
    }
  }

  // Ejecución de Auditoría Forense Multimodal con Gemini Vision API ("Algo fuera de lo común")
  async function runGeminiVisionAudit() {
    setAuditingGemini(true)
    setError('')
    setStatus('Ejecutando Auditoría Multimodal Gemini Vision (Evaluación OSHA / ISO 45001)…')

    try {
      let base64 = ''
      if (source === 'camera_hw' && videoRef.current) {
        base64 = await elementToBase64(videoRef.current)
      } else if (file) {
        base64 = await fileToBase64(file)
      } else if (imageRef.current) {
        base64 = await elementToBase64(imageRef.current)
      } else if (ipImageRef.current) {
        base64 = await elementToBase64(ipImageRef.current)
      } else {
        throw new Error('Carga una imagen o activa la cámara para realizar la auditoría multimodal.')
      }

      const currentLabels = detections.map(d => d.label)
      const report = await runIndustrialSafetyAudit(base64, currentLabels, scenario)
      setAuditReport(report)
      setShowAuditModal(true)
      setStatus(`Auditoría Gemini completada · Índice de Seguridad: ${report.complianceScore}%`)

      // Guardar también en el registro histórico empresarial
      const analysisRecord: Analysis = {
        id: makeId('AN-GEMINI'),
        createdAt: new Date().toISOString(),
        sourceName: file ? file.name : 'Captura de Cámara / Stream',
        scenario,
        mode: 'Auditoría Forense Multimodal',
        engine: 'IA MULTIMODAL (GEMINI)',
        durationMs: 85,
        plantZone: 'Sector Auditado con IA Multimodal',
        detections: detections,
        patterns: report.hazardsIdentified,
        alerts: report.riskLevel === 'Crítico' || report.riskLevel === 'Alto'
          ? [report.executiveSummary]
          : [],
        imageData: preview,
        width: 1280,
        height: 720,
        volumeCm3: null,
        status: 'COMPLETADO',
        createdBy: `${user?.name || 'Operador'} · IA Gemini`,
        auditReport: report
      }
      saveAnalysis(analysisRecord)

      if (report.riskLevel === 'Crítico' || report.riskLevel === 'Alto') {
        const severity = report.riskLevel === 'Crítico' ? 'Crítica' : 'Alta'
        addAlerts([
          {
            id: makeId('ALT-GEMINI'),
            analysisId: analysisRecord.id,
            createdAt: analysisRecord.createdAt,
            severity,
            message: `[AUDITORÍA GEMINI] ${report.executiveSummary}`,
            status: 'Nueva',
            scenario,
            zone: 'Planta Principal',
            assignedSupervisor: 'Gerencia HSE',
            correctiveProtocol: report.correctiveActions[0] || 'Intervención correctiva recomendada'
          }
        ])
        playAlarm()

        // Despachar inmediatamente reporte crítico/alto de Gemini a Telegram
        void sendTelegramAlert({
          severity,
          message: `[Auditoría Forense Gemini] ${report.executiveSummary}`,
          scenario
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error durante la auditoría con Gemini.')
      setStatus('Fallo en auditoría multimodal')
    } finally {
      setAuditingGemini(false)
    }
  }

  // Iniciar Cámara Física (USB / Cable / Bluetooth / Integrada)
  async function startHardwareCamera(deviceId?: string) {
    stopCamera()
    setError('')
    setStatus('Conectando cámara de hardware y cargando modelo YOLOv8…')
    try {
      await loadBrowserVisionModel(scenario)
      const stream = await startHardwareCameraStream(deviceId || selectedDeviceId)
      streamRef.current = stream
      const video = videoRef.current
      if (!video) return

      video.srcObject = stream
      await video.play()

      setSource('camera_hw')
      setLive(true)
      liveAlertKeys.current.clear()
      liveAnalysisId.current = makeId('LIVE-HW')
      liveAnalysisCreatedAt.current = new Date().toISOString()
      setStatus('Cámara de hardware activa · Inspección continua en tiempo real')

      // Loop de inferencia continua
      timerRef.current = window.setInterval(async () => {
        if (video.readyState < 2 || browserBusyRef.current) return
        browserBusyRef.current = true
        try {
          const activeScenario = scenarioRef.current
          const activeConf = confidenceRef.current
          const result = await detectBrowserObjects(video, activeConf, activeScenario)
          rawDetectionsRef.current = result.detections
          const filtered = filterEnabledClasses(result.detections, activeScenario)
          const evaluated = evaluateScene(filtered, activeScenario)

          const r: InferResult = {
            detections: filtered,
            width: result.width,
            height: result.height,
            duration_ms: result.durationMs,
            engine: 'IA EDGE (NAVEGADOR)',
            patterns: evaluated.patterns,
            alerts: evaluated.alerts,
            specialized_model: true,
            model_notice: `Cámara en Vivo · Escenario "${activeScenario}" · ${filtered.length} detección(es) válida(s)`
          }

          setMetrics(r)
          setDetections(r.detections)
          setPatterns(r.patterns)
          setLiveAlerts(r.alerts)

          // Alertas en vivo no repetitivas
          const fresh = r.alerts.filter(a => {
            const k = `${activeScenario}:${a.message}`
            if (liveAlertKeys.current.has(k)) return false
            liveAlertKeys.current.add(k)
            return true
          })

          if (fresh.length > 0) {
            shouldSound(fresh)
            addAlerts(
              fresh.map(a => ({
                id: makeId('ALT'),
                analysisId: liveAnalysisId.current,
                createdAt: new Date().toISOString(),
                severity: a.severity,
                message: `[CÁMARA VIVO] ${a.message}`,
                status: 'Nueva',
                scenario,
                zone: 'Zona de Video en Vivo'
              }))
            )

            // Despachar a Telegram alertas Alta o Crítica en vivo
            fresh
              .filter(a => a.severity === 'Alta' || a.severity === 'Crítica')
              .forEach(a => {
                void sendTelegramAlert({
                  severity: a.severity,
                  message: a.message,
                  scenario
                })
              })
          }

          if (Date.now() - lastPersistRef.current > 3500) {
            lastPersistRef.current = Date.now()
            let liveSnap = ''
            try {
              if (videoRef.current && videoRef.current.videoWidth > 0) {
                const offCanvas = document.createElement('canvas')
                offCanvas.width = 640
                offCanvas.height = 360
                const ctx = offCanvas.getContext('2d')
                if (ctx) {
                  ctx.drawImage(videoRef.current, 0, 0, 640, 360)
                  liveSnap = offCanvas.toDataURL('image/jpeg', 0.6)
                }
              }
            } catch {}

            saveAnalysis({
              id: liveAnalysisId.current,
              createdAt: liveAnalysisCreatedAt.current,
              sourceName: `Cámara Física (${selectedDeviceId ? 'Dispositivo Seleccionado' : 'Integrada/USB'})`,
              scenario,
              mode: task,
              engine: 'IA EDGE (NAVEGADOR)',
              durationMs: r.duration_ms,
              plantZone: 'Transmisión en Vivo',
              detections: r.detections,
              patterns: r.patterns.map(p => `${p.name}: ${p.evidence}`),
              alerts: r.alerts.map(a => a.message),
              imageData: liveSnap,
              width: r.width,
              height: r.height,
              volumeCm3: null,
              status: 'EN_PROCESO',
              createdBy: user?.name || 'Operador'
            })
          }
        } catch {}
        finally {
          browserBusyRef.current = false
        }
      }, 500)
    } catch (err) {
      stopCamera()
      setError(err instanceof Error ? err.message : 'No se pudo acceder a la cámara seleccionada.')
    }
  }

  // Iniciar Cámara IP / RTSP / Stream Industrial
  async function startIpCameraStream(streamPreset: IpStreamPreset, customUrl?: string) {
    stopCamera()
    setError('')
    setStatus(`Conectando flujo de Cámara IP: ${streamPreset.name}…`)

    const activeUrl = customUrl || streamPreset.url
    setSource('camera_ip')
    setLive(true)
    setPreview(activeUrl)

    try {
      await loadBrowserVisionModel(scenario)
      setStatus(`Cámara IP conectada (${streamPreset.protocol}) · Ejecutando inspección de seguridad…`)

      liveAlertKeys.current.clear()
      liveAnalysisId.current = makeId('LIVE-IP')
      liveAnalysisCreatedAt.current = new Date().toISOString()

      // Inferencia sobre la imagen del flujo IP
      timerRef.current = window.setInterval(async () => {
        if (!ipImageRef.current || browserBusyRef.current) return
        browserBusyRef.current = true
        try {
          const activeScenario = scenarioRef.current
          const activeConf = confidenceRef.current
          const result = await detectBrowserObjects(ipImageRef.current, activeConf, activeScenario)
          rawDetectionsRef.current = result.detections
          const filtered = filterEnabledClasses(result.detections, activeScenario)
          const evaluated = evaluateScene(filtered, activeScenario)

          const r: InferResult = {
            detections: filtered,
            width: result.width,
            height: result.height,
            duration_ms: result.durationMs,
            engine: 'IA EDGE (NAVEGADOR)',
            patterns: evaluated.patterns,
            alerts: evaluated.alerts,
            specialized_model: true,
            model_notice: `Flujo IP Activo · Escenario "${activeScenario}" · ${streamPreset.protocol} (${filtered.length} objetos)`
          }

          setMetrics(r)
          setDetections(r.detections)
          setPatterns(r.patterns)
          setLiveAlerts(r.alerts)

          const fresh = r.alerts.filter(a => {
            const k = `ip:${activeScenario}:${a.message}`
            if (liveAlertKeys.current.has(k)) return false
            liveAlertKeys.current.add(k)
            return true
          })

          if (fresh.length > 0) {
            shouldSound(fresh)
            addAlerts(
              fresh.map(a => ({
                id: makeId('ALT-IP'),
                analysisId: liveAnalysisId.current,
                createdAt: new Date().toISOString(),
                severity: a.severity,
                message: `[CÁMARA IP] ${a.message}`,
                status: 'Nueva',
                scenario,
                zone: streamPreset.name
              }))
            )

            // Despachar a Telegram alertas Alta o Crítica en vivo
            fresh
              .filter(a => a.severity === 'Alta' || a.severity === 'Crítica')
              .forEach(a => {
                void sendTelegramAlert({
                  severity: a.severity,
                  message: a.message,
                  scenario
                })
              })
          }
        } catch {}
        finally {
          browserBusyRef.current = false
        }
      }, 700)
    } catch (err) {
      stopCamera()
      setError('No se pudo establecer el flujo con la cámara IP seleccionada.')
    }
  }

  // Simulador de Inspección de Planta Industrial
  function runIndustrialSimulator() {
    stopCamera()
    setSource('simulator')
    setEngineMode('sim')
    setError('')
    setFile(null)

    const workers = [
      { id: 'OPERARIO-01', x: 0.16, y: 0.2, w: 0.16, h: 0.6, helmet: true, vest: true, boots: true, gloves: true },
      { id: 'OPERARIO-02', x: 0.44, y: 0.24, w: 0.16, h: 0.58, helmet: false, vest: true, boots: true, gloves: false },
      { id: 'OPERARIO-03', x: 0.72, y: 0.18, w: 0.16, h: 0.62, helmet: true, vest: false, boots: true, gloves: true }
    ]

    const ds: Detection[] = workers.flatMap((w, i) => {
      const items: Detection[] = [
        {
          id: `sim-w-${w.id}`,
          label: 'person',
          classId: 0,
          confidence: 0.95 - i * 0.02,
          x: w.x,
          y: w.y,
          width: w.w,
          height: w.h,
          trackId: i + 1
        }
      ]
      if (w.helmet) {
        items.push({
          id: `sim-h-${w.id}`,
          label: 'helmet',
          classId: 1,
          confidence: 0.92,
          x: w.x + 0.03,
          y: w.y,
          width: 0.1,
          height: 0.12
        })
      } else {
        items.push({
          id: `sim-nh-${w.id}`,
          label: 'no_helmet',
          classId: 6,
          confidence: 0.89,
          x: w.x + 0.03,
          y: w.y,
          width: 0.1,
          height: 0.12
        })
      }
      if (w.vest) {
        items.push({
          id: `sim-v-${w.id}`,
          label: 'vest',
          classId: 2,
          confidence: 0.94,
          x: w.x + 0.02,
          y: w.y + 0.14,
          width: 0.12,
          height: 0.22
        })
      } else {
        items.push({
          id: `sim-nv-${w.id}`,
          label: 'no_vest',
          classId: 11,
          confidence: 0.87,
          x: w.x + 0.02,
          y: w.y + 0.14,
          width: 0.12,
          height: 0.22
        })
      }
      return items
    })

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="900" height="520" viewBox="0 0 900 520">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#14213d"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
        </defs>
        <rect width="900" height="520" fill="url(#bg)"/>
        <path d="M0 380 L900 380" stroke="#334155" stroke-width="4"/>
        <path d="M0 430 L900 430" stroke="#1e293b" stroke-width="2"/>
        <text x="30" y="45" font-family="Arial" font-size="20" font-weight="bold" fill="#38bdf8">VISION AI · PLANTA INDUSTRIAL PILOTO · SIMULACIÓN HSE</text>
        ${workers
          .map(
            w => `
          <g transform="translate(${w.x * 900}, ${w.y * 520})">
            <rect x="0" y="0" width="135" height="300" rx="8" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="4"/>
            <circle cx="67" cy="40" r="26" fill="#cbd5e1"/>
            ${w.helmet ? '<path d="M40 38 Q67 8 94 38 Z" fill="#eab308" stroke="#ca8a04" stroke-width="3"/>' : '<circle cx="67" cy="20" r="8" fill="#ef4444"/>'}
            <rect x="35" y="70" width="65" height="95" rx="10" fill="${w.vest ? '#f97316' : '#475569'}"/>
            <path d="M35 85 L12 160 M100 85 L123 160 M50 165 L40 280 M85 165 L95 280" stroke="#64748b" stroke-width="14" stroke-linecap="round"/>
            <text x="15" y="320" font-family="Arial" font-size="14" font-weight="bold" fill="#f8fafc">${w.id}</text>
          </g>
        `
          )
          .join('')}
      </svg>
    `

    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = url
    setPreview(url)

    const evaluated = evaluateScene(ds)
    const simResult: InferResult = {
      detections: ds,
      width: 900,
      height: 520,
      duration_ms: 22,
      engine: 'SIMULADOR HSE',
      patterns: evaluated.patterns,
      alerts: evaluated.alerts,
      specialized_model: true,
      model_notice: 'SIMULADOR INDUSTRIAL ACTIVO · Evaluación pericial de normas OSHA e ISO 45001'
    }

    setMetrics(simResult)
    setDetections(ds)
    setPatterns(evaluated.patterns)
    setLiveAlerts(evaluated.alerts)
    shouldSound(evaluated.alerts)
    setStatus('Simulación de planta ejecutada con éxito')
  }

  // Guardar y Probar API Key de Gemini
  const [testingModalKey, setTestingModalKey] = useState(false)
  const [modalKeyStatus, setModalKeyStatus] = useState<{ success?: boolean; message?: string } | null>(null)

  async function handleTestModalApiKey() {
    setTestingModalKey(true)
    setModalKeyStatus(null)
    try {
      const res = await testGeminiConnection(apiKeyInput)
      setModalKeyStatus({ success: res.success, message: res.message })
      if (res.success) {
        setGeminiApiKey(apiKeyInput)
      }
    } catch (err) {
      setModalKeyStatus({
        success: false,
        message: err instanceof Error ? err.message : 'Error al probar Gemini'
      })
    } finally {
      setTestingModalKey(false)
    }
  }

  function handleSaveApiKey() {
    setGeminiApiKey(apiKeyInput)
    setShowKeyConfig(false)
    setModalKeyStatus(null)
    setStatus('API Key de Gemini configurada con éxito')
  }

  // Descarga de Informe de Auditoría Ejecutivo
  function downloadAuditReport() {
    if (!auditReport) return
    const content = `=====================================================
INFORME OFICIAL DE AUDITORÍA · VISION AI
REPORTE GENERADO POR INTELIGENCIA ARTIFICIAL GEMINI
=====================================================
ID Auditoría: ${auditReport.id}
Fecha y Hora: ${new Date(auditReport.timestamp).toLocaleString()}
Auditor Responsable: ${user?.name || 'Supervisor de Seguridad'} (${user?.role || 'HSE'})
Motor de IA: ${auditReport.modelUsed || (auditReport.usedLiveApi ? 'Google Gemini Vision (En Vivo)' : 'Motor Local')}
Escenario Operativo: ${auditReport.scenario || scenario}

0. DESCRIPCIÓN DE LA ESCENA CAPTURADA POR LA CÁMARA
-----------------------------------------------------
${auditReport.sceneDescription || 'Fotograma procesado directamente por la IA multimodal.'}

1. EVALUACIÓN Y CUMPLIMIENTO GLOBAL
-----------------------------------------------------
Índice de Cumplimiento: ${auditReport.complianceScore}%
Nivel de Riesgo Operativo: ${auditReport.riskLevel.toUpperCase()}
Dictamen Normativo: ${auditReport.oshaStatus}

2. CHECKLIST DE INSPECCIÓN VISUAL
-----------------------------------------------------
${auditReport.ppeChecklist
  .map(item => `[${item.present ? '✓ CONFORME' : '✗ NO CONFORME'}] ${item.item}\n   → ${item.details}`)
  .join('\n')}

3. PELIGROS Y HALLAZGOS IDENTIFICADOS EN LA IMAGEN
-----------------------------------------------------
${auditReport.hazardsIdentified.map((h, i) => `${i + 1}. ${h}`).join('\n')}

4. PLAN DE ACCIÓN CORRECTIVA RECOMENDADO
-----------------------------------------------------
${auditReport.correctiveActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}

5. DICTAMEN EJECUTIVO
-----------------------------------------------------
${auditReport.executiveSummary}

Notas del Inspector IA:
${auditReport.inspectorNotes}
=====================================================
Certificado emitido digitalmente por la Plataforma VISION AI.
Análisis visual en tiempo real · Modelo: ${auditReport.modelUsed || 'Gemini Vision'}
`
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Auditoria-${(auditReport.scenario || scenario).replace(/\s+/g, '-')}-${auditReport.id}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const currentCount = detections.length
  const workersDetected = detections.filter(d => d.label.toLowerCase().includes('person') || d.label.toLowerCase().includes('operario')).length

  return (
    <div className="module-page">
      {/* Cabecera Empresarial */}
      <div className="page-heading">
        <div>
          <span className="eyebrow">CENTRO DE OPERACIONES HSE</span>
          <h1>Análisis Visual e Inspección de Seguridad</h1>
          <p>
            Plataforma corporativa de visión artificial para inspección de EPP, delimitación perimetral y auditoría multimodal
            OSHA/ISO 45001.
          </p>
        </div>
        <div className="top-camera-controls" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="secondary-button" onClick={() => setShowDeviceModal(true)} title="Conectar cámaras USB, Cable o Bluetooth">
            <Radio size={15} /> Conectar Cámara Física ({videoDevices.length})
          </button>
          <button className="secondary-button" onClick={() => setShowIpModal(true)} title="Conectar cámaras IP o flujos RTSP">
            <Wifi size={15} /> Cámara IP / RTSP
          </button>
          <button
            className="secondary-button"
            onClick={() => setShowKeyConfig(true)}
            style={{ borderColor: apiKeyInput ? '#22c55e' : '#cbd5e1' }}
          >
            <Sparkles size={15} color={apiKeyInput ? '#16a34a' : '#64748b'} />
            {apiKeyInput ? 'Gemini API Activa' : 'Configurar Gemini API'}
          </button>
        </div>
      </div>

      {/* Barra de Controles y Selección de Motor */}
      <div className="analysis-toolbar">
        <div className="mode-switch">
          <button
            className={engineMode === 'edge' ? 'selected' : ''}
            onClick={() => {
              if (live) stopCamera()
              setEngineMode('edge')
            }}
          >
            <Cpu size={15} /> IA EDGE (NAVEGADOR)
          </button>
          <button
            className={engineMode === 'gemini' ? 'selected' : ''}
            onClick={() => {
              if (live) stopCamera()
              setEngineMode('gemini')
            }}
          >
            <Sparkles size={15} /> AUDITORÍA GEMINI
          </button>
          <button
            className={engineMode === 'sim' ? 'selected' : ''}
            onClick={() => {
              if (live) stopCamera()
              setEngineMode('sim')
            }}
          >
            <Activity size={15} /> SIMULADOR HSE
          </button>
        </div>

        <label>
          Escenario Operativo{' '}
          <select
            value={scenario}
            onChange={e => {
              const nextScenario = e.target.value as Scenario
              setScenario(nextScenario)
              scenarioRef.current = nextScenario

              // Si hay una imagen cargada con detecciones calculadas, re-filtrar al vuelo
              if (rawDetectionsRef.current.length > 0 && !live) {
                const filtered = filterDetectionsByScenario(rawDetectionsRef.current, nextScenario)
                const evaluated = evaluateScene(filtered, nextScenario)
                setDetections(filtered)
                setPatterns(evaluated.patterns)
                setLiveAlerts(evaluated.alerts)
                if (metrics) {
                  setMetrics({
                    ...metrics,
                    detections: filtered,
                    patterns: evaluated.patterns,
                    alerts: evaluated.alerts,
                    model_notice: `Filtro adaptado al escenario "${nextScenario}" · ${filtered.length} detección(es) válida(s)`
                  })
                }
                setStatus(`Escenario cambiado a "${nextScenario}" · ${filtered.length} objetos válidos`)
              } else if (!live) {
                setDetections([])
                setMetrics(null)
                setPatterns([])
                setLiveAlerts([])
                setStatus(`Escenario activo: ${nextScenario}`)
              }
            }}
          >
            {scenarios.map(s => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>

        <label>
          Modalidad{' '}
          <select
            value={task}
            onChange={e => {
              if (live) stopCamera()
              setTask(e.target.value as Task)
            }}
          >
            <option value="combined">Combinado (Detección + Reglas)</option>
            <option value="detect">Solo Detección EPP</option>
            <option value="segment">Segmentación Perimetral</option>
            <option value="patterns">Análisis de Patrones</option>
          </select>
        </label>

        <label>
          Sensibilidad <b>{Math.round(confidence * 100)}%</b>
          <input
            type="range"
            min="0.1"
            max="0.9"
            step="0.05"
            value={confidence}
            onChange={e => setConfidence(Number(e.target.value))}
          />
        </label>
      </div>

  
      
      

      {/* Configuración de Zona Restringida / Exclusión */}
      {(scenario === 'Almacén inteligente' || scenario === 'Seguridad industrial') && (
        <section className="panel zone-config">
          <div className="panel-heading">
            <div>
              <h3>Zona de Exclusión Perimetral (OSHA 1910)</h3>
              <p>Delimita el perímetro rojo sobre maquinaria en movimiento. Se emitirá alarma si un operario invade el área.</p>
            </div>
            <ShieldAlert size={18} color="#ef4444" />
          </div>
          <div className="zone-fields">
            {(['x', 'y', 'width', 'height'] as const).map(k => (
              <label key={k}>
                {k === 'x' ? 'Eje X (%)' : k === 'y' ? 'Eje Y (%)' : k === 'width' ? 'Ancho (%)' : 'Alto (%)'}
                <input
                  type="number"
                  min={0}
                  max={Math.round((k === 'x' ? 1 - zone.width : k === 'y' ? 1 - zone.height : k === 'width' ? 1 - zone.x : 1 - zone.y) * 100)}
                  value={Math.round(zone[k] * 100)}
                  onChange={e => {
                    const limit = k === 'x' ? 1 - zone.width : k === 'y' ? 1 - zone.height : k === 'width' ? 1 - zone.x : 1 - zone.y
                    const v = Math.max(0, Math.min(limit, (Number(e.target.value) || 0) / 100))
                    setZone(z => ({ ...z, [k]: v }))
                  }}
                />
              </label>
            ))}
          </div>
        </section>
      )}

      {/* Cuadrícula Principal de Análisis */}
      <div className="analysis-grid">
        {/* Panel Visor */}
        <section className="panel viewer-panel">
          <div className="panel-heading">
            <div>
              <h3>Visor de Inspección en Tiempo Real</h3>
              <p>
                {source === 'camera_hw'
                  ? 'Transmisión directa desde dispositivo físico (USB / Bluetooth / Integrada)'
                  : source === 'camera_ip'
                  ? `Cámara IP Industrial (${selectedIpPreset.name})`
                  : source === 'simulator'
                  ? 'Escena virtual simulada de planta industrial'
                  : 'Inspección de imagen estática de alta resolución'}
              </p>
            </div>
            <span className={`live-chip ${live ? 'is-live' : ''}`}>
              <i />
              {live ? 'EN VIVO' : source === 'simulator' ? 'SIMULADOR' : 'ESTACIÓN LISTA'}
            </span>
          </div>

          <div className={`viewer-stage ${live ? 'streaming' : ''}`}>
            {/* Video elemento para cámaras de hardware */}
            <video
              ref={videoRef}
              muted
              playsInline
              style={{ display: source === 'camera_hw' && live ? 'block' : 'none' }}
            />

            {/* Imagen elemento para cámara IP */}
            {source === 'camera_ip' && live && (
              <img
                ref={ipImageRef}
                src={preview}
                crossOrigin="anonymous"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onLoad={() => drawOverlay()}
              />
            )}

            {/* Imagen normal */}
            {source !== 'camera_hw' && source !== 'camera_ip' && preview ? (
              <>
                <img
                  ref={imageRef}
                  src={preview}
                  onLoad={() => drawOverlay()}
                  onError={() => setError('No se pudo visualizar la imagen seleccionada.')}
                />
              </>
            ) : source !== 'camera_hw' && source !== 'camera_ip' && !live ? (
              <div className="empty-view">
                <div>
                  <ImagePlus size={38} />
                  <b>Carga una imagen o conecta una cámara</b>
                  <span>Soporta JPG, PNG, WEBP, Cámaras USB, Bluetooth o Flujos IP RTSP</span>
                </div>
              </div>
            ) : null}

            {/* Canvas para dibujar overlays */}
            <canvas ref={canvasRef} className="overlay-canvas" />

            <div className="viewer-corner">
              VISION AI · {engineMode === 'edge' ? 'EDGE ONNX' : engineMode === 'gemini' ? 'GEMINI MULTIMODAL' : 'SIMULADOR'}
            </div>
          </div>

          {/* Botones de Acción del Visor */}
          <div className="viewer-actions">
            <label className="secondary-button">
              <Upload size={15} /> Cargar Imagen
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={e => {
                  onFile(e.target.files?.[0])
                  e.currentTarget.value = ''
                }}
              />
            </label>

            <button
              className="secondary-button"
              onClick={() => {
                if (live) stopCamera()
                else startHardwareCamera()
              }}
            >
              <Camera size={15} />
              {live ? 'Detener Cámara' : 'Activar Cámara'}
            </button>

            <button className="secondary-button" onClick={runIndustrialSimulator}>
              <Activity size={15} /> Probar Simulador
            </button>

            <button
              className={`secondary-button ${alarmEnabled ? 'active-alarm' : ''}`}
              onClick={toggleAlarm}
              title="Activar sirena sonora en caso de alertas críticas"
            >
              <Volume2 size={15} />
              {alarmEnabled ? 'Sirena Activada' : 'Habilitar Sirena'}
            </button>

            {/* Botón especial "Fuera de lo común": Auditoría con Gemini Multimodal */}
            <button
              className="secondary-button"
              style={{ background: 'linear-gradient(135deg, #1e3a8a, #0284c7)', color: '#fff', border: 'none' }}
              onClick={runGeminiVisionAudit}
              disabled={auditingGemini || (!preview && !live)}
              title="Auditoría pericial profunda con IA Generativa Multimodal"
            >
              {auditingGemini ? <RefreshCw className="spin" size={15} /> : <Sparkles size={15} />}
              {auditingGemini ? 'Auditando...' : 'Auditoría Gemini Vision'}
            </button>
          </div>

          <div className="viewer-status">
            <span>
              <i className={live ? 'online' : ''} />
              {status}
            </span>
          </div>

          {error && <div className="error-banner">{error}</div>}
          {metrics && (
            <div className="info-strip" style={{ marginTop: '12px' }}>
              <CheckCircle2 size={15} />
              <span>{metrics.model_notice}</span>
            </div>
          )}
        </section>

        {/* Panel Lateral de Resultados */}
        <aside className="analysis-side">
          {/* Métricas Principales */}
          <section className="panel result-panel">
            <div className="panel-heading">
              <div>
                <h3>Métricas de Inferencia</h3>
                <p>{metrics?.engine || 'Esperando inicio de inspección'}</p>
              </div>
              <Scan size={18} />
            </div>

            <div className="result-metrics">
              <div>
                <small>Detecciones</small>
                <strong>{currentCount}</strong>
              </div>
              <div>
                <small>Operarios</small>
                <strong>{workersDetected}</strong>
              </div>
              <div>
                <small>Latencia</small>
                <strong>{metrics ? `${metrics.duration_ms.toFixed(0)} ms` : '—'}</strong>
              </div>
            </div>

            {/* Lista de detecciones */}
            <div className="detection-list">
              {detections.length ? (
                detections.map(d => {
                  const isViolation = d.label.toLowerCase().includes('no_') || d.label.toLowerCase().includes('sin')
                  return (
                    <div className="detection-row" key={d.id}>
                      <span
                        className="detection-color"
                        style={{ background: isViolation ? '#ef4444' : '#0ea5e9' }}
                      />
                      <div>
                        <b style={{ color: isViolation ? '#dc2626' : undefined }}>{d.label}</b>
                        <small>{`X ${(d.x * 100).toFixed(0)}% · Y ${(d.y * 100).toFixed(0)}% · W ${(d.width * 100).toFixed(0)}% · H ${(d.height * 100).toFixed(0)}%`}</small>
                      </div>
                      <strong>{(d.confidence * 100).toFixed(0)}%</strong>
                    </div>
                  )
                })
              ) : (
                <div className="empty-list">Las detecciones de EPP e infraestructura aparecerán aquí.</div>
              )}
            </div>

            {/* Botón principal de ejecución según modo */}
            {engineMode === 'edge' ? (
              <button className="primary-button" disabled={busy || (!file && !live)} onClick={runEdgeAnalysis}>
                {busy ? <RefreshCw className="spin" size={16} /> : <Play size={16} />}
                {busy ? 'Ejecutando Inferencia...' : 'Ejecutar Inspección Edge'}
              </button>
            ) : engineMode === 'gemini' ? (
              <button
                className="primary-button"
                style={{ background: 'linear-gradient(135deg, #2563eb, #06b6d4)' }}
                disabled={auditingGemini || (!file && !live)}
                onClick={runGeminiVisionAudit}
              >
                {auditingGemini ? <RefreshCw className="spin" size={16} /> : <Sparkles size={16} />}
                {auditingGemini ? 'Consultando Gemini Vision...' : 'Ejecutar Auditoría Gemini'}
              </button>
            ) : (
              <button className="primary-button" onClick={runIndustrialSimulator}>
                <Activity size={16} /> Ejecutar Simulación HSE
              </button>
            )}
          </section>

          {/* Patrones de Seguridad Evaluados */}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Patrones y Reglas Operativas</h3>
                <p>Verificación técnica OSHA / ISO 45001</p>
              </div>
              <ShieldAlert size={18} />
            </div>
            {patterns.length ? (
              patterns.map((p, i) => (
                <div className="detection-row" key={`${p.name}-${i}`}>
                  <div>
                    <b>{p.name}</b>
                    <small>{p.evidence}</small>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-list">No hay eventos o patrones registrados aún.</div>
            )}
          </section>

          {/* Alertas Críticas */}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Alertas del Fotograma</h3>
                <p>Infracciones detectadas para resolución inmediata</p>
              </div>
              <AlertTriangle size={18} color="#ef4444" />
            </div>
            {liveAlerts.length ? (
              liveAlerts.map((a, i) => (
                <div className="detection-row" key={i}>
                  <span
                    className="severity-dot"
                    style={{ background: a.severity === 'Crítica' ? '#dc2626' : a.severity === 'Alta' ? '#ea580c' : '#3b82f6' }}
                  />
                  <div>
                    <b style={{ color: a.severity === 'Crítica' ? '#dc2626' : undefined }}>{a.severity}</b>
                    <small>{a.message}</small>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-list">No se registran alertas en este momento.</div>
            )}
          </section>
        </aside>
      </div>

      {/* MODAL 1: Conectar Cámaras Físicas (USB / Bluetooth / Integrada) */}
      {showDeviceModal && (
        <div className="detail-backdrop" onClick={() => setShowDeviceModal(false)}>
          <div className="detail-modal" onClick={e => e.stopPropagation()}>
            <div className="panel-heading">
              <div>
                <h3>Selección de Cámara Física</h3>
                <p>Detecta dispositivos de captura USB, cámaras Bluetooth emparejadas y cámaras integradas.</p>
              </div>
              <button className="table-action" onClick={() => setShowDeviceModal(false)}>
                Cerrar
              </button>
            </div>

            <div style={{ padding: '15px 0' }}>
              {videoDevices.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {videoDevices.map(d => (
                    <div
                      key={d.deviceId}
                      onClick={() => setSelectedDeviceId(d.deviceId)}
                      style={{
                        padding: '12px 14px',
                        border: selectedDeviceId === d.deviceId ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        borderRadius: '8px',
                        background: selectedDeviceId === d.deviceId ? '#eff6ff' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Camera size={18} color="#2563eb" />
                        <div>
                          <b style={{ fontSize: '12px', color: '#1e293b' }}>{d.label}</b>
                          <small style={{ display: 'block', color: '#64748b', fontSize: '10px' }}>
                            {d.isBluetooth ? 'Dispositivo Inalámbrico Bluetooth' : d.isUsb ? 'Conexión USB / Cable' : 'Cámara del Sistema'}
                          </small>
                        </div>
                      </div>
                      {selectedDeviceId === d.deviceId && (
                        <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 'bold' }}>Seleccionada</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <Camera size={30} />
                  <b>No se encontraron cámaras de hardware</b>
                  <p>Asegúrate de conceder permisos al navegador y conectar tu cámara USB o Bluetooth.</p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '15px' }}>
              <button className="secondary-button" onClick={() => setShowDeviceModal(false)}>
                Cancelar
              </button>
              <button
                className="primary-button small"
                onClick={() => {
                  setShowDeviceModal(false)
                  startHardwareCamera(selectedDeviceId)
                }}
              >
                Conectar Cámara Seleccionada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Conectar Cámara IP / Flujo RTSP */}
      {showIpModal && (
        <div className="detail-backdrop" onClick={() => setShowIpModal(false)}>
          <div className="detail-modal" onClick={e => e.stopPropagation()}>
            <div className="panel-heading">
              <div>
                <h3>Conexión de Cámara IP / Flujo Industrial</h3>
                <p>Conéctate a cámaras de circuito cerrado (CCTV) industriales vía URL HTTP, MJPEG o simulador RTSP.</p>
              </div>
              <button className="table-action" onClick={() => setShowIpModal(false)}>
                Cerrar
              </button>
            </div>

            <div style={{ padding: '15px 0' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '12px', color: '#334155' }}>Presintonías de Planta Industrial:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {IP_STREAM_PRESETS.map(preset => (
                  <div
                    key={preset.id}
                    onClick={() => setSelectedIpPreset(preset)}
                    style={{
                      padding: '12px 14px',
                      border: selectedIpPreset.id === preset.id ? '2px solid #0284c7' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: selectedIpPreset.id === preset.id ? '#f0f9ff' : '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <b style={{ fontSize: '12px', color: '#0f172a' }}>{preset.name}</b>
                      <small style={{ display: 'block', color: '#64748b', fontSize: '10px', marginTop: '3px' }}>
                        Protocolo: {preset.protocol} · {preset.description}
                      </small>
                    </div>
                    {selectedIpPreset.id === preset.id && (
                      <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 'bold' }}>Seleccionada</span>
                    )}
                  </div>
                ))}
              </div>

              <h4 style={{ margin: '0 0 8px', fontSize: '12px', color: '#334155' }}>O ingresar URL de Cámara IP Personalizada:</h4>
              <input
                type="text"
                placeholder="Ejemplo: http://192.168.1.120:8080/video ó https://mi-stream-industrial.com/mjpeg"
                value={customIpUrl}
                onChange={e => setCustomIpUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '11px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '15px' }}>
              <button className="secondary-button" onClick={() => setShowIpModal(false)}>
                Cancelar
              </button>
              <button
                className="primary-button small"
                onClick={() => {
                  setShowIpModal(false)
                  startIpCameraStream(selectedIpPreset, customIpUrl)
                }}
              >
                Iniciar Transmisión IP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Auditoría Pericial Gemini Vision (Multimodal OSHA) */}
      {showAuditModal && auditReport && (
        <div className="detail-backdrop" onClick={() => setShowAuditModal(false)}>
          <div className="detail-modal" style={{ maxWidth: '820px' }} onClick={e => e.stopPropagation()}>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">AUDITORÍA FORENSE INTELIGENTE · {(auditReport.scenario || scenario).toUpperCase()}</span>
                <h3>Dictamen Pericial — {auditReport.scenario || scenario}</h3>
                <p>
                  Evaluación cognitiva generada mediante {auditReport.modelUsed || (auditReport.usedLiveApi ? 'Google Gemini Vision (En Vivo)' : 'Motor Local')}
                </p>
              </div>
              <button className="table-action" onClick={() => setShowAuditModal(false)}>
                Cerrar
              </button>
            </div>

            {/* Sección 0: Lo que la cámara observa (descripción real de Gemini) */}
            {auditReport.sceneDescription && (
              <div style={{
                background: 'linear-gradient(135deg, #eff6ff, #f0f9ff)',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '14px',
                margin: '12px 0 0'
              }}>
                <b style={{ fontSize: '11px', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Eye size={14} /> Lo que la cámara observa:
                </b>
                <p style={{ fontSize: '11px', color: '#1e3a8a', lineHeight: '1.6', margin: 0 }}>
                  {auditReport.sceneDescription}
                </p>
              </div>
            )}

            {/* Score y Riesgo */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                background: '#f8fafc',
                padding: '14px',
                borderRadius: '8px',
                margin: '15px 0'
              }}
            >
              <div>
                <small style={{ color: '#64748b', fontSize: '10px' }}>ÍNDICE CUMPLIMIENTO</small>
                <div style={{ fontSize: '24px', fontWeight: '800', color: auditReport.complianceScore > 80 ? '#16a34a' : '#dc2626' }}>
                  {auditReport.complianceScore}%
                </div>
              </div>
              <div>
                <small style={{ color: '#64748b', fontSize: '10px' }}>NIVEL DE RIESGO</small>
                <div style={{ fontSize: '18px', fontWeight: '700', color: auditReport.riskLevel === 'Crítico' ? '#dc2626' : auditReport.riskLevel === 'Alto' ? '#ea580c' : '#16a34a', marginTop: '4px' }}>
                  {auditReport.riskLevel}
                </div>
              </div>
              <div>
                <small style={{ color: '#64748b', fontSize: '10px' }}>ESTADO OSHA</small>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginTop: '6px' }}>
                  {auditReport.oshaStatus}
                </div>
              </div>
            </div>

            {/* Resumen Ejecutivo */}
            <div style={{ marginBottom: '16px' }}>
              <b style={{ fontSize: '12px', color: '#1e293b' }}>Dictamen Ejecutivo:</b>
              <p style={{ fontSize: '11px', color: '#475569', lineHeight: '1.6', margin: '6px 0 0' }}>
                {auditReport.executiveSummary}
              </p>
            </div>

            {/* Checklist EPP */}
            <div style={{ marginBottom: '16px' }}>
              <b style={{ fontSize: '12px', color: '#1e293b' }}>
                {(auditReport.scenario || scenario) === 'Seguridad industrial' ? 'Verificación Reglamentaria de EPP:'
                  : (auditReport.scenario || scenario) === 'Almacén inteligente' ? 'Inspección de Seguridad Logística:'
                  : (auditReport.scenario || scenario) === 'Control de calidad' ? 'Inspección de Calidad de Producto:'
                  : (auditReport.scenario || scenario) === 'Retail' ? 'Auditoría Operativa de Aforo y Local:'
                  : (auditReport.scenario || scenario) === 'Transporte y logística' ? 'Inspección de Seguridad Vial y Patio:'
                  : (auditReport.scenario || scenario) === 'Agricultura' ? 'Inspección Fitosanitaria y de Cosecha:'
                  : 'Checklist de Inspección Visual:'}
              </b>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                {auditReport.ppeChecklist.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      background: item.present ? '#f0fdf4' : '#fef2f2',
                      border: item.present ? '1px solid #bbf7d0' : '1px solid #fecaca',
                      fontSize: '11px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <b style={{ color: item.present ? '#166534' : '#991b1b', display: 'block' }}>{item.item}</b>
                      <small style={{ color: '#64748b' }}>{item.details}</small>
                    </div>
                    <span style={{ fontWeight: 'bold', color: item.present ? '#16a34a' : '#dc2626' }}>
                      {item.present ? '✓ Conforme' : '✗ Ausente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Peligros y Acciones Correctivas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div style={{ background: '#fff1f2', padding: '12px', borderRadius: '8px', border: '1px solid #ffe4e6' }}>
                <b style={{ color: '#9f1239', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={14} /> Peligros Detectados:
                </b>
                <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '10px', color: '#881337', lineHeight: '1.5' }}>
                  {auditReport.hazardsIdentified.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>

              <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '8px', border: '1px solid #dbeafe' }}>
                <b style={{ color: '#1e40af', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={14} /> Acciones Correctivas (CAPA):
                </b>
                <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '10px', color: '#1e3a8a', lineHeight: '1.5' }}>
                  {auditReport.correctiveActions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Notas periciales */}
            <p style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic', margin: '0 0 16px' }}>
              Nota: {auditReport.inspectorNotes}
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="secondary-button" onClick={downloadAuditReport}>
                <Download size={14} /> Descargar Informe Oficial (TXT/PDF)
              </button>
              <button className="primary-button small" onClick={() => setShowAuditModal(false)}>
                Cerrar Auditoría
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Configuración de Gemini API Key */}
      {showKeyConfig && (
        <div className="detail-backdrop" onClick={() => setShowKeyConfig(false)}>
          <div className="detail-modal" onClick={e => e.stopPropagation()}>
            <div className="panel-heading">
              <div>
                <h3>Configuración de Gemini API</h3>
                <p>Para análisis multimodal en vivo con Google Gemini 1.5 Flash.</p>
              </div>
              <button className="table-action" onClick={() => setShowKeyConfig(false)}>
                Cerrar
              </button>
            </div>

            <div style={{ padding: '15px 0' }}>
              <p style={{ fontSize: '11px', color: '#475569', lineHeight: '1.6' }}>
                Ingresa tu clave de API de Google AI Studio (Gemini). Es necesaria para generar los reportes de auditoría
                en tiempo real con visión multimodal. Puedes obtener una clave gratuita en{' '}
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>
                  aistudio.google.com/apikey
                </a>.
              </p>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '11px',
                  marginTop: '10px'
                }}
              />

              {modalKeyStatus && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    background: modalKeyStatus.success ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${modalKeyStatus.success ? '#86efac' : '#fecaca'}`,
                    color: modalKeyStatus.success ? '#166534' : '#991b1b'
                  }}
                >
                  {modalKeyStatus.message}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '15px' }}>
              <button
                className="secondary-button small"
                onClick={handleTestModalApiKey}
                disabled={testingModalKey || !apiKeyInput.trim()}
              >
                {testingModalKey ? 'Comprobando...' : 'Probar Clave'}
              </button>
              <button className="secondary-button small" onClick={() => setShowKeyConfig(false)}>
                Cancelar
              </button>
              <button className="primary-button small" onClick={handleSaveApiKey}>
                Guardar Clave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pie de página explicativo */}
      <div className="analysis-footnote">
        <CheckCircle2 size={15} />
        <span>
          <b>Entorno Empresarial Activo:</b> Motor de Visión Edge ejecutándose 100% en el dispositivo cliente mediante
          WebAssembly/WebGPU. No requiere backend en Render ni servidor externo para operar en Vercel.
        </span>
      </div>
    </div>
  )
}
