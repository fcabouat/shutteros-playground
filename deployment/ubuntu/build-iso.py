#!/usr/bin/env python3
"""Remaster an official Ubuntu 26.04 Server ISO with the local offline kiosk."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import tempfile

PROJECT = Path(__file__).resolve().parents[2]
BUILD = PROJECT.parent / "shutteros-build"
KIT = Path(__file__).resolve().parent


def real_directory(path: Path) -> None:
    if not path.is_dir() or any(part.is_symlink() for part in (path, *path.parents)):
        raise ValueError(f"directory and its parents must not be links: {path}")


def regular_file(root: Path, name: object, directory: str | None = None) -> Path:
    if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9_./+-]+", name):
        raise ValueError(f"invalid file path: {name!r}")
    relative = PurePosixPath(name)
    if relative.is_absolute() or ".." in relative.parts or str(relative) != name:
        raise ValueError(f"unsafe file path: {name}")
    if directory and (len(relative.parts) != 2 or relative.parts[0] != directory):
        raise ValueError(f"expected a file directly under {directory}/: {name}")
    path = root / name
    if not path.is_file() or any(part.is_symlink() for part in (path, *path.parents)):
        raise ValueError(f"missing regular file or linked parent: {name}")
    return path


def validate_build(dist: Path, *, private_branding: Path | None = None,
                   source_fingerprint: str | None = None) -> dict:
    real_directory(dist)
    index = regular_file(dist, "index.html")
    regular_file(dist, "kiosk-config.json")
    info = json.loads(regular_file(dist, "build-info.json").read_text())
    if not isinstance(info, dict) or not isinstance(info.get("publicBuild"), bool):
        raise ValueError("build-info must record whether this is a public build")
    if info.get("basePath") != "" or info.get("indexSha256") != digest(index):
        raise ValueError("ISO requires a fresh root-path game build, not a Pages/site build")
    if source_fingerprint is not None and info.get("sourceSha256") != source_fingerprint:
        raise ValueError("game sources, configuration or private branding changed since the build")
    branding = private_branding if private_branding is not None else PROJECT / "private/branding.json"
    if branding.exists() and info["publicBuild"]:
        raise ValueError("private branding exists but this build uses the public identity; rebuild locally")
    return info


def validate_cache(cache: Path, *, expected_base_sha256: str | None = None,
                   expected_base_name: str | None = None) -> dict:
    real_directory(cache)
    for directory in ("debs", "snaps"):
        real_directory(cache / directory)
    manifest = json.loads(regular_file(cache, "manifest.json").read_text())
    if not isinstance(manifest, dict) or manifest.get("version") != 1 or manifest.get("ubuntu_release") != "26.04" or manifest.get("architecture") != "amd64":
        raise ValueError("offline cache must target Ubuntu 26.04 amd64 with manifest version 1")
    base_sha, base_name = manifest.get("base_iso_sha256"), manifest.get("base_iso_name")
    if not isinstance(base_sha, str) or not re.fullmatch(r"[0-9a-f]{64}", base_sha) or not isinstance(base_name, str) or not re.fullmatch(r"ubuntu-26\.04(?:\.\d+)?-live-server-amd64\.iso", base_name):
        raise ValueError("cache must record its official Ubuntu Server baseline ISO name and SHA256")
    if expected_base_sha256 is not None and base_sha != expected_base_sha256:
        raise ValueError("cache baseline ISO SHA256 differs from the supplied ISO; prepare a matching cache")
    if expected_base_name is not None and base_name != expected_base_name:
        raise ValueError("cache baseline ISO name differs from the supplied ISO; prepare a matching cache")
    status_sha, package_count = manifest.get("base_status_sha256"), manifest.get("baseline_package_count")
    if manifest.get("baseline_compatible") is not True or manifest.get("base_source_id") != "ubuntu-server" or not isinstance(status_sha, str) or not re.fullmatch(r"[0-9a-f]{64}", status_sha) or not isinstance(package_count, int) or isinstance(package_count, bool) or package_count <= 0:
        raise ValueError("cache must record successful offline compatibility against the Ubuntu Server baseline status")
    spec = importlib.util.spec_from_file_location("cache_preparer", KIT / "prepare-offline-cache.py")
    preparer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(preparer)
    if manifest.get("requested_debs") != list(preparer.REQUESTED_DEBS) or not isinstance(manifest.get("prepared_at"), str) or not manifest["prepared_at"]:
        raise ValueError("cache must contain the complete recorded preparation")
    debs, snaps, hashes = (manifest.get(key) for key in ("debs", "snaps", "sha256"))
    if not isinstance(debs, list) or not debs or not isinstance(snaps, list) or not snaps or not isinstance(hashes, dict):
        raise ValueError("cache must list DEBs, ordered signed snaps and checksums")
    expected = set()
    for name in debs:
        if regular_file(cache, name, "debs").suffix != ".deb" or name in expected:
            raise ValueError("invalid or duplicate DEB path")
        expected.add(name)
    seen = set()
    for snap in snaps:
        if not isinstance(snap, dict):
            raise ValueError("invalid Snap manifest entry")
        name, revision, dependencies = (snap.get(key) for key in ("name", "revision", "dependencies"))
        if not isinstance(name, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", name) or name in seen:
            raise ValueError("invalid or duplicate Snap name")
        if not isinstance(revision, (str, int)) or isinstance(revision, bool) or not re.fullmatch(r"[1-9][0-9]*", str(revision)):
            raise ValueError("invalid signed Snap revision")
        if not isinstance(dependencies, list) or any(not isinstance(value, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", value) for value in dependencies):
            raise ValueError("invalid Snap dependencies")
        if len(set(dependencies)) != len(dependencies) or not set(dependencies) <= seen:
            raise ValueError("missing or incorrectly ordered Snap base/content dependency")
        for key, suffix in (("snap", ".snap"), ("assert", ".assert")):
            value = snap.get(key)
            regular_file(cache, value, "snaps")
            if value != f"snaps/{name}_{revision}{suffix}" or value in expected:
                raise ValueError("Snap filename must match its name and signed revision")
            expected.add(value)
        seen.add(name)
    if snaps[-1]["name"] != "chromium":
        raise ValueError("Chromium must follow its base and content dependencies")
    if set(hashes) != expected:
        raise ValueError("cache checksums must cover every DEB, snap and assertion")
    actual = set()
    for directory in ("debs", "snaps"):
        for path in (cache / directory).iterdir():
            name = path.relative_to(cache).as_posix()
            regular_file(cache, name, directory)
            actual.add(name)
    if actual != expected:
        raise ValueError("cache contains unrecorded or missing files")
    # Only read checksum/assertion contents after validating every path and field.
    for name in sorted(expected):
        sha = hashes[name]
        if not isinstance(sha, str) or not re.fullmatch(r"[0-9a-f]{64}", sha) or digest(cache / name) != sha:
            raise ValueError(f"offline cache checksum mismatch: {name}")
    for snap in snaps:
        if preparer.assert_revision(cache / snap["assert"], cache / snap["snap"]) != str(snap["revision"]):
            raise ValueError("Snap signed revision does not match cache manifest")
    return manifest


def digest(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def run(*args: str) -> None:
    subprocess.run(args, check=True)


def regular_tree(source: Path, target: Path, *, cache: bool = False) -> None:
    if source.is_symlink() or not source.is_dir():
        raise ValueError(f"source must be a real directory: {source}")
    for path in source.rglob("*"):
        if path.is_symlink() or not (path.is_dir() or path.is_file()):
            raise ValueError(f"links and special files are not allowed: {path}")
        destination = target / path.relative_to(source)
        if path.is_dir():
            destination.mkdir(parents=True, exist_ok=True)
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            if cache:
                try:
                    os.link(path, destination)
                    continue
                except OSError:
                    pass
            shutil.copy2(path, destination)


def checksums(root: Path) -> None:
    lines = [f"{digest(path)}  {path.relative_to(root).as_posix()}"
             for path in sorted(root.rglob("*")) if path.is_file() and path.name != "SHA256SUMS"]
    (root / "SHA256SUMS").write_text("\n".join(lines) + "\n")


def boot_config(text: str) -> str:
    lines = []
    for line in text.splitlines():
        if re.match(r"\s*linux\s+/casper/vmlinuz", line):
            head = line.split("---", 1)[0].rstrip()
            line = head + " autoinstall ds=nocloud\\;s=/cdrom/shutteros-seed/ network-config=disabled ---"
        if line.strip().startswith("set timeout="):
            line = "set timeout=10"
        lines.append(line)
    if not any("shutteros-seed" in line for line in lines):
        raise ValueError("ISO GRUB configuration has no supported Ubuntu Server kernel entry")
    return "\n".join(lines) + "\n"


def main() -> None:
    if os.environ.get("CI"):
        raise ValueError("ISO generation is excluded from CI")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-iso", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--admin-config", type=Path)
    args = parser.parse_args()
    iso = args.base_iso.resolve(strict=True)
    cache = args.cache.absolute()
    admin = args.admin_config.resolve(strict=True) if args.admin_config else None
    sums = iso.parent / "SHA256SUMS"
    expected = None
    for line in sums.read_text().splitlines():
        fields = line.split(maxsplit=1)
        if len(fields) == 2 and fields[1].lstrip(" *") == iso.name:
            expected = fields[0]
    if not expected or digest(iso) != expected:
        raise ValueError("official ISO SHA256SUMS verification failed")
    if not re.fullmatch(r"ubuntu-26\.04(?:\.\d+)?-live-server-amd64\.iso", iso.name):
        raise ValueError("only official Ubuntu 26.04 amd64 Server media is supported")
    xorriso = shutil.which("xorriso")
    if not xorriso:
        raise ValueError("install xorriso on the build machine before generating the ISO")
    dist = BUILD / "dist"
    fingerprint = subprocess.check_output(["node", str(PROJECT / "scripts/record-build.mjs"), "--fingerprint"],
                                          cwd=PROJECT, text=True).strip()
    validate_build(dist, source_fingerprint=fingerprint)
    manifest = validate_cache(cache, expected_base_sha256=expected, expected_base_name=iso.name)
    output_root = BUILD / "kiosk-iso"
    output_root.mkdir(parents=True, exist_ok=True)
    version = json.loads((PROJECT / "package.json").read_text())["version"]
    output = output_root / f"shutteros-ubuntu26.04-amd64-v{version}.iso"
    partial = output.with_suffix(".iso.part")
    partial.unlink(missing_ok=True)
    with tempfile.TemporaryDirectory(prefix="assemble-", dir=output_root) as scratch:
        work = Path(scratch)
        payload = work / "shutteros-payload"
        payload.mkdir()
        for directory in ("debs", "snaps"):
            regular_tree(cache / directory, payload / directory, cache=True)
        site = payload / "site"
        site.mkdir()
        for path in dist.iterdir():
            if path.name in {"portable", "site"}:
                continue
            if path.is_symlink():
                raise ValueError("compiled build must not contain symlinks")
            if path.is_dir():
                regular_tree(path, site / path.name)
            else:
                shutil.copy2(path, site / path.name)
        kit = payload / "kit"
        kit.mkdir()
        for name in ("install.sh", "verify.sh", "uninstall.sh", "platform.sh", "session",
                     "launch-chromium", "validate-config.py", "chromium-policy.json",
                     "shutteros-kiosk.service", "shutteros-static.service"):
            shutil.copy2(KIT / name, kit / name)
        (kit / "autoinstall").mkdir()
        for path in (KIT / "autoinstall").iterdir():
            if path.is_file() and path.suffix in {".py", ".sh", ".service"}:
                shutil.copy2(path, kit / "autoinstall" / path.name)
        manifest["admin_interactive"] = admin is None
        manifest["hostname_prefix"] = (json.loads(admin.read_text()).get("hostname_prefix", "shutteros")
                                       if admin else "shutteros")
        manifest["build"] = {"version": version, "iso_sha256": expected,
                             "commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=PROJECT, text=True).strip()}
        (payload / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        checksums(payload)
        spec = importlib.util.spec_from_file_location("kiosk_payload", KIT / "autoinstall/payload.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        module.validate(payload)
        seed = work / "shutteros-seed"
        seed.mkdir()
        render_args = ["python3", "-B", str(KIT / "autoinstall/render-user-data.py")]
        if admin:
            render_args.append(str(admin))
        run(*render_args, "--output", str(seed / "user-data"))
        (seed / "meta-data").write_text("instance-id: shutteros-offline-installer\n")
        grub = work / "grub.cfg"
        run(xorriso, "-osirrox", "on", "-indev", str(iso), "-extract", "/boot/grub/grub.cfg", str(grub))
        grub.chmod(0o600)  # ISO files are read-only; only this temporary copy is edited.
        grub.write_text(boot_config(grub.read_text()))
        loopback = work / "loopback.cfg"
        run(xorriso, "-osirrox", "on", "-indev", str(iso), "-extract", "/boot/grub/loopback.cfg", str(loopback))
        loopback.chmod(0o600)
        loopback.write_text(boot_config(loopback.read_text()))
        md5sums = work / "md5sum.txt"
        run(xorriso, "-osirrox", "on", "-indev", str(iso), "-extract", "/md5sum.txt", str(md5sums))
        md5sums.chmod(0o600)
        replacements = {"./boot/grub/grub.cfg": grub, "./boot/grub/loopback.cfg": loopback}
        md5_lines = []
        for line in md5sums.read_text().splitlines():
            sha, name = line.split(maxsplit=1)
            if name in replacements:
                with replacements[name].open("rb") as stream:
                    sha = hashlib.file_digest(stream, "md5").hexdigest()
            md5_lines.append(f"{sha}  {name}")
        for directory in (payload, seed):
            for path in sorted(directory.rglob("*")):
                if path.is_file():
                    with path.open("rb") as stream:
                        sha = hashlib.file_digest(stream, "md5").hexdigest()
                    md5_lines.append(f"{sha}  ./{path.relative_to(work).as_posix()}")
        md5sums.write_text("\n".join(md5_lines) + "\n")
        run(xorriso, "-indev", str(iso), "-outdev", str(partial),
            "-map", str(payload), "/shutteros-payload", "-map", str(seed), "/shutteros-seed",
            "-map", str(grub), "/boot/grub/grub.cfg", "-map", str(loopback), "/boot/grub/loopback.cfg",
            "-map", str(md5sums), "/md5sum.txt", "-boot_image", "any", "replay", "-commit", "-end")
    partial.replace(output)
    (output_root / (output.name + ".sha256")).write_text(f"{digest(output)}  {output.name}\n")
    (output_root / (output.name + ".manifest.json")).write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Offline USB ISO: {output}")


if __name__ == "__main__":
    main()
