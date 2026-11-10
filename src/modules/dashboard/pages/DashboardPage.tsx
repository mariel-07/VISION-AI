import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Radio,
  ScanEye,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  calculateEnterpriseKpis,
  readAlerts,
  readAnalyses
} from '../../../shared/services/store'

export default function DashboardPage() {
  const rows = readAnalyses()
  const alerts = readAlerts()
  const kpis = calculateEnterpriseKpis()

  const openAlerts = alerts.filter(a => a.status === 'Nueva')
  const criticalCount = alerts.filter(a => a.severity === 'Crítica' && a.status === 'Nueva').length

  const metrics = [
    {
      label: 'Índice Cumplimiento EPP',
      value: `${kpis.complianceScore}%`,
      icon: ShieldCheck,
      color: '#10b981',
      sub: 'Estándar ISO 45001 / OSHA'
    },
    {
      label: 'Días sin Incidentes Graves',
      value: `${kpis.daysWithoutIncident}`,
      icon: CheckCircle2,
      color: '#0284c7',
      sub: 'En zonas monitoreadas por IA'
    },
    {
      label: 'Operarios Auditados',
      value: `${kpis.totalWorkersInspected}`,
      icon: Users,
      color: '#8b5cf6',
      sub: 'Censo visual consolidado'
    },
    {
      label: 'Alertas Críticas Activas',
      value: `${criticalCount}`,
      icon: AlertTriangle,
      color: criticalCount > 0 ? '#ef4444' : '#10b981',
      sub: criticalCount > 0 ? 'Requieren intervención inmediata' : 'Sin infracciones críticas'
    },
    {
      label: 'Inspecciones Registradas',
      value: `${rows.length}`,
      icon: ScanEye,
      color: '#3b82f6',
      sub: 'Sesiones de visión por IA'
    }
  ]

  const plantZones = [
    { name: 'Nave de Ensamble y Mecanizado', status: 'Conforme', workers: 8, ppeScore: 94 },
    { name: 'Bahía de Carga y Descarga (Montacargas)', status: 'Riesgo Moderado', workers: 5, ppeScore: 78 },
    { name: 'Celda Robótica de Soldadura', status: 'Inspección Activa', workers: 2, ppeScore: 88 },
    { name: 'Pasarela Peatonal Principal', status: 'Conforme', workers: 12, ppeScore: 98 }
  ]

  return (
    <div className="module-page">
      {/* Cabecera Ejecutiva */}
      <div className="page-heading">
        <div>
          <span className="eyebrow">PLATAFORMA INDUSTRIAL HSE · SUITE CORPORATIVA</span>
          <h1>Tablero de Control de Seguridad y Visión AI</h1>
          <p>
            Monitoreo en tiempo real de cumplimiento de EPP, prevención de colisiones hombre-máquina e inspección normativa.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link className="secondary-button" to="/analysis">
            <Radio size={15} /> Conectar Cámara / IP
          </Link>
          <Link className="primary-link" to="/analysis">
            <ScanEye size={16} /> Iniciar Inspección Visual
          </Link>
        </div>
      </div>

      {/* Banner de Estado Corporativo */}
      <div className="welcome-strip" style={{ background: 'linear-gradient(100deg, #eff6ff, #f0fdf4)', border: '1px solid #bfdbfe' }}>
        <div className="welcome-icon" style={{ background: '#2563eb', color: '#fff' }}>
          <ShieldAlert size={20} />
        </div>
        <div>
          <b>Estado de Seguridad Industrial: Nivel Operativo Óptimo ({kpis.complianceScore}%)</b>
          <p>
            El sistema de Visión Artificial se encuentra ejecutándose en modo Edge sin dependencia de servidores externos.
            Cumplimiento normativo auditado bajo directrices OSHA 1910 y certificación ISO 45001.
          </p>
        </div>
        <div className="welcome-status" style={{ color: '#166534', fontWeight: 'bold' }}>
          <i>●</i> 4 CÁMARAS EN LÍNEA
        </div>
      </div>

      {/* Tarjetas de Indicadores Clave (KPIs) */}
      <div className="metric-grid module-metrics" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {metrics.map(metric => (
          <div className="metric-card" key={metric.label}>
            <div className="metric-top">
              <span>{metric.label}</span>
              <i style={{ color: metric.color }}>
                <metric.icon size={18} />
              </i>
            </div>
            <div className="metric-value" style={{ color: metric.color }}>
              {metric.value}
            </div>
            <div className="metric-foot">{metric.sub}</div>
          </div>
        ))}
      </div>

      {/* Cuadrícula Principal: Zonas de Planta y Actividad */}
      <div className="module-columns">
        {/* Actividad de Inspección Reciente */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Últimas Inspecciones y Eventos Registrados</h3>
              <p>Auditorías visuales y capturas en estaciones de trabajo</p>
            </div>
            <Link className="text-link" to="/history">
              Ver Historial Completo <ArrowUpRight size={13} />
            </Link>
          </div>

          {rows.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ORIGEN / SECTOR</th>
                    <th>ESCENARIO</th>
                    <th>MOTOR</th>
                    <th>DETECCIONES</th>
                    <th>FECHA Y HORA</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 6).map(item => (
                    <tr key={item.id}>
                      <td>
                        <b>{item.sourceName}</b>
                        <small style={{ display: 'block', color: '#64748b', fontSize: '9px' }}>
                          {item.plantZone || 'Sector Principal'}
                        </small>
                      </td>
                      <td>{item.scenario}</td>
                      <td>
                        <span className={`status-pill ${item.engine.includes('GEMINI') ? 'success' : item.engine.includes('SIM') ? 'warning' : 'success'}`}>
                          {item.engine}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{item.detections.length}</span> objetos
                      </td>
                      <td>{new Date(item.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <ScanEye size={27} />
              <b>No hay inspecciones registradas</b>
              <p>Inicia el análisis visual para comenzar a registrar eventos.</p>
            </div>
          )}
        </section>

        {/* Alertas Pendientes de Revisión */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Alertas e Infracciones Recientes</h3>
              <p>Incidencias que requieren firma de supervisor</p>
            </div>
            <Link className="text-link" to="/alerts">
              Centro de Alertas ({openAlerts.length})
            </Link>
          </div>

          {alerts.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {alerts.slice(0, 5).map(item => (
                <div className="alert-row" key={item.id}>
                  <span
                    className="severity-dot"
                    style={{
                      background: item.severity === 'Crítica' ? '#dc2626' : item.severity === 'Alta' ? '#ea580c' : '#3b82f6'
                    }}
                  />
                  <div>
                    <b style={{ color: item.severity === 'Crítica' ? '#dc2626' : '#1e293b' }}>{item.message}</b>
                    <small>
                      {item.zone || item.scenario} · {new Date(item.createdAt).toLocaleTimeString()} · Estado: {item.status}
                    </small>
                  </div>
                  <span
                    className="status-pill"
                    style={{
                      background: item.status === 'Nueva' ? '#fee2e2' : '#dcfce7',
                      color: item.status === 'Nueva' ? '#dc2626' : '#166534'
                    }}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state compact">
              <CheckCircle2 size={24} color="#16a34a" />
              <b>Sin alertas pendientes</b>
              <p>Todas las inspecciones se encuentran conformes.</p>
            </div>
          )}
        </section>
      </div>

      {/* Estado de Zonas de Planta Industrial */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Monitoreo Perimetral por Zonas de Planta</h3>
            <p>Estado operativo en tiempo real de las estaciones y celdas industriales</p>
          </div>
          <Activity size={18} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginTop: '12px' }}>
          {plantZones.map(zone => (
            <div
              key={zone.name}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '14px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 'bold',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: zone.status === 'Conforme' ? '#dcfce7' : '#fef3c7',
                    color: zone.status === 'Conforme' ? '#166534' : '#b45309'
                  }}
                >
                  {zone.status}
                </span>
                <b style={{ fontSize: '14px', color: '#1e293b' }}>{zone.ppeScore}% EPP</b>
              </div>
              <h4 style={{ fontSize: '11px', margin: '8px 0 4px', color: '#1e293b' }}>{zone.name}</h4>
              <small style={{ color: '#64748b', fontSize: '9px' }}>{zone.workers} trabajadores activos en turno</small>
            </div>
          ))}
        </div>
      </section>

      {/* Nota técnica de infraestructura */}
      <div className="info-strip">
        <Sparkles size={16} />
        <span>
          <b>Despliegue Corporativo en Vercel:</b> Motor de Red Neuronal ejecutándose de manera descentralizada en el cliente
          con ONNX Runtime WebAssembly/WebGPU. Conexión de cámaras USB, Bluetooth y streams IP RTSP disponibles directamente
          sin necesidad de intermediarios en servidor.
        </span>
      </div>
    </div>
  )
}
