import { Boxes, Download, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { readAnalyses } from '../../../shared/services/store'

export default function DetectionsPage() {
  const [q, setQ] = useState('')
  const [minConfidence, setMinConfidence] = useState(0)
  const [filterType, setFilterType] = useState('all')

  const allDetections = useMemo(() => {
    return readAnalyses().flatMap(a =>
      a.detections.map(d => ({
        ...d,
        analysis: a
      }))
    )
  }, [])

  const rows = allDetections.filter(d => {
    const matchQuery =
      d.label.toLowerCase().includes(q.toLowerCase()) ||
      d.analysis.sourceName.toLowerCase().includes(q.toLowerCase())
    const matchConfidence = d.confidence >= minConfidence

    if (filterType === 'violations') {
      const isVio = d.label.toLowerCase().includes('no_') || d.label.toLowerCase().includes('sin')
      return matchQuery && matchConfidence && isVio
    }
    if (filterType === 'ppe') {
      const isPpe = ['helmet', 'vest', 'boots', 'gloves', 'goggles', 'casco', 'chaleco'].some(k =>
        d.label.toLowerCase().includes(k)
      )
      return matchQuery && matchConfidence && isPpe
    }
    return matchQuery && matchConfidence
  })

  function exportDetectionsCsv() {
    const head = ['ID', 'Clase / Elemento', 'Confianza (%)', 'X', 'Y', 'Ancho', 'Alto', 'Origen', 'Motor', 'Fecha']
    const lines = rows.map(d => [
      d.id,
      `"${d.label}"`,
      (d.confidence * 100).toFixed(1),
      d.x.toFixed(3),
      d.y.toFixed(3),
      d.width.toFixed(3),
      d.height.toFixed(3),
      `"${d.analysis.sourceName}"`,
      d.analysis.engine,
      d.analysis.createdAt
    ])
    const csvContent = [head.join(','), ...lines.map(l => l.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Inventario-Detecciones-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="module-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">INVENTARIO DE VISIÓN COMPUTACIONAL</span>
          <h1>Detecciones de EPP e Infraestructura</h1>
          <p>
            Catálogo exhaustivo de todos los elementos, operarios e implementos de protección identificados por la IA en
            cada fotograma.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="secondary-button" onClick={exportDetectionsCsv}>
            <Download size={15} /> Exportar CSV
          </button>
          <span className="count-tag">
            <Boxes size={15} /> {rows.length} detecciones
          </span>
        </div>
      </div>

      <section className="panel">
        <div className="filter-bar" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Search size={15} />
              <input
                placeholder="Buscar por clase, operario o estación…"
                value={q}
                onChange={e => setQ(e.target.value)}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
              Filtro:
              <select value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="all">Todos los elementos</option>
                <option value="ppe">Solo Elementos EPP</option>
                <option value="violations">Solo Infracciones (no_helmet, no_vest)</option>
              </select>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
              Confianza mínima:
              <select value={minConfidence} onChange={e => setMinConfidence(Number(e.target.value))}>
                <option value="0">Todas (&gt;0%)</option>
                <option value="0.5">Media (&gt;50%)</option>
                <option value="0.75">Alta (&gt;75%)</option>
                <option value="0.9">Muy Alta (&gt;90%)</option>
              </select>
            </label>
          </div>
        </div>

        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>CLASE / IMPLEMENTO</th>
                  <th>CONFIANZA</th>
                  <th>POSICIÓN ESPACIAL (X, Y)</th>
                  <th>DIMENSIONES (W × H)</th>
                  <th>ORIGEN / CÁMARA</th>
                  <th>MOTOR IA</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d, i) => {
                  const isViolation = d.label.toLowerCase().includes('no_') || d.label.toLowerCase().includes('sin')
                  return (
                    <tr key={`${d.analysis.id}-${d.id}-${i}`}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '2px',
                              background: isViolation ? '#ef4444' : '#0284c7'
                            }}
                          />
                          <b style={{ color: isViolation ? '#dc2626' : '#1e293b' }}>{d.label.toUpperCase()}</b>
                        </div>
                      </td>
                      <td>
                        <span className="confidence-value">{(d.confidence * 100).toFixed(1)}%</span>
                      </td>
                      <td>
                        {d.x.toFixed(3)}, {d.y.toFixed(3)}
                      </td>
                      <td>
                        {d.width.toFixed(3)} × {d.height.toFixed(3)}
                      </td>
                      <td>
                        <b>{d.analysis.sourceName}</b>
                      </td>
                      <td>
                        <span
                          className={`status-pill ${
                            d.analysis.engine.includes('GEMINI') ? 'success' : d.analysis.engine.includes('SIM') ? 'warning' : 'success'
                          }`}
                        >
                          {d.analysis.engine}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Boxes size={28} />
            <b>No hay detecciones que coincidan con los filtros</b>
            <p>Ajusta el nivel de confianza o realiza una nueva búsqueda.</p>
          </div>
        )}
      </section>
    </div>
  )
}
