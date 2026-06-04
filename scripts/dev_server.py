"""Local dev: static public/ + POST /api/cutout (Python OpenCV)."""

from __future__ import annotations

import base64
import json
import mimetypes
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import cv2 as cv
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
sys.path.insert(0, str(ROOT / "python"))

from background_remover import remove_background  # noqa: E402

MAX_BYTES = 12 * 1024 * 1024


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

    threshold = int(body.get("threshold", 100))
    invert = bool(body.get("invert", False))

    image = _decode_image(image_b64)
    result = remove_background(image, threshold, invert=invert)
    ok, buf = cv.imencode(".png", result)
    if not ok:
        raise ValueError("Could not encode PNG")
    return buf.tobytes()


class DevHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC), **kwargs)

    def do_OPTIONS(self) -> None:
        if self._is_cutout_api():
            self.send_response(204)
            self._cors()
            self.end_headers()
            return
        super().do_OPTIONS()

    def _is_cutout_api(self) -> bool:
        path = self.path.split("?", 1)[0].rstrip("/")
        return path == "/api/cutout" or path.endswith("/api/cutout")

    def do_POST(self) -> None:
        if self._is_cutout_api():
            try:
                length = int(self.headers.get("Content-Length", 0))
                raw = self.rfile.read(length)
                body = json.loads(raw.decode("utf-8"))
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
                self._cors()
                self.end_headers()
                self.wfile.write(payload)
            except ValueError as exc:
                self._json_error(400, str(exc))
            except Exception:
                self._json_error(500, "Processing failed")
            return
        self.send_error(404)

    def _cors(self) -> None:
        origin = self.headers.get("Origin", "*")
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Vary", "Origin")

    def _json_error(self, code: int, message: str) -> None:
        payload = json.dumps({"error": message}).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.end_headers()
        self.wfile.write(payload)

    def end_headers(self) -> None:
        if self.path.endswith((".js", ".css", ".html")):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def guess_type(self, path: str) -> str:
        ctype = mimetypes.guess_type(path)[0]
        return ctype or "application/octet-stream"


def main() -> None:
    port = 3000
    server = ThreadingHTTPServer(("127.0.0.1", port), DevHandler)
    print(f"Threshold dev server http://127.0.0.1:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
