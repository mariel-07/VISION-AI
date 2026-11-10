# VISION AI · Enterprise HSE Safety & Visual Intelligence Suite

**Versión 2.5 Enterprise · React + TypeScript + Vite + YOLOv8 ONNX (Edge WebAssembly/WebGPU) + Google Gemini 1.5 Vision Multimodal**

---

## 🏢 Visión General del Proyecto

**VISION AI** es una plataforma corporativa de visión artificial aplicada a la **Seguridad Industrial y Salud en el Trabajo (HSE - Health, Safety & Environment)**, diseñada bajo lineamientos internacionales de las normas **OSHA 29 CFR 1910 / 1926** e **ISO 45001:2018**.

El sistema permite automatizar la supervisión de Elementos de Protección Personal (EPP), delimitar perímetros de exclusión en celdas de maquinaria pesada, prevenir accidentes hombre-máquina y generar auditorías periciales inmediatas asistidas por Inteligencia Artificial Multimodal.

---

## 🎯 Arquitectura 100% Desplegable en Vercel (Sin Dependencia de Backend Externo)

A diferencia de soluciones que dependen de servidores pesados en Python (FastAPI/PyTorch) o servicios en la nube propensos a apagarse por inactividad (como Render), esta versión de **VISION AI** funciona de manera **descentralizada y autónoma en Vercel**:

1. **Motor Edge en el Navegador (YOLOv8 ONNX):**
   * Corre directamente en el dispositivo cliente mediante **ONNX Runtime Web (WASM / WebGPU)**.
   * Utiliza el modelo entrenado con pesos industriales de EPP (`public/models/epp.onnx`) y detección general (`public/models/yolov8n.onnx`).
   * No requiere servidores, no consume cuotas de cómputo en backend y ofrece latencias inferiores a 40 ms.

2. **Auditoría Forense con IA Generativa Multimodal (Google Gemini 1.5 Vision):**
   * Función innovadora *"fuera de lo común"* para peritaje normativo profundo.
   * Diagnostica riesgos ergonómicos, interacción crítica con montacargas, probabilidad de accidente y genera un **Informe Oficial de Auditoría HSE** descargable.
   * Incluye un **Motor Cognitivo Industrial Offline de Respaldo** que garantiza el 100% de disponibilidad incluso sin conexión o sin clave de API.

---

## 🧩 Cohesión y Sentido Empresarial de los Módulos

Todos los módulos están conectados a un almacén de datos empresarial común (`store.ts`), ofreciendo un flujo de trabajo integral:

| Módulo | Finalidad Empresarial en la Industria |
| :--- | :--- |
| **Resumen General (Dashboard)** | Cuadro de mando ejecutivo: Índice de Cumplimiento EPP global (%), Días sin incidentes visuales, censo de operarios inspeccionados y estado de seguridad por celdas de planta. |
| **Análisis Visual (Cámaras)** | Estación de monitoreo en tiempo real con bounding boxes dinámicos, checklist de EPP por trabajador (casco, chaleco, etc.), sirena de alarma sonora y captura de evidencias. |
| **Segmentación y Perímetros** | **¿Para qué le sirve a la empresa?** Evita las falsas alarmas de las cajas rectangulares delimitando con exactitud milimétrica polígonos de exclusión en brazos robóticos, sendas peatonales seguras y derrames de líquidos químicos (riesgo de resbalones y caídas). |
| **Reconocimiento de Patrones** | **¿Para qué le sirve a la empresa?** Seguridad Basada en Conducta (*Behavior-Based Safety - BBS*). Genera mapas de calor de riesgo por sector, detecta horas pico críticas de incumplimiento (turno tarde 15:30 hrs por calor/fatiga) y activa planes de acción preventiva (CAPA) bajo ISO 45001. |
| **Inventario de Detecciones** | Catálogo técnico de cada elemento localizado, con coordenadas normalizadas (X, Y, W, H), clase, nivel de confianza y exportación a formato CSV. |
| **Centro de Alertas (Triage)** | Gestión de infracciones críticas con asignación de supervisor responsable, protocolos correctivos y estados de resolución bajo SLA (*Nueva*, *Revisada*, *Cerrada*). |
| **Historial y Certificados** | Registro inmutable de inspecciones con generación e impresión de **Certificados Oficiales de Inspección HSE** con sello y firma digital para auditorías laborales. |
| **Escenarios de Planta** | Calibración de reglas según el sector: Manufactura Pesada, Almacén Logístico, Celda Robótica, Planta Química y Obras Civiles. |
| **Configuración** | Control de sensibilidad, activación de reglas de paro, prueba de sirena, enlace de Gemini API y canal de alertas móviles a Telegram. |

---

## 📲 Notificaciones de Alerta en Tiempo Real a tu Celular (Telegram)

El sistema despacha automáticamente avisos inmediatos con formato enriquecido a tu celular cuando se registran infracciones de severidad **Alta** o **Crítica** (ej: invasión de perímetro peligroso, operarios sin casco/chaleco cerca de maquinaria o anomalías críticas detectadas por Gemini).

### Requisitos y Configuración en tu Celular (Paso a Paso):
1. **Instala Telegram:** Disponible gratis en Google Play Store (Android) o App Store (iPhone).
2. **Crea tu Bot con BotFather:**
   * En el buscador de Telegram en tu celular, busca el bot oficial `@BotFather`.
   * Presiona **Iniciar** o envía `/start`.
   * Escribe `/newbot`, asigna un nombre y un usuario que termine en `bot` (ej: `vision_alerta_bot`).
   * BotFather te entregará tu **Bot Token** (ej: `7823456789:AAHqj...`).
3. **Obtén tu Chat ID Personal:**
   * En el buscador de Telegram busca `@userinfobot` y presiona **Iniciar**.
   * Copia tu número de `Id` (ej: `123456789`).
4. **Paso indispensable:**
   * Abre en Telegram el bot que acabas de crear y presiona **Iniciar (/start)** para autorizarlo a enviarte mensajes.
5. **Vincúlalo:**
   * Ingresa a **Configuración** en la app web de VISION AI, pega tu Token y Chat ID y pulsa **"Probar Envío al Celular"**.

---

## 🤖 Conexión con Google Gemini API (Auditoría Forense)

La plataforma utiliza los modelos multimodales oficiales de **Google Gemini** (`gemini-1.5-flash`, `gemini-2.0-flash`, `gemini-1.5-pro`):
1. Obtén tu clave gratuita en [Google AI Studio (aistudio.google.com/apikey)](https://aistudio.google.com/apikey).
2. Pégala en **Configuración → API de IA Multimodal** o configúrala en el archivo `.env` (`VITE_GEMINI_API_KEY`).
3. Haz clic en **"Probar Conexión con Gemini"** para verificar en vivo que tu clave esté activa y lista para usar.

---

## 📹 Conectividad de Cámaras y Fuentes de Video

La plataforma soporta múltiples fuentes de captura industrial:

1. **Cámaras Físicas (USB / Cable / Bluetooth / Integradas):**
   * El sistema enumera todos los dispositivos de video disponibles mediante `navigator.mediaDevices.enumerateDevices()`.
   * Permite conectar webcams industriales de alta resolución por cable USB, boroscopios de inspección, capturadoras HDMI o cámaras inalámbricas Bluetooth.

2. **Cámaras IP y Circuitos Cerrados (RTSP / HTTP MJPEG):**
   * Admite URLs directas de cámaras de seguridad IP o streams industriales.
   * Incluye 3 presintonías simuladas listas para probar:
     * *Cámara IP #01: Bahía Logística y Montacargas (Sector B)*
     * *Cámara IP #02: Nave Industrial de Mecanizado y Soldadura*
     * *Cámara IP #03: Pasarela Peatonal y Zonas Confinadas*

3. **Carga de Archivos de Alta Resolución:**
   * Soporte para fotografías JPG, PNG y WEBP de hasta 15 MB para peritaje forense post-incidente.

---

## 🚀 Despliegue en Vercel

1. Sube este repositorio a tu cuenta de **GitHub**.
2. En [Vercel](https://vercel.com/), haz clic en **Add New → Project** e importa el repositorio.
3. Vercel detectará automáticamente la configuración:
   * **Framework:** Vite
   * **Build Command:** `npm run build`
   * **Output Directory:** `dist`
4. Pulsa **Deploy**.
5. ¡Listo! La suite se compilará y desplegará en segundos, funcionando de forma 100% autónoma en la nube.

---

## 🔑 Credenciales de Acceso al Portal

Para ingresar a la plataforma en modo demostración:

* **Usuario:** `demo@visionai.com`
* **Contraseña:** `visionai2026`
* **Rol Asignado:** Supervisor / Jefe de Seguridad HSE

---

## 📜 Estándares Normativos Integrados

* **OSHA 29 CFR 1910.135:** Protección para la cabeza (Cascos de seguridad industrial ANSI Z89.1).
* **OSHA 29 CFR 1926.201:** Señalización y prendas retrorreflectantes de alta visibilidad (EN ISO 20471).
* **OSHA 29 CFR 1910.178:** Seguridad en carretillas elevadoras motorizadas (Montacargas).
* **ISO 45001:2018 (Cláusula 8.1.2):** Jerarquía de controles y eliminación de peligros en el lugar de trabajo.
