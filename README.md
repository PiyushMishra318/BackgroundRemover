# Threshold-Background-Cutout

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![C++](https://img.shields.io/badge/C%2B%2B-17-blue.svg)](CMakeLists.txt)
[![Python](https://img.shields.io/badge/python-3.11+-blue.svg)](requirements.txt)
[![OpenCV](https://img.shields.io/badge/OpenCV-4+-green.svg)](CMakeLists.txt)

Remove a solid background from an image using **grayscale thresholding**, then write a **BGRA PNG** with an alpha mask.

Dual CLIs share the same pipeline: a fast **C++** binary (`bg-cutout`) and a portable **Python** entry point (`bg-cutout-py`).

## Requirements

**C++ CLI**

- C++17 compiler
- CMake 3.16+
- [OpenCV](https://opencv.org/) 4.x

**Python CLI**

- Python 3.11+
- `opencv-python-headless`

## Build (C++)

```bash
git clone git@github.com:PiyushMishra318/Threshold-Background-Cutout.git
cd Threshold-Background-Cutout
cmake -B build -S .
cmake --build build
```

### OpenCV on Windows

Set `OpenCV_DIR` to your OpenCV build folder:

```powershell
$env:OpenCV_DIR = "C:\opencv\build"
cmake -B build -S .
cmake --build build --config Release
```

Prebuilt Windows binaries are attached to [GitHub Releases](https://github.com/PiyushMishra318/Threshold-Background-Cutout/releases) as `bg-cutout-windows-x64.exe`.

### OpenCV on Ubuntu

```bash
sudo apt-get install libopencv-dev
```

## Install (Python)

```bash
pip install -r requirements-dev.txt
pip install -e .
```

## Usage

C++:

```bash
./build/bg-cutout fixtures/sample.jpg output.png
./build/bg-cutout -i photo.jpg -o cutout.png --threshold 120 --invert
./build/bg-cutout input.jpg output.png --preview
```

Python (same algorithm):

```bash
bg-cutout-py fixtures/sample.jpg output.png
bg-cutout-py -i photo.jpg -o cutout.png --threshold 120 --invert
```

### Options

| Flag | Description |
|------|-------------|
| `-i, --input` | Input image path |
| `-o, --output` | Output PNG path (alpha channel) |
| `-t, --threshold` | Threshold 0–255 (default: 100) |
| `--invert` | Invert mask (for dark backgrounds) |
| `--preview` | Show OpenCV window (C++ only) |
| `-h, --help` | Help |

## How it works

1. Load BGR image
2. Convert to grayscale
3. Binary threshold → alpha mask
4. Merge B, G, R, and alpha into BGRA
5. Save PNG

## Tests

```bash
cmake --build build && ctest --test-dir build --output-on-failure
pytest
```

## Project layout

```text
src/main.cpp              # C++ CLI (primary)
python/background_remover.py  # Python CLI (same pipeline)
tests/test_background_remover.py
fixtures/sample.jpg
CMakeLists.txt
```

## License

MIT © 2026 [Piyush Mishra](https://github.com/PiyushMishra318)
