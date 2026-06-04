/**
 * Vercel serverless — same pipeline as python/background_remover.py:
 * BGR → grayscale (OpenCV weights) → binary threshold → BGRA PNG.
 * Pure JS decode/encode (no native sharp) for reliable Vercel deploys.
 */

const JPEG = require("jpeg-js");
const { PNG } = require("pngjs");

const MAX_BYTES = 12 * 1024 * 1024;

function toGray(r, g, b) {
  return Math.round(0.114 * b + 0.587 * g + 0.299 * r);
}

function alphaMask(gray, threshold, invert) {
  if (invert) {
    return gray > threshold ? 0 : 255;
  }
  return gray > threshold ? 255 : 0;
}

function decodeImage(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    const decoded = JPEG.decode(buffer, { useTArray: true });
    if (!decoded || !decoded.width) {
      throw new Error("Could not decode JPEG");
    }
    return {
      width: decoded.width,
      height: decoded.height,
      data: decoded.data,
    };
  }

  const png = PNG.sync.read(buffer);
  return {
    width: png.width,
    height: png.height,
    data: png.data,
  };
}

function removeBackground(buffer, threshold, invert) {
  const { width, height, data } = decodeImage(buffer);
  const out = new PNG({ width, height });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) << 2;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = toGray(r, g, b);
      out.data[i] = r;
      out.data[i + 1] = g;
      out.data[i + 2] = b;
      out.data[i + 3] = alphaMask(gray, threshold, invert);
    }
  }

  return PNG.sync.write(out);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  const origin =
    typeof res.getHeader === "function" ? res.getHeader("Origin") : null;
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
  res.end(body);
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const raw = await readBody(req);
    const body = JSON.parse(raw.toString("utf8"));
    const imageField = body.image;
    if (!imageField || typeof imageField !== "string") {
      sendJson(res, 400, { error: "Missing image (base64)" });
      return;
    }

    const threshold = Math.min(
      255,
      Math.max(0, parseInt(body.threshold, 10) || 100)
    );
    const invert = Boolean(body.invert);

    let b64 = imageField;
    if (b64.includes(",")) b64 = b64.split(",")[1];
    const input = Buffer.from(b64, "base64");
    if (input.length > MAX_BYTES) {
      sendJson(res, 400, { error: "Image too large" });
      return;
    }

    const png = removeBackground(input, threshold, invert);
    sendJson(res, 200, {
      png: png.toString("base64"),
      contentType: "image/png",
      engine: "node-opencv-parity",
    });
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Processing failed" });
  }
};
