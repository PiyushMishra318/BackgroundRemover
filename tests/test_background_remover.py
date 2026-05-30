import sys
from pathlib import Path

import cv2 as cv
import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "python"))

from background_remover import remove_background


def test_remove_background_adds_alpha_channel():
    image = np.full((32, 32, 3), 240, dtype=np.uint8)
    image[8:24, 8:24] = (30, 60, 90)

    result = remove_background(image, threshold=100, invert=True)

    assert result.shape == (32, 32, 4)
    assert result.dtype == np.uint8
    assert result[16, 16, 3] == 255
    assert result[0, 0, 3] == 0


def test_remove_background_invert():
    image = np.full((16, 16, 3), 20, dtype=np.uint8)
    image[4:12, 4:12] = 220

    normal = remove_background(image, threshold=100, invert=False)
    inverted = remove_background(image, threshold=100, invert=True)

    assert not np.array_equal(normal[:, :, 3], inverted[:, :, 3])


def test_remove_background_rejects_invalid_threshold():
    image = np.zeros((8, 8, 3), dtype=np.uint8)
    with pytest.raises(ValueError, match="threshold"):
        remove_background(image, threshold=300)


def test_cli_roundtrip(tmp_path):
    fixture = ROOT / "fixtures" / "sample.jpg"
    output = tmp_path / "out.png"
    image = cv.imread(str(fixture), cv.IMREAD_COLOR)
    result = remove_background(image, threshold=100, invert=True)
    assert cv.imwrite(str(output), result)
    written = cv.imread(str(output), cv.IMREAD_UNCHANGED)
    assert written is not None
    assert written.shape[2] == 4
