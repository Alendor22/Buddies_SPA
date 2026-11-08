import io
import os
from functools import lru_cache

import numpy as np
from fastapi import FastAPI, File, Header, HTTPException, UploadFile

MODEL_VERSION = "open-noodle/pet-recognition-base@main"
MAX_BYTES = 8 * 1024 * 1024
MEAN = np.asarray([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.asarray([0.229, 0.224, 0.225], dtype=np.float32)
app = FastAPI(title="Buddies Dog Re-identification", docs_url=None, redoc_url=None)


@lru_cache(maxsize=1)
def models():
    import onnxruntime as ort
    import torch
    from huggingface_hub import hf_hub_download
    from torchvision.models.detection import (
        FasterRCNN_ResNet50_FPN_V2_Weights,
        fasterrcnn_resnet50_fpn_v2,
    )

    weights = FasterRCNN_ResNet50_FPN_V2_Weights.DEFAULT
    detector = fasterrcnn_resnet50_fpn_v2(weights=weights).eval()
    path = hf_hub_download(
        repo_id="open-noodle/pet-recognition-base",
        filename="recognition/model.onnx",
    )
    encoder = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
    return detector, encoder, weights


def authorize(value):
    token = os.environ.get("DOG_REID_API_TOKEN", "")
    if not token or value != f"Bearer {token}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health():
    return {"ok": True, "modelVersion": MODEL_VERSION}


@app.post("/embed")
async def embed(
    image: UploadFile = File(...),
    authorization: str | None = Header(default=None),
):
    import torch
    from PIL import Image
    from torchvision.models.detection import FasterRCNN_ResNet50_FPN_V2_Weights

    authorize(authorization)
    if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Unsupported image type")
    raw = await image.read(MAX_BYTES + 1)
    if not raw or len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds 8 MB")
    try:
        pil = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid image") from exc

    detector, encoder, weights = models()
    tensor = (
        torch.from_numpy(np.asarray(pil).copy())
        .permute(2, 0, 1)
        .float()
        / 255.0
    )
    with torch.inference_mode():
        found = detector([tensor])[0]

    categories = weights.meta["categories"]
    dog_label = categories.index("dog")
    matches = [
        (float(score), box.tolist())
        for label, score, box in zip(
            found["labels"], found["scores"], found["boxes"]
        )
        if int(label) == dog_label and float(score) >= 0.35
    ]
    if not matches:
        raise HTTPException(status_code=422, detail="No clear dog detected")

    _, box = max(matches, key=lambda item: item[0])
    left, top, right, bottom = map(int, box)
    crop = pil.crop(
        (
            max(0, left),
            max(0, top),
            min(pil.width, right),
            min(pil.height, bottom),
        )
    )
    crop = crop.resize((224, 224), Image.Resampling.BICUBIC)
    array = np.asarray(crop, dtype=np.float32) / 255.0
    array = (array - MEAN) / STD
    array = np.transpose(array, (2, 0, 1))[None, ...]
    inputs = encoder.get_inputs()
    outputs = encoder.get_outputs()
    vector = encoder.run(
        [outputs[0].name],
        {inputs[0].name: array},
    )[0].reshape(-1).astype(np.float32)
    norm = float(np.linalg.norm(vector))
    if vector.size != 512 or not np.isfinite(vector).all() or norm == 0:
        raise HTTPException(status_code=502, detail="Invalid embedding")
    vector /= norm
    return {"embedding": vector.tolist(), "modelVersion": MODEL_VERSION}
