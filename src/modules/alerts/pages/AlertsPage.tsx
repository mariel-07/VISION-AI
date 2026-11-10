import { useState } from 'react'
import {
  BellRing,
  Check,
  CheckCircle2,
  Download,
  Filter,
  Send,
  ShieldAlert,
  Smartphone,
  UserCheck
} from 'lucide-react'
import { readAlerts, updateAlert, type AlertItem } from '../../../shared/services/store'
import { sendTelegramAlert } from '../../../shared/services/telegramService'

export default function AlertsPage() {
  const [version, setVersion] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string>('Todas')
  const [severityFilter, setSeverityFilter] = useState<string>('Todas')

  const alerts = readAlerts()
  const filtered = alerts.filter(a => {
    const matchStatus = statusFilter === 'Todas' || a.status === statusFilter
    const matchSeverity = severityFilter === 'Todas' || a.severity === severityFilter
    return matchStatus && matchSeverity
  })

  const newCount = alerts.filter(a => a.status === 'Nueva').length
  const criticalCount = alerts.filter(a => a.severity === 'Crítica' && a.status === 'Nueva').length

  function handleMarkReviewed(id: string) {
    updateAlert(id, 'Revisada')
    setVersion(v => v + 1)
  }

  const [telegramNotice, setTelegramNotice] = useState<string | null>(null)

  async function handleSendTelegram(alert: AlertItem) {
    setTelegramNotice(`Enviando alerta ${alert.id} a Telegram...`)
    const res = await sendTelegramAlert({
      severity: alert.severity,
      message: alert.message,
      scenario: alert.scenario
    })
    if (res.sent) {
      setTelegramNotice(`✓ Alerta ${alert.id} enviada exitosamente a tu celular.`)
    } else {
      setTelegramNotice(`✗ No se pudo enviar a Telegram: ${res.reason || 'Revisa tu configuración'}`)
    }
    window.setTimeout(() => setTelegramNotice(null), 3500)
  }

  function handleMarkClosed(id: string) {
    updateAlert(id, 'Cerrada')
    setVersion(v => v + 1)
  }

  function exportAlertsReport() {
    const header = ['ID Alerta', 'Severidad', 'Mensaje de Incidente', 'Estado', 'Zona de Planta', 'Fecha y Hora']
    const lines = filtered.map(a => [
      a.id,
      a.severity,
      `"${a.message.replace(/"/g, '""')}"`,
      a.status,
      `"${a.zone || a.scenario}"`,
      new Date(a.createdAt).toLocaleString()
    ])
    const csvContent = [header.join(','), ...lines.map(l => l.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Incidentes-HSE-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="module-page">
      {/* Cabecera */}
      <div className="page-heading">
        <div>
          <span className="eyebrow">GESTIÓN DE INCIDENTES Y SLA</span>
          <h1>Centro de Alertas y Notificaciones de Seguridad</h1>
          <p>
            Registro auditable de infracciones de EPP, invasiones de perímetro y riesgos de colisión Hombre-Máquina.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="secondary-button" onClick={exportAlertsReport}>
            <Download size={15} /> Exportar Reporte CSV
          </button>
          <span className="count-tag" style={{ color: criticalCount > 0 ? '#dc2626' : undefined }}>
            <BellRing size={15} /> {newCount} pendientes ({criticalCount} críticas)
          </span>
        </div>
      </div>

      {telegramNotice && (
        <div
          style={{
            padding: '10px 14px',
            marginBottom: '14px',
            borderRadius: '6px',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: telegramNotice.startsWith('✓') ? '#f0fdf4' : telegramNotice.startsWith('✗') ? '#fef2f2' : '#f0f9ff',
            border: `1px solid ${telegramNotice.startsWith('✓') ? '#86efac' : telegramNotice.startsWith('✗') ? '#fecaca' : '#bae6fd'}`,
            color: telegramNotice.startsWith('✓') ? '#166534' : telegramNotice.startsWith('✗') ? '#991b1b' : '#0369a1'
          }}
        >
          <Smartphone size={15} />
          <span>{telegramNotice}</span>
        </div>
      )}

      {/* Panel de Filtros y Estadísticas de Alertas */}
      <section className="panel">
        <div className="filter-bar" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
              <Filter size={15} /> Estado:
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option>Todas</option>
                <option>Nueva</option>
                <option>Revisada</option>
                <option>Cerrada</option>
              </select>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
              Severidad:
              <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
                <option>Todas</option>
                <option>Crítica</option>
                <option>Alta</option>
                <option>Media</option>
                <option>Baja</option>
              </select>
            </label>
          </div>

          <small style={{ color: '#94a3b8', fontSize: '10px', alignSelf: 'center' }}>
            Mostrando {filtered.length} de {alerts.length} alertas registradas
          </small>
        </div>

        {filtered.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
            {filtered.map(a => {
              const isCrit = a.severity === 'Crítica'
              const isHigh = a.severity === 'Alta'
              const isNew = a.status === 'Nueva'
              return (
                <div
                  className="alert-row alert-full"
                  key={`${a.id}-${version}`}
                  style={{
                    background: isNew && isCrit ? '#fef2f2' : isNew ? '#fff7ed' : '#ffffff',
                    border: `1px solid ${isNew && isCrit ? '#fecaca' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    padding: '12px 14px'
                  }}
                >
                  <span
                    className="severity-dot"
                    style={{
                      background: isCrit ? '#dc2626' : isHigh ? '#ea580c' : '#3b82f6',
                      width: '10px',
                      height: '10px'
                    }}
                  />
                  <div className="alert-content">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <b style={{ fontSize: '12px', color: isCrit ? '#991b1b' : '#1e293b' }}>{a.message}</b>
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 'bold',
                          padding: '1px 6px',
                          borderRadius: '3px',
                          color: isCrit ? '#dc2626' : isHigh ? '#ea580c' : '#0284c7',
                          background: isCrit ? '#fee2e2' : isHigh ? '#ffedd5' : '#e0f2fe'
                        }}
                      >
                        {a.severity.toUpperCase()}
                      </span>
                    </div>

                    <small style={{ color: '#64748b', fontSize: '10px', display: 'block' }}>
                      <b>Ubicación:</b> {a.zone || a.scenario} · <b>Fecha:</b> {new Date(a.createdAt).toLocaleString()} · ID: {a.id}
                    </small>

                    {a.correctiveProtocol && (
                      <small style={{ display: 'block', color: '#0284c7', fontSize: '10px', marginTop: '3px' }}>
                        <b>Protocolo:</b> {a.correctiveProtocol}
                      </small>
                    )}
                  </div>

                  <span
                    className="status-pill"
                    style={{
                      background: a.status === 'Nueva' ? '#fee2e2' : a.status === 'Revisada' ? '#fef3c7' : '#dcfce7',
                      color: a.status === 'Nueva' ? '#dc2626' : a.status === 'Revisada' ? '#b45309' : '#166534',
                      alignSelf: 'center'
                    }}
                  >
                    {a.status}
                  </span>

                  
<div className="alert-actions">
  <button
    className="alert-btn"
    title="Enviar esta alerta a mi Telegram"
    onClick={() => handleSendTelegram(a)}
    style={{ color: '#0284c7', borderColor: '#bae6fd' }}
  >
    <Send size={13} />
    <span>Telegram</span>
  </button>

  {a.status !== 'Revisada' && a.status !== 'Cerrada' && (
    <button
      className="alert-btn alert-btn-review"
      title="Marcar como Revisada / En proceso"
      onClick={() => handleMarkReviewed(a.id)}
    >
      <UserCheck size={15} />
      <span>Revisar</span>
    </button>
  )}

  {a.status !== 'Cerrada' && (
    <button
      className="alert-btn alert-btn-close"
      title="Cerrar y archivar alerta"
      onClick={() => handleMarkClosed(a.id)}
    >
      <Check size={15} />
      <span>Cerrar</span>
    </button>
  )}
</div>

                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty-state">
            <CheckCircle2 size={32} color="#16a34a" />
            <b>No hay alertas con los filtros seleccionados</b>
            <p>La planta se encuentra operando dentro de los rangos de seguridad establecidos.</p>
          </div>
        )}
      </section>

      <div className="info-strip">
        <ShieldAlert size={16} />
        <span>
          <b>Trazabilidad y Cumplimiento Legal:</b> Todo cambio de estado de una alerta queda registrado en la base de auditoría
          de la plataforma, sirviendo como evidencia de debida diligencia ante inspecciones laborales del ministerio de trabajo o auditorías ISO 45001.
        </span>
      </div>
    </div>
  )
}
