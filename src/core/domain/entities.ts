export type UserRole = 'Administrador' | 'Operador de análisis' | 'Supervisor' | 'Auditor'
export type AnalysisMode = 'detection' | 'segmentation' | 'patterns' | 'combined'
export type AnalysisStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface AppUser {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface AnalysisRecord {
  id: string
  createdAt: string
  createdBy: string
  sourceName: string
  scenarioId: string
  mode: AnalysisMode
  status: AnalysisStatus
  durationMs: number
  averageConfidence: number
  isDemo: true
}

export interface Detection {
  id: string
  analysisId: string
  classId: string
  label: string
  confidence: number
  x: number
  y: number
  width: number
  height: number
}

export interface AlertRecord {
  id: string
  analysisId: string
  ruleId: string
  severity: 'Baja' | 'Media' | 'Alta' | 'Crítica'
  message: string
  status: 'Nueva' | 'Revisada' | 'Cerrada'
  createdAt: string
  reviewedBy?: string
}
