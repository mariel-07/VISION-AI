# Alcance de entrega · VISION AI v2

Esta entrega implementa la aplicación modular descrita en el documento técnico y amplía el motor previsto originalmente para incorporar inferencia real con YOLO.

## Módulos entregados
- Resumen: KPI calculados desde el historial local.
- Análisis visual: carga de imagen, cámara en vivo vía WebSocket, visor con cajas, controles de confianza y simulador sintético.
- Detecciones: búsqueda, confianza, coordenadas, tamaño y origen.
- Segmentación: llamada al modelo YOLO-seg y visualización de polígonos de máscara.
- Patrones: eventos derivados de clases y reglas.
- Alertas: estados Nueva/Revisada/Cerrada.
- Historial: filtros y exportación CSV.
- Escenarios: seis contextos empresariales.
- Configuración: umbral, reglas activables y parámetros de estimación volumétrica.

- Modo DEMO disponible en Vercel sin backend: análisis sintético de imagen y escenarios, con marca explícita de simulación.
- Configuración de Vercel para servir SPA y variables opcionales `VITE_API_URL` / `VITE_WS_URL` para conectar un backend externo.
- Configuración de alarma sonora de prueba iniciada por el operador.
- Escenarios de transporte y agricultura con reglas generales COCO para vehículos y frutas.

## Diferencia de motores
- `YOLO REAL`: resultados generados por Ultralytics YOLO en el backend Python.
- `SIMULADOR`: escena SVG o cajas ilustrativas y resultados sintéticos fijos para validar el flujo visual; nunca se presentan como inferencia de la imagen.

Los dos orígenes se identifican por separado en la interfaz y el historial.

## Condiciones y límites
- Los pesos incluidos por defecto son YOLOv8n y YOLOv8n-seg preentrenados sobre COCO. Las clases empresariales no incluidas requieren dataset etiquetado y entrenamiento específico.
- La cámara procesa fotogramas mientras la página está activa; no hay grabación ni operación 24/7.
- El almacenamiento es local al navegador. No hay autenticación real ni base de datos compartida.
- El volumen es una aproximación a partir de caja 2D, escala px/cm y profundidad ingresada; no es una medición tridimensional real.
- Las alertas requieren validación humana. La ausencia de detección de EPP no confirma que el trabajador carezca de ese elemento.
- Vercel aloja el frontend estático; FastAPI/YOLO y el WebSocket de cámara necesitan un servicio externo. Los planes gratuitos pueden suspenderse y no garantizan vigilancia 24/7.

## Verificación pendiente en el equipo de ejecución
La carpeta se entrega con fuentes y dependencias declaradas. La instalación de paquetes npm y de Ultralytics debe realizarse en el equipo de ejecución; en el entorno de generación no se pudo completar la descarga de dependencias de npm ni descargar los pesos YOLO, por lo que no se afirma que el build o la inferencia hayan sido ejecutados aquí.
