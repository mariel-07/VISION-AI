export type CameraDevice = {
  deviceId: string
  label: string
  groupId?: string
  isBluetooth?: boolean
  isUsb?: boolean
}

export type IpStreamPreset = {
  id: string
  name: string
  url: string
  protocol: 'HTTP-MJPEG' | 'RTSP-STREAM' | 'HLS'
  description: string
}

export const IP_STREAM_PRESETS: IpStreamPreset[] = [
  {
    id: 'cam-01',
    name: 'Cámara IP #01 · Bahía Logística y Montacargas (Sector B)',
    url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
    protocol: 'HTTP-MJPEG',
    description: 'Vigilancia en zona de alta densidad con circulación de maquinaria pesada.'
  },
  {
    id: 'cam-02',
    name: 'Cámara IP #02 · Nave Industrial de Mecanizado y Soldadura',
    url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=80',
    protocol: 'HTTP-MJPEG',
    description: 'Control de EPP obligatorio en caliente: caretas, guantes y chalecos.'
  },
  {
    id: 'cam-03',
    name: 'Cámara IP #03 · Pasarela Peatonal y Zonas Confinadas',
    url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80',
    protocol: 'RTSP-STREAM',
    description: 'Monitoreo de delimitación de sendas peatonales y barandas perimetrales.'
  }
]

/**
 * Obtiene la lista de cámaras físicas conectadas:
 * Integrada, USB (cable), Bluetooth, o capturadoras de video.
 */
export async function getAvailableVideoDevices(): Promise<CameraDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return []
  }

  try {
    // Si no se han pedido permisos antes, los nombres pueden venir vacíos; solicitamos un stream efímero
    let tempStream: MediaStream | null = null
    try {
      tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    } catch {
      // Ignorar si el usuario rechaza inicialmente o no hay cámara conectada
    }

    const devices = await navigator.mediaDevices.enumerateDevices()
    if (tempStream) {
      tempStream.getTracks().forEach(t => t.stop())
    }

    const videoInputs = devices.filter(d => d.kind === 'videoinput')

    return videoInputs.map((device, index) => {
      const lower = device.label.toLowerCase()
      const isBt = lower.includes('bluetooth') || lower.includes('bt') || lower.includes('wireless')
      const isUsb = lower.includes('usb') || lower.includes('camera') || lower.includes('video') || lower.includes('capture')

      return {
        deviceId: device.deviceId,
        label: device.label || `Cámara ${index + 1} (${isBt ? 'Bluetooth' : isUsb ? 'USB / Cable' : 'Dispositivo de video'})`,
        groupId: device.groupId,
        isBluetooth: isBt,
        isUsb: isUsb
      }
    })
  } catch (error) {
    console.warn('No se pudieron enumerar dispositivos de video', error)
    return []
  }
}

/**
 * Inicia la captura desde un dispositivo físico seleccionado (USB, Bluetooth, etc.)
 */
export async function startHardwareCameraStream(deviceId?: string): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('La API de captura de medios no está disponible en este navegador o contexto.')
  }

  const constraints: MediaStreamConstraints = {
    audio: false,
    video: deviceId
      ? {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      : {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
  }

  return await navigator.mediaDevices.getUserMedia(constraints)
}

