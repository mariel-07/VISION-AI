# Dataset de seguridad industrial (plantilla)

Esta carpeta solo incluye una plantilla YAML. No incluye fotografías, anotaciones ni pesos entrenados.

## Estructura esperada

```text
server/datasets/seguridad/
├── data.yaml
├── images/
│   ├── train/
│   └── val/
└── labels/
    ├── train/
    └── val/
```

Copia `data.yaml.example` como `data.yaml` y ajusta `path`. Etiqueta cada objeto con cajas YOLO y conserva los mismos índices de clase en todo el dataset.

Clases de ejemplo: `person`, `helmet`, `vest`, `gloves`, `goggles`, `boots` y clases explícitas de ausencia como `no_helmet` o `no_gloves`. Las clases de ausencia deben anotarse siguiendo una definición consistente (por ejemplo, región/persona sin el elemento), no inferirse automáticamente porque un objeto no aparezca en una fotografía.

## Entrenar

Desde la carpeta `server` con el entorno Python activado:

```bash
python train_scenario.py --data datasets/seguridad/data.yaml --base yolov8n.pt --epochs 80 --imgsz 640 --batch 8
```

Al terminar, configura `YOLO_MODEL_SECURITY` en `server/.env` con la ruta al `best.pt` generado y reinicia FastAPI.

## Validación obligatoria

- Divide imágenes por trabajador/escena/sesión, no fotogramas casi idénticos entre train y val.
- Incluye casco, chaleco, guantes, lentes y botas en distintos ángulos, iluminaciones y distancias.
- Incluye casos negativos y elementos parcialmente ocultos.
- Evalúa precisión, recall, mAP, falsos positivos y falsos negativos por clase.
- No concluyas que falta un EPP por una clase que el modelo no detectó. Usa una clase explícita de ausencia, asociación persona-elemento y revisión humana.
- El modelo COCO-SSD del navegador no se entrena ni se convierte automáticamente en este modelo especializado; esta fase utiliza el backend YOLO.
