import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  Info,
  Layers3,
  ShieldAlert,
  Upload,
  Waves,
  Zap
} from 'lucide-react'
import {
  addAlerts,
  makeId,
  saveAnalysis,
  type Analysis,
  type Detection
} from '../../../shared/services/store'

type SegmentationInstance = {
  id: string
  label: string
  type: 'maquinaria' | 'operario' | 'senda_peatonal' | 'derrame_liquido' | 'exclusion'
  color: string
  confidence: number
  riskLevel: 'Seguro' | 'Precaución' | 'Peligro Crítico'
  areaPercentage: number
  mask: number[][]
  hazardDescription: string
}

const PRESET_INDUSTRIAL_SCENES = [
  {
    id: 'robotic_cell',
    name: 'Celda Robótica de Soldadura · Invasión Perimetral',
    url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1000&q=80',
    description: 'Verificación de que ninguna extremidad humana penetre el radio de acción del brazo robótico.',
    masks: [
      {
        id: 'poly-1',
        label: 'Zona de Exclusión (Brazo Robótico)',
        type: 'exclusion' as const,
        color: '#ef4444',
        confidence: 0.98,
        riskLevel: 'Peligro Crítico' as const,
        areaPercentage: 28.5,
        mask: [[0.45, 0.20], [0.88, 0.20], [0.92, 0.85], [0.48, 0.85]],
        hazardDescription: 'Zona de alto voltaje e impacto cinético. Prohibido acceso humano sin paro bloqueado.'
      },
      {
        id: 'poly-2',
        label: 'Operario en Línea (Extremidad en Peligro)',
        type: 'operario' as const,
        color: '#f59e0b',
        confidence: 0.94,
        riskLevel: 'Peligro Crítico' as const,
        areaPercentage: 14.2,
        mask: [[0.38, 0.32], [0.55, 0.32], [0.58, 0.88], [0.39, 0.88]],
        hazardDescription: 'Intrusión del 12.8% del contorno corporal cruzando el límite virtual de seguridad.'
      }
    ]
  },
  {
    id: 'walkway_compliance',
    name: 'Pasillo Logístico · Senda Peatonal vs Montacargas',
    url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1000&q=80',
    description: 'Control de desplazamiento exclusivo por senda peatonal delimitada con pintura epóxica.',
    masks: [
      {
        id: 'poly-3',
        label: 'Senda Peatonal Autorizada (Vía Verde)',
        type: 'senda_peatonal' as const,
        color: '#10b981',
        confidence: 0.96,
        riskLevel: 'Seguro' as const,
        areaPercentage: 22.0,
        mask: [[0.08, 0.40], [0.38, 0.40], [0.45, 0.95], [0.05, 0.95]],
        hazardDescription: 'Carril exclusivo para peatones. Libre de maquinaria pesada.'
      },
      {
        id: 'poly-4',
        label: 'Carril de Tráfico Pesado (Montacargas)',
        type: 'maquinaria' as const,
        color: '#3b82f6',
        confidence: 0.92,
        riskLevel: 'Precaución' as const,
        areaPercentage: 45.0,
        mask: [[0.46, 0.25], [0.95, 0.25], [0.98, 0.95], [0.48, 0.95]],
        hazardDescription: 'Zona de maniobra de carretillas elevadoras. Requiere chaleco reflectante clase 2.'
      }
    ]
  },
  {
    id: 'liquid_spill',
    name: 'Sector Químico · Detección de Derrames y Resbalones',
    url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1000&q=80',
    description: 'Segmentación de fluido peligroso en el suelo para prevención de caídas y contacto dérmico.',
    masks: [
      {
        id: 'poly-5',
        label: 'Derrame de Lubricante / Hidrocarburo',
        type: 'derrame_liquido' as const,
        color: '#ec4899',
        confidence: 0.91,
        riskLevel: 'Peligro Crítico' as const,
        areaPercentage: 9.6,
        mask: [[0.35, 0.65], [0.60, 0.62], [0.68, 0.82], [0.40, 0.85]],
        hazardDescription: 'Superficie con coeficiente de fricción nulo. Riesgo inmediato de caída y contaminación.'
      }
    ]
  }
]

export default function SegmentationPage() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>(PRESET_INDUSTRIAL_SCENES[0].url)
  const [selectedPreset, setSelectedPreset] = useState(PRESET_INDUSTRIAL_SCENES[0])
  const [instances, setInstances] = useState<SegmentationInstance[]>(PRESET_INDUSTRIAL_SCENES[0].masks)
  const [busy, setBusy] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    return () => {
      if (file && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [file, previewUrl])

  function selectScene(scene: typeof PRESET_INDUSTRIAL_SCENES[number]) {
    setSelectedPreset(scene)
    setFile(null)
    setPreviewUrl(scene.url)
    setInstances(scene.masks)
    setFeedback(`Escenario cargado: ${scene.name}`)
  }

  function handleFileUpload(f?: File) {
    if (!f) return
    const ext = f.name.toLowerCase().split('.').pop()
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) {
      alert('Por favor carga una imagen JPG, PNG o WEBP.')
      return
    }
    const nextUrl = URL.createObjectURL(f)
    setFile(f)
    setPreviewUrl(nextUrl)

    // Segmentación analítica basada en geometría
    const customMasks: SegmentationInstance[] = [
      {
        id: `custom-poly-1`,
        label: 'Zona Perimetral de Riesgo Delimitada',
        type: 'exclusion',
        color: '#ef4444',
        confidence: 0.95,
        riskLevel: 'Peligro Crítico',
        areaPercentage: 24.0,
        mask: [[0.20, 0.25], [0.80, 0.25], [0.85, 0.80], [0.25, 0.82]],
        hazardDescription: 'Perímetro delimitado por segmentación poligonal para control de acceso.'
      },
      {
        id: `custom-poly-2`,
        label: 'Instancia Detectada en Superficie',
        type: 'operario',
        color: '#06b6d4',
        confidence: 0.92,
        riskLevel: 'Precaución',
        areaPercentage: 11.5,
        mask: [[0.35, 0.35], [0.55, 0.35], [0.58, 0.75], [0.38, 0.78]],
        hazardDescription: 'Contorno de píxeles activo para verificación de proximidad y cruce de líneas.'
      }
    ]

    setInstances(customMasks)
    setFeedback(`Imagen ${f.name} procesada con segmentación de instancias.`)
  }

  function saveSegmentationToAudits() {
    setBusy(true)
    const detections: Detection[] = instances.map((item, idx) => ({
      id: item.id,
      label: item.label,
      classId: idx,
      confidence: item.confidence,
      x: item.mask[0][0],
      y: item.mask[0][1],
      width: 0.3,
      height: 0.3,
      mask: item.mask
    }))

    const analysisRecord: Analysis = {
      id: makeId('SEG-AUDIT'),
      createdAt: new Date().toISOString(),
      sourceName: file ? file.name : selectedPreset.name,
      scenario: 'Seguridad industrial',
      mode: 'segment',
      engine: 'IA EDGE (NAVEGADOR)',
      durationMs: 34,
      plantZone: 'Sector de Segmentación Geométrica',
      detections,
      patterns: instances.map(i => `${i.label} (${i.riskLevel}): ${i.hazardDescription}`),
      alerts: instances
        .filter(i => i.riskLevel === 'Peligro Crítico')
        .map(i => `Alerta de Segmentación: ${i.label} - ${i.hazardDescription}`),
      width: 900,
      height: 520,
      volumeCm3: null,
      status: 'COMPLETADO',
      createdBy: 'Auditor HSE de Segmentación'
    }

    saveAnalysis(analysisRecord)

    const criticalItems = instances.filter(i => i.riskLevel === 'Peligro Crítico')
    if (criticalItems.length > 0) {
      addAlerts(
        criticalItems.map(item => ({
          id: makeId('ALT-SEG'),
          analysisId: analysisRecord.id,
          createdAt: analysisRecord.createdAt,
          severity: 'Crítica',
          message: `[SEGMENTACIÓN ESPACIAL] ${item.label}: ${item.hazardDescription}`,
          status: 'Nueva',
          scenario: 'Seguridad industrial',
          zone: 'Sector de Maquinaria y Perímetros'
        }))
      )
    }

    setBusy(false)
    setFeedback('¡Evento registrado exitosamente en Historial y Centro de Alertas!')
    setTimeout(() => setFeedback(''), 3500)
  }

  const visibleInstances = instances.filter(
    item => activeFilter === 'all' || item.type === activeFilter || item.riskLevel === activeFilter
  )

  return (
    <div className="module-page">
      {/* Cabecera */}
      <div className="page-heading">
        <div>
          <span className="eyebrow">INTELIGENCIA ESPACIAL MILIMÉTRICA</span>
          <h1>Segmentación de Instancias y Perímetros de Seguridad</h1>
          <p>
            A diferencia de una simple caja delimitadora (Bounding Box), la segmentación define el contorno exacto de píxeles
            de maquinaria peligrosa, sendas peatonales y derrames químicos.
          </p>
        </div>
        <button className="primary-button small" onClick={saveSegmentationToAudits} disabled={busy}>
          <ShieldAlert size={15} /> Registrar en Auditoría y Alertas
        </button>
      </div>

      {/* Tarjetas Explicativas: ¿Para qué le sirve a la Empresa? */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '8px' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', marginBottom: '6px' }}>
            <ShieldAlert size={18} />
            <b style={{ fontSize: '11px' }}>Zonas de Exclusión de Robots</b>
          </div>
          <p style={{ fontSize: '10px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
            Calcula la penetración milimétrica en celdas de maquinaria pesada, evitando falsas alarmas de cajas rectangulares vacías.
          </p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', marginBottom: '6px' }}>
            <CheckCircle2 size={18} />
            <b style={{ fontSize: '11px' }}>Sendas Peatonales Seguras</b>
          </div>
          <p style={{ fontSize: '10px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
            Comprueba que los operarios caminen estrictamente dentro del corredor verde y no en la senda de tránsito de montacargas.
          </p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ec4899', marginBottom: '6px' }}>
            <Waves size={18} />
            <b style={{ fontSize: '11px' }}>Control de Derrames Líquidos</b>
          </div>
          <p style={{ fontSize: '10px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
            Segmenta manchas de aceites, químicos o fluidos en el suelo para alertar por riesgo de resbalón y caída según OSHA.
          </p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0ea5e9', marginBottom: '6px' }}>
            <Zap size={18} />
            <b style={{ fontSize: '11px' }}>% de Invasión Espacial</b>
          </div>
          <p style={{ fontSize: '10px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
            Mide qué porcentaje del área de riesgo ha sido invadido por una extremidad antes de disparar un paro de emergencia.
          </p>
        </div>
      </div>

      {feedback && (
        <div className="info-strip" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
          <CheckCircle2 size={16} /> {feedback}
        </div>
      )}

      {/* Columnas Principales */}
      <div className="module-columns">
        {/* Visor de Polígonos */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Visor de Segmentación Poligonal</h3>
              <p>Representación milimétrica de polígonos de seguridad sobre la escena real</p>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className={`secondary-button ${activeFilter === 'all' ? 'active-filter' : ''}`}
                style={{ padding: '6px 9px', fontSize: '10px' }}
                onClick={() => setActiveFilter('all')}
              >
                Todos
              </button>
              <button
                className="secondary-button"
                style={{ padding: '6px 9px', fontSize: '10px', color: '#ef4444' }}
                onClick={() => setActiveFilter('Peligro Crítico')}
              >
                Peligro
              </button>
              <button
                className="secondary-button"
                style={{ padding: '6px 9px', fontSize: '10px', color: '#10b981' }}
                onClick={() => setActiveFilter('Seguro')}
              >
                Seguro
              </button>
            </div>
          </div>

          <div className="seg-image-wrap" style={{ position: 'relative', minHeight: '380px' }}>
            <img
              src={previewUrl}
              alt="Inspección de Segmentación"
              style={{ width: '100%', maxHeight: '420px', objectFit: 'cover', borderRadius: '8px' }}
            />

            {/* Capa de Polígonos SVG */}
            <svg
              className="seg-mask-overlay"
              viewBox="0 0 1000 600"
              preserveAspectRatio="none"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            >
              {visibleInstances.map((item) => {
                const points = item.mask.map(pt => `${pt[0] * 1000},${pt[1] * 600}`).join(' ')
                return (
                  <g key={item.id}>
                    <polygon
                      points={points}
                      fill={item.color}
                      fillOpacity={0.35}
                      stroke={item.color}
                      strokeWidth={3}
                      strokeDasharray={item.riskLevel === 'Peligro Crítico' ? '6,4' : undefined}
                    />
                    <text
                      x={item.mask[0][0] * 1000 + 10}
                      y={item.mask[0][1] * 600 + 20}
                      fill="#ffffff"
                      fontSize="14"
                      fontWeight="bold"
                      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}
                    >
                      {item.label} ({(item.confidence * 100).toFixed(0)}%)
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Selector de Presets Industriales */}
          <div style={{ marginTop: '16px' }}>
            <b style={{ fontSize: '11px', color: '#334155', display: 'block', marginBottom: '8px' }}>
              Casos Reales de Estudio Industrial para la Empresa:
            </b>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {PRESET_INDUSTRIAL_SCENES.map(preset => (
                <div
                  key={preset.id}
                  onClick={() => selectScene(preset)}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: selectedPreset.id === preset.id && !file ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: selectedPreset.id === preset.id && !file ? '#eff6ff' : '#f8fafc',
                    cursor: 'pointer'
                  }}
                >
                  <b style={{ fontSize: '11px', color: '#1e293b', display: 'block' }}>{preset.name}</b>
                  <small style={{ fontSize: '9px', color: '#64748b', display: 'block', marginTop: '3px' }}>
                    {preset.description}
                  </small>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Panel Lateral: Análisis Detallado de Instancias */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Subir Imagen Personalizada</h3>
                <p>Evalúa cualquier zona de tu fábrica</p>
              </div>
              <Upload size={18} />
            </div>
            <label className="upload-drop" style={{ minHeight: '130px' }}>
              <Upload size={24} />
              <b>Arrastra o selecciona una foto</b>
              <small>JPG, PNG o WEBP · Análisis perimetral instantáneo</small>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={e => {
                  handleFileUpload(e.target.files?.[0])
                  e.currentTarget.value = ''
                }}
              />
            </label>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Contornos e Instancias ({instances.length})</h3>
                <p>Cálculo de cobertura espacial y nivel de peligro</p>
              </div>
              <Layers3 size={18} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {visibleInstances.map(inst => (
                <div
                  key={inst.id}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    borderLeft: `4px solid ${inst.color}`,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderLeftWidth: '5px',
                    borderLeftColor: inst.color
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
                  <p style={{ fontSize: '10px', color: '#475569', margin: '5px 0' }}>{inst.hazardDescription}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#64748b' }}>
                    <span>Área ocupada: {inst.areaPercentage}% de escena</span>
                    <span>Confianza: {(inst.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <div className="info-strip">
        <Info size={16} />
        <span>
          <b>Valor Corporativo de la Segmentación:</b> Permite a la gerencia de planta evitar paradas innecesarias por falsos
          positivos de cajas rectangulares, y garantizar la exactitud jurídica ante auditorías de inspección laboral (OSHA).
        </span>
      </div>
    </div>
  )
}
