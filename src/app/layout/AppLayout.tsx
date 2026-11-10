import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Activity,
  Bell,
  BrainCircuit,
  ChevronDown,
  CircleHelp,
  Command,
  FileClock,
  HardHat,
  LayoutDashboard,
  LogOut,
  ScanEye,
  Settings2,
  Shapes,
  Sparkles
} from 'lucide-react'
import { useAuth } from '../../modules/auth/services/AuthContext'
import { readAlerts } from '../../shared/services/store'

const primaryLinks = [
  { to: '/dashboard', label: 'Resumen General', icon: LayoutDashboard },
  { to: '/analysis', label: 'Análisis Visual & Cámaras', icon: ScanEye },
]
const visionLinks = [
  { to: '/detections', label: 'Detecciones EPP', icon: Activity },
  { to: '/segmentation', label: 'Segmentación & Zonas', icon: Shapes },
  { to: '/patterns', label: 'Patrones & Riesgo BBS', icon: BrainCircuit },
]
const operationLinks = [
  { to: '/alerts', label: 'Centro de Alertas', icon: Bell },
  { to: '/history', label: 'Historial & Certificados', icon: FileClock },
]
const adminLinks = [
  { to: '/scenarios', label: 'Escenarios Industriales', icon: HardHat },
  { to: '/settings', label: 'Configuración', icon: Settings2 },
]

const titles: Record<string, string> = {
  '/dashboard': 'Resumen General de Planta',
  '/': 'Resumen General de Planta',
  '/analysis': 'Estación de Análisis Visual & Cámaras',
  '/detections': 'Inventario de Detecciones EPP',
  '/segmentation': 'Segmentación y Perímetros de Seguridad',
  '/patterns': 'Reconocimiento de Patrones de Riesgo',
  '/alerts': 'Centro de Alertas y Triage de Incidentes',
  '/history': 'Historial de Auditorías y Certificados',
  '/scenarios': 'Sectores y Escenarios Industriales',
  '/settings': 'Configuración de la Suite'
}

function NavGroup({ label, links, badgeCount }: { label: string; links: typeof primaryLinks; badgeCount?: number }) {
  return (
    <div className="nav-group">
      <p className="nav-label">{label}</p>
      {links.map(({ to, label: itemLabel, icon: Icon, ...rest }) => (
        <NavLink
          key={to}
          to={to}
          end={'end' in rest ? Boolean((rest as { end?: boolean }).end) : false}
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <Icon size={17} strokeWidth={1.8} />
          <span>{itemLabel}</span>
          {to === '/alerts' && typeof badgeCount === 'number' && badgeCount > 0 && (
            <span className="nav-count">{badgeCount}</span>
          )}
        </NavLink>
      ))}
    </div>
  )
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const alerts = readAlerts()
  const unreadAlerts = alerts.filter(a => a.status === 'Nueva').length

  return (
    <div className="app-shell">
      {/* Barra Lateral Corporativa */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Command size={21} />
            <span />
          </div>
          <div>
            <strong>
              VISION<span>AI</span>
            </strong>
            <small>ENTERPRISE HSE SUITE</small>
          </div>
        </div>

        <div className="workspace-switch">
          <div className="workspace-icon">
            <Sparkles size={16} />
          </div>
          <div>
            <b>Planta Industrial Norte</b>
            <small>Auditoría ISO 45001 / OSHA</small>
          </div>
          <ChevronDown size={15} />
        </div>

        <nav className="sidebar-nav">
          <NavGroup label="OPERACIONES PRINCIPALES" links={primaryLinks} />
          <NavGroup label="INTELIGENCIA VISUAL" links={visionLinks} />
          <NavGroup label="TRAZABILIDAD" links={operationLinks} badgeCount={unreadAlerts} />
          <NavGroup label="ADMINISTRACIÓN" links={adminLinks} />
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">
              <CircleHelp size={17} />
            </div>
            <div>
              <b>Soporte HSE Corporativo</b>
              <small>Guía de uso y normativas</small>
            </div>
          </div>

          <div className="sidebar-user">
            <div className="avatar">
              {user?.name
                .split(' ')
                .map(x => x[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div className="user-meta">
              <b>{user?.name}</b>
              <small>{user?.role}</small>
            </div>
            <button className="icon-button logout" onClick={logout} title="Cerrar sesión">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      {/* Área Principal */}
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>VISION AI SUITE</span>
            <b>/</b>
            <strong>{titles[location.pathname] || 'Plataforma'}</strong>
          </div>

          <div className="top-actions">
            <span className="environment">
              <i /> 
            </span>
            <div className="notification-button" title={`${unreadAlerts} alertas pendientes`}>
              <Bell size={18} />
              {unreadAlerts > 0 && <i />}
            </div>
            <div className="top-avatar">
              {user?.name
                .split(' ')
                .map(x => x[0])
                .slice(0, 2)
                .join('')}
            </div>
          </div>
        </header>

        <div className="page-content">
          <Outlet />
        </div>

        <footer className="app-footer">
          <span>
            VISION AI <b>·</b> Plataforma de Inspección Visual de Seguridad Industrial <b>·</b> ISO 45001:2018 & OSHA 1910
          </span>
          <span>Versión 2.5.0 Enterprise <b>·</b> Desplegado en Vercel</span>
        </footer>
      </main>
    </div>
  )
}
