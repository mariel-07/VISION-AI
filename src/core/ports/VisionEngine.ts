import type { AnalysisMode, AnalysisRecord } from '../domain/entities'

export interface AnalysisInput {
  sourceName: string
  scenarioId: string
  mode: AnalysisMode
  threshold: number
  createdBy: string
}

export interface VisionResult {
  analysis: AnalysisRecord
  detections: Array<{ id: string; label: string; confidence: number; x: number; y: number; width: number; height: number }>
  patterns: Array<{ id: string; type: string; label: string; confidence: number; evidence: string }>
  durationMs: number
}

/** Contrato que permite sustituir el motor DEMO por una API real en una fase posterior. */
export interface VisionEngine {
  analyze(input: AnalysisInput): Promise<VisionResult>
}
