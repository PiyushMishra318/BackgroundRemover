"""Vercel serverless handler — runs python/background_remover.remove_background."""

from __future__ import annotations

import base64
import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

import cv2 as cv
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
PYTHON_DIR = ROOT / "python"
if PYTHON_DIR.is_dir():
    sys.path.insert(0, str(PYTHON_DIR))

try:
    from background_remover import remove_background
except ImportError:
    import cv2 as cv
    import numpy as np

    def remove_background(image, threshold=100, *, invert=False):
        if image.ndim != 3 or image.shape[2] not in (3, 4):
            raise ValueError("Expected a BGR or BGRA image")
        bgr = image[:, :, :3]
        gray = cv.cvtColor(bgr, cv.COLOR_BGR2GRAY)
        mode = cv.THRESH_BINARY_INV if invert else cv.THRESH_BINARY
        _, mask = cv.threshold(gray, threshold, 255, mode)
        bgra = cv.cvtColor(bgr, cv.COLOR_BGR2BGRA)
        bgra[:, :, 3] = mask
        return bgra

MAX_BYTES = 12 * 1024 * 1024
DEFAULT_THRESHOLD = 100


def _cors_headers(handler: BaseHTTPRequestHandler) -> None:
    origin = handler.headers.get("Origin", "*")
    handler.send_header("Access-Control-Allow-Origin", origin)
    handler.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Vary", "Origin")


def _read_json(handler: BaseHTTPRequestHandler) -> dict:
    length = int(handler.headers.get("Content-Length", 0))
    if length <= 0 or length > MAX_BYTES:
        raise ValueError("Invalid request body size")
    raw = handler.rfile.read(length)
    data = json.loads(raw.decode("utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Expected JSON object")
    return data


def _decode_image(payload: str) -> np.ndarray:
    if "," in payload:
        payload = payload.split(",", 1)[1]
    blob = base64.b64decode(payload, validate=True)
    if len(blob) > MAX_BYTES:
        raise ValueError("Image too large")
    arr = np.frombuffer(blob, dtype=np.uint8)
    image = cv.imdecode(arr, cv.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode image")
    return image


def _process(body: dict) -> bytes:
    image_b64 = body.get("image")
    if not image_b64 or not isinstance(image_b64, str):
        raise ValueError("Missing image (base64)")

    threshold = int(body.get("threshold", DEFAULT_THRESHOLD))
    invert = bool(body.get("invert", False))

    image = _decode_image(image_b64)
    result = remove_background(image, threshold, invert=invert)
    ok, buf = cv.imencode(".png", result)
    if not ok:
        raise ValueError("Could not encode PNG")
    return buf.tobytes()


class handler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A003
        return

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        _cors_headers(self)
        self.end_headers()

    def do_POST(self) -> None:
        try:
            body = _read_json(self)
            png = _process(body)
            payload = json.dumps(
                {
                    "png": base64.b64encode(png).decode("ascii"),
                    "contentType": "image/png",
                    "engine": "python-opencv",
                }
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            _cors_headers(self)
            self.end_headers()
            self.wfile.write(payload)
        except ValueError as exc:
            self._error(400, str(exc))
        except Exception:
            self._error(500, "Processing failed")

    def _error(self, code: int, message: str) -> None:
        payload = json.dumps({"error": message}).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        _cors_headers(self)
        self.end_headers()
        self.wfile.write(payload)
