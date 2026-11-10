import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Eye,
  EyeOff,
  HardHat,
  Layers3,
  ScanEye,

  Sparkles
} from 'lucide-react'
import { useAuth } from '../services/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('demo@visionai.com')
  const [password, setPassword] = useState('visionai2026')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.includes('@') || password.length < 4) {
      setError('Ingresa un correo válido y una contraseña de al menos 4 caracteres.')
      return
    }
    setError('')
    const ok = login(email, password, 'Supervisor')
    if (!ok) {
      setError('Credenciales incorrectas. Verifica tus datos de acceso.')
      return
    }
    navigate('/')
  }

  return (
    <div className="login-page">
      <section className="login-visual">
        <div className="visual-grid" />
        <div className="visual-glow glow-one" />
        <div className="visual-glow glow-two" />

        <div className="login-brand">
          <div className="brand-mark large">
            <ScanEye size={25} />
          </div>
          <div>
            <strong>
              VISION<span>AI</span>
            </strong>
            <small>ENTERPRISE HSE SUITE</small>
          </div>
        </div>

        <div className="visual-copy">
          <div className="eyebrow">
            <Sparkles size={14} />
            SEGURIDAD INDUSTRIAL & INTELIGENCIA VISUAL
          </div>

          <h1>
            Prevención de accidentes
            <br />
            mediante <em>Visión Artificial.</em>
          </h1>

          <p>
            Plataforma corporativa para inspección de EPP en tiempo real, delimitación de perímetros en maquinaria pesada y
            auditorías automatizadas bajo normas OSHA e ISO 45001.
          </p>

          <div className="feature-stack">
            <div>
              <span className="feature-icon">
                <HardHat size={18} />
              </span>
              <span>
                <b>Inspección Automática de EPP</b>
                <small>Detección de cascos, chalecos, guantes y calzado con IA Edge</small>
              </span>
            </div>

            <div>
              <span className="feature-icon">
                <Layers3 size={18} />
              </span>
              <span>
                <b>Segmentación Espacial Milimétrica</b>
                <small>Zonas de exclusión de robots, sendas peatonales y derrames</small>
              </span>
            </div>

            <div>
              <span className="feature-icon">
                <Sparkles size={18} />
              </span>
              <span>
                <b>Auditoría Multimodal Gemini Vision</b>
                <small>Peritaje cognitivo OSHA e informe ejecutivo para gerencia</small>
              </span>
            </div>
          </div>
        </div>

        <div className="visual-foot">
          <span>SUITE EMPRESARIAL HSE</span>
          <span>© 2026 VISION AI</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-form-wrap">
          <div className="mobile-brand">
            <div className="brand-mark">
              <ScanEye size={20} />
            </div>
            <strong>
              VISION<span>AI</span>
            </strong>
          </div>

          <div className="login-heading">
            <div className="login-tag">ACCESO CORPORATIVO</div>
            <h2>Portal de Seguridad HSE</h2>
            <p>Ingresa tus credenciales autorizadas de supervisor o auditor de planta.</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <label>Correo electrónico corporativo</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="supervisor@empresa.com"
              required
            />

            <label>Contraseña de acceso</label>
            <div className="password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Mostrar u ocultar contraseña"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            {error && <p className="form-error">{error}</p>}

            <button className="submit-button" type="submit">
              Acceder al Panel de Control HSE
              <ArrowRight size={17} />
            </button>
          </form>

         

          <div className="login-legal">
            Acceso seguro encriptado bajo estándares de auditoría ISO 45001.
          </div>
        </div>
      </section>
    </div>
  )
}
