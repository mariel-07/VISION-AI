import type { AnalysisInput, VisionEngine, VisionResult } from '../../core/ports/VisionEngine'

/**
 * Adaptador determinista de demostración. Sus resultados son sintéticos y
 * sirven para probar el contrato de la aplicación, no para inspeccionar píxeles.
 */
export class DemoVisionAdapter implements VisionEngine {
  async analyze(input: AnalysisInput): Promise<VisionResult> {
    const started = performance.now()
    const analysisId = `DEMO-${Date.now()}`
    const safety = input.scenarioId.toLowerCase().includes('seguridad')
    const labels = safety
      ? ['Persona DEMO 01', 'Persona DEMO 02', 'Persona DEMO 03']
      : input.scenarioId.toLowerCase().includes('transporte')
        ? ['Automóvil DEMO', 'Camión DEMO', 'Motocicleta DEMO']
        : input.scenarioId.toLowerCase().includes('agricultura')
          ? ['Manzana DEMO', 'Plátano DEMO', 'Naranja DEMO']
          : ['Objeto DEMO 01', 'Objeto DEMO 02', 'Objeto DEMO 03']
    const boxes = [
      { x: .12, y: .20, width: .22, height: .56 },
      { x: .40, y: .28, width: .20, height: .48 },
      { x: .68, y: .18, width: .20, height: .58 },
    ]
    const detections = labels.map((label, index) => ({
      id: `${analysisId}-D${index + 1}`,
      label,
      confidence: .94 - index * .06,
      ...boxes[index],
    })).filter(item => item.confidence >= input.threshold)
    const patterns = [{
      id: `${analysisId}-P1`,
      type: safety ? 'ppe-review' : 'scenario-demo',
      label: safety ? 'Revisión de EPP (DEMO)' : `Escenario ${input.scenarioId} (DEMO)`,
      confidence: .9,
      evidence: 'Resultado sintético determinista para validar la interfaz; no procede de inferencia sobre una imagen.',
    }]
    const durationMs = performance.now() - started
    return {
      analysis: {
        id: analysisId,
        createdAt: new Date().toISOString(),
        createdBy: input.createdBy,
        sourceName: input.sourceName,
        scenarioId: input.scenarioId,
        mode: input.mode,
        status: 'completed',
        durationMs,
        averageConfidence: detections.length ? detections.reduce((sum, item) => sum + item.confidence, 0) / detections.length : 0,
        isDemo: true,
      },
      detections,
      patterns,
      durationMs,
    }
  }
}
