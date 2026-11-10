import { ArrowLeft, Construction, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import * as Icons from 'lucide-react'

export default function PlaceholderPage({ title, subtitle, icon }: { title: string; subtitle: string; icon: string }) {
  const Icon = (Icons as unknown as Record<string, LucideIcon>)[icon.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()).replace(/^./, letter => letter.toUpperCase())] || Construction
  return <div className="placeholder-page"><div className="page-heading"><div><div className="overline">MÓDULO DE LA PLATAFORMA</div><h1>{title}</h1><p>{subtitle}</p></div></div><div className="placeholder-card"><div className="placeholder-icon"><Icon size={27}/></div><span className="coming-tag">SIGUIENTE ETAPA DE DESARROLLO</span><h2>Este módulo está preparado para implementarse</h2><p>La navegación y la estructura del módulo ya están definidas. Su funcionalidad se incorporará siguiendo el manual de procedimientos y la arquitectura técnica de VISION AI.</p><Link to="/" className="back-link"><ArrowLeft size={15}/> Volver al resumen</Link></div></div>
}
