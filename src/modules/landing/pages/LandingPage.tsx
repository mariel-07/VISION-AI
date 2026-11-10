import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowRight,
  Bell,
  BrainCircuit,
  Camera,
  CheckCircle2,
  FileCheck2,
  HardHat,
  Layers3,
  ScanEye,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap
} from 'lucide-react'
import { useAuth } from '../../auth/services/AuthContext'

export default function LandingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [cctvTime, setCctvTime] = useState('')

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCctvTime(now.toLocaleTimeString('es-ES', { hour12: false }) + '.' + Math.floor(now.getMilliseconds() / 100))
    }
    updateTime()
    const timer = setInterval(updateTime, 100)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="landing-container">
      {/* Barra de Navegación Superior */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <div className="brand-mark">
              <ScanEye size={22} />
              <span />
            </div>
            <div>
              <strong>VISION<span>AI</span></strong>
              <small>ENTERPRISE HSE SUITE</small>
            </div>
          </div>

          <nav className="landing-nav-links">
            <a href="#capacidades">Capacidades</a>
            <a href="#modulos">Módulos</a>
            <a href="#segmentacion">Segmentación Real</a>
            <a href="#normativas">Normativas</a>
            <a href="#metricas">Rendimiento</a>
          </nav>

          <div className="landing-nav-actions">
            {user ? (
              <button className="landing-primary-btn" onClick={() => navigate('/dashboard')}>
                <span>Ir al Dashboard ({user.name.split(' ')[0]})</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <>
                <Link to="/login" className="landing-link-login">
                  Acceso Supervisores
                </Link>
                <button className="landing-primary-btn" onClick={() => navigate('/login')}>
                  <span>Iniciar Sesión</span>
                  <ArrowRight size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Sección Hero Principal */}
      <section className="landing-hero">
        <div className="hero-glow glow-1" />
        <div className="hero-glow glow-2" />
        <div className="hero-grid-pattern" />

        <div className="hero-content">
          <div className="hero-badge">
            <span className="live-dot" />
            <Sparkles size={14} />
            <span>SISTEMA ACTIVO · INTELIGENCIA VISUAL & SEGURIDAD INDUSTRIAL 4.0</span>
          </div>

          <h1 className="hero-title">
            Cero Accidentes en Planta con{' '}
            <span className="gradient-text">Visión Artificial</span> en Tiempo Real.
          </h1>

          <p className="hero-subtitle">
            Supervisión automatizada de EPP, delimitación perimetral milimétrica en maquinaria pesada,
            detección de derrames químicos y auditorías forenses inteligentes bajo estándares OSHA 1910 e ISO 45001.
          </p>

          <div className="hero-actions">
            <button className="hero-btn-primary" onClick={() => navigate('/login')}>
              <ScanEye size={18} />
              <span>Acceder al Sistema HSE</span>
              <ArrowRight size={18} />
            </button>
            <button className="hero-btn-secondary" onClick={() => navigate('/login')}>
              <HardHat size={18} />
              <span>Ver Demostración en Vivo</span>
            </button>
          </div>

          {/* Estadísticas de Confianza */}
          <div className="hero-trust-bar">
            <div>
              <strong>35 ms</strong>
              <span>Latencia Edge</span>
            </div>
            <div className="divider" />
            <div>
              <strong>99.4%</strong>
              <span>Precisión EPP</span>
            </div>
            <div className="divider" />
            <div>
              <strong>100%</strong>
              <span>Procesamiento Local</span>
            </div>
            <div className="divider" />
            <div>
              <strong>OSHA / ISO</strong>
              <span>Cumplimiento Total</span>
            </div>
          </div>
        </div>

        {/* Simulador Interactivo de CCTV Industrial */}
        <div className="hero-monitor-wrap">
          <div className="monitor-frame">
            <div className="monitor-topbar">
              <div className="monitor-cam-title">
                <span className="rec-dot" />
                <b>CAM-04 · NAVE DE SOLDADURA Y MONTAJE PESADO</b>
                <span className="time-code">{cctvTime}</span>
              </div>
              <div className="monitor-stats">
                <span className="monitor-tag">30 FPS</span>
                <span className="monitor-tag edge">WEBGPU EDGE</span>
              </div>
            </div>

            <div className="monitor-screen">
              {/* Overlay Canvas de Detección Simulado */}
              <div className="cctv-grid-overlay" />
              <div className="cctv-scanline" />

              {/* Detección 1: Operario con EPP completo */}
              <div className="cctv-bbox safe" style={{ top: '22%', left: '18%', width: '18%', height: '56%' }}>
                <span className="bbox-label safe">OPERARIO #1 · EPP COMPLETO (98%)</span>
                <div className="cctv-subbox" style={{ top: '3%', left: '20%', width: '55%', height: '22%' }}>
                  <span className="sub-tag">CASCO OK</span>
                </div>
                <div className="cctv-subbox" style={{ top: '27%', left: '10%', width: '75%', height: '40%' }}>
                  <span className="sub-tag">CHALECO OK</span>
                </div>
              </div>

              {/* Detección 2: Celda Robótica con Segmentación Perimetral */}
              <div className="cctv-exclusion-zone" style={{ top: '15%', left: '52%', width: '40%', height: '70%' }}>
                <div className="exclusion-header">
                  <ShieldAlert size={14} />
                  <span>ZONA DE EXCLUSIÓN · BRAZO ROBÓTICO #02</span>
                </div>
                <div className="exclusion-status safe">
                  <CheckCircle2 size={13} />
                  <span>PERÍMETRO INTACTO · DISTANCIA: 2.4 m</span>
                </div>
              </div>

              {/* Senda Peatonal Verde */}
              <div className="cctv-walkway" style={{ bottom: '4%', left: '5%', width: '42%', height: '18%' }}>
                <span>SENDA PEATONAL AUTORIZADA (VÍA SEGURA)</span>
              </div>

              {/* Live Status HUD */}
              <div className="monitor-hud-bottom">
                <div className="hud-metric">
                  <small>ESTADO DE SEGURIDAD</small>
                  <b style={{ color: '#22c55e' }}>ÓPTIMO (SIN ACCIDENTES)</b>
                </div>
                <div className="hud-metric">
                  <small>OPERARIOS DETECTADOS</small>
                  <b>1 EN LÍNEA</b>
                </div>
                <div className="hud-metric">
                  <small>INVASIÓN ESPACIAL</small>
                  <b>0.0% (SEGURO)</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sección de Módulos de la Suite */}
      <section className="landing-section" id="modulos">
        <div className="section-header">
          <span className="eyebrow">ARQUITECTURA INTEGRADA</span>
          <h2>Módulos Especializados de Visión Artificial</h2>
          <p>
            Una plataforma completa que conecta cámaras en vivo, detección de objetos,
            segmentación de perímetros y reportes automáticos en tiempo real.
          </p>
        </div>

        <div className="modules-grid">
          <div className="module-card">
            <div className="module-card-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <ScanEye size={24} />
            </div>
            <h3>Análisis Visual & Cámaras en Vivo</h3>
            <p>
              Conexión directa a webcams USB, cámaras IP y streams RTSP.
              Inferencia ultra rápida en el navegador con aceleración WebGPU y WASM sin enviar video a servidores externos.
            </p>
            <div className="card-badge">TIEMPO REAL · 30 FPS</div>
          </div>

          <div className="module-card">
            <div className="module-card-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
              <HardHat size={24} />
            </div>
            <h3>Detección Automática de EPP</h3>
            <p>
              Inspección continua de cascos de seguridad, chalecos reflectivos clase 2, guantes y calzado.
              Alerta de inmediato cuando un operario ingresa sin el equipo reglamentario.
            </p>
            <div className="card-badge">NORMA OSHA 1910.135</div>
          </div>

          <div className="module-card highlighted">
            <div className="highlight-tag">NUEVA VERSIÓN 2.5</div>
            <div className="module-card-icon" style={{ background: '#f3e8ff', color: '#7c3aed' }}>
              <Layers3 size={24} />
            </div>
            <h3>Segmentación & Zonas en Tiempo Real</h3>
            <p>
              Delimitación milimétrica de perímetros peligrosos alrededor de robots y maquinaria pesada.
              Calcula el porcentaje exacto de invasión espacial y activa paros de emergencia virtuales.
            </p>
            <div className="card-badge highlight">CONECTADO A TODOS LOS MÓDULOS</div>
          </div>

          <div className="module-card">
            <div className="module-card-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
              <BrainCircuit size={24} />
            </div>
            <h3>Patrones de Riesgo & Comportamiento BBS</h3>
            <p>
              Mapas de calor espaciales por sector de planta y análisis por turnos.
              Identifica zonas ciegas e interacciones críticas entre peatones y montacargas.
            </p>
            <div className="card-badge">METODOLOGÍA BBS</div>
          </div>

          <div className="module-card">
            <div className="module-card-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
              <Bell size={24} />
            </div>
            <h3>Centro de Alertas & Notificaciones</h3>
            <p>
              Triage en tiempo real con niveles de criticidad (Baja, Media, Alta, Crítica).
              Despacho automático de evidencias fotográficas e informes ejecutivos al bot oficial de Telegram.
            </p>
            <div className="card-badge">TELEGRAM BOT INTEGRADO</div>
          </div>

          <div className="module-card">
            <div className="module-card-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
              <FileCheck2 size={24} />
            </div>
            <h3>Historial & Auditorías Forenses</h3>
            <p>
              Registro digital de cada incidente con metadatos de supervisor, coordenadas,
              motor utilizado y actas oficiales descargables para inspectores de trabajo.
            </p>
            <div className="card-badge">VALIDEZ LEGAL & AUDITORÍA</div>
          </div>
        </div>
      </section>

      {/* Sección Destacada: Segmentación Espacial sin Imágenes Estáticas */}
      <section className="landing-section dark-section" id="segmentacion">
        <div className="dark-section-inner">
          <div className="dark-section-text">
            <span className="eyebrow" style={{ color: '#38bdf8' }}>INTELIGENCIA ESPACIAL MILIMÉTRICA</span>
            <h2>Segmentación Dinámica Conectada en Tiempo Real</h2>
            <p>
              Olvídate de imágenes estáticas de stock. El módulo de segmentación ahora trabaja en vivo
              con tu cámara real, o sincronizado instantáneamente con los análisis de EPP y auditorías de la fábrica.
            </p>

            <div className="feature-bullets">
              <div className="f-bullet">
                <div className="f-bullet-icon"><Zap size={18} /></div>
                <div>
                  <b>Sincronización Total entre Módulos</b>
                  <p>Cualquier detección o foto analizada en Análisis se refleja de inmediato en Segmentación con contornos poligonales.</p>
                </div>
              </div>

              <div className="f-bullet">
                <div className="f-bullet-icon"><Camera size={18} /></div>
                <div>
                  <b>Cámara en Vivo Cuadro a Cuadro</b>
                  <p>Activa tu cámara y observa cómo los polígonos de exclusión y sendas peatonales evalúan la escena a 30 cuadros por segundo.</p>
                </div>
              </div>

              <div className="f-bullet">
                <div className="f-bullet-icon"><ShieldCheck size={18} /></div>
                <div>
                  <b>Comprensible para Todo el Personal</b>
                  <p>Lenguaje claro, semáforos visuales (Verde = Seguro, Rojo = Peligro) y cálculo de invasión en porcentaje sin tecnicismos.</p>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <button className="hero-btn-primary" onClick={() => navigate('/login')}>
                <span>Probar la Segmentación en Tiempo Real</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          <div className="dark-section-visual">
            <div className="interactive-preview-card">
              <div className="preview-top">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
                <span className="preview-title">SEGMENTACIÓN DE POLÍGONOS DINÁMICOS</span>
              </div>
              <div className="preview-body">
                <div className="poly-legend">
                  <span className="poly-chip red">🔴 ZONA DE EXCLUSIÓN (ROBOT)</span>
                  <span className="poly-chip green">🟢 SENDA PEATONAL</span>
                  <span className="poly-chip blue">🟣 SILUETA DE OPERARIO</span>
                </div>
                <div className="poly-canvas-mock">
                  <div className="poly-danger-zone">
                    <span>ÁREA DE GIRO CINÉTICO</span>
                  </div>
                  <div className="poly-worker-mask">
                    <span>OPERARIO DETECTADO</span>
                  </div>
                  <div className="poly-safe-zone">
                    <span>CAMINO VERDE SEGURO</span>
                  </div>
                </div>
                <div className="poly-footer">
                  <span>Invasión Detectada: <b>0.0%</b></span>
                  <span className="status-badge-safe">PERÍMETRO SEGURO</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sección Normativas y Regulaciones */}
      <section className="landing-section" id="normativas">
        <div className="section-header">
          <span className="eyebrow">ESTÁNDARES INTERNACIONALES</span>
          <h2>Alineado a las Normativas Más Exigentes</h2>
          <p>
            Diseñado para cumplir con los requerimientos legales de los departamentos de Prevención de Riesgos Laborales.
          </p>
        </div>

        <div className="standards-grid">
          <div className="standard-item">
            <b>OSHA 1910.132</b>
            <small>Equipo de Protección Personal</small>
            <p>Supervisión continua y registro de uso de protección ocular, facial, de cabeza y extremidades.</p>
          </div>
          <div className="standard-item">
            <b>ISO 45001:2018</b>
            <small>Sistemas de Gestión de SST</small>
            <p>Métricas cuantificables de reducción de incidentes y evidencia auditable para certificación.</p>
          </div>
          <div className="standard-item">
            <b>ANSI/ISEA 107</b>
            <small>Prendas de Alta Visibilidad</small>
            <p>Control de chalecos reflectivos clase 2 y 3 en zonas de tránsito de vehículos industriales.</p>
          </div>
          <div className="standard-item">
            <b>OSHA 1910.212</b>
            <small>Protección de Maquinaria</small>
            <p>Delimitación virtual de puntos de operación y áreas de peligro de prensas y brazos robóticos.</p>
          </div>
        </div>
      </section>

      {/* Llamado a la Acción (CTA) Final */}
      <section className="landing-cta-banner">
        <div className="cta-glow" />
        <h2>¿Listo para elevar la seguridad de tu planta a cero accidentes?</h2>
        <p>
          Accede al portal corporativo de VISION AI y comienza a inspeccionar en tiempo real.
        </p>
        <div className="cta-buttons">
          <button className="cta-btn-main" onClick={() => navigate('/login')}>
            <span>Ingresar a la Plataforma</span>
            <ArrowRight size={18} />
          </button>
        </div>
        <small className="cta-note">Acceso seguro para supervisores HSE, técnicos de seguridad y directores de operaciones.</small>
      </section>

      {/* Footer Corporativo */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-left">
            <div className="landing-brand">
              <div className="brand-mark small">
                <ScanEye size={18} />
              </div>
              <strong>VISION<span>AI</span></strong>
            </div>
            <p>Enterprise HSE Suite · Plataforma de Visión Artificial Industrial</p>
          </div>

          <div className="footer-right">
            <span>© 2026 VISION AI Inc. Todos los derechos reservados.</span>
            <div className="footer-status-pill">
              <span className="live-dot" />
              <span>Sistemas Edge & Gemini 100% Operativos</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
