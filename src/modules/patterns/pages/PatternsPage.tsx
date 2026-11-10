import { useMemo, useState } from 'react'
import {
  BrainCircuit,
  CheckCircle2,
  Clock,
  Download,
  Flame,
  ShieldAlert,
  Sparkles,
  Users
} from 'lucide-react'
import { readAnalyses } from '../../../shared/services/store'

type PlantSectorRisk = {
  sector: string
  zoneName: string
  riskScore: number // 0-100
  incidentCount: number
  primaryHazard: string
  complianceRate: number
  status: 'Crítico' | 'Moderado' | 'Seguro'
}

type ShiftTrend = {
  shift: string
  hours: string
  violations: number
  helmetCompliance: number
  vestCompliance: number
  criticalIncidentTime: string
}

type PreventiveCapaAction = {
  id: string
  patternTrigger: string
  action: string
  deadline: string
  responsible: string
  priority: 'Alta' | 'Media' | 'Crítica'
  isoStandard: string
}

export default function PatternsPage() {
  const [activeTab, setActiveTab] = useState<'heatmaps' | 'shifts' | 'capa'>('heatmaps')

  const analyses = useMemo(() => readAnalyses(), [])

  // Mapa de calor de riesgos por sector de planta industrial
  const sectorRisks: PlantSectorRisk[] = [
    {
      sector: 'Sector A',
      zoneName: 'Bahía de Carga y Descarga Pesada',
      riskScore: 84,
      incidentCount: 14,
      primaryHazard: 'Interacción Peatón-Montacargas en puntos ciegos',
      complianceRate: 68,
      status: 'Crítico'
    },
    {
      sector: 'Sector B',
      zoneName: 'Nave de Soldadura y Mecanizado',
      riskScore: 72,
      incidentCount: 9,
      primaryHazard: 'Omisión de caretas y guantes ante proyecciones',
      complianceRate: 79,
      status: 'Moderado'
    },
    {
      sector: 'Sector C',
      zoneName: 'Celda Robótica y Corte Plasma',
      riskScore: 89,
      incidentCount: 18,
      primaryHazard: 'Incursión en perímetro de maquinaria en movimiento',
      complianceRate: 64,
      status: 'Crítico'
    },
    {
      sector: 'Sector D',
      zoneName: 'Pasillo Logístico Principal',
      riskScore: 24,
      incidentCount: 2,
      primaryHazard: 'Tránsito peatonal fuera de senda delimitada',
      complianceRate: 94,
      status: 'Seguro'
    },
    {
      sector: 'Sector E',
      zoneName: 'Almacén de Sustancias Químicas',
      riskScore: 61,
      incidentCount: 6,
      primaryHazard: 'Uso intermitente de protección respiratoria',
      complianceRate: 83,
      status: 'Moderado'
    }
  ]

  // Tendencias de incumplimiento por turnos de trabajo
  const shiftTrends: ShiftTrend[] = [
    {
      shift: 'Turno Mañana',
      hours: '06:00 - 14:00',
      violations: 5,
      helmetCompliance: 96,
      vestCompliance: 94,
      criticalIncidentTime: '13:15 (Fin de jornada / Prisa)'
    },
    {
      shift: 'Turno Tarde',
      hours: '14:00 - 22:00',
      violations: 19,
      helmetCompliance: 71,
      vestCompliance: 76,
      criticalIncidentTime: '15:30 (Pico de somnolencia / calor post-almuerzo)'
    },
    {
      shift: 'Turno Noche',
      hours: '22:00 - 06:00',
      violations: 12,
      helmetCompliance: 82,
      vestCompliance: 78,
      criticalIncidentTime: '03:45 (Fatiga circadiana y baja visibilidad)'
    }
  ]

  // Plan de Acción Preventivo y Correctivo (CAPA) basado en patrones detectados
  const capaPlans: PreventiveCapaAction[] = [
    {
      id: 'CAPA-001',
      patternTrigger: 'Recurrencia de 6 operarios sin casco en Sector C a las 15:30 hrs',
      action: 'Instalar cortina óptica con paro automático y reforzar señalética luminosa.',
      deadline: '48 Horas',
      responsible: 'Ing. Carlos Mendoza (Jefe HSE)',
      priority: 'Crítica',
      isoStandard: 'ISO 45001:2018 Cláusula 8.1.2'
    },
    {
      id: 'CAPA-002',
      patternTrigger: 'Cruce frecuente de peatones sobre carril de montacargas en Sector A',
      action: 'Instalar baranda física de contención y pintar nuevamente senda peatonal reflectiva.',
      deadline: '5 Días',
      responsible: 'Supervisión de Mantenimiento',
      priority: 'Alta',
      isoStandard: 'OSHA 29 CFR 1910.178'
    },
    {
      id: 'CAPA-003',
      patternTrigger: 'Retiro recurrente de guantes mecánicos por falta de ergonomía',
      action: 'Sustituir stock de guantes rígidos por modelo microporoso anticorte nivel 5.',
      deadline: '1 Semana',
      responsible: 'Dpto. de Compras y EPP',
      priority: 'Media',
      isoStandard: 'ANSI/ISEA 105-2016'
    }
  ]

  // Extracción de patrones de los análisis guardados
  const savedPatterns = useMemo(() => {
    return analyses.flatMap(a =>
      a.patterns.map((p, i) => ({
        id: `${a.id}-p-${i}`,
        text: p,
        scenario: a.scenario,
        engine: a.engine,
        source: a.sourceName,
        date: a.createdAt,
        zone: a.plantZone || 'Planta Principal'
      }))
    )
  }, [analyses])

  function exportPatternReport() {
    const lines = [
      '=====================================================',
      'REPORTE CORPORATIVO DE PATRONES DE RIESGO HSE',
      'Plataforma VISION AI · Detección de Comportamientos Inseguros',
      '=====================================================',
      `Fecha de Emisión: ${new Date().toLocaleString()}`,
      `Total Eventos Analizados: ${savedPatterns.length}`,
      '',
      '1. MAPA DE CALOR POR SECTORES DE PLANTA:',
      ...sectorRisks.map(
        s => `[${s.status.toUpperCase()}] ${s.sector} - ${s.zoneName} | Riesgo: ${s.riskScore}% | Incidentes: ${s.incidentCount} | Causa: ${s.primaryHazard}`
      ),
      '',
      '2. PATRONES CRÍTICOS POR TURNOS DE TRABAJO:',
      ...shiftTrends.map(
        t => `${t.shift} (${t.hours}) -> Infracciones: ${t.violations} | Casco: ${t.helmetCompliance}% | Hora Pico: ${t.criticalIncidentTime}`
      ),
      '',
      '3. PLAN DE ACCIONES CORRECTIVAS (CAPA):',
      ...capaPlans.map(
        c => `[${c.priority}] ${c.id}: ${c.action} | Resp: ${c.responsible} | Plazo: ${c.deadline} (${c.isoStandard})`
      )
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Reporte-Patrones-HSE-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="module-page">
      {/* Cabecera */}
      <div className="page-heading">
        <div>
          <span className="eyebrow">INTELIGENCIA PREDICTIVA Y COMPORTAMIENTO (BBS)</span>
          <h1>Reconocimiento de Patrones de Riesgo Industrial</h1>
          <p>
            Identifica hábitos inseguros repetitivos, horas punta de incumplimiento de EPP y sectores críticos de la planta
            antes de que se produzca un accidente laboral.
          </p>
        </div>
        <button className="primary-button small" onClick={exportPatternReport}>
          <Download size={15} /> Exportar Reporte de Patrones
        </button>
      </div>

      {/* Tarjetas Explicativas: Para qué le sirve a la Empresa */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '10px' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ea580c', marginBottom: '6px' }}>
            <Flame size={18} />
            <b style={{ fontSize: '11px' }}>Mapas de Calor de Riesgo</b>
          </div>
          <p style={{ fontSize: '10px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
            Localiza con precisión en qué sectores de la fábrica se concentra el 80% de los incidentes de seguridad (Principio de Pareto).
          </p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6', marginBottom: '6px' }}>
            <Clock size={18} />
            <b style={{ fontSize: '11px' }}>Horas Críticas y Fatiga</b>
          </div>
          <p style={{ fontSize: '10px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
            Detecta la correlación entre el cambio de turno (14:00 - 15:30) y el abandono voluntario de cascos por calor o fatiga.
          </p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8b5cf6', marginBottom: '6px' }}>
            <Users size={18} />
            <b style={{ fontSize: '11px' }}>Seguridad Basada en Conducta</b>
          </div>
          <p style={{ fontSize: '10px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
            Mide la efectividad real de las capacitaciones de seguridad comparando el antes y el después con métricas objetivas de visión.
          </p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', marginBottom: '6px' }}>
            <CheckCircle2 size={18} />
            <b style={{ fontSize: '11px' }}>Planes Correctivos (CAPA)</b>
          </div>
          <p style={{ fontSize: '10px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
            Genera automáticamente acciones preventivas estructuradas bajo la norma internacional ISO 45001 para la gerencia.
          </p>
        </div>
      </div>

      {/* Pestañas de Navegación del Módulo de Patrones */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
        <button
          className={`secondary-button ${activeTab === 'heatmaps' ? 'active-filter' : ''}`}
          onClick={() => setActiveTab('heatmaps')}
        >
          <Flame size={15} /> Mapa de Calor por Sectores de Planta
        </button>
        <button
          className={`secondary-button ${activeTab === 'shifts' ? 'active-filter' : ''}`}
          onClick={() => setActiveTab('shifts')}
        >
          <Clock size={15} /> Tendencias por Turno y Horario
        </button>
        <button
          className={`secondary-button ${activeTab === 'capa' ? 'active-filter' : ''}`}
          onClick={() => setActiveTab('capa')}
        >
          <ShieldAlert size={15} /> Plan de Acciones Preventivas (CAPA)
        </button>
      </div>

      {/* PESTAÑA 1: MAPA DE CALOR POR SECTORES DE PLANTA */}
      {activeTab === 'heatmaps' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            {sectorRisks.map(s => {
              const isCrit = s.status === 'Crítico'
              const isMod = s.status === 'Moderado'
              return (
                <div
                  key={s.sector}
                  style={{
                    background: '#fff',
                    borderRadius: '10px',
                    border: `1px solid ${isCrit ? '#fecaca' : isMod ? '#fed7aa' : '#bbf7d0'}`,
                    padding: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 'bold',
                        color: isCrit ? '#dc2626' : isMod ? '#ea580c' : '#16a34a',
                        background: isCrit ? '#fee2e2' : isMod ? '#ffedd5' : '#dcfce7',
                        padding: '3px 8px',
                        borderRadius: '4px'
                      }}
                    >
                      {s.sector} · {s.status.toUpperCase()}
                    </span>
                    <b style={{ fontSize: '18px', color: isCrit ? '#dc2626' : '#1e293b' }}>{s.riskScore}% Riesgo</b>
                  </div>

                  <h3 style={{ fontSize: '13px', margin: '12px 0 6px', color: '#1e293b' }}>{s.zoneName}</h3>
                  <p style={{ fontSize: '10px', color: '#64748b', margin: '0 0 12px', minHeight: '30px' }}>
                    <b>Peligro Recurrente:</b> {s.primaryHazard}
                  </p>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#475569', marginBottom: '4px' }}>
                      <span>Tasa de Cumplimiento EPP</span>
                      <b>{s.complianceRate}%</b>
                    </div>
                    <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${s.complianceRate}%`,
                          background: isCrit ? '#ef4444' : isMod ? '#f59e0b' : '#10b981'
                        }}
                      />
                    </div>
                    <small style={{ display: 'block', fontSize: '9px', color: '#94a3b8', marginTop: '6px' }}>
                      {s.incidentCount} infracciones registradas en las últimas 72 hrs.
                    </small>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* PESTAÑA 2: TENDENCIAS POR TURNO Y HORARIO */}
      {activeTab === 'shifts' && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Análisis Cronológico de Incidentes por Turno Laboral</h3>
              <p>Muestra cómo decae el uso de equipo de protección a lo largo del ciclo diario de trabajo</p>
            </div>
            <Clock size={18} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', margin: '15px 0' }}>
            {shiftTrends.map(t => (
              <div
                key={t.shift}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b style={{ fontSize: '13px', color: '#1e293b' }}>{t.shift}</b>
                  <span style={{ fontSize: '10px', color: '#64748b', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                    {t.hours}
                  </span>
                </div>

                <div style={{ margin: '14px 0' }}>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: t.violations > 10 ? '#dc2626' : '#1e293b' }}>
                    {t.violations} <small style={{ fontSize: '11px', fontWeight: 'normal', color: '#64748b' }}>infracciones</small>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '10px', color: '#475569' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Cumplimiento Casco:</span>
                    <b style={{ color: t.helmetCompliance < 80 ? '#dc2626' : '#16a34a' }}>{t.helmetCompliance}%</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Cumplimiento Chaleco:</span>
                    <b style={{ color: t.vestCompliance < 80 ? '#dc2626' : '#16a34a' }}>{t.vestCompliance}%</b>
                  </div>
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', color: '#ef4444' }}>
                    <b>Hora Pico Crítica:</b>
                    <div style={{ color: '#64748b', fontSize: '9px', marginTop: '2px' }}>{t.criticalIncidentTime}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="info-strip">
            <Sparkles size={16} />
            <span>
              <b>Hallazgo de la IA:</b> El turno tarde registra un 280% más de omisión de casco y chaleco reflectante entre las
              14:30 y 16:00 horas, coincidente con la curva de temperatura máxima ambiental y fatiga postprandial.
            </span>
          </div>
        </section>
      )}

      {/* PESTAÑA 3: PLAN DE ACCIONES CORRECTIVAS (CAPA / ISO 45001) */}
      {activeTab === 'capa' && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Planes de Acción Correctiva y Preventiva (CAPA - ISO 45001)</h3>
              <p>Medidas estructuradas que el sistema sugiere automáticamente ante la detección de patrones recurrentes</p>
            </div>
            <ShieldAlert size={18} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            {capaPlans.map(capa => (
              <div
                key={capa.id}
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '14px',
                  display: 'grid',
                  gridTemplateColumns: '100px 1.8fr 1.2fr 100px',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 'bold',
                      color: capa.priority === 'Crítica' ? '#dc2626' : '#ea580c',
                      background: capa.priority === 'Crítica' ? '#fee2e2' : '#ffedd5',
                      padding: '3px 8px',
                      borderRadius: '4px'
                    }}
                  >
                    {capa.id}
                  </span>
                  <small style={{ display: 'block', color: '#64748b', fontSize: '9px', marginTop: '3px' }}>
                    {capa.priority}
                  </small>
                </div>

                <div>
                  <b style={{ fontSize: '11px', color: '#1e293b', display: 'block' }}>{capa.action}</b>
                  <small style={{ color: '#64748b', fontSize: '9px', display: 'block', marginTop: '3px' }}>
                    <b>Detonante:</b> {capa.patternTrigger}
                  </small>
                </div>

                <div>
                  <span style={{ fontSize: '10px', color: '#334155', display: 'block' }}>
                    <b>Responsable:</b> {capa.responsible}
                  </span>
                  <small style={{ color: '#0284c7', fontSize: '9px' }}>{capa.isoStandard}</small>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 'bold' }}>{capa.deadline}</span>
                  <small style={{ display: 'block', color: '#94a3b8', fontSize: '8px' }}>Plazo Límite</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Lista de Patrones Observados en Vivo */}
      <section className="panel" style={{ marginTop: '14px' }}>
        <div className="panel-heading">
          <div>
            <h3>Evidencias y Patrones Registrados en este Dispositivo ({savedPatterns.length})</h3>
            <p>Historial consolidado a partir de las inspecciones visuales ejecutadas</p>
          </div>
          <BrainCircuit size={18} />
        </div>

        {savedPatterns.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {savedPatterns.slice(0, 10).map(item => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  background: '#f8fafc',
                  border: '1px solid #f1f5f9',
                  borderRadius: '6px'
                }}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: item.text.toLowerCase().includes('infracción') || item.text.toLowerCase().includes('peligro') ? '#ef4444' : '#10b981'
                  }}
                />
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: '11px', color: '#1e293b' }}>{item.text}</b>
                  <small style={{ display: 'block', color: '#64748b', fontSize: '9px', marginTop: '2px' }}>
                    {item.zone} · {item.source} · {new Date(item.date).toLocaleString()}
                  </small>
                </div>
                <span className="status-pill success">{item.engine}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <BrainCircuit size={28} />
            <b>Sin patrones registrados</b>
            <p>Ejecuta una inspección en Análisis Visual o inicia el simulador para acumular patrones.</p>
          </div>
        )}
      </section>
    </div>
  )
}
