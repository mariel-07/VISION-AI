import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  HelpCircle,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Trash2,
  Volume2
} from 'lucide-react'
import {
  clearAnalysisData,
  getClassConfig,
  getLocalStorageUsage,
  getSettings,
  readAlerts,
  readAnalyses,
  setClassConfig,
  setSettings,
  type ScenarioClassConfig,
  type VisionSettings
} from '../../../shared/services/store'
import {
  AVAILABLE_GEMINI_MODELS,
  getGeminiApiKey,
  getGeminiModel,
  resetGeminiConfigToDefault,
  setGeminiApiKey,
  setGeminiModel,
  testGeminiConnection
} from '../../../shared/services/geminiVision'
import {
  getTelegramConfig,
  resetTelegramConfigToDefault,
  setTelegramConfig,
  testTelegramNotification,
  type TelegramConfig
} from '../../../shared/services/telegramService'

const scenarios = [
  'Seguridad industrial',
  'Almacén inteligente',
  'Control de calidad',
  'Retail',
  'Transporte y logística',
  'Agricultura'
]

export default function SettingsPage() {
  const [settings, setSettingsState] = useState<VisionSettings>(getSettings)
  const [classConfig, setClassConfigState] = useState<ScenarioClassConfig>(getClassConfig)
  const [classesScenario, setClassesScenario] = useState<string>(scenarios[0])
  const [geminiKey, setGeminiKeyState] = useState<string>(getGeminiApiKey)
  const [geminiModel, setGeminiModelState] = useState<string>(getGeminiModel)
  const [telegramConfig, setTelegramConfigState] = useState<TelegramConfig>(getTelegramConfig)

  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [showTelegramToken, setShowTelegramToken] = useState(false)
  const [showTelegramHelp, setShowTelegramHelp] = useState(false)

  const [geminiTesting, setGeminiTesting] = useState(false)
  const [geminiStatus, setGeminiStatus] = useState<{ success?: boolean; message?: string } | null>(null)

  const [telegramTesting, setTelegramTesting] = useState(false)
  const [telegramStatus, setTelegramStatus] = useState<{ success?: boolean; message?: string } | null>(null)

  const [credentialsNotice, setCredentialsNotice] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [revision, setRevision] = useState(0)

  const usageKb = useMemo(() => (getLocalStorageUsage() / 1024).toFixed(1), [revision])
  const analyses = readAnalyses()
  const alerts = readAlerts()

  // Guardado reactivo inmediato de credenciales para que jamás se pierdan entre pestañas/módulos
  function updateGeminiKey(val: string) {
    setGeminiKeyState(val)
    setGeminiApiKey(val)
  }

  function updateGeminiModel(val: string) {
    setGeminiModelState(val)
    setGeminiModel(val)
  }

  function updateTelegramConfig(partial: Partial<TelegramConfig>) {
    const updated = { ...telegramConfig, ...partial }
    setTelegramConfigState(updated)
    setTelegramConfig(updated)
  }

  function handleSaveAllCredentials() {
    setGeminiApiKey(geminiKey)
    setGeminiModel(geminiModel)
    setTelegramConfig(telegramConfig)
    setCredentialsNotice('✓ Credenciales guardadas y fijadas permanentemente en este dispositivo.')
    window.setTimeout(() => setCredentialsNotice(null), 3500)
  }

  function handleResetCredentialsToDefaults() {
    const defaultGemini = resetGeminiConfigToDefault()
    const defaultTelegram = resetTelegramConfigToDefault()
    setGeminiKeyState(defaultGemini.key)
    setGeminiModelState(defaultGemini.model)
    setTelegramConfigState(defaultTelegram)
    setCredentialsNotice('✓ Credenciales restablecidas a los valores de Vercel/Producción.')
    window.setTimeout(() => setCredentialsNotice(null), 3500)
  }

  function save() {
    setSettings(settings)
    setClassConfig(classConfig)
    setGeminiApiKey(geminiKey)
    setGeminiModel(geminiModel)
    setTelegramConfig(telegramConfig)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2500)
  }

  async function handleTestGemini() {
    setGeminiTesting(true)
    setGeminiStatus(null)
    // Auto-persistir inmediatamente antes de comprobar
    setGeminiApiKey(geminiKey)
    setGeminiModel(geminiModel)
    try {
      const res = await testGeminiConnection(geminiKey)
      setGeminiStatus({ success: res.success, message: res.message })
      if (res.success) {
        setGeminiApiKey(geminiKey)
        if (res.model) {
          setGeminiModelState(res.model)
          setGeminiModel(res.model)
        }
      }
    } catch (err) {
      setGeminiStatus({
        success: false,
        message: err instanceof Error ? err.message : 'Error inesperado al probar Gemini.'
      })
    } finally {
      setGeminiTesting(false)
    }
  }

  async function handleTestTelegram() {
    setTelegramTesting(true)
    setTelegramStatus(null)
    // Auto-persistir inmediatamente antes de enviar la prueba
    setTelegramConfig(telegramConfig)
    try {
      const res = await testTelegramNotification(telegramConfig.botToken, telegramConfig.chatId)
      setTelegramStatus({ success: res.success, message: res.message })
      if (res.success) {
        setTelegramConfig(telegramConfig)
      }
    } catch (err) {
      setTelegramStatus({
        success: false,
        message: err instanceof Error ? err.message : 'Error inesperado al probar Telegram.'
      })
    } finally {
      setTelegramTesting(false)
    }
  }

  function clearData() {
    const confirmed = window.confirm(
      '¿Deseas reiniciar los registros de análisis y alertas de la empresa en este navegador? Se restablecerán a los valores iniciales.'
    )
    if (!confirmed) return
    clearAnalysisData()
    setRevision(value => value + 1)
  }

  async function testAlarm() {
    try {
      const AudioContextClass = window.AudioContext
      const context = new AudioContextClass()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sawtooth'
      oscillator.frequency.setValueAtTime(880, context.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(440, context.currentTime + 0.35)
      gain.gain.value = 0.08
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      window.setTimeout(() => {
        oscillator.stop()
        void context.close()
      }, 350)
    } catch {
      window.alert('El navegador no permitió reproducir el sonido. Comprueba los permisos de audio.')
    }
  }

  return (
    <div className="module-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ADMINISTRACIÓN DEL SISTEMA</span>
          <h1>Configuración de la Suite de Visión AI</h1>
          <p>
            Parámetros de inferencia, API de Google Gemini Vision y Notificaciones móviles a Telegram para alertas de prioridad Alta y Crítica.
          </p>
        </div>
      </div>

      {/* PANEL 1: INFERENCIA Y CONFIGURACIÓN GENERAL */}
      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h3>Parámetros de Inferencia y Visión Edge</h3>
            <p>Ajustes de sensibilidad y escenario por defecto</p>
          </div>
          <SlidersHorizontal size={18} />
        </div>

        <div className="settings-grid">
          <label>
            Umbral de Confianza de Detección <strong>{Math.round(settings.confidence * 100)}%</strong>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={settings.confidence}
              onChange={e => setSettingsState({ ...settings, confidence: Number(e.target.value) })}
            />
            <small>Detecciones por debajo de este umbral serán descartadas para evitar falsos positivos.</small>
          </label>

          <label>
            Escenario Operativo Predeterminado
            <select
              value={settings.scenario}
              onChange={e => setSettingsState({ ...settings, scenario: e.target.value })}
            >
              {scenarios.map(item => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <small>Escenario aplicado al iniciar una nueva sesión de análisis.</small>
          </label>
        </div>

        {/* PANEL MAESTRO DE CREDENCIALES DEL SISTEMA (VERCEL / PRODUCCIÓN) */}
        <div
          className="rule-settings"
          style={{
            border: '2px solid #3b82f6',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
            padding: '16px 18px',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={20} color="#2563eb" />
              <div>
                <h3 style={{ margin: 0, color: '#1e3a8a', fontSize: '14px', fontWeight: 700 }}>
                  Credenciales Maestras del Sistema (Persistencia Permanente en Vercel)
                </h3>
                <span style={{ fontSize: '11px', color: '#475569' }}>
                  Determinadas para que cualquier persona que entre a la plataforma cuente inmediatamente con IA y Telegram activo.
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#dcfce7',
                  color: '#166534',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: '12px',
                  border: '1px solid #86efac'
                }}
              >
                <CheckCircle2 size={13} /> Integradas y Fijas
              </span>
            </div>
          </div>

          <p style={{ margin: '0 0 12px', fontSize: '11px', color: '#334155', lineHeight: 1.5 }}>
            Los 4 valores clave (<b>Gemini API Key</b>, <b>Modelo de IA</b>, <b>Bot Token Telegram</b> y <b>Chat ID</b>) están configurados con valores predeterminados de fábrica y guardado automático en este navegador. Puedes modificarlos en los paneles inferiores o restablecerlos cuando lo desees.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="primary-button small"
              onClick={handleSaveAllCredentials}
              style={{ fontSize: '11px', padding: '7px 16px', background: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Save size={13} /> Guardar y Fijar Credenciales Permanentemente
            </button>
            <button
              type="button"
              className="secondary-button small"
              onClick={handleResetCredentialsToDefaults}
              style={{ fontSize: '11px', padding: '7px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              title="Restablece las 4 credenciales fijas de Vercel (Gemini y Telegram)"
            >
              <RefreshCw size={13} /> Restablecer a Valores Predeterminados
            </button>
          </div>

          {credentialsNotice && (
            <div
              style={{
                marginTop: '10px',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                background: '#f0fdf4',
                border: '1px solid #86efac',
                color: '#166534',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <CheckCircle2 size={15} />
              <span>{credentialsNotice}</span>
            </div>
          )}
        </div>

        {/* Clave de Google Gemini API */}
        <div className="rule-settings" style={{ borderLeft: '4px solid #2563eb', paddingLeft: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="#2563eb" />
              <h3 style={{ margin: 0 }}>API de IA Multimodal (Google Gemini Vision)</h3>
            </div>
            {geminiKey ? (
              <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={13} /> Clave configurada
              </span>
            ) : (
              <span style={{ fontSize: '11px', color: '#eab308', fontWeight: 600 }}>
                Sin clave (Modo Offline)
              </span>
            )}
          </div>
          <p style={{ margin: '4px 0 10px', fontSize: '11px', color: '#64748b' }}>
            Permite la auditoría forense profunda de normas OSHA e ISO 45001 ("algo fuera de lo común").
            Obtén tu API Key gratis en <b>Google AI Studio</b> (aistudio.google.com).
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '10px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <input
                type={showGeminiKey ? 'text' : 'password'}
                placeholder="Introduce tu clave de API de Gemini (ej: AIzaSy...)"
                value={geminiKey}
                onChange={e => updateGeminiKey(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 36px 10px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '11px',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey(v => !v)}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '4px'
                }}
                title={showGeminiKey ? 'Ocultar' : 'Mostrar'}
              >
                {showGeminiKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            <div>
              <select
                value={geminiModel}
                onChange={e => updateGeminiModel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '11px',
                  boxSizing: 'border-box'
                }}
              >
                {AVAILABLE_GEMINI_MODELS.map(m => (
                  <option key={m} value={m}>
                    {m} {m === 'gemini-3.8-flash' ? '(Predeterminado)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              className="secondary-button small"
              onClick={handleTestGemini}
              disabled={geminiTesting || !geminiKey.trim()}
              style={{ fontSize: '11px', padding: '6px 12px' }}
            >
              {geminiTesting ? <RefreshCw className="spin" size={13} /> : <Sparkles size={13} />}
              {geminiTesting ? 'Comprobando clave...' : 'Probar Conexión con Gemini'}
            </button>
            <small style={{ color: '#64748b', fontSize: '10px' }}>
              Verifica y guarda permanentemente el modelo y la cuota de tu API Key en vivo.
            </small>
          </div>

          {geminiStatus && (
            <div
              style={{
                marginTop: '10px',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: geminiStatus.success ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${geminiStatus.success ? '#86efac' : '#fecaca'}`,
                color: geminiStatus.success ? '#166534' : '#991b1b'
              }}
            >
              {geminiStatus.success ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{geminiStatus.message}</span>
            </div>
          )}
        </div>

        {/* PANEL DE NOTIFICACIONES A TELEGRAM (NUEVO) */}
        <div className="rule-settings" style={{ borderLeft: '4px solid #0284c7', paddingLeft: '14px', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Smartphone size={18} color="#0284c7" />
              <h3 style={{ margin: 0 }}>Notificaciones de Alerta a tu Celular (Telegram Bot API)</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowTelegramHelp(v => !v)}
              style={{
                background: 'none',
                border: 'none',
                color: '#0284c7',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600
              }}
            >
              <HelpCircle size={14} /> {showTelegramHelp ? 'Ocultar guía móvil' : '¿Cómo configurar en el celular?'}
            </button>
          </div>

          <p style={{ margin: '4px 0 10px', fontSize: '11px', color: '#64748b' }}>
            Recibe en tiempo real en tu teléfono las alertas de prioridad <b>Alta</b> y <b>Crítica</b> (invasión de perímetro, falta de casco/chaleco, riesgos de choque peatón-máquina o anomalías forenses detectadas por Gemini).
          </p>

          {/* Guía desplegable de configuración en el celular */}
          {showTelegramHelp && (
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #bae6fd',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '14px',
                fontSize: '11px',
                color: '#0f172a'
              }}
            >
              <h4 style={{ margin: '0 0 6px', color: '#0369a1', fontSize: '12px' }}>
                📱 Requerimientos y Pasos en tu Celular (Solo toma 2 minutos):
              </h4>
              <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>
                  <b>Instalar Telegram:</b> Descarga gratis Telegram desde Google Play Store (Android) o App Store (iPhone).
                </li>
                <li>
                  <b>Crear tu Bot con @BotFather:</b> En el buscador de Telegram en tu celular, busca el bot oficial <code>@BotFather</code>. Presiona <i>Iniciar</i>, envía <code>/newbot</code>, dale un nombre y un usuario (ej: <code>mi_alerta_bot</code>). BotFather te entregará tu <b>Bot Token</b> (ej: <code>7123456789:AAH...</code>).
                </li>
                <li>
                  <b>Obtener tu Chat ID con @userinfobot:</b> En el buscador de Telegram, busca <code>@userinfobot</code>, presiona <i>Iniciar</i> y copia el número de tu <code>Id</code> (ej: <code>123456789</code>).
                </li>
                <li>
                  <b>Paso indispensable:</b> Abre en Telegram el bot que acabas de crear y presiona <b>Iniciar (/start)</b>. Esto autoriza a tu bot a enviarte mensajes.
                </li>
                <li>
                  Pega el Token y tu Chat ID en los campos de abajo y haz clic en <b>"Probar Envío al Celular"</b>.
                </li>
              </ol>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#334155' }}>
              <span><b>Bot Token de Telegram</b> (de @BotFather):</span>
              <div style={{ position: 'relative' }}>
                <input
                  type={showTelegramToken ? 'text' : 'password'}
                  placeholder="ej: 7123456789:AAHqj_..."
                  value={telegramConfig.botToken}
                  onChange={e => updateTelegramConfig({ botToken: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 36px 8px 10px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '11px',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowTelegramToken(v => !v)}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '4px'
                  }}
                  title={showTelegramToken ? 'Ocultar' : 'Mostrar'}
                >
                  {showTelegramToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#334155' }}>
              <span><b>Tu Chat ID de Telegram</b> (de @userinfobot):</span>
              <input
                type="text"
                placeholder="ej: 123456789"
                value={telegramConfig.chatId}
                onChange={e => updateTelegramConfig({ chatId: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '11px',
                  boxSizing: 'border-box'
                }}
              />
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', cursor: 'pointer', color: '#1e293b' }}>
              <input
                type="checkbox"
                checked={telegramConfig.enabled}
                onChange={e => updateTelegramConfig({ enabled: e.target.checked })}
              />
              <b>Habilitar despacho automático de alertas a mi celular</b>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#475569' }}>
              <span>Intervalo anti-inundación (Cooldown):</span>
              <select
                value={telegramConfig.cooldownSeconds}
                onChange={e => updateTelegramConfig({ cooldownSeconds: Number(e.target.value) })}
                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '11px' }}
              >
                <option value={15}>15 segundos</option>
                <option value={30}>30 segundos</option>
                <option value={45}>45 segundos (Recomendado)</option>
                <option value={60}>60 segundos</option>
                <option value={120}>2 minutos</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
            <button
              type="button"
              className="primary-button small"
              onClick={handleTestTelegram}
              disabled={telegramTesting || !telegramConfig.botToken.trim() || !telegramConfig.chatId.trim()}
              style={{ fontSize: '11px', padding: '6px 14px', background: '#0284c7' }}
            >
              {telegramTesting ? <RefreshCw className="spin" size={13} /> : <Send size={13} />}
              {telegramTesting ? 'Enviando a tu celular...' : 'Probar Envío al Celular (Telegram)'}
            </button>
            <small style={{ color: '#64748b', fontSize: '10px' }}>
              Enviará un mensaje instantáneo a tu celular y fijará permanentemente las credenciales.
            </small>
          </div>

          {telegramStatus && (
            <div
              style={{
                marginTop: '10px',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: telegramStatus.success ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${telegramStatus.success ? '#86efac' : '#fecaca'}`,
                color: telegramStatus.success ? '#166534' : '#991b1b'
              }}
            >
              {telegramStatus.success ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{telegramStatus.message}</span>
            </div>
          )}
        </div>

        {/* Reglas de Seguridad HSE */}
        <div className="rule-settings">
          <h3>Reglas Automáticas de Seguridad HSE</h3>
          <p>Activa o desactiva las condiciones que disparan alertas sonoras y notificaciones:</p>

          <label>
            <input
              type="checkbox"
              checked={settings.rules.personSafety}
              onChange={e =>
                setSettingsState({
                  ...settings,
                  rules: { ...settings.rules, personSafety: e.target.checked }
                })
              }
            />
            Inspección obligatoria de Casco y Chaleco reflectante ante detección de operarios
          </label>

          <label>
            <input
              type="checkbox"
              checked={settings.rules.forklift}
              onChange={e =>
                setSettingsState({
                  ...settings,
                  rules: { ...settings.rules, forklift: e.target.checked }
                })
              }
            />
            Alerta por interacción Peatón-Montacargas en radio menor a 3.5 metros
          </label>

          <label>
            <input
              type="checkbox"
              checked={settings.rules.zoneIntrusion}
              onChange={e =>
                setSettingsState({
                  ...settings,
                  rules: { ...settings.rules, zoneIntrusion: e.target.checked }
                })
              }
            />
            Disparo de alarma por incursión en zona de exclusión de maquinaria pesada
          </label>
        </div>

        {/* Clases Permitidas por Escenario */}
        <div className="rule-settings">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3>Clases y Elementos Permitidos por Escenario</h3>
              <p style={{ margin: '2px 0 8px' }}>
                Filtro estricto: solo las clases marcadas serán reconocidas en vivo o imágenes para cada escenario.
              </p>
            </div>
            <select
              value={classesScenario}
              onChange={e => setClassesScenario(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            >
              {scenarios.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '8px', marginTop: '10px' }}>
            {(classConfig[classesScenario] || []).map(cls => (
              <label
                key={cls.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: cls.enabled ? '#f0fdf4' : '#f8fafc',
                  border: `1px solid ${cls.enabled ? '#86efac' : '#e2e8f0'}`,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                <input
                  type="checkbox"
                  checked={cls.enabled}
                  onChange={e => {
                    const checked = e.target.checked
                    setClassConfigState(prev => {
                      const currentList = prev[classesScenario] || []
                      const updated = currentList.map(item => item.name === cls.name ? { ...item, enabled: checked } : item)
                      return { ...prev, [classesScenario]: updated }
                    })
                  }}
                />
                <span style={{ fontWeight: cls.enabled ? 600 : 400, color: cls.enabled ? '#166534' : '#64748b' }}>
                  {cls.name}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="settings-footer">
          <span>{saved ? '✓ Configuración guardada exitosamente.' : 'Recuerda guardar los cambios.'}</span>
          <button className="primary-button small" onClick={save}>
            <Save size={15} /> Guardar Configuración
          </button>
        </div>
      </section>

      {/* PANEL 2: PRUEBA DE ALARMA */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Prueba de Alarma Sonora de Planta</h3>
            <p>Verifica que el sintetizador de audio del navegador funcione adecuadamente</p>
          </div>
          <Volume2 size={18} />
        </div>
        <button className="secondary-button" onClick={testAlarm}>
          <BellRing size={15} /> Probar Sirena Sonora
        </button>
      </section>

      {/* PANEL 3: ALMACENAMIENTO AUDITABLE */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Repositorio Local de Auditorías</h3>
            <p>Los datos se encuentran protegidos y persistidos en este equipo</p>
          </div>
          <Database size={18} />
        </div>
        <div className="detail-summary">
          <span>
            <b>{analyses.length}</b> inspecciones guardadas
          </span>
          <span>
            <b>{alerts.length}</b> alertas de incidentes
          </span>
          <span>
            <b>{usageKb} KB</b> espacio utilizado
          </span>
        </div>
        <div className="settings-footer" style={{ marginTop: '14px' }}>
          <span>Restablecer datos restablece las muestras empresariales de demostración.</span>
          <button className="secondary-button" onClick={clearData}>
            <Trash2 size={15} /> Restablecer Repositorio
          </button>
        </div>
      </section>
    </div>
  )
}
