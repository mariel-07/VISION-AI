"""Entrena un YOLOv8n para EPP (casco/chaleco) en Google Colab y deja los 2 archivos para el navegador.

Pasos en Colab (https://colab.research.google.com):
  1) Entorno de ejecución > Cambiar tipo > GPU (T4, gratis).
  2) Pega este archivo en una celda y ejecútala.
  3) Descarga epp.onnx y epp.labels.json y ponlos en public/models/ de tu proyecto.

Dataset: elige uno público en formato "YOLOv8" (Roboflow Universe o Kaggle) que tenga clases
de casco y de AUSENCIA de casco (por ejemplo: helmet / head, o Hardhat / NO-Hardhat / Safety Vest / NO-Safety Vest).
Revisa su licencia antes de usarlo. Rellena los datos de abajo con los del dataset que elijas.
"""
# !pip -q install ultralytics roboflow onnx

import json
from pathlib import Path

from roboflow import Roboflow
from ultralytics import YOLO

# ---- Completa estos datos (los da Roboflow en "Download Dataset > YOLOv8") ----
API_KEY = "TU_API_KEY_DE_ROBOFLOW"   # cuenta gratuita
WORKSPACE = "workspace-del-dataset"
PROYECTO = "proyecto-del-dataset"
VERSION = 1
# ------------------------------------------------------------------------------

dataset = Roboflow(api_key=API_KEY).workspace(WORKSPACE).project(PROYECTO).version(VERSION).download("yolov8")
data_yaml = Path(dataset.location) / "data.yaml"

modelo = YOLO("yolov8n.pt")
modelo.train(data=str(data_yaml), epochs=50, imgsz=640, batch=16, patience=15)

# Cargar los mejores pesos y exportar con la forma que espera el navegador.
mejor = Path(modelo.trainer.best)
final = YOLO(str(mejor))
onnx = Path(final.export(format="onnx", imgsz=640, opset=12, dynamic=False))

# Etiquetas en el MISMO orden que las clases del modelo.
etiquetas = [final.names[i] for i in sorted(final.names)]
Path("epp.labels.json").write_text(json.dumps(etiquetas, ensure_ascii=False, indent=2), encoding="utf-8")
onnx.rename("epp.onnx")

print("Clases:", etiquetas)
print("Validación (mAP50):", final.val(data=str(data_yaml)).box.map50)
print("Descarga epp.onnx y epp.labels.json y colócalos en public/models/")
# from google.colab import files; files.download("epp.onnx"); files.download("epp.labels.json")
