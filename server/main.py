from __future__ import annotations
import os, time, uuid, re, urllib.request, urllib.parse, json
from contextlib import asynccontextmanager
from typing import Any
import cv2
import numpy as np
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

MAX_BYTES = 12 * 1024 * 1024
DEFAULT_MODEL = os.getenv('YOLO_MODEL', 'yolov8n.pt')
SEG_MODEL = os.getenv('YOLO_SEG_MODEL', 'yolov8n-seg.pt')
# Cada escenario puede usar pesos propios entrenados con sus clases empresariales.
SCENARIO_MODELS = {
    'seguridad-industrial': os.getenv('YOLO_MODEL_SECURITY', ''),
    'almacen-inteligente': os.getenv('YOLO_MODEL_WAREHOUSE', ''),
    'control-de-calidad': os.getenv('YOLO_MODEL_QUALITY', ''),
    'retail': os.getenv('YOLO_MODEL_RETAIL', ''),
}

# Clases permitidas estrictamente para cada escenario (evita falsos positivos cruzados)
SCENARIO_ALLOWED_CLASSES = {
    'Seguridad industrial': {
        'person', 'persona', 'worker', 'operario',
        'helmet', 'hardhat', 'casco', 'safety_helmet',
        'vest', 'chaleco', 'safety_vest', 'reflective_vest',
        'gloves', 'glove', 'guantes', 'safety_gloves',
        'goggles', 'goggle', 'lentes', 'safety_glasses', 'glasses',
        'boots', 'boot', 'botas', 'safety_boots',
        'no_helmet', 'sin_casco', 'no_hardhat', 'head',
        'no_vest', 'sin_chaleco',
        'no_gloves', 'sin_guantes',
        'no_goggles', 'no_goggle', 'sin_lentes',
        'no_boots', 'sin_botas',
        'forklift', 'montacargas',
    },
    'Almacén inteligente': {
        'person', 'persona', 'box', 'caja', 'carton', 'pallet', 'pallets', 'tarima',
        'forklift', 'montacargas', 'truck', 'camion', 'package', 'paquete',
    },
    'Control de calidad': {
        'product', 'producto', 'defect', 'defecto', 'scratch', 'rayon', 'crack', 'grieta',
        'bottle', 'botella', 'package', 'paquete', 'component', 'pieza',
    },
    'Retail': {
        'person', 'persona', 'cliente', 'bottle', 'botella', 'cup', 'taza', 'vaso',
        'handbag', 'bolso', 'cartera', 'backpack', 'mochila', 'suitcase', 'maleta',
        'product', 'producto',
    },
    'Transporte y logística': {
        'car', 'auto', 'coche', 'truck', 'camion', 'bus', 'autobus',
        'motorcycle', 'moto', 'bicycle', 'bicicleta', 'person', 'persona',
    },
    'Agricultura': {
        'apple', 'manzana', 'banana', 'platano', 'orange', 'naranja',
        'plant', 'planta', 'potted plant', 'potted_plant', 'leaf', 'hoja', 'weed', 'maleza',
    },
}
models: dict[str, YOLO] = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    models.clear()

app = FastAPI(title='VISION AI · YOLO API', version='2.1.0', lifespan=lifespan)
origins = os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',')
app.add_middleware(CORSMiddleware, allow_origins=[x.strip() for x in origins], allow_origin_regex=r'https?://(localhost|127\.0\.0\.1|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?', allow_credentials=True, allow_methods=['*'], allow_headers=['*'])

def slug(value: str) -> str:
    value = value.lower().strip().replace('á','a').replace('é','e').replace('í','i').replace('ó','o').replace('ú','u').replace('ñ','n')
    return re.sub(r'[^a-z0-9]+', '-', value).strip('-')

def get_model(task: str, scenario: str = '') -> tuple[YOLO, str, bool]:
    scenario_key = slug(scenario)
    custom = SCENARIO_MODELS.get(scenario_key, '') if task == 'detect' else ''
    path = SEG_MODEL if task == 'segment' else (custom or DEFAULT_MODEL)
    key = f'{task}:{scenario_key if custom else "general"}:{path}'
    if key not in models:
        try:
            models[key] = YOLO(path)
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f'No se pudo cargar el modelo {path}: {exc}') from exc
    return models[key], path, bool(custom)

def decode_image(raw: bytes) -> np.ndarray:
    if not raw or len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail='La imagen está vacía o supera 12 MB.')
    frame = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=415, detail='No se pudo decodificar la imagen. Verifica que sea un JPG, PNG o WEBP válido y que no esté dañado.')
    return frame

def evaluate_scenario(detections: list[dict[str, Any]], scenario: str, zone: dict[str, float] | None = None) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    labels = [d['label'].lower() for d in detections]
    patterns: list[dict[str, str]] = []
    alerts: list[dict[str, str]] = []
    person_count = sum(1 for x in labels if x in ('person', 'persona'))
    if scenario == 'Seguridad industrial':
        if person_count:
            patterns.append({'name':'Presencia de persona','confidence':'Detección YOLO','evidence':f'{person_count} persona(s) localizada(s).'})
        ppe_classes = {
            'casco': ('helmet', 'hard hat', 'safety helmet', 'casco'),
            'chaleco': ('vest', 'safety vest', 'reflective vest', 'chaleco'),
            'guantes': ('gloves', 'glove', 'safety gloves', 'guantes'),
            'lentes': ('goggles', 'safety glasses', 'protective eyewear', 'glasses', 'lentes'),
            'botas': ('boots', 'safety boots', 'steel toe boots', 'botas'),
        }
        missing_classes = {
            'casco': ('no helmet', 'no_helmet', 'without helmet', 'sin casco'),
            'chaleco': ('no vest', 'no_vest', 'without vest', 'sin chaleco'),
            'guantes': ('no gloves', 'no_gloves', 'without gloves', 'sin guantes'),
            'lentes': ('no goggles', 'no_goggles', 'without goggles', 'sin lentes'),
            'botas': ('no boots', 'no_boots', 'without boots', 'sin botas'),
        }
        recognized_ppe = False
        for item, aliases in ppe_classes.items():
            if any(label in labels for label in aliases):
                recognized_ppe = True
                patterns.append({'name': f'{item.capitalize()} identificado(s)', 'confidence': 'Clase devuelta por el modelo', 'evidence': f'El modelo especializado detectó la clase correspondiente a {item}.'})
        explicit_missing = False
        for item, aliases in missing_classes.items():
            if any(label in labels for label in aliases):
                explicit_missing = True
                patterns.append({'name': f'Posible ausencia de {item}', 'confidence': 'Clase devuelta por el modelo', 'evidence': f'El modelo especializado devolvió una clase asociada a ausencia de {item}.'})
                alerts.append({'severity': 'Alta', 'message': f'Posible incumplimiento de EPP: el modelo detectó ausencia de {item}. Requiere verificación humana.'})
        # No inferir ausencia solo porque un objeto no apareció: puede estar oculto,
        # fuera del encuadre o no formar parte de las clases del modelo.
        if person_count and not recognized_ppe and not explicit_missing:
            patterns.append({'name':'EPP no verificable','confidence':'Limitación del modelo','evidence':f'{person_count} persona(s) detectada(s), pero el modelo activo no reconoció clases de EPP.'})
            alerts.append({'severity':'Media','message':f'Revisión de EPP requerida: {person_count} persona(s) detectada(s), pero no fue posible verificar los elementos de protección. No es una confirmación de incumplimiento.'})
        elif person_count and recognized_ppe and not explicit_missing:
            patterns.append({'name':'Verificación parcial de EPP','confidence':'Revisión requerida','evidence':'Se reconoció al menos una clase de EPP, pero la ausencia de otros elementos no puede concluirse automáticamente.'})
        if zone and person_count:
            inside = [d for d in detections if d['label'].lower() in ('person','persona') and zone['x'] <= d['x'] + d['width']/2 <= zone['x']+zone['width'] and zone['y'] <= d['y'] + d['height']/2 <= zone['y']+zone['height']]
            if inside:
                patterns.append({'name':'Persona dentro de zona restringida','confidence':'Regla geométrica configurada','evidence':f'{len(inside)} persona(s) tienen el centro de su caja dentro del área restringida.'})
                alerts.append({'severity':'Alta','message':f'ADVERTENCIA: {len(inside)} persona(s) detectada(s) dentro de la zona restringida. Verificar la imagen y el acceso al área.'})
        if not patterns:
            patterns.append({'name':'Escena de seguridad analizada','confidence':'Resultado del modelo','evidence':'No se detectaron personas ni clases EPP por encima del umbral. Esto no certifica que el área esté vacía o que el EPP sea correcto.'})
    elif scenario == 'Almacén inteligente':
        if any(x in labels for x in ('forklift','montacargas')):
            patterns.append({'name':'Montacargas detectado','confidence':'Detección del modelo','evidence':'Se localizó un objeto clasificado como montacargas.'})
            alerts.append({'severity':'Media','message':'Montacargas detectado: revisar manualmente su ubicación y la zona operativa.'})
        if any(x in labels for x in ('pallet','pallets','pallet de carga')):
            patterns.append({'name':'Pallet localizado','confidence':'Modelo especializado','evidence':'Se detectó una clase de pallet.'})
        if any(x in labels for x in ('box','carton','caja')):
            patterns.append({'name':'Cajas localizadas','confidence':'Detección del modelo','evidence':f'{sum(x in ("box","carton","caja") for x in labels)} caja(s) detectada(s).'})
        if zone:
            inside = [d for d in detections if zone['x'] <= d['x'] + d['width']/2 <= zone['x']+zone['width'] and zone['y'] <= d['y'] + d['height']/2 <= zone['y']+zone['height']]
            if inside:
                patterns.append({'name':'Objeto en zona restringida','confidence':'Regla geométrica configurada','evidence':f'{len(inside)} objeto(s) tienen su centro dentro del rectángulo configurado.'})
                alerts.append({'severity':'Alta','message':f'Objeto dentro de zona restringida configurada: {len(inside)} detección(es). Verificar visualmente la evidencia.'})
        if detections and not patterns:
            patterns.append({'name':'Elementos localizados','confidence':'Detección general COCO','evidence':f'{len(detections)} objeto(s) detectado(s). Pallets y montacargas no se confirman sin pesos especializados.'})
    elif scenario == 'Control de calidad':
        if detections:
            patterns.append({'name':'Objetos para inspección','confidence':'Detección del modelo','evidence':f'{len(detections)} objeto(s) localizado(s). El modelo COCO no está entrenado para confirmar defectos superficiales.'})
            alerts.append({'severity':'Media','message':'Inspección de calidad pendiente: la detección genérica no confirma ni descarta defectos del producto.'})
        if any('defect' in x or 'scratch' in x or 'crack' in x for x in labels):
            patterns.append({'name':'Posible defecto visual','confidence':'Modelo especializado','evidence':'El modelo devolvió una clase relacionada con defectos.'})
        if not detections:
            patterns.append({'name':'Sin objeto localizado','confidence':'Resultado del modelo','evidence':'No se encontraron clases por encima del umbral. Esto no significa que el producto esté libre de defectos.'})
    elif scenario == 'Retail':
        if person_count:
            patterns.append({'name':'Presencia de clientes','confidence':'Derivada de detección','evidence':f'{person_count} persona(s) detectada(s) en la escena.'})
        if person_count >= 4:
            patterns.append({'name':'Ocupación elevada','confidence':'Regla por conteo','evidence':f'Se contabilizaron {person_count} personas en este fotograma.'})
            alerts.append({'severity':'Media','message':f'Ocupación elevada: {person_count} personas detectadas en el fotograma. Revisar el contexto antes de actuar.'})
    elif scenario == 'Transporte y logística':
        vehicle_labels = ('car', 'truck', 'bus', 'motorcycle', 'bicycle')
        vehicles = [label for label in labels if label in vehicle_labels]
        if vehicles:
            counts = {label: vehicles.count(label) for label in sorted(set(vehicles))}
            summary = ', '.join(f'{count} {label}' for label, count in counts.items())
            patterns.append({'name':'Vehículos localizados','confidence':'Detección general COCO','evidence':f'Se localizaron {len(vehicles)} vehículo(s): {summary}.'})
        else:
            patterns.append({'name':'Flujo de transporte analizado','confidence':'Resultado del modelo','evidence':'No se localizaron vehículos de las clases generales seleccionadas por encima del umbral.'})
    elif scenario == 'Agricultura':
        produce_labels = ('apple', 'banana', 'orange')
        produce = [label for label in labels if label in produce_labels]
        if produce:
            patterns.append({'name':'Frutas localizadas','confidence':'Detección general COCO','evidence':f'Se localizaron {len(produce)} fruta(s) de las clases generales disponibles: {", ".join(sorted(set(produce)))}.'})
        else:
            patterns.append({'name':'Escena agrícola analizada','confidence':'Resultado del modelo','evidence':'El modelo general no localizó frutas de sus clases COCO. Enfermedades de hojas, plagas y maleza requieren un modelo agrícola especializado.'})
        if any(x in labels for x in ('bottle','cup','book','backpack','handbag','suitcase','sports ball')):
            patterns.append({'name':'Productos u objetos visibles','confidence':'Detección del modelo','evidence':'Se localizaron objetos de las clases generales disponibles en COCO.'})
        if not patterns:
            patterns.append({'name':'Escena retail analizada','confidence':'Resultado del modelo','evidence':'No se detectaron personas ni objetos de las clases generales seleccionadas.'})
    return patterns, alerts

def infer(frame: np.ndarray, confidence: float = .35, task: str = 'detect', tracking: bool = False, scenario: str = '', zone: dict[str, float] | None = None) -> dict[str, Any]:
    model, model_path, specialized = get_model(task, scenario)
    start = time.perf_counter()
    # Se usa predict() sin ByteTrack para evitar que el tracker persistente
    # conserve pirámides ópticas de fotogramas con tamaños distintos. Esto
    # también evita que callbacks de tracking contaminen inferencias posteriores
    # de imágenes estáticas realizadas con la misma instancia YOLO.
    results = model.predict(frame, conf=confidence, verbose=False, imgsz=640)
    elapsed = (time.perf_counter() - start) * 1000
    result = results[0]
    height, width = frame.shape[:2]
    detections = []
    boxes = result.boxes
    if boxes is not None:
        xyxy = boxes.xyxy.cpu().numpy()
        confs = boxes.conf.cpu().numpy()
        classes = boxes.cls.cpu().numpy().astype(int)
        # No se asignan IDs temporales: el modo estable de esta versión es detección
        # por fotograma, sin seguimiento persistente.
        ids = [None] * len(xyxy)
        polygons = result.masks.xy if result.masks is not None else []
        for i, (coords, score, class_id) in enumerate(zip(xyxy, confs, classes)):
            x1, y1, x2, y2 = [float(v) for v in coords]
            name = str(model.names.get(int(class_id), class_id))
            # Filtrar estrictamente: solo lo que pertenece al escenario seleccionado
            if scenario and scenario in SCENARIO_ALLOWED_CLASSES:
                clean_name = name.lower().strip().replace(' ', '_').replace('-', '_')
                allowed_set = SCENARIO_ALLOWED_CLASSES[scenario]
                if clean_name not in allowed_set and name.lower() not in allowed_set:
                    continue
            mask = None
            if i < len(polygons):
                pts = polygons[i]
                mask = [[round(float(px) / width, 5), round(float(py) / height, 5)] for px, py in pts[:1500]]
            detections.append({'id':str(uuid.uuid4()),'label':name,'classId':int(class_id),'confidence':float(score),'x':max(0,x1/width),'y':max(0,y1/height),'width':max(0,min(1,(x2-x1)/width)),'height':max(0,min(1,(y2-y1)/height)),'trackId':int(ids[i]) if ids[i] is not None else None,'mask':mask})
    patterns, alerts = evaluate_scenario(detections, scenario, zone)
    # Despachar automáticamente a Telegram si hay alertas de prioridad Alta o Crítica
    for a in alerts:
        if a.get('severity') in ('Alta', 'Crítica'):
            try:
                send_telegram_alert(a.get('severity', 'Alta'), a.get('message', ''), scenario)
            except Exception as _t_err:
                print(f"[Telegram Alert Error] {_t_err}")
    return {'detections':detections,'width':width,'height':height,'duration_ms':round(elapsed,2),'engine':'YOLO REAL','task':task,'scenario':scenario,'patterns':patterns,'alerts':alerts,'model_path':model_path,'specialized_model':specialized,'model_notice':('Modelo especializado configurado para este escenario.' if specialized else 'Se está usando el modelo general COCO. Las clases empresariales no incluidas en COCO requieren pesos entrenados para este escenario.')}

telegram_cooldowns: dict[str, float] = {}

def send_telegram_alert(severity: str, message: str, scenario: str = '', custom_token: str | None = None, custom_chat_id: str | None = None) -> tuple[bool, str]:
    token = (custom_token or os.getenv('TELEGRAM_BOT_TOKEN', '')).strip()
    chat_id = (custom_chat_id or os.getenv('TELEGRAM_CHAT_ID', '')).strip()
    if not token or not chat_id:
        return False, 'Configura TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en server/.env para habilitar avisos al celular.'

    # Control anti-inundación (cooldown) por mensaje
    now = time.time()
    key = f"{severity}:{message.strip()}"
    try:
        cooldown = float(os.getenv('TELEGRAM_COOLDOWN_SECONDS', '45'))
    except ValueError:
        cooldown = 45.0

    if now - telegram_cooldowns.get(key, 0) < cooldown:
        return False, f'Alerta en período de enfriamiento ({cooldown}s)'

    icon = '🚨⛔' if severity == 'Crítica' else '⚠️🔴'
    hora = time.strftime('%H:%M:%S')
    fecha = time.strftime('%d/%m/%Y')
    text = (
        f"{icon} <b>VISION AI - ALERTA {severity.upper()}</b>\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"🏢 <b>Escenario:</b> {scenario or 'General'}\n"
        f"⚠️ <b>Incidente:</b> {message}\n"
        f"⏰ <b>Hora:</b> {hora} ({fecha})\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"📱 <i>Acción requerida: Verifique la estación de monitoreo inmediatamente.</i>"
    )
    payload = urllib.parse.urlencode({
        'chat_id': chat_id,
        'text': text,
        'parse_mode': 'HTML'
    }).encode()
    request = urllib.request.Request(f'https://api.telegram.org/bot{token}/sendMessage', data=payload, method='POST')
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            result = json.loads(response.read().decode('utf-8'))
        if result.get('ok'):
            telegram_cooldowns[key] = now
            return True, 'Enviado con éxito a Telegram.'
        return False, result.get('description', 'Telegram no confirmó el envío.')
    except Exception as exc:
        return False, f'Error al contactar con la API de Telegram: {exc}'

@app.post('/api/v1/notifications/test')
def test_notification():
    token = os.getenv('TELEGRAM_BOT_TOKEN', '').strip()
    chat_id = os.getenv('TELEGRAM_CHAT_ID', '').strip()
    if not token or not chat_id:
        raise HTTPException(status_code=503, detail='Configura TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en server/.env para habilitar avisos al teléfono.')
    hora = time.strftime('%H:%M:%S')
    fecha = time.strftime('%d/%m/%Y')
    test_text = (
        f"🔔 <b>VISION AI - VINCULACIÓN EXITOSA</b>\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"✅ <b>El canal de notificaciones a tu celular está funcionando correctamente.</b>\n"
        f"⏰ <b>Hora:</b> {hora} ({fecha})\n"
        f"📡 Las alertas de prioridad <b>Alta</b> y <b>Crítica</b> de la planta llegarán inmediatamente a este chat.\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"<i>VISION AI Platform 2.5</i>"
    )
    payload = urllib.parse.urlencode({'chat_id': chat_id, 'text': test_text, 'parse_mode': 'HTML'}).encode()
    request = urllib.request.Request(f'https://api.telegram.org/bot{token}/sendMessage', data=payload, method='POST')
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            result = json.loads(response.read().decode('utf-8'))
        if not result.get('ok'):
            raise HTTPException(status_code=502, detail=result.get('description', 'Telegram no confirmó el envío.'))
        return {'status':'sent', 'message':'Notificación de prueba enviada con éxito a tu Telegram.'}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f'No se pudo enviar a Telegram: {type(exc).__name__}')

@app.post('/api/v1/notifications/alert')
async def trigger_notification_alert(body: dict):
    severity = str(body.get('severity', 'Alta'))
    message = str(body.get('message', ''))
    scenario = str(body.get('scenario', ''))
    token = body.get('token')
    chat_id = body.get('chat_id')
    ok, detail = send_telegram_alert(severity, message, scenario, token, chat_id)
    if not ok:
        raise HTTPException(status_code=400, detail=detail)
    return {'status': 'sent', 'message': detail}

@app.get('/health')
def health():
    return {'status':'ok','service':'VISION AI YOLO','models_loaded':list(models.keys()),'default_model':DEFAULT_MODEL,'segmentation_model':SEG_MODEL,'scenario_models':{k:bool(v) for k,v in SCENARIO_MODELS.items()}}

@app.post('/api/v1/infer')
async def infer_upload(file: UploadFile = File(...), confidence: float = Form(.35), task: str = Form('detect'), scenario: str = Form(''), zone_x: float = Form(.72), zone_y: float = Form(.10), zone_width: float = Form(.25), zone_height: float = Form(.80)):
    allowed = {'image/jpeg','image/png','image/webp','application/octet-stream',''}
    ext = (file.filename or '').lower().rsplit('.',1)[-1]
    if file.content_type not in allowed and ext not in ('jpg','jpeg','png','webp'):
        raise HTTPException(status_code=415, detail='Formato no permitido. Usa JPG, PNG o WEBP.')
    if ext not in ('jpg','jpeg','png','webp'):
        raise HTTPException(status_code=415, detail='La extensión del archivo no es JPG, PNG o WEBP.')
    if not 0.05 <= confidence <= .99:
        raise HTTPException(status_code=422, detail='La confianza debe estar entre 0.05 y 0.99.')
    if task not in ('detect','segment'):
        raise HTTPException(status_code=422, detail='Tarea no válida.')
    if scenario not in ('Seguridad industrial','Almacén inteligente','Control de calidad','Retail','Transporte y logística','Agricultura'):
        raise HTTPException(status_code=422, detail='Selecciona un escenario válido.')
    if not (0 <= zone_x <= 1 and 0 <= zone_y <= 1 and 0 < zone_width <= 1 and 0 < zone_height <= 1 and zone_x + zone_width <= 1 and zone_y + zone_height <= 1):
        raise HTTPException(status_code=422, detail='La zona restringida debe estar dentro de la imagen y usar porcentajes válidos.')
    raw = await file.read(MAX_BYTES + 1)
    zone = {'x':zone_x,'y':zone_y,'width':zone_width,'height':zone_height} if scenario in ('Almacén inteligente','Seguridad industrial') else None
    return infer(decode_image(raw), confidence, task, scenario=scenario, zone=zone)

@app.websocket('/api/v1/stream')
async def stream(websocket: WebSocket):
    await websocket.accept()
    scenario = websocket.query_params.get('scenario','Almacén inteligente')
    task = websocket.query_params.get('task','detect')
    try:
        zone = {'x':float(websocket.query_params.get('zone_x','.72')),'y':float(websocket.query_params.get('zone_y','.10')),'width':float(websocket.query_params.get('zone_width','.25')),'height':float(websocket.query_params.get('zone_height','.80'))}
        if not (0 <= zone['x'] <= 1 and 0 <= zone['y'] <= 1 and 0 < zone['width'] <= 1 and 0 < zone['height'] <= 1 and zone['x']+zone['width'] <= 1 and zone['y']+zone['height'] <= 1): zone = None
    except ValueError:
        zone = None
    try:
        while True:
            raw = await websocket.receive_bytes()
            try:
                frame = decode_image(raw)
                if task == 'combined':
                    detected = infer(frame, .35, 'detect', tracking=True, scenario=scenario, zone=zone)
                    segmented = infer(frame, .35, 'segment', tracking=False, scenario=scenario, zone=zone)
                    merged = []
                    for d in detected['detections']:
                        match = next((m for m in segmented['detections'] if m['label'] == d['label'] and abs(m['x']-d['x']) < .08 and abs(m['y']-d['y']) < .08), None)
                        merged.append({**d, 'mask': match['mask']} if match and match.get('mask') else d)
                    result = {**detected, 'detections':merged, 'duration_ms':round(detected['duration_ms']+segmented['duration_ms'],2), 'model_notice':detected['model_notice']+' Segmentación en vivo: '+str(sum(1 for x in merged if x.get('mask')))+' máscaras disponibles.'}
                else:
                    result = infer(frame, .35, task if task in ('detect','segment') else 'detect', tracking=True, scenario=scenario, zone=zone)
                await websocket.send_json(result)
            except WebSocketDisconnect:
                raise
            except HTTPException as exc:
                try:
                    await websocket.send_json({'error':exc.detail,'detections':[],'width':0,'height':0,'duration_ms':0,'engine':'YOLO REAL'})
                except (WebSocketDisconnect, RuntimeError):
                    break
            except Exception as exc:
                print(f'Error procesando fotograma: {type(exc).__name__}: {exc}')
                try:
                    await websocket.send_json({'error':str(exc),'detections':[],'width':0,'height':0,'duration_ms':0,'engine':'YOLO REAL'})
                except (WebSocketDisconnect, RuntimeError):
                    break
    except WebSocketDisconnect:
        print('Cliente de cámara desconectado.')
    except Exception as exc:
        print(f'Error en el flujo WebSocket: {type(exc).__name__}: {exc}')
        try:
            await websocket.close(code=1011, reason='Error interno del motor de visión')
        except Exception:
            pass

if __name__ == '__main__':
    import uvicorn
    # Sin autoreload: evita que el proceso supervisor reinicie el servidor durante
    # sesiones WebSocket persistentes, especialmente en Windows.
    uvicorn.run(app, host='0.0.0.0', port=int(os.getenv('PORT','8000')), reload=False, ws_ping_interval=30, ws_ping_timeout=90)
