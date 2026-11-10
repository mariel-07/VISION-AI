import {
  Building2,
  Factory,
  HardHat,
  Package,
  ShieldCheck,
  Truck,
  Waves
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { readAnalyses } from '../../../shared/services/store'

const scenariosList = [
  {
    name: 'Seguridad industrial',
    subtitle: 'Naves de Manufactura y Fundición',
    desc: 'Supervisión activa de cascos dieléctricos ANSI Z89.1, chalecos de alta visibilidad EN ISO 20471 y delimitación de celdas de prensas.',
    icon: HardHat,
    color: '#0284c7',
    targetClasses: 'person · helmet · vest · boots · gloves · no_helmet · no_vest'
  },
  {
    name: 'Almacén inteligente',
    subtitle: 'Centros de Distribución y Logística',
    desc: 'Monitoreo de circulación de carretillas elevadoras (montacargas), control de distanciamiento entre peatones y estiba segura de pallets.',
    icon: Package,
    color: '#f59e0b',
    targetClasses: 'forklift · pallet · box · person · truck · package'
  },
  {
    name: 'Control de calidad',
    subtitle: 'Líneas Automatizadas de Ensamble',
    desc: 'Verificación óptica de defectos superficiales, piezas faltantes y control perimetral de brazos robóticos de soldadura.',
    icon: Factory,
    color: '#10b981',
    targetClasses: 'product · defect · scratch · crack · component'
  },
  {
    name: 'Transporte y logística',
    subtitle: 'Patios de Maniobras y Muelles de Carga',
    desc: 'Control de flujo de camiones articulados, supervisión de calzos de seguridad en ruedas y verificación de chalecos en muelles.',
    icon: Truck,
    color: '#8b5cf6',
    targetClasses: 'truck · car · person · barrier · trailer'
  },
  {
    name: 'Planta Química y Fluidos',
    subtitle: 'Zonas ATEX y Tanques de Almacenamiento',
    desc: 'Segmentación de superficies para detección de derrames de hidrocarburos y verificación de protección respiratoria.',
    icon: Waves,
    color: '#ec4899',
    targetClasses: 'spill · person · mask · respirator · hazard_zone'
  },
  {
    name: 'Construcción y Obras Civiles',
    subtitle: 'Edificación y Trabajos en Altura',
    desc: 'Auditoría de arneses de seguridad, líneas de vida y perímetros de caída al vacío según norma OSHA 1926.',
    icon: Building2,
    color: '#ef4444',
    targetClasses: 'harness · scaffold · worker · barrier · helmet'
  }
]

export default function ScenariosPage() {
  const analyses = readAnalyses()

  return (
    <div className="module-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CONFIGURACIÓN MULTI-ENTORNO</span>
          <h1>Escenarios y Sectores Industriales</h1>
          <p>
            Configuración pericial de reglas de negocio, modelos de visión y protocolos HSE según el tipo de entorno de planta.
          </p>
        </div>
        <Link to="/analysis" className="primary-link">
          Iniciar Inspección en Escenario
        </Link>
      </div>

      <div className="scenario-grid">
        {scenariosList.map(s => {
          const count = analyses.filter(a => a.scenario === s.name).length
          return (
            <article className="panel scenario-card" key={s.name}>
              <div className="scenario-icon" style={{ background: `${s.color}15`, color: s.color }}>
                <s.icon size={22} />
              </div>
              <h3 style={{ fontSize: '13px', margin: '4px 0 2px' }}>{s.name}</h3>
              <small style={{ color: s.color, fontWeight: 'bold' }}>{s.subtitle}</small>
              <p style={{ margin: '8px 0', fontSize: '10px', lineHeight: '1.5' }}>{s.desc}</p>
              <small style={{ color: '#64748b', fontSize: '9px' }}>
                <b>Clases:</b> {s.targetClasses}
              </small>

              <footer>
                <span>{count} inspecciones guardadas</span>
                <Link to={`/analysis?scenario=${encodeURIComponent(s.name)}`} style={{ color: s.color, fontWeight: 'bold' }}>
                  Auditar →
                </Link>
              </footer>
            </article>
          )
        })}
      </div>

      <div className="info-strip">
        <ShieldCheck size={16} />
        <span>
          <b>Compatibilidad de Modelos:</b> El escenario de "Seguridad Industrial" utiliza el modelo entrenado con pesos EPP
          (<code>epp.onnx</code>) que corre directamente en el navegador del cliente sin necesidad de servidores adicionales.
        </span>
      </div>
    </div>
  )
}
