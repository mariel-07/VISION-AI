# Manual de procedimiento · VISION AI v2.1

## Objetivo
Operar la plataforma para analizar imágenes y fotogramas de cámara con YOLO, consultar detecciones, segmentaciones, patrones, alertas e historial.

## Procedimiento de arranque
1. Instalar Python 3.10–3.12 y Node.js 18+. En Windows se pueden iniciar los servicios con `INICIAR_BACKEND.bat` y `INICIAR_FRONTEND.bat`.
2. Crear entorno virtual dentro de `server` e instalar `server/requirements.txt`.
3. Iniciar `python main.py` y comprobar `http://localhost:8000/health`.
4. En la raíz, ejecutar `npm install` y `npm run dev`.
5. Abrir `http://localhost:5173` e ingresar con las credenciales demostrativas del README.

## Procedimiento 03. Carga y selección de imágenes
1. Entrar a Análisis visual y seleccionar uno de los cuatro escenarios iniciales.
2. Pulsar Cargar imagen y elegir JPG, PNG o WEBP.
3. El frontend valida extensión/tipo y tamaño máximo de 12 MB; se muestra la vista previa.
4. Si el archivo está vacío, dañado o no es compatible, se informa el error y no se ejecuta el análisis.
5. Ajustar la confianza y la modalidad. No se puede ejecutar YOLO sin imagen válida.

## Procedimiento 05. Ejecución del análisis visual
1. Verificar escenario, imagen y modalidad.
2. Pulsar Ejecutar análisis.
3. Se crea el identificador y se registra EN_PROCESO con fecha, usuario, imagen y escenario.
4. El visor muestra las etapas de validación, inferencia, segmentación cuando corresponda y evaluación de reglas.
5. El backend invoca YOLO real; en modalidad Combinado ejecuta detección y segmentación.
6. Se aplican las reglas del escenario y la zona restringida configurada para Almacén inteligente.
7. Se registran patrones y alertas; al terminar el análisis se actualiza a COMPLETADO. Ante error queda como ERROR.
8. Dashboard e historial leen el registro guardado en el navegador.

## Procedimiento 06. Visualización de detección de objetos
1. Ejecutar el análisis en Detección, Patrones o Combinado.
2. Revisar las cajas delimitadoras dibujadas sobre la imagen.
3. Consultar clase, confianza y coordenadas normalizadas X, Y, ancho y alto.
4. Consultar el listado de detecciones en el panel lateral y el módulo Detecciones.
5. Ajustar la confianza mínima y volver a ejecutar si es necesario.

## Procedimiento 07. Visualización de segmentación
1. Seleccionar Segmentación o Combinado.
2. Ejecutar el análisis; el backend utiliza YOLO-seg.
3. Las máscaras disponibles se dibujan como polígonos semitransparentes sobre la imagen.
4. Revisar clase, confianza y disponibilidad de máscara. Una clase no reconocida por el modelo no tendrá máscara.

## Procedimiento 08. Reconocimiento de patrones
1. Seleccionar Patrones o Combinado y ejecutar el análisis.
2. El backend evalúa reglas según el escenario seleccionado.
3. Seguridad industrial: presencia de persona genera una solicitud de revisión visual de EPP; no se declara incumplimiento automático.
4. Almacén inteligente: se evalúa si el centro de una detección cae dentro del rectángulo rojo de zona restringida, que debe ajustarse a la imagen/cámara.
5. Control de calidad: los objetos localizados quedan pendientes de inspección; no se confirma defecto superficial con COCO.
6. Retail: se cuenta la cantidad de personas en el fotograma; cuatro o más generan patrón de ocupación elevada.
7. Revisar nombre, evidencia y nivel de confianza/regla informado.

## Procedimiento 09. Generación y gestión de alertas
1. Durante el análisis o la cámara en vivo se evalúan las reglas del escenario.
2. Las alertas se asocian al análisis o sesión de cámara que las originó.
3. Abrir Centro de alertas para revisar mensaje, severidad, fecha y escenario.
4. Marcar como Revisada o Cerrada solo después de una revisión humana.
5. Los cambios quedan guardados en el almacenamiento local del navegador.

## Procedimiento del simulador
1. Abrir Análisis visual.
2. Seleccionar escenario.
3. Pulsar Probar simulador.
4. Revisar las detecciones sintéticas, patrones y alertas.
5. Verificar que el motor figure como SIMULADOR en historial.

## Procedimiento de alertas e historial
1. Abrir Alertas.
2. Filtrar por estado.
3. Marcar cada evento como Revisada o Cerrada tras la comprobación humana.
4. Abrir Historial para buscar por nombre, escenario o identificador.
5. Exportar CSV para el reporte.

## Procedimiento de calibración volumétrica
1. Colocar una referencia de dimensión conocida en el mismo plano del objeto.
2. Estimar píxeles por centímetro y configurar ese valor.
3. Ingresar la profundidad estimada.
4. Interpretar el resultado como aproximación de prisma, no como volumen real.
5. Para precisión física, utilizar cámara de profundidad o estéreo calibrado y desarrollar un módulo 3D específico.

## Configuración de modelos especializados
1. Preparar y etiquetar un dataset propio en formato YOLO.
2. Crear `data.yaml` con rutas de entrenamiento/validación y nombres de clases.
3. Ejecutar `python train_scenario.py --data ruta/data.yaml --epochs 80` desde `server`.
4. Configurar el `best.pt` en la variable del escenario dentro de `server/.env`.
5. Reiniciar FastAPI y comprobar que `/health` muestra el modelo especializado configurado.

## Verificación de operación
- API responde en `/health`.
- Indicador frontend muestra YOLO API conectada.
- La cámara solicita permiso y los fotogramas generan respuestas.
- La imagen cargada genera cajas/clases y confianza.
- Segmentación usa el peso `yolov8n-seg.pt`.
- El historial y alertas persisten al recargar el mismo navegador.
- El CSV contiene los registros filtrados.
- Los registros SIMULADOR están diferenciados de YOLO REAL.

## Seguridad y limitaciones
No utilizar la plataforma para identificar personas, emitir sanciones automáticas ni tomar decisiones críticas. Proteger imágenes, obtener consentimiento cuando corresponda y validar los resultados con una persona responsable. Los pesos COCO no detectan clases especializadas no incluidas en su entrenamiento. Para cascos, chalecos, pallets, montacargas, defectos y productos propios se requieren pesos entrenados por escenario.
