# VISION AI — Arquitectura y despliegue

## Arquitectura de dos piezas

- **Frontend React/Vite en Vercel:** navegación, análisis DEMO, detección general real en el navegador mediante TensorFlow.js + COCO-SSD (cargados desde CDN), cámara en vivo local, paneles, alertas, historial, exportación CSV y configuración.
- **Backend Python/FastAPI fuera de Vercel:** inferencia YOLO, segmentación YOLO-seg, pre/postprocesamiento OpenCV y WebSocket de cámara en vivo.
- **Persistencia actual:** `localStorage` del navegador. No es multiusuario ni sincronizado.

## Despliegue DEMO

1. Publicar el repositorio en GitHub.
2. Importarlo desde Vercel.
3. Usar `npm ci`, `npm run build` y `dist`.
4. No definir `VITE_API_URL` ni `VITE_WS_URL`.
5. Probar el simulador y comprobar que los datos se mantienen al recargar en el mismo navegador.

## Activar YOLO REAL

1. Ejecutar FastAPI en un proveedor que admita Python, PyTorch y WebSocket.
2. Configurar `CORS_ORIGINS` con el origen exacto de Vercel.
3. Configurar `VITE_API_URL=https://...` y `VITE_WS_URL=wss://...` en Vercel.
4. Volver a desplegar el frontend.
5. Probar `/health`, análisis de imagen y después la cámara.
6. Para EPP, entrenar y validar pesos especializados. El modelo COCO general no reconoce de forma nativa casco, chaleco, guantes o botas.

## Límites que no se deben ocultar

- Vercel sirve el frontend; no aloja este servidor FastAPI como proceso permanente ni su WebSocket de vídeo continuo.
- Un backend gratuito puede dormir o limitar inferencia. No se garantiza vigilancia continua 24/7.
- `localStorage` pertenece a cada navegador; no reemplaza una base de datos central.
- La autenticación actual es demostrativa y no protege información empresarial.
- COCO-SSD en navegador es inferencia real para clases generales COCO, pero no reconoce casco/chaleco/guantes/botas.
- Los resultados DEMO son sintéticos. No deben presentarse como inferencia real ni utilizarse para decisiones disciplinarias o de seguridad.
- La ausencia de detección de un EPP no prueba que el trabajador no lo lleve. Se requiere un modelo especializado validado, asociación objeto-persona y revisión humana.
