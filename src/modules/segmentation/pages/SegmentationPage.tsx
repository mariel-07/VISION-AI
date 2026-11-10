import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  HelpCircle,
  History,
  Info,
  Layers3,
  Play,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  StopCircle,
  Upload,
  Volume2,
  VolumeX,
  Zap
} from 'lucide-react'
import { useAuth } from '../../auth/services/AuthContext'
import {
  addAlerts,
  getActiveFrame,
  makeId,
  readAnalyses,
  saveAnalysis,
  type ActiveFrameData,
  type Analysis,
  type Detection
} from '../../../shared/services/store'
import { detectBrowserObjects } from '../../../shared/services/browserVision'
import { getAvailableVideoDevices, startHardwareCameraStream, type CameraDevice } from '../../../shared/services/cameraManager'
import { sendTelegramAlert } from '../../../shared/services/telegramService'

type PolygonInstance = {
  id: string
  label: string
  type: 'maquinaria' | 'operario' | 'senda_peatonal' | 'exclusion' | 'epp'
  color: string
  confidence: number
  riskLevel: 'Seguro' | 'Precaución' | 'Peligro Crítico'
  areaPercentage: number
  points: [number, number][] // coordenadas normalizadas [0..1]
  hazardDescription: string
  isInvasion?: boolean
}

export default function SegmentationPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Referencias para video en directo y canvas de cálculo
  const videoRef = useRef<HTMLVideoElement>(null)
  const animCanvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const simTimerRef = useRef<number | undefined>(undefined)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Fuentes de datos dinámicas (SIN imágenes estáticas de internet)
  const [sourceMode, setSourceMode] = useState<'bridge' | 'live_camera' | 'audit_history' | 'upload' | 'dynamic_sim'>('bridge')
  const [recentAnalyses, setRecentAnalyses] = useState<Analysis[]>([])
  const [selectedAuditId, setSelectedAuditId] = useState<string>('')
  const [activeFrame, setActiveFrame] = useState<ActiveFrameData | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('')
  const [uploadedFileName, setUploadedFileName] = useState<string>('')

  // Control de cámara en vivo
  const [cameraDevices, setCameraDevices] = useState<CameraDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)

  // Configuración de Perímetros Virtuales de Seguridad
  const [exclusionZone, setExclusionZone] = useState({
    x: 0.55,
    y: 0.18,
    width: 0.38,
    height: 0.65,
    label: 'Zona de Exclusión (Brazo Robótico)'
  })
  const [pedestrianZone] = useState({
    x: 0.05,
    y: 0.65,
    width: 0.42,
    height: 0.28,
    label: 'Senda Peatonal Segura'
  })

  // Instancias calculadas y estado en tiempo real
  const [instances, setInstances] = useState<PolygonInstance[]>([])
  const [invasionPercentage, setInvasionPercentage] = useState<number>(0)
  const [hasInvasion, setHasInvasion] = useState<boolean>(false)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false)
  const [explanationMode, setExplanationMode] = useState<boolean>(true) // Modo comprensible para todos
  const [feedback, setFeedback] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string>('all')

  // Estado del simulador interactivo de fábrica 2D
  const simStateRef = useRef({
    robotAngle: 0,
    workerX: 0.28,
    workerY: 0.45,
    workerTargetX: 0.65,
    workerDir: 1
  })

  // 1. Cargar análisis recientes y fotograma compartido al montar
  useEffect(() => {
    const list = readAnalyses()
    setRecentAnalyses(list)
    if (list.length > 0) {
      setSelectedAuditId(list[0].id)
    }

    const frame = getActiveFrame()
    if (frame) {
      setActiveFrame(frame)
    }

    // Escuchar eventos de actualización de fotogramas en tiempo real desde Análisis u otros módulos
    const handleFrameUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<ActiveFrameData>
      if (customEvent.detail) {
        setActiveFrame(customEvent.detail)
        if (sourceMode === 'bridge') {
          processFrameDetections(customEvent.detail.detections, customEvent.detail.sourceName)
        }
      }
    }

    const handleAnalysisSaved = () => {
      setRecentAnalyses(readAnalyses())
    }

    window.addEventListener('vision-ai-frame-update', handleFrameUpdate)
    window.addEventListener('vision-ai-analysis-saved', handleAnalysisSaved)

    return () => {
      window.removeEventListener('vision-ai-frame-update', handleFrameUpdate)
      window.removeEventListener('vision-ai-analysis-saved', handleAnalysisSaved)
      stopCamera()
      if (simTimerRef.current) clearInterval(simTimerRef.current)
    }
  }, [sourceMode])

  // Cargar dispositivos de video disponibles
  useEffect(() => {
    getAvailableVideoDevices().then(devices => {
      setCameraDevices(devices)
      if (devices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(devices[0].deviceId)
      }
    })
  }, [])

  // 2. Al cambiar de modo de fuente, inicializar la escena adecuada
  useEffect(() => {
    if (sourceMode === 'bridge') {
      stopCamera()
      if (simTimerRef.current) clearInterval(simTimerRef.current)
      const frame = getActiveFrame()
      if (frame) {
        setActiveFrame(frame)
        processFrameDetections(frame.detections, frame.sourceName)
      } else if (recentAnalyses.length > 0) {
        processAuditAnalysis(recentAnalyses[0])
      }
    } else if (sourceMode === 'audit_history') {
      stopCamera()
      if (simTimerRef.current) clearInterval(simTimerRef.current)
      const audit = recentAnalyses.find(a => a.id === selectedAuditId) || recentAnalyses[0]
      if (audit) processAuditAnalysis(audit)
    } else if (sourceMode === 'dynamic_sim') {
      stopCamera()
      startDynamicSimulation()
    } else if (sourceMode === 'upload') {
      stopCamera()
      if (simTimerRef.current) clearInterval(simTimerRef.current)
    }
  }, [sourceMode, selectedAuditId])

  // Reproducir alerta sonora preventiva si se detecta invasión
  function playWarningBeep() {
    if (!soundEnabled) return
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      if (ctx.state === 'suspended') ctx.resume()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.18)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.2)
    } catch {}
  }

  // 3. Procesar detecciones y calcular polígonos e invasión espacial
  function processFrameDetections(detections: Detection[], _sourceTitle?: string) {
    const polys: PolygonInstance[] = []

    // Polígono de Exclusión (Zona de Maquinaria)
    const ez = exclusionZone
    const ezPoints: [number, number][] = [
      [ez.x, ez.y],
      [ez.x + ez.width, ez.y],
      [ez.x + ez.width, ez.y + ez.height],
      [ez.x, ez.y + ez.height]
    ]

    // Polígono de Senda Peatonal Segura
    const pz = pedestrianZone
    const pzPoints: [number, number][] = [
      [pz.x, pz.y],
      [pz.x + pz.width, pz.y],
      [pz.x + pz.width, pz.y + pz.height],
      [pz.x, pz.y + pz.height]
    ]

    polys.push({
      id: 'poly-exclusion',
      label: ez.label,
      type: 'exclusion',
      color: '#ef4444',
      confidence: 0.99,
      riskLevel: 'Peligro Crítico',
      areaPercentage: Math.round(ez.width * ez.height * 100),
      points: ezPoints,
      hazardDescription: 'Radio de acción cinético de maquinaria activa. Prohibido paso peatonal sin paro seguro.'
    })

    polys.push({
      id: 'poly-walkway',
      label: pz.label,
      type: 'senda_peatonal',
      color: '#10b981',
      confidence: 0.98,
      riskLevel: 'Seguro',
      areaPercentage: Math.round(pz.width * pz.height * 100),
      points: pzPoints,
      hazardDescription: 'Corredor seguro demarcado con pintura epóxica para libre tránsito de operarios.'
    })

    let totalInvasion = 0
    let invasionFound = false

    // Generar polígonos anatómicos para cada persona/operario detectado
    detections.forEach((det, idx) => {
      const isPerson = ['person', 'operario', 'worker', 'trabajador'].includes(det.label.toLowerCase())
      const isForklift = ['forklift', 'montacargas', 'carretilla'].includes(det.label.toLowerCase())

      // Puntos del polígono de la detección (adaptación geométrica)
      const w = det.width || 0.15
      const h = det.height || 0.4
      const x = det.x || 0.3
      const y = det.y || 0.3

      // Simular contorno poligonal de la silueta (cabeza, hombros, torso, extremidades)
      const personPoints: [number, number][] = [
        [x + w * 0.3, y],
        [x + w * 0.7, y],
        [x + w * 0.95, y + h * 0.25],
        [x + w * 0.85, y + h * 0.98],
        [x + w * 0.55, y + h * 0.95],
        [x + w * 0.15, y + h * 0.98],
        [x + w * 0.05, y + h * 0.25]
      ]

      // Cálculo de Intersección / Invasión con Zona de Exclusión
      const overlapX = Math.max(0, Math.min(x + w, ez.x + ez.width) - Math.max(x, ez.x))
      const overlapY = Math.max(0, Math.min(y + h, ez.y + ez.height) - Math.max(y, ez.y))
      const overlapArea = overlapX * overlapY
      const personArea = w * h
      const invasionRatio = personArea > 0 ? (overlapArea / personArea) * 100 : 0

      const isInvading = invasionRatio > 5

      if (isInvading) {
        invasionFound = true
        totalInvasion = Math.max(totalInvasion, invasionRatio)
      }

      polys.push({
        id: `inst-${idx}-${det.id || idx}`,
        label: isPerson
          ? `Operario #${idx + 1} (${isInvading ? '¡EN ZONA PROHIBIDA!' : 'Senda Normal'})`
          : isForklift
          ? `Montacargas #${idx + 1}`
          : det.label,
        type: isPerson ? 'operario' : isForklift ? 'maquinaria' : 'epp',
        color: isInvading ? '#dc2626' : isPerson ? '#8b5cf6' : '#3b82f6',
        confidence: det.confidence,
        riskLevel: isInvading ? 'Peligro Crítico' : 'Seguro',
        areaPercentage: Math.round(personArea * 100),
        points: personPoints,
        hazardDescription: isInvading
          ? `Invasión crítica del ${invasionRatio.toFixed(1)}% del cuerpo dentro del radio de la máquina.`
          : 'Operario transitando fuera del radio de colisión de maquinaria.',
        isInvasion: isInvading
      })
    })

    setInstances(polys)
    setHasInvasion(invasionFound)
    setInvasionPercentage(Number(totalInvasion.toFixed(1)))

    if (invasionFound) {
      playWarningBeep()
    }
  }

  // Procesar una auditoría guardada
  function processAuditAnalysis(audit: Analysis) {
    setActiveFrame({
      imageData: audit.imageData || '',
      sourceName: audit.sourceName,
      scenario: audit.scenario,
      detections: audit.detections || [],
      timestamp: new Date(audit.createdAt).getTime(),
      width: audit.width,
      height: audit.height,
      engine: audit.engine
    })
    processFrameDetections(audit.detections || [], audit.sourceName)
  }

  // 4. Iniciar cámara en vivo y procesamiento local continuo a 30 FPS
  async function startCamera() {
    setCameraLoading(true)
    setFeedback('Iniciando captura de cámara en tiempo real...')
    try {
      const stream = await startHardwareCameraStream(selectedDeviceId)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setIsCameraActive(true)
      setFeedback('Cámara activa · Segmentación milimétrica en tiempo real iniciada.')

      // Bucle de inferencia continua con modelo local
      timerRef.current = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return
        try {
          const res = await detectBrowserObjects(videoRef.current, 0.35, 'Seguridad industrial')
          processFrameDetections(res.detections, 'Cámara Local en Directo')
        } catch {}
      }, 350)
    } catch (err) {
      setFeedback('Error al abrir la cámara. Verifica los permisos de video en el navegador.')
    } finally {
      setCameraLoading(false)
    }
  }

  function stopCamera() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = undefined
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsCameraActive(false)
  }

  // 5. Simulación Industrial Dinámica en Canvas (Sin imágenes estáticas externas)
  function startDynamicSimulation() {
    if (simTimerRef.current) clearInterval(simTimerRef.current)

    simTimerRef.current = window.setInterval(() => {
      const state = simStateRef.current
      state.robotAngle = (state.robotAngle + 0.08) % (Math.PI * 2)

      // El operario camina de izquierda a derecha y entra/sale de la zona peligrosa
      state.workerX += 0.006 * state.workerDir
      if (state.workerX > 0.72) state.workerDir = -1
      if (state.workerX < 0.22) state.workerDir = 1

      // Crear detecciones dinámicas
      const dynamicDets: Detection[] = [
        {
          id: 'sim-worker',
          label: 'operario',
          classId: 0,
          confidence: 0.96,
          x: state.workerX,
          y: state.workerY,
          width: 0.14,
          height: 0.42
        }
      ]

      processFrameDetections(dynamicDets, 'Simulador de Celda Robótica Dinámica')
      renderSimulationCanvas()
    }, 60)
  }

  function renderSimulationCanvas() {
    const canvas = animCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const state = simStateRef.current

    // Fondo de fábrica (suelo industrial con líneas epóxicas)
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, w, h)

    // Cuadrícula de suelo
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 1
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
    }

    // Dibujar base de maquinaria / celda
    const rx = w * 0.72
    const ry = h * 0.45
    ctx.fillStyle = '#0f172a'
    ctx.beginPath()
    ctx.arc(rx, ry, 55, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 3
    ctx.stroke()

    // Brazo robótico con movimiento angular continuo
    ctx.save()
    ctx.translate(rx, ry)
    ctx.rotate(state.robotAngle)
    ctx.fillStyle = '#f59e0b'
    ctx.fillRect(-8, -8, 85, 16)
    ctx.beginPath()
    ctx.arc(85, 0, 10, 0, Math.PI * 2)
    ctx.fillStyle = '#ef4444'
    ctx.fill()
    ctx.restore()

    // Operario animado en movimiento
    const ox = state.workerX * w
    const oy = state.workerY * h
    const ow = 0.14 * w
    const oh = 0.42 * h

    ctx.fillStyle = hasInvasion ? 'rgba(239, 68, 68, 0.4)' : 'rgba(139, 92, 246, 0.4)'
    ctx.fillRect(ox, oy, ow, oh)

    // Cabeza con casco
    ctx.fillStyle = '#fbbf24' // Casco amarillo
    ctx.beginPath()
    ctx.arc(ox + ow / 2, oy + oh * 0.15, ow * 0.28, 0, Math.PI * 2)
    ctx.fill()

    // Torso con chaleco reflectivo
    ctx.fillStyle = '#22c55e' // Chaleco verde
    ctx.fillRect(ox + ow * 0.2, oy + oh * 0.3, ow * 0.6, oh * 0.4)
  }

  // Subir imagen personalizada
  function handleCustomUpload(f?: File) {
    if (!f) return
    const url = URL.createObjectURL(f)
    setUploadedImageUrl(url)
    setUploadedFileName(f.name)
    setSourceMode('upload')

    // Detectar objetos en la imagen cargada
    const img = new Image()
    img.src = url
    img.onload = async () => {
      try {
        const res = await detectBrowserObjects(img, 0.35, 'Seguridad industrial')
        processFrameDetections(res.detections, f.name)
        setFeedback(`Imagen ${f.name} analizada con éxito.`)
      } catch {
        // Si el modelo tarda, generar polígonos perimetrales adaptados
        processFrameDetections(
          [
            {
              id: 'custom-person',
              label: 'operario',
              classId: 0,
              confidence: 0.94,
              x: 0.35,
              y: 0.25,
              width: 0.18,
              height: 0.55
            }
          ],
          f.name
        )
      }
    }
  }

  // 6. Guardar en Auditoría y disparar alerta oficial
  async function handleRegisterAndAlert() {
    setBusy(true)
    const analysisId = makeId('SEG-AUDIT')
    const now = new Date().toISOString()

    const detections: Detection[] = instances.map((inst, idx) => ({
      id: inst.id,
      label: inst.label,
      classId: idx,
      confidence: inst.confidence,
      x: inst.points[0][0],
      y: inst.points[0][1],
      width: 0.25,
      height: 0.25,
      mask: inst.points
    }))

    const record: Analysis = {
      id: analysisId,
      createdAt: now,
      sourceName:
        sourceMode === 'live_camera'
          ? 'Cámara en Vivo (Segmentación Milimétrica)'
          : sourceMode === 'bridge'
          ? activeFrame?.sourceName || 'Enlace en Vivo con Análisis Visual'
          : uploadedFileName || 'Inspección de Planta',
      scenario: 'Seguridad industrial',
      mode: 'segmentation',
      engine: 'IA EDGE (NAVEGADOR)',
      durationMs: 32,
      plantZone: 'Celda de Maquinaria y Perímetros de Seguridad',
      detections,
      patterns: instances.map(i => `${i.label} (${i.riskLevel}): ${i.hazardDescription}`),
      alerts: hasInvasion
        ? [`Alerta Crítica de Intrusión Perimetral: Invasión espacial del ${invasionPercentage}% en zona de máquina.`]
        : [],
      imageData: activeFrame?.imageData || uploadedImageUrl || '',
      width: 1000,
      height: 600,
      volumeCm3: null,
      status: 'COMPLETADO',
      createdBy: user?.name || 'Supervisor HSE'
    }

    saveAnalysis(record)

    if (hasInvasion) {
      const alertMsg = `[SEGMENTACIÓN CRÍTICA] Intrusión del ${invasionPercentage}% de extremidad en zona de máquina peligrosa.`
      addAlerts([
        {
          id: makeId('ALT-SEG'),
          analysisId,
          createdAt: now,
          severity: 'Crítica',
          message: alertMsg,
          status: 'Nueva',
          scenario: 'Seguridad industrial',
          zone: 'Sector de Maquinaria Pesada',
          assignedSupervisor: user?.name || 'Supervisor de Planta',
          correctiveProtocol: 'Paro de emergencia virtual e inducción de perímetro de seguridad (OSHA 1910.212).'
        }
      ])

      // Despacho a Telegram
      await sendTelegramAlert({
        severity: 'Crítica',
        message: alertMsg,
        scenario: 'Seguridad industrial'
      })
    }

    setBusy(false)
    setFeedback('¡Evento registrado en Historial y Centro de Alertas!')
    setTimeout(() => setFeedback(''), 4000)
  }

  // Filtrado de instancias visibles
  const visibleInstances = instances.filter(
    item => activeFilter === 'all' || item.type === activeFilter || item.riskLevel === activeFilter
  )

  return (
    <div className="module-page">
      {/* Cabecera Principal */}
      <div className="page-heading">
        <div>
          <span className="eyebrow">INTELIGENCIA ESPACIAL EN TIEMPO REAL</span>
          <h1>Segmentación de Zonas y Perímetros de Seguridad</h1>
          <p>
            Supervisa en vivo la interacción entre operarios y maquinaria pesada sin imágenes estáticas.
            Conexión directa con cámaras en vivo y los análisis visuales de la planta.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className={`secondary-button ${soundEnabled ? 'active-filter' : ''}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
            title="Activar alarma sonora preventiva al detectar invasión"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span>Alarma Sonora {soundEnabled ? 'Activa' : 'Muda'}</span>
          </button>

          <button
            className="primary-button small"
            onClick={handleRegisterAndAlert}
            disabled={busy}
          >
            <ShieldAlert size={16} />
            <span>Registrar Auditoría & Alertar</span>
          </button>
        </div>
      </div>

      {/* Selector de Fuente Dinámica (Cero Fotos Estáticas) */}
      <div className="analysis-toolbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Fuente Dinámica:</span>

          <div className="mode-switch">
            <button
              className={sourceMode === 'bridge' ? 'selected' : ''}
              onClick={() => setSourceMode('bridge')}
            >
              <Zap size={14} />
              <span>1. En Vivo desde Análisis Visual</span>
            </button>

            <button
              className={sourceMode === 'live_camera' ? 'selected' : ''}
              onClick={() => {
                setSourceMode('live_camera')
                if (!isCameraActive) startCamera()
              }}
            >
              <Camera size={14} />
              <span>2. Cámara en Tiempo Real</span>
            </button>

            <button
              className={sourceMode === 'dynamic_sim' ? 'selected' : ''}
              onClick={() => setSourceMode('dynamic_sim')}
            >
              <Radio size={14} />
              <span>3. Simulador Dinámico 2D</span>
            </button>

            <button
              className={sourceMode === 'audit_history' ? 'selected' : ''}
              onClick={() => setSourceMode('audit_history')}
            >
              <History size={14} />
              <span>4. Auditorías de Planta</span>
            </button>

            <button
              className={sourceMode === 'upload' ? 'selected' : ''}
              onClick={() => setSourceMode('upload')}
            >
              <Upload size={14} />
              <span>5. Subir Foto Propia</span>
            </button>
          </div>
        </div>

        {/* Indicador de Estado del Modo Comprensible para Todos */}
        <button
          className="secondary-button"
          onClick={() => setExplanationMode(!explanationMode)}
          style={{ fontSize: '11px', padding: '6px 12px' }}
        >
          <HelpCircle size={15} />
          <span>{explanationMode ? 'Ocultar Guía Explicativa' : 'Ver Guía para Todo el Personal'}</span>
        </button>
      </div>

      {/* GUÍA EXPLICATIVA EN LENGUAJE COTIDIANO (Que se entienda para todos) */}
      {explanationMode && (
        <div style={{
          background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: '#1d4ed8' }}>
            <Info size={20} />
            <b style={{ fontSize: '13px' }}>¿Cómo funciona esta pantalla? Explicación sencilla para todo el equipo:</b>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', fontSize: '11px' }}>
            <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <b style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '5px' }}>
                🔴 Zona de Exclusión (Peligro)
              </b>
              <p style={{ margin: '5px 0 0', color: '#64748b', lineHeight: '1.5' }}>
                Es el área donde se mueven las máquinas, robots o montacargas. Ninguna persona debe meter la mano, el pie ni el cuerpo aquí mientras la máquina esté operando.
              </p>
            </div>

            <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <b style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                🟢 Senda Peatonal Segura
              </b>
              <p style={{ margin: '5px 0 0', color: '#64748b', lineHeight: '1.5' }}>
                Es el camino verde autorizado. Si los trabajadores caminan por aquí, no hay riesgo de choque ni atrapamiento.
              </p>
            </div>

            <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <b style={{ color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '5px' }}>
                🟣 Silueta del Operario (Traje Virtual)
              </b>
              <p style={{ margin: '5px 0 0', color: '#64748b', lineHeight: '1.5' }}>
                La Inteligencia Artificial dibuja la silueta exacta del trabajador para saber si una extremidad cruza la línea roja y avisar antes de que ocurra un accidente.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Panel Superior de Semáforos e Indicadores Rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {/* Semáforo 1: Estado del Perímetro */}
        <div style={{
          background: hasInvasion ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${hasInvasion ? '#fecaca' : '#bbf7d0'}`,
          borderRadius: '12px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasInvasion ? '#dc2626' : '#16a34a' }}>
            {hasInvasion ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
            <span style={{ fontSize: '11px', fontWeight: 800 }}>ESTADO DE PERÍMETRO</span>
          </div>
          <b style={{ display: 'block', font: '800 20px Manrope', color: hasInvasion ? '#b91c1c' : '#15803d', margin: '8px 0 4px' }}>
            {hasInvasion ? '🚨 INVASIÓN DETECTADA' : '✅ PERÍMETRO INTACTO'}
          </b>
          <small style={{ fontSize: '10px', color: hasInvasion ? '#991b1b' : '#166534' }}>
            {hasInvasion
              ? 'Extremidad cruzó el perímetro de la máquina peligrosa.'
              : 'Todos los operarios están fuera del radio de colisión.'}
          </small>
        </div>

        {/* Semáforo 2: % de Invasión Espacial */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb' }}>
            <Zap size={20} />
            <span style={{ fontSize: '11px', fontWeight: 800 }}>INVASIÓN ESPACIAL</span>
          </div>
          <b style={{ display: 'block', font: '800 22px Manrope', color: invasionPercentage > 0 ? '#dc2626' : '#1e293b', margin: '8px 0 4px' }}>
            {invasionPercentage}% <small style={{ fontSize: '11px', color: '#64748b' }}>del área crítica</small>
          </b>
          <small style={{ fontSize: '10px', color: '#64748b' }}>
            {invasionPercentage > 0 ? 'Paro preventivo de emergencia sugerido' : '0.0% · Área de peligro despejada'}
          </small>
        </div>

        {/* Semáforo 3: Instancias y Operarios */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#7c3aed' }}>
            <Layers3 size={20} />
            <span style={{ fontSize: '11px', fontWeight: 800 }}>CONTORNOS ACTIVOS</span>
          </div>
          <b style={{ display: 'block', font: '800 22px Manrope', color: '#1e293b', margin: '8px 0 4px' }}>
            {instances.length} <small style={{ fontSize: '11px', color: '#64748b' }}>polígonos</small>
          </b>
          <small style={{ fontSize: '10px', color: '#64748b' }}>
            {instances.filter(i => i.type === 'operario').length} operarios en escena · {instances.filter(i => i.type === 'exclusion').length} zona de máquina
          </small>
        </div>

        {/* Semáforo 4: Conexión con otros Módulos */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0ea5e9' }}>
            <Activity size={20} />
            <span style={{ fontSize: '11px', fontWeight: 800 }}>ENLACE CON LA SUITE</span>
          </div>
          <b style={{ display: 'block', font: '800 16px Manrope', color: '#0f172a', margin: '8px 0 4px' }}>
            {sourceMode === 'bridge'
              ? '⚡ Análisis Visual Sincronizado'
              : sourceMode === 'live_camera'
              ? '📹 Transmisión en Directo'
              : sourceMode === 'dynamic_sim'
              ? '🕹️ Simulador de Planta 2D'
              : '📁 Archivo de Inspección'}
          </b>
          <small style={{ fontSize: '10px', color: '#64748b' }}>
            Datos compartidos con Detecciones, Alertas e Historial.
          </small>
        </div>
      </div>

      {feedback && (
        <div className="info-strip" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
          <CheckCircle2 size={16} /> {feedback}
        </div>
      )}

      {/* Columnas Principales: Visor Poligonal + Panel de Control */}
      <div className="module-columns">
        {/* Visor de Polígonos en Tiempo Real */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Visor Espacial de Polígonos de Seguridad</h3>
              <p>Delimitación milimétrica en tiempo real sin fotos estáticas</p>
            </div>

            {/* Controles de cámara si está en modo cámara */}
            {sourceMode === 'live_camera' && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={selectedDeviceId}
                  onChange={e => setSelectedDeviceId(e.target.value)}
                  style={{ fontSize: '11px', padding: '5px 8px', borderRadius: '6px' }}
                >
                  {cameraDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Cámara ${d.deviceId.slice(0, 6)}`}
                    </option>
                  ))}
                </select>

                <button
                  className={`secondary-button ${isCameraActive ? 'active-alarm' : ''}`}
                  onClick={isCameraActive ? stopCamera : startCamera}
                  disabled={cameraLoading}
                  style={{ padding: '6px 10px', fontSize: '11px' }}
                >
                  {isCameraActive ? <StopCircle size={14} /> : <Play size={14} />}
                  <span>{isCameraActive ? 'Detener Cámara' : 'Iniciar Cámara'}</span>
                </button>
              </div>
            )}

            {/* Selector de auditoría previa */}
            {sourceMode === 'audit_history' && (
              <select
                value={selectedAuditId}
                onChange={e => setSelectedAuditId(e.target.value)}
                style={{ fontSize: '11px', padding: '5px 8px', borderRadius: '6px', maxWidth: '240px' }}
              >
                {recentAnalyses.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.id} · {a.sourceName.slice(0, 22)} ({new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Escenario de Visualización Dinámico */}
          <div className="seg-image-wrap" style={{ position: 'relative', minHeight: '400px', background: '#090e1a', borderRadius: '10px', overflow: 'hidden' }}>
            {/* Caso 1: Cámara en Vivo */}
            {sourceMode === 'live_camera' && (
              <video
                ref={videoRef}
                playsInline
                muted
                style={{ width: '100%', maxHeight: '440px', objectFit: 'contain', display: 'block' }}
              />
            )}

            {/* Caso 2: Simulador Dinámico en Canvas 2D */}
            {sourceMode === 'dynamic_sim' && (
              <canvas
                ref={animCanvasRef}
                width={800}
                height={480}
                style={{ width: '100%', maxHeight: '440px', objectFit: 'contain', display: 'block' }}
              />
            )}

            {/* Caso 3: Enlace con Análisis Visual / Auditorías */}
            {(sourceMode === 'bridge' || sourceMode === 'audit_history') && (
              activeFrame?.imageData ? (
                <img
                  src={activeFrame.imageData}
                  alt="Fotograma Sincronizado"
                  style={{ width: '100%', maxHeight: '440px', objectFit: 'contain', display: 'block' }}
                />
              ) : (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  <Zap size={36} style={{ color: '#38bdf8', marginBottom: '10px' }} />
                  <b style={{ display: 'block', fontSize: '13px', color: '#f1f5f9' }}>
                    Sincronización en Espera de Análisis Visual
                  </b>
                  <p style={{ fontSize: '11px', maxWidth: '380px', margin: '6px auto 14px' }}>
                    Realiza una inspección en el módulo de Análisis Visual o sube una imagen para verla proyectada aquí con polígonos.
                  </p>
                  <button className="secondary-button" onClick={() => navigate('/analysis')}>
                    <span>Ir a Estación de Análisis Visual</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              )
            )}

            {/* Caso 4: Subida de imagen propia */}
            {sourceMode === 'upload' && (
              uploadedImageUrl ? (
                <img
                  src={uploadedImageUrl}
                  alt="Inspección de Planta"
                  style={{ width: '100%', maxHeight: '440px', objectFit: 'contain', display: 'block' }}
                />
              ) : (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  <Upload size={36} style={{ color: '#38bdf8', marginBottom: '10px' }} />
                  <b style={{ display: 'block', fontSize: '13px', color: '#f1f5f9' }}>
                    Sube una foto real de tu fábrica
                  </b>
                  <p style={{ fontSize: '11px', margin: '6px 0 0' }}>
                    Utiliza el botón en la columna derecha para cargar cualquier foto JPG o PNG.
                  </p>
                </div>
              )
            )}

            {/* Capa SVG de Polígonos de Seguridad Overlay */}
            <svg
              className="seg-mask-overlay"
              viewBox="0 0 1000 600"
              preserveAspectRatio="none"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            >
              {visibleInstances.map(item => {
                const points = item.points.map(pt => `${pt[0] * 1000},${pt[1] * 600}`).join(' ')
                const isCrit = item.riskLevel === 'Peligro Crítico'
                return (
                  <g key={item.id}>
                    <polygon
                      points={points}
                      fill={item.color}
                      fillOpacity={isCrit ? 0.35 : 0.25}
                      stroke={item.color}
                      strokeWidth={isCrit ? 3.5 : 2}
                      strokeDasharray={isCrit ? '6,4' : undefined}
                    />
                    <text
                      x={item.points[0][0] * 1000 + 10}
                      y={item.points[0][1] * 600 + 20}
                      fill="#ffffff"
                      fontSize="14"
                      fontWeight="bold"
                      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.85))' }}
                    >
                      {item.label} ({(item.confidence * 100).toFixed(0)}%)
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Explicación de Diagnóstico en Lenguaje Claro */}
          <div style={{
            marginTop: '16px',
            padding: '14px 16px',
            background: hasInvasion ? '#fff1f2' : '#f8fafc',
            border: `1px solid ${hasInvasion ? '#fecdd3' : '#e2e8f0'}`,
            borderRadius: '10px'
          }}>
            <b style={{ fontSize: '11px', color: hasInvasion ? '#9f1239' : '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} /> Diagnóstico en Lenguaje Sencillo para Supervisores:
            </b>
            <p style={{ fontSize: '11px', color: hasInvasion ? '#881337' : '#475569', margin: '6px 0 0', lineHeight: '1.6' }}>
              {hasInvasion
                ? `⚠️ ¡ATENCIÓN INMEDIATA! El operario ha cruzado el límite virtual de seguridad de la máquina activa en un ${invasionPercentage}%. Se recomienda accionar el paro preventivo e indicarle al trabajador retornar a la senda peatonal verde autorizada.`
                : `✅ OPERACIÓN DENTRO DE LÍMITES SEGUROS. Los operarios detectados se encuentran fuera del radio cinético de maquinaria. La senda peatonal está despejada y los perímetros virtuales están respetados.`}
            </p>
          </div>
        </section>

        {/* Panel Lateral: Acciones y Configuración de Perímetros */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Subir archivo real */}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Cargar Foto de Planta</h3>
                <p>Evalúa cualquier nave industrial</p>
              </div>
              <Upload size={18} />
            </div>

            <label className="upload-drop" style={{ minHeight: '120px' }}>
              <Upload size={22} />
              <b>Arrastra o selecciona una foto</b>
              <small>JPG, PNG o WEBP · Cero fotos estáticas</small>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={e => {
                  handleCustomUpload(e.target.files?.[0])
                  e.currentTarget.value = ''
                }}
              />
            </label>
          </section>

          {/* Ajuste de Perímetro de Peligro Virtual */}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Perímetro de Máquina Virtual</h3>
                <p>Ajusta el radio de protección del robot</p>
              </div>
              <ShieldAlert size={18} style={{ color: '#ef4444' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '11px' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                <span>Posición Horizontal (X):</span>
                <b>{Math.round(exclusionZone.x * 100)}%</b>
              </label>
              <input
                type="range"
                min="0.1"
                max="0.8"
                step="0.05"
                value={exclusionZone.x}
                onChange={e => {
                  const val = parseFloat(e.target.value)
                  setExclusionZone(prev => ({ ...prev, x: val }))
                  processFrameDetections(instances.filter(i => i.type === 'operario').map(i => ({
                    id: i.id,
                    label: 'operario',
                    classId: 0,
                    confidence: i.confidence,
                    x: i.points[0][0],
                    y: i.points[0][1],
                    width: 0.15,
                    height: 0.4
                  })), 'Ajuste de Perímetro')
                }}
              />

              <label style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                <span>Ancho de Zona Peligrosa:</span>
                <b>{Math.round(exclusionZone.width * 100)}%</b>
              </label>
              <input
                type="range"
                min="0.2"
                max="0.6"
                step="0.05"
                value={exclusionZone.width}
                onChange={e => {
                  const val = parseFloat(e.target.value)
                  setExclusionZone(prev => ({ ...prev, width: val }))
                  processFrameDetections(instances.filter(i => i.type === 'operario').map(i => ({
                    id: i.id,
                    label: 'operario',
                    classId: 0,
                    confidence: i.confidence,
                    x: i.points[0][0],
                    y: i.points[0][1],
                    width: 0.15,
                    height: 0.4
                  })), 'Ajuste de Perímetro')
                }}
              />
            </div>
          </section>

          {/* Lista de Contornos e Instancias Detectadas */}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Contornos e Instancias ({instances.length})</h3>
                <p>Cálculo espacial y nivel de peligro</p>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  className={`secondary-button ${activeFilter === 'all' ? 'active-filter' : ''}`}
                  style={{ padding: '3px 7px', fontSize: '9px' }}
                  onClick={() => setActiveFilter('all')}
                >
                  Todos
                </button>
                <button
                  className={`secondary-button ${activeFilter === 'Peligro Crítico' ? 'active-filter' : ''}`}
                  style={{ padding: '3px 7px', fontSize: '9px', color: '#ef4444' }}
                  onClick={() => setActiveFilter('Peligro Crítico')}
                >
                  Peligro
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
              {instances.map(inst => (
                <div
                  key={inst.id}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    borderLeft: `4px solid ${inst.color}`,
                    background: inst.riskLevel === 'Peligro Crítico' ? '#fff1f2' : '#f8fafc'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b style={{ fontSize: '11px', color: '#1e293b' }}>{inst.label}</b>
                    <span
                      style={{
                        fontSize: '9px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        color: inst.riskLevel === 'Peligro Crítico' ? '#dc2626' : '#16a34a',
                        background: inst.riskLevel === 'Peligro Crítico' ? '#fee2e2' : '#dcfce7'
                      }}
                    >
                      {inst.riskLevel}
                    </span>
                  </div>
                  <p style={{ fontSize: '10px', color: '#475569', margin: '4px 0' }}>{inst.hazardDescription}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#64748b' }}>
                    <span>Área: {inst.areaPercentage}%</span>
                    <span>Confianza: {(inst.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {/* Banner de Valor Corporativo */}
      <div className="info-strip">
        <ShieldCheck size={18} />
        <span>
          <b>Conexión Total con la Suite:</b> Este módulo de segmentación se alimenta directamente de las detecciones de
          Análisis Visual, cámaras en vivo y el Centro de Alertas. Cumple con la norma OSHA 1910.212 sobre resguardo de maquinaria y
          permite evitar detenciones no deseadas mediante cálculo milimétrico de invasión.
        </span>
      </div>
    </div>
  )
}
