import { useMemo, useState } from 'react'
import {
  Download,
  Printer,
  Search
} from 'lucide-react'
import { readAnalyses, type Analysis } from '../../../shared/services/store'

export default function HistoryPage() {
  const [q, setQ] = useState('')
  const [engineFilter, setEngineFilter] = useState('Todos')
  const [selected, setSelected] = useState<Analysis | null>(null)

  const rows = useMemo(() => {
    return readAnalyses().filter(a => {
      const matchText = (a.sourceName + a.scenario + a.id + (a.plantZone || '')).toLowerCase().includes(q.toLowerCase())
      const matchEngine = engineFilter === 'Todos' || a.engine.toLowerCase().includes(engineFilter.toLowerCase())
      return matchText && matchEngine
    })
  }, [q, engineFilter])

  function exportCsv() {
    const head = ['ID', 'Fecha', 'Fuente / Sector', 'Escenario', 'Motor', 'Objetos', 'Confianza Media', 'Latencia (ms)', 'Zona']
    const lines = rows.map(a => {
      const avg = a.detections.length ? (a.detections.reduce((s, d) => s + d.confidence, 0) / a.detections.length).toFixed(3) : '0'
      return [
        a.id,
        a.createdAt,
        `"${a.sourceName.replace(/"/g, '""')}"`,
        a.scenario,
        a.engine,
        a.detections.length,
        avg,
        a.durationMs,
        `"${a.plantZone || 'Planta Principal'}"`
      ].join(',')
    })
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Auditoria-HSE-Historial-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function printCertificate(item: Analysis) {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>Certificado de Inspección HSE - ${item.id}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; }
            .header { border-bottom: 3px solid #2563eb; padding-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            .badge { background: #dcfce7; color: #166534; padding: 6px 12px; border-radius: 6px; font-weight: bold; }
            h1 { margin: 0; font-size: 24px; color: #1e3a8a; }
            table { width: 100%; border-collapse: collapse; margin-top: 25px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 13px; }
            th { background: #f8fafc; }
            .seal { margin-top: 50px; display: flex; justify-content: space-between; align-items: flex-end; }
            .signature { border-top: 1px solid #64748b; width: 220px; text-align: center; padding-top: 8px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>VISION AI · CERTIFICADO DE INSPECCIÓN VISUAL</h1>
              <small>Sistema de Gestión de Seguridad y Salud en el Trabajo (ISO 45001 / OSHA 1910)</small>
            </div>
            <div class="badge">AUDITORÍA VÁLIDA</div>
          </div>

          <div style="margin-top: 25px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 13px;">
            <div><strong>ID Inspección:</strong> ${item.id}</div>
            <div><strong>Fecha de Emisión:</strong> ${new Date(item.createdAt).toLocaleString()}</div>
            <div><strong>Ubicación / Sector:</strong> ${item.sourceName} (${item.plantZone || 'Planta Principal'})</div>
            <div><strong>Auditor Responsable:</strong> ${item.createdBy || 'Supervisor de Planta'}</div>
            <div><strong>Motor de Visión:</strong> ${item.engine}</div>
            <div><strong>Total Detecciones:</strong> ${item.detections.length} objetos</div>
          </div>

          <h3>1. Elementos y Equipos Auditados</h3>
          <table>
            <thead>
              <tr><th>Ítem / Elemento</th><th>Confianza</th><th>Coordenadas Normalizadas</th></tr>
            </thead>
            <tbody>
              ${item.detections.map(d => `<tr><td><strong>${d.label.toUpperCase()}</strong></td><td>${(d.confidence * 100).toFixed(1)}%</td><td>X: ${d.x.toFixed(2)}, Y: ${d.y.toFixed(2)}</td></tr>`).join('')}
            </tbody>
          </table>

          <h3>2. Patrones y Hallazgos Normativos</h3>
          <ul>
            ${item.patterns.map(p => `<li>${p}</li>`).join('') || '<li>Sin observaciones críticas</li>'}
          </ul>

          <div class="seal">
            <div>
              <small>Documento generado digitalmente por la Suite VISION AI v2.0.</small>
            </div>
            <div class="signature">
              Firma y Sello de Seguridad HSE
            </div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <div className="module-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">AUDITORÍA Y TRAZABILIDAD HSE</span>
          <h1>Historial de Inspecciones y Auditorías</h1>
          <p>
            Registro inmutable de todas las inspecciones ejecutadas, peritajes de EPP y certificados descargables.
          </p>
        </div>
        <button className="primary-link" onClick={exportCsv}>
          <Download size={15} /> Exportar Historial CSV
        </button>
      </div>

      <section className="panel">
        <div className="filter-bar">
          <label>
            <Search size={15} />
            <input
              placeholder="Buscar por sector, archivo, ID o zona…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </label>
          <select value={engineFilter} onChange={e => setEngineFilter(e.target.value)}>
            <option>Todos</option>
            <option value="EDGE">IA EDGE (NAVEGADOR)</option>
            <option value="GEMINI">IA MULTIMODAL (GEMINI)</option>
            <option value="SIM">SIMULADOR HSE</option>
          </select>
        </div>

        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID INSPECCIÓN</th>
                  <th>FECHA Y HORA</th>
                  <th>ESTACIÓN / SECTOR</th>
                  <th>ESCENARIO</th>
                  <th>MOTOR IA</th>
                  <th>OBJETOS</th>
                  <th>LATENCIA</th>
                  <th>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(a => (
                  <tr key={a.id}>
                    <td>
                      <b style={{ color: '#0284c7' }}>{a.id}</b>
                    </td>
                    <td>{new Date(a.createdAt).toLocaleString()}</td>
                    <td>
                      <b>{a.sourceName}</b>
                      <small style={{ display: 'block', color: '#64748b', fontSize: '9px' }}>
                        {a.plantZone || 'Planta Principal'}
                      </small>
                    </td>
                    <td>{a.scenario}</td>
                    <td>
                      <span
                        className={`status-pill ${
                          a.engine.includes('GEMINI') ? 'success' : a.engine.includes('SIM') ? 'warning' : 'success'
                        }`}
                      >
                        {a.engine}
                      </span>
                    </td>
                    <td>
                      <b>{a.detections.length}</b>
                    </td>
                    <td>{a.durationMs.toFixed(0)} ms</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="table-action" onClick={() => setSelected(a)}>
                          Ver Detalle
                        </button>
                        <button
                          className="table-action"
                          style={{ background: '#f8fafc', color: '#166534' }}
                          title="Imprimir Certificado HSE"
                          onClick={() => printCertificate(a)}
                        >
                          <Printer size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Search size={28} />
            <b>No se encontraron registros de inspección</b>
            <p>Prueba con otros términos de búsqueda o ejecuta una nueva inspección en Análisis Visual.</p>
          </div>
        )}
      </section>

      {/* MODAL DETALLE DE INSPECCIÓN */}
      {selected && (
        <div className="detail-backdrop" onClick={() => setSelected(null)}>
          <div className="detail-modal" onClick={e => e.stopPropagation()}>
            <div className="panel-heading">
              <div>
                <h3>Detalle de la Inspección</h3>
                <p>
                  {selected.id} · {new Date(selected.createdAt).toLocaleString()}
                </p>
              </div>
              <button className="table-action" onClick={() => setSelected(null)}>
                Cerrar
              </button>
            </div>

            <div className="detail-summary">
              <b>{selected.sourceName}</b>
              <span>{selected.plantZone || 'Sector Principal'}</span>
              <span>{selected.scenario}</span>
              <span>Motor: {selected.engine}</span>
              <span>Responsable: {selected.createdBy || 'Operador'}</span>
              <span>{selected.detections.length} detecciones</span>
            </div>

            <h4>Detecciones de Elementos</h4>
            {selected.detections.length ? (
              <div style={{ maxHeight: '180px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selected.detections.map(d => (
                  <div className="detection-row" key={d.id}>
                    <span className="detection-color" />
                    <div>
                      <b>{d.label}</b>
                      <small>
                        Coordenadas: x {d.x.toFixed(3)} · y {d.y.toFixed(3)} · {d.width.toFixed(3)} × {d.height.toFixed(3)}
                      </small>
                    </div>
                    <strong>{(d.confidence * 100).toFixed(1)}%</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-paragraph">Sin detecciones registradas.</p>
            )}

            <h4>Patrones Identificados</h4>
            {selected.patterns.length ? (
              <ul style={{ margin: '6px 0', paddingLeft: '20px', fontSize: '11px', color: '#475569' }}>
                {selected.patterns.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            ) : (
              <p className="muted-paragraph">Sin patrones particulares.</p>
            )}

            <h4>Alertas e Infracciones</h4>
            {selected.alerts.length ? (
              <ul style={{ margin: '6px 0', paddingLeft: '20px', fontSize: '11px', color: '#dc2626' }}>
                {selected.alerts.map((al, i) => (
                  <li key={i}>{al}</li>
                ))}
              </ul>
            ) : (
              <p className="muted-paragraph" style={{ color: '#16a34a' }}>
                Sin infracciones reportadas durante esta sesión.
              </p>
            )}

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="secondary-button" onClick={() => printCertificate(selected)}>
                <Printer size={14} /> Imprimir Certificado Oficial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
