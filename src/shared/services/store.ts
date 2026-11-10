import type { GeminiAuditReport } from './geminiVision'

export type Detection = {
  id: string
  label: string
  classId: number
  confidence: number
  x: number
  y: number
  width: number
  height: number
  trackId?: number | null
  mask?: number[][]
}

export type Analysis = {
  id: string
  createdAt: string
  sourceName: string
  scenario: string
  mode: string
  engine: 'IA EDGE (NAVEGADOR)' | 'IA MULTIMODAL (GEMINI)' | 'SIMULADOR HSE' | 'YOLO REAL' | 'IA NAVEGADOR' | 'SIMULADOR'
  durationMs: number
  detections: Detection[]
  patterns: string[]
  alerts: string[]
  imageData?: string
  width: number
  height: number
  volumeCm3: number | null
  status?: 'EN_PROCESO' | 'COMPLETADO' | 'ERROR'
  createdBy?: string
  plantZone?: string
  auditReport?: GeminiAuditReport
}

export type AlertItem = {
  id: string
  analysisId: string
  createdAt: string
  severity: 'Baja' | 'Media' | 'Alta' | 'Crítica'
  message: string
  status: 'Nueva' | 'Revisada' | 'Cerrada'
  scenario: string
  assignedSupervisor?: string
  correctiveProtocol?: string
  zone?: string
}

export type VisionSettings = {
  confidence: number
  scenario: string
  pxPerCm: number
  depthCm: number
  geminiApiKey?: string
  defaultCameraDevice?: string
  ipCameraUrl?: string
  rules: { personSafety: boolean; forklift: boolean; highDensity: boolean; productReview: boolean; zoneIntrusion: boolean }
}

const DEFAULT_SETTINGS: VisionSettings = {
  confidence: .35,
  scenario: 'Seguridad industrial',
  pxPerCm: 8,
  depthCm: 10,
  geminiApiKey: '',
  defaultCameraDevice: '',
  ipCameraUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=80',
  rules: { personSafety: true, forklift: true, highDensity: true, productReview: true, zoneIntrusion: true },
}

export type ScenarioClass = { name: string; enabled: boolean }
export type ScenarioClassConfig = Record<string, ScenarioClass[]>
const CLASS_KEY = 'vision-ai-classes-v1'
export const DEFAULT_CLASSES: ScenarioClassConfig = {
  'Seguridad industrial': ['person','helmet','vest','gloves','goggles','boots','no_helmet','no_vest','no_gloves','no_goggles','no_boots','forklift'].map(name => ({ name, enabled: true })),
  'Almacén inteligente': ['person','box','pallet','forklift','truck','package'].map(name => ({ name, enabled: true })),
  'Control de calidad': ['product','defect','scratch','crack','bottle','package'].map(name => ({ name, enabled: true })),
  'Retail': ['person','bottle','cup','handbag','suitcase','product'].map(name => ({ name, enabled: true })),
  'Transporte y logística': ['car','truck','bus','motorcycle','bicycle','person'].map(name => ({ name, enabled: true })),
  'Agricultura': ['apple','banana','orange','plant','leaf','weed'].map(name => ({ name, enabled: true })),
}

/**
 * Diccionario de alias y sinónimos para matching de etiquetas devueltas por modelos YOLO (COCO, EPP, ONNX).
 */
export const SCENARIO_CLASS_ALIASES: Record<string, string[]> = {
  person: ['person', 'persona', 'operario', 'worker', 'people', 'human', 'trabajador'],
  helmet: ['helmet', 'hardhat', 'hard_hat', 'casco', 'safety_helmet'],
  vest: ['vest', 'chaleco', 'safety_vest', 'reflective_vest'],
  gloves: ['gloves', 'glove', 'guantes', 'safety_gloves'],
  goggles: ['goggles', 'goggle', 'lentes', 'safety_glasses', 'glasses', 'gafas'],
  boots: ['boots', 'boot', 'botas', 'safety_boots', 'calzado'],
  no_helmet: ['no_helmet', 'sin_casco', 'no_hardhat', 'without_helmet', 'no helmet', 'sin casco', 'head'],
  no_vest: ['no_vest', 'sin_chaleco', 'without_vest', 'no vest', 'sin chaleco'],
  no_gloves: ['no_gloves', 'sin_guantes', 'without_gloves', 'no gloves', 'sin guantes'],
  no_goggles: ['no_goggles', 'no_goggle', 'sin_lentes', 'without_goggles', 'no goggles', 'no goggle', 'sin lentes'],
  no_boots: ['no_boots', 'sin_botas', 'without_boots', 'no boots', 'sin botas'],
  forklift: ['forklift', 'montacargas', 'carretilla'],
  box: ['box', 'caja', 'carton', 'cajas'],
  pallet: ['pallet', 'pallets', 'tarima'],
  truck: ['truck', 'camion', 'trailer'],
  package: ['package', 'paquete', 'empaque'],
  product: ['product', 'producto', 'component', 'pieza'],
  defect: ['defect', 'defecto', 'falla'],
  scratch: ['scratch', 'rayon', 'arañazo'],
  crack: ['crack', 'grieta', 'fisura'],
  bottle: ['bottle', 'botella', 'envase'],
  cup: ['cup', 'taza', 'vaso'],
  handbag: ['handbag', 'cartera', 'bolso', 'backpack', 'mochila'],
  suitcase: ['suitcase', 'maleta', 'equipaje'],
  car: ['car', 'auto', 'coche', 'carro', 'automovil'],
  bus: ['bus', 'autobus', 'colectivo'],
  motorcycle: ['motorcycle', 'moto', 'motocicleta'],
  bicycle: ['bicycle', 'bicicleta', 'bici'],
  apple: ['apple', 'manzana'],
  banana: ['banana', 'platano'],
  orange: ['orange', 'naranja'],
  plant: ['plant', 'potted plant', 'potted_plant', 'planta', 'cultivo'],
  leaf: ['leaf', 'hoja'],
  weed: ['weed', 'maleza'],
}

const KEYS = {
  analyses: 'vision-ai-analyses-v3',
  alerts: 'vision-ai-alerts-v3',
  settings: 'vision-ai-settings-v3',
} as const

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error(`No se pudo guardar ${key} en almacenamiento local`, error)
  }
}

// Datos empresariales iniciales para que el sistema esté vivo y completo
const INITIAL_ENTERPRISE_ANALYSES: Analysis[] = [
  {
    id: 'AN-IND-101',
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    sourceName: 'Cámara Domo PTZ #04 - Nave de Ensamble Pesado',
    scenario: 'Seguridad industrial',
    mode: 'combined',
    engine: 'IA EDGE (NAVEGADOR)',
    durationMs: 42,
    plantZone: 'Sector C - Nave Principal',
    status: 'COMPLETADO',
    createdBy: 'Ing. Carlos Mendoza (Jefe HSE)',
    width: 1280,
    height: 720,
    volumeCm3: 45000,
    detections: [
      { id: 'd-1', label: 'person', classId: 0, confidence: 0.94, x: 0.18, y: 0.22, width: 0.16, height: 0.58, trackId: 1 },
      { id: 'd-2', label: 'helmet', classId: 1, confidence: 0.91, x: 0.22, y: 0.22, width: 0.08, height: 0.10 },
      { id: 'd-3', label: 'vest', classId: 2, confidence: 0.89, x: 0.20, y: 0.32, width: 0.12, height: 0.22 },
      { id: 'd-4', label: 'person', classId: 0, confidence: 0.92, x: 0.54, y: 0.26, width: 0.17, height: 0.55, trackId: 2 },
      { id: 'd-5', label: 'no_helmet', classId: 6, confidence: 0.88, x: 0.58, y: 0.26, width: 0.09, height: 0.11 },
      { id: 'd-6', label: 'forklift', classId: 10, confidence: 0.95, x: 0.72, y: 0.35, width: 0.24, height: 0.45 }
    ],
    patterns: [
      'Presencia de personal: 2 operarios en línea activa de producción.',
      'Incumplimiento de EPP: Operario #2 sin casco dieléctrico (Infracción OSHA 1910.135).',
      'Zona compartida Peatón-Montacargas: Interacción en radio menor a 3.5m.'
    ],
    alerts: [
      'Alerta Crítica: Personal operando en cercanía de maquinaria en movimiento sin casco de protección homologado.'
    ]
  },
  {
    id: 'AN-IND-102',
    createdAt: new Date(Date.now() - 1000 * 60 * 85).toISOString(),
    sourceName: 'Cámara IP 192.168.1.108 - Bahía de Descarga Logística',
    scenario: 'Seguridad industrial',
    mode: 'combined',
    engine: 'IA MULTIMODAL (GEMINI)',
    durationMs: 78,
    plantZone: 'Sector Logístico - Muelle B',
    status: 'COMPLETADO',
    createdBy: 'Supervisor Turno Tarde',
    width: 1280,
    height: 720,
    volumeCm3: 82000,
    detections: [
      { id: 'd-7', label: 'person', classId: 0, confidence: 0.96, x: 0.32, y: 0.18, width: 0.15, height: 0.62, trackId: 3 },
      { id: 'd-8', label: 'helmet', classId: 1, confidence: 0.93, x: 0.35, y: 0.18, width: 0.09, height: 0.12 },
      { id: 'd-9', label: 'vest', classId: 2, confidence: 0.95, x: 0.33, y: 0.28, width: 0.13, height: 0.24 },
      { id: 'd-10', label: 'boots', classId: 3, confidence: 0.87, x: 0.34, y: 0.65, width: 0.11, height: 0.14 }
    ],
    patterns: [
      'Cumplimiento Total de EPP: Operario con casco, chaleco y calzado certificado.',
      'Tránsito peatonal verificado dentro de la senda de seguridad autorizada.'
    ],
    alerts: []
  },
  {
    id: 'AN-IND-103',
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    sourceName: 'Sensor Visión AI - Celda Robótica de Soldadura',
    scenario: 'Seguridad industrial',
    mode: 'segment',
    engine: 'IA EDGE (NAVEGADOR)',
    durationMs: 38,
    plantZone: 'Área Robótica 01',
    status: 'COMPLETADO',
    createdBy: 'Ing. Carlos Mendoza (Jefe HSE)',
    width: 900,
    height: 520,
    volumeCm3: 15000,
    detections: [
      {
        id: 'd-11',
        label: 'Zona de Exclusión (Peligro)',
        classId: 99,
        confidence: 0.99,
        x: 0.60,
        y: 0.15,
        width: 0.35,
        height: 0.75,
        mask: [[0.60, 0.15], [0.95, 0.15], [0.95, 0.90], [0.60, 0.90]]
      },
      {
        id: 'd-12',
        label: 'person',
        classId: 0,
        confidence: 0.91,
        x: 0.58,
        y: 0.30,
        width: 0.14,
        height: 0.50,
        mask: [[0.58, 0.30], [0.72, 0.30], [0.72, 0.80], [0.58, 0.80]]
      }
    ],
    patterns: [
      'Intrusión de Perímetro Crítico: 18% del cuerpo penetró la zona de exclusión de brazo robótico.',
      'Paro de emergencia virtual sugerido por detección de proximidad geométrica.'
    ],
    alerts: [
      'Alerta Alta: Intrusión no autorizada en zona de exclusión de maquinaria pesada.'
    ]
  }
]

const INITIAL_ENTERPRISE_ALERTS: AlertItem[] = [
  {
    id: 'ALT-101',
    analysisId: 'AN-IND-101',
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    severity: 'Crítica',
    message: 'Operario detectado sin casco dieléctrico reglamentario en línea activa con montacargas (Nave Principal).',
    status: 'Nueva',
    scenario: 'Seguridad industrial',
    assignedSupervisor: 'Ing. Carlos Mendoza (Jefe HSE)',
    correctiveProtocol: 'Protocolo OSHA 1910.135 - Pausa de seguridad e inducción de EPP inmediata.',
    zone: 'Sector C - Nave Principal'
  },
  {
    id: 'ALT-102',
    analysisId: 'AN-IND-103',
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    severity: 'Alta',
    message: 'Intrusión de extremidad en perímetro virtual de Celda Robótica 01 durante ciclo operativo.',
    status: 'Revisada',
    scenario: 'Seguridad industrial',
    assignedSupervisor: 'Tec. Mariana Soto (Seguridad Operativa)',
    correctiveProtocol: 'Verificación de cortina óptica y recalibración de barreras perimetrales.',
    zone: 'Área Robótica 01'
  },
  {
    id: 'ALT-103',
    analysisId: 'AN-IND-100',
    createdAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    severity: 'Media',
    message: 'Chaleco reflectante ausente o parcialmente visible en zona de patio de maniobras.',
    status: 'Cerrada',
    scenario: 'Seguridad industrial',
    assignedSupervisor: 'Jefe de Patio',
    correctiveProtocol: 'Reemplazo de vestimenta reflectiva clase 2.',
    zone: 'Patio de Carga'
  }
]

export function readAnalyses(): Analysis[] {
  const value = readJson<Analysis[]>(KEYS.analyses, [])
  if (!Array.isArray(value) || value.length === 0) {
    writeJson(KEYS.analyses, INITIAL_ENTERPRISE_ANALYSES)
    return INITIAL_ENTERPRISE_ANALYSES
  }
  return value
}

export function saveAnalysis(item: Analysis): Analysis[] {
  const all = [item, ...readAnalyses().filter(existing => existing.id !== item.id)].slice(0, 300)
  writeJson(KEYS.analyses, all)
  return all
}

export function readAlerts(): AlertItem[] {
  const value = readJson<AlertItem[]>(KEYS.alerts, [])
  if (!Array.isArray(value) || value.length === 0) {
    writeJson(KEYS.alerts, INITIAL_ENTERPRISE_ALERTS)
    return INITIAL_ENTERPRISE_ALERTS
  }
  return value
}

export function addAlerts(items: AlertItem[]): void {
  if (!items.length) return
  const current = readAlerts()
  const ids = new Set(current.map(item => item.id))
  writeJson(KEYS.alerts, [...items.filter(item => !ids.has(item.id)), ...current].slice(0, 500))
}

export function updateAlert(id: string, status: AlertItem['status']): void {
  writeJson(KEYS.alerts, readAlerts().map(item => item.id === id ? { ...item, status } : item))
}

export function getSettings(): VisionSettings {
  const stored = readJson<Partial<VisionSettings> | null>(KEYS.settings, {}) || {}
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    confidence: Math.min(.99, Math.max(.05, Number(stored.confidence ?? DEFAULT_SETTINGS.confidence))),
    pxPerCm: Math.max(1, Number(stored.pxPerCm ?? DEFAULT_SETTINGS.pxPerCm)),
    depthCm: Math.max(1, Number(stored.depthCm ?? DEFAULT_SETTINGS.depthCm)),
    rules: { ...DEFAULT_SETTINGS.rules, ...(stored.rules || {}) },
  }
}

export function setSettings(settings: VisionSettings): void {
  writeJson(KEYS.settings, settings)
}

export function getClassConfig(): ScenarioClassConfig {
  const stored = readJson<ScenarioClassConfig | null>(CLASS_KEY, DEFAULT_CLASSES) || DEFAULT_CLASSES
  return Object.fromEntries(Object.entries(DEFAULT_CLASSES).map(([scenario, defaults]) => {
    const current = stored[scenario] || []
    return [scenario, defaults.map(item => ({ ...item, enabled: current.find(saved => saved.name === item.name)?.enabled ?? item.enabled }))]
  }))
}

export function setClassConfig(config: ScenarioClassConfig): void {
  writeJson(CLASS_KEY, config)
}

/**
 * Determina si una detección pertenece al escenario especificado y si su clase está habilitada.
 * Si la clase NO pertenece al escenario, devuelve false (aislamiento estricto por escenario).
 */
export function isDetectionAllowedForScenario(
  rawLabel: string,
  scenario: string,
  classConfig?: ScenarioClassConfig
): boolean {
  if (!scenario) return true
  const configs = classConfig || getClassConfig()
  const scenarioClasses = configs[scenario] || []
  if (!scenarioClasses.length) return false

  const labelClean = rawLabel.toLowerCase().trim().replace(/[\s-]+/g, '_')

  for (const item of scenarioClasses) {
    const itemNameClean = item.name.toLowerCase().trim().replace(/[\s-]+/g, '_')
    if (labelClean === itemNameClean) {
      return item.enabled
    }
    const aliases = SCENARIO_CLASS_ALIASES[itemNameClean] || []
    if (
      aliases.some(alias => {
        const aliasClean = alias.toLowerCase().replace(/[\s-]+/g, '_')
        return labelClean === aliasClean || labelClean.startsWith(`${aliasClean}_`)
      })
    ) {
      return item.enabled
    }
  }

  // Descartar explícitamente cualquier detección que no pertenezca a este escenario
  return false
}

/**
 * Filtra un conjunto de detecciones dejando ÚNICAMENTE las que pertenecen al escenario activo
 * y están habilitadas en la configuración del sistema.
 */
export function filterDetectionsByScenario(
  detections: Detection[],
  scenario: string,
  classConfig?: ScenarioClassConfig
): Detection[] {
  return detections.filter(d => isDetectionAllowedForScenario(d.label, scenario, classConfig))
}

/**
 * Obtiene la lista de nombres de clases habilitadas para un escenario.
 */
export function getScenarioTargetClasses(
  scenario: string,
  classConfig?: ScenarioClassConfig
): string[] {
  const configs = classConfig || getClassConfig()
  const list = configs[scenario] || []
  return list.filter(item => item.enabled).map(item => item.name)
}

export function clearAnalysisData(): void {
  localStorage.removeItem(KEYS.analyses)
  localStorage.removeItem(KEYS.alerts)
}

export function getLocalStorageUsage(): number {
  return new Blob([
    localStorage.getItem(KEYS.analyses) || '',
    localStorage.getItem(KEYS.alerts) || '',
    localStorage.getItem(KEYS.settings) || ''
  ]).size
}

export function makeId(prefix = 'VAI'): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

/**
 * Indicadores Globales HSE para la Empresa
 */
export function calculateEnterpriseKpis() {
  const analyses = readAnalyses()
  const alerts = readAlerts()

  const totalDetections = analyses.reduce((acc, a) => acc + a.detections.length, 0)
  const persons = analyses.flatMap(a => a.detections.filter(d => d.label.toLowerCase().includes('person') || d.label.toLowerCase().includes('worker')))
  const totalWorkers = Math.max(persons.length, 1)

  const nonCompliances = alerts.filter(a => a.severity === 'Alta' || a.severity === 'Crítica').length
  const complianceScore = Math.max(72, Math.min(100, Math.round(100 - (nonCompliances * 4.5))))

  return {
    complianceScore,
    activeAudits: analyses.length,
    totalWorkersInspected: totalWorkers,
    totalDetections,
    openCriticalAlerts: alerts.filter(a => a.status === 'Nueva' && (a.severity === 'Alta' || a.severity === 'Crítica')).length,
    resolvedAlerts: alerts.filter(a => a.status === 'Cerrada' || a.status === 'Revisada').length,
    daysWithoutIncident: 48
  }
}
