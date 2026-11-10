"""Entrena un modelo YOLO para uno de los escenarios de VISION AI.

Ejemplo:
  python train_scenario.py --data datasets/seguridad/data.yaml --base yolov8n.pt --epochs 80

El dataset debe estar anotado en formato YOLO y su YAML debe declarar train,
val y names. El archivo best.pt se genera en runs/detect/train/weights/.
"""
import argparse
from pathlib import Path
from ultralytics import YOLO

parser = argparse.ArgumentParser(description='Entrenamiento de pesos YOLO especializados para VISION AI')
parser.add_argument('--data', required=True, help='Ruta al archivo data.yaml del dataset etiquetado')
parser.add_argument('--base', default='yolov8n.pt', help='Pesos base')
parser.add_argument('--epochs', type=int, default=80)
parser.add_argument('--imgsz', type=int, default=640)
parser.add_argument('--batch', type=int, default=8)
parser.add_argument('--device', default='', help='0 para GPU CUDA; cpu para CPU; vacío para selección automática')
args = parser.parse_args()
if not Path(args.data).is_file():
    raise SystemExit(f'No existe el dataset YAML: {args.data}')
model = YOLO(args.base)
result = model.train(data=args.data, epochs=args.epochs, imgsz=args.imgsz, batch=args.batch, device=args.device or None, project='runs/vision_ai', name=Path(args.data).parent.name, exist_ok=True)
print('Entrenamiento finalizado. Revisa runs/vision_ai/<nombre>/weights/best.pt')
