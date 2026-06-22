"""
Setup script for embedded Python distribution.

Downloads python-build-standalone (Gregory Szorc's portable Python builds)
for the target platform and extracts it into the Tauri resource directory.

Usage:
    python setup_embedded_python.py [--platform windows|x86_64-apple-darwin|x86_64-unknown-linux-gnu]

The embedded Python is placed at:
    app/src-tauri/python/  (bundled as a Tauri resource)

Requirements:
    - Internet connection (to download from GitHub)
    - Python 3.8+ (to run this script)
"""

import argparse
import hashlib
import os
import platform
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
import zipfile
from pathlib import Path

# ── Configuration ───────────────────────────────────────────────────────────

# python-build-standalone release URL template
# See: https://github.com/astral-sh/python-build-standalone/releases
PYTHON_VERSION = "3.12.9"
RELEASE_TAG = "20260121"  # Release date tag

# Platform-specific download URLs
PLATFORM_CONFIGS = {
    "windows": {
        "arch": "x86_64",
        "filename": f"cpython-{PYTHON_VERSION}+{RELEASE_TAG}-x86_64-pc-windows-msvc-install_only.tar.gz",
        "ext": ".tar.gz",
        "python_exe": "python/python.exe",
    },
    "macos": {
        "arch": "x86_64",
        "filename": f"cpython-{PYTHON_VERSION}+{RELEASE_TAG}-x86_64-apple-darwin-install_only.tar.gz",
        "ext": ".tar.gz",
        "python_exe": "python/bin/python3",
    },
    "linux": {
        "arch": "x86_64",
        "filename": f"cpython-{PYTHON_VERSION}+{RELEASE_TAG}-x86_64-unknown-linux-gnu-install_only.tar.gz",
        "ext": ".tar.gz",
        "python_exe": "python/bin/python3",
    },
}

BASE_URL = "https://github.com/astral-sh/python-build-standalone/releases/download"


def detect_platform() -> str:
    """Detect the current platform."""
    system = platform.system().lower()
    if system == "windows":
        return "windows"
    elif system == "darwin":
        return "macos"
    elif system == "linux":
        return "linux"
    else:
        raise RuntimeError(f"Unsupported platform: {system}")


def get_resource_dir() -> Path:
    """Get the Tauri resource directory where Python should be embedded."""
    # This script lives in python-backend/
    # The resource directory is app/src-tauri/python/
    script_dir = Path(__file__).resolve().parent
    resource_dir = script_dir.parent / "app" / "src-tauri" / "python"
    return resource_dir


def download_file(url: str, dest: Path) -> None:
    """Download a file with progress indication."""
    print(f"Downloading: {url}")
    print(f"Destination: {dest}")

    def report_progress(block_num: int, block_size: int, total_size: int):
        downloaded = block_num * block_size
        if total_size > 0:
            percent = min(100, downloaded * 100 // total_size)
            print(f"\r  {percent}% ({downloaded:,} / {total_size:,} bytes)", end="")
        else:
            print(f"\r  {downloaded:,} bytes", end="")

    urllib.request.urlretrieve(url, dest, report_progress)
    print()  # newline after progress


def extract_archive(archive_path: Path, dest_dir: Path) -> None:
    """Extract a .tar.gz or .zip archive."""
    print(f"Extracting to: {dest_dir}")

    # Remove existing Python directory if present
    if dest_dir.exists():
        print(f"Removing existing: {dest_dir}")
        shutil.rmtree(dest_dir)

    dest_dir.mkdir(parents=True, exist_ok=True)

    if archive_path.suffix == ".zip" or str(archive_path).endswith(".zip"):
        with zipfile.ZipFile(archive_path, "r") as zf:
            zf.extractall(dest_dir)
    else:
        # .tar.gz
        with tarfile.open(archive_path, "r:gz") as tf:
            tf.extractall(dest_dir)

    print("Extraction complete.")


def verify_installation(resource_dir: Path, platform_key: str) -> bool:
    """Verify that the embedded Python works correctly."""
    config = PLATFORM_CONFIGS[platform_key]
    python_exe = resource_dir / config["python_exe"]

    if not python_exe.exists():
        print(f"ERROR: Python executable not found at {python_exe}")
        return False

    # Test: run python --version
    try:
        result = subprocess.run(
            [str(python_exe), "--version"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        print(f"Python version: {result.stdout.strip()}")
        print("Embedded Python is ready.")
        return True
    except Exception as e:
        print(f"ERROR: Failed to run embedded Python: {e}")
        return False


def setup(platform_key: str | None = None) -> bool:
    """Main setup routine."""
    if platform_key is None:
        platform_key = detect_platform()
    else:
        # Normalize: accept "x86_64-apple-darwin" etc.
        if "windows" in platform_key:
            platform_key = "windows"
        elif "darwin" in platform_key or "macos" in platform_key:
            platform_key = "macos"
        elif "linux" in platform_key:
            platform_key = "linux"

    print(f"Setting up embedded Python for: {platform_key}")
    print(f"Python version: {PYTHON_VERSION} (build {RELEASE_TAG})")

    config = PLATFORM_CONFIGS[platform_key]
    filename = config["filename"]
    url = f"{BASE_URL}/{RELEASE_TAG}/{filename}"
    resource_dir = get_resource_dir()

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        archive_path = tmp_path / filename

        try:
            download_file(url, archive_path)
        except Exception as e:
            print(f"ERROR: Download failed: {e}")
            print("\nYou can manually download the Python distribution from:")
            print(f"  {url}")
            print(f"And extract it to: {resource_dir}")
            return False

        try:
            extract_archive(archive_path, resource_dir)
        except Exception as e:
            print(f"ERROR: Extraction failed: {e}")
            return False

    return verify_installation(resource_dir, platform_key)


def main():
    parser = argparse.ArgumentParser(
        description="Download and set up embedded Python for Open Flow Algorithm"
    )
    parser.add_argument(
        "--platform",
        help="Target platform (windows, macos, linux, or full target triple)",
        default=None,
    )
    parser.add_argument(
        "--python-version",
        help=f"Python version to download (default: {PYTHON_VERSION})",
        default=PYTHON_VERSION,
    )
    args = parser.parse_args()

    global PYTHON_VERSION
    PYTHON_VERSION = args.python_version

    success = setup(args.platform)
    if success:
        print("\n✅ Embedded Python setup complete!")
        print(f"   Location: {get_resource_dir()}")
        print("   The Tauri build will now include Python in the app bundle.")
    else:
        print("\n❌ Embedded Python setup failed.")
        sys.exit(1)


if __name__ == "__main__":
    main()
