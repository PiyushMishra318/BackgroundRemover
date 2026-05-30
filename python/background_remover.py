"""Remove solid backgrounds via grayscale thresholding (Python CLI)."""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2 as cv
import numpy as np


def remove_background(
    image: np.ndarray,
    threshold: int = 100,
    *,
    invert: bool = False,
) -> np.ndarray:
    if image.ndim != 3 or image.shape[2] not in (3, 4):
        raise ValueError("Expected a BGR or BGRA image")

    if not 0 <= threshold <= 255:
        raise ValueError("threshold must be between 0 and 255")

    bgr = image[:, :, :3]
    gray = cv.cvtColor(bgr, cv.COLOR_BGR2GRAY)
    mode = cv.THRESH_BINARY_INV if invert else cv.THRESH_BINARY
    _, mask = cv.threshold(gray, threshold, 255, mode)

    bgra = cv.cvtColor(bgr, cv.COLOR_BGR2BGRA)
    bgra[:, :, 3] = mask
    return bgra


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Remove a solid background and write a BGRA PNG."
    )
    parser.add_argument("input", nargs="?", help="Input image path")
    parser.add_argument("output", nargs="?", help="Output PNG path")
    parser.add_argument("-i", "--input", dest="input_flag", help="Input image path")
    parser.add_argument("-o", "--output", dest="output_flag", help="Output PNG path")
    parser.add_argument("-t", "--threshold", type=int, default=100)
    parser.add_argument("--invert", action="store_true")
    args = parser.parse_args()

    input_path = args.input_flag or args.input
    output_path = args.output_flag or args.output
    if not input_path or not output_path:
        parser.error("input and output paths are required")

    image = cv.imread(input_path, cv.IMREAD_COLOR)
    if image is None:
        raise SystemExit(f"Could not read image: {input_path}")

    result = remove_background(image, args.threshold, invert=args.invert)
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    if not cv.imwrite(str(output), result):
        raise SystemExit(f"Could not write image: {output}")

    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
