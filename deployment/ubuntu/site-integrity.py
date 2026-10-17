#!/usr/bin/env python3
"""Record and check every deployed site file; never print configuration contents."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
from urllib.request import ProxyHandler, build_opener


def inventory(root: Path) -> dict[str, str]:
    if root.is_symlink() or not root.is_dir():
        raise ValueError("site root must be a real directory")
    files = {}
    for path in sorted(root.rglob("*")):
        name = path.relative_to(root).as_posix()
        if path.is_symlink() or not (path.is_file() or path.is_dir()):
            raise ValueError(f"site contains a link or special file: {name}")
        if path.is_file():
            with path.open("rb") as stream:
                files[name] = hashlib.file_digest(stream, "sha256").hexdigest()
    for name in ("index.html", "kiosk-config.json"):
        if name not in files or (root / name).stat().st_size == 0:
            raise ValueError(f"site entry point is missing or empty: {name}")
    return files


def record(root: Path, manifest: Path) -> None:
    if manifest.resolve().is_relative_to(root.resolve()):
        raise ValueError("site inventory must be outside the served directory")
    manifest.write_text(json.dumps({"version": 1, "files": inventory(root)}, indent=2) + "\n")


def verify(root: Path, manifest: Path) -> None:
    if manifest.is_symlink() or not manifest.is_file():
        raise ValueError("site inventory is missing; reinstall with the reviewed kit")
    data = json.loads(manifest.read_text())
    if not isinstance(data, dict) or data.get("version") != 1 or not isinstance(data.get("files"), dict):
        raise ValueError("invalid site inventory")
    expected = data["files"]
    if any(not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{64}", value)
           for value in expected.values()):
        raise ValueError("invalid site inventory checksums")
    actual = inventory(root)
    for name in sorted(expected.keys() | actual.keys()):
        if name not in actual:
            raise ValueError(f"deployed site file missing: {name}")
        if name not in expected:
            raise ValueError(f"unexpected deployed site file: {name}")
        if actual[name] != expected[name]:
            raise ValueError(f"deployed site checksum mismatch: {name}")


def verify_http(root: Path) -> None:
    expected = (root / "index.html").read_bytes()
    if not expected:
        raise ValueError("site index.html is empty")
    url = "http://127.0.0.1:8080/"
    # This must check the local service, even if the administrator uses a proxy.
    with build_opener(ProxyHandler({})).open(url, timeout=3) as response:
        if response.status != 200 or response.geturl() != url or response.read(len(expected) + 1) != expected:
            raise ValueError("HTTP response does not match the installed index.html")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("record", "verify", "http"))
    parser.add_argument("site", type=Path)
    parser.add_argument("manifest", type=Path, nargs="?")
    args = parser.parse_args()
    if args.action == "http":
        verify_http(args.site)
    else:
        if args.manifest is None:
            parser.error("record and verify require an inventory path")
        (record if args.action == "record" else verify)(args.site, args.manifest)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as error:
        print(f"Site integrity check failed: {error}", file=sys.stderr)
        sys.exit(1)
