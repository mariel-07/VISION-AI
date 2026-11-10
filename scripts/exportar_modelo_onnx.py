"""Convierte YOLOv8n a ONNX y lo copia a public/models/ para que el navegador lo use.

Uso (en tu PC, una sola vez, con internet):
    pip install ultralytics onnx
    python scripts/exportar_modelo_onnx.py

Resultado: public/models/yolov8n.onnx  (~12 MB)
"""
import shutil
from pathlib import Path

from ultralytics import YOLO

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "public" / "models"
DESTINO.mkdir(parents=True, exist_ok=True)

modelo = YOLO("yolov8n.pt")  # se descarga solo la primera vez
# imgsz=640 y forma fija: es lo que espera el código del navegador.
ruta = Path(modelo.export(format="onnx", imgsz=640, opset=12, dynamic=False))
shutil.copy(ruta, DESTINO / "yolov8n.onnx")
print(f"Listo: {DESTINO / 'yolov8n.onnx'}  ({(DESTINO / 'yolov8n.onnx').stat().st_size / 1e6:.1f} MB)")

# Comprobación opcional de la forma de salida (debe ser [1, 84, 8400]).
try:
    import onnxruntime as ort

    sesion = ort.InferenceSession(str(DESTINO / "yolov8n.onnx"), providers=["CPUExecutionProvider"])
    print("Entrada:", sesion.get_inputs()[0].shape, "· Salida:", sesion.get_outputs()[0].shape)
except ImportError:
    print("(Instala onnxruntime si quieres verificar la forma de salida.)")
