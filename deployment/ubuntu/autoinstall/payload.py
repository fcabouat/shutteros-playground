#!/usr/bin/env python3
"""Validate the USB payload and perform manifest-pinned offline installation."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import subprocess
import sys
import tempfile
from urllib.parse import unquote, urlsplit


def command_summary(args) -> str:
    if args and args[0] == "apt-get":
        count = sum(isinstance(arg, str) and arg.endswith(".deb") for arg in args)
        phase = "URI preflight" if "--print-uris" in args else "install"
        return f"apt-get {phase} ({count} local DEBs, --no-remove, isolated package lists)"
    return shlex.join(args)


def failure_message(error: Exception) -> str:
    if isinstance(error, subprocess.CalledProcessError):
        return f"{command_summary(error.cmd)} failed with exit status {error.returncode}"
    if isinstance(error, subprocess.TimeoutExpired):
        return f"{command_summary(error.cmd)} timed out after {error.timeout} seconds"
    return str(error)


def run(*args: str, timeout: int = 300, print_output: bool = True) -> str:
    print("+ " + command_summary(args), flush=True)
    try:
        result = subprocess.run(args, check=False, text=True, stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, timeout=timeout)
    except subprocess.TimeoutExpired as error:
        output = error.output or ""
        print(output.decode(errors="replace") if isinstance(output, bytes) else output, end="", flush=True)
        raise
    if print_output or result.returncode:
        print(result.stdout, end="", flush=True)
    result.check_returncode()
    return result.stdout


def relative_file(root: Path, value: object, directory: str | None = None) -> Path:
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_./+-]+", value):
        raise ValueError(f"invalid payload path: {value!r}")
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or "." in path.parts or str(path) != value:
        raise ValueError(f"unsafe payload path: {value}")
    if directory and (len(path.parts) != 2 or path.parts[0] != directory):
        raise ValueError(f"expected a file directly under {directory}/: {value}")
    resolved = root / value
    if not resolved.is_file() or resolved.is_symlink():
        raise ValueError(f"missing regular payload file: {value}")
    return resolved


def validate(root: Path) -> dict:
    if root.is_symlink() or not root.is_dir():
        raise ValueError("payload root must be a real directory")
    files = set()
    for path in root.rglob("*"):
        if path.is_symlink() or not (path.is_file() or path.is_dir()):
            raise ValueError(f"payload contains a link or special file: {path}")
        if path.is_file():
            files.add(path.relative_to(root).as_posix())
    sums = relative_file(root, "SHA256SUMS")
    checksummed = set()
    for line in sums.read_text().splitlines():
        match = re.fullmatch(r"([0-9a-f]{64})  (.+)", line)
        if not match:
            raise ValueError("SHA256SUMS requires sha256sum's text format")
        digest, name = match.groups()
        path = relative_file(root, name)
        if name in checksummed or name == "SHA256SUMS":
            raise ValueError(f"duplicate or recursive checksum: {name}")
        with path.open("rb") as stream:
            actual = hashlib.file_digest(stream, "sha256").hexdigest()
        if actual != digest:
            raise ValueError(f"checksum mismatch: {name}")
        checksummed.add(name)
    if checksummed != files - {"SHA256SUMS"}:
        raise ValueError("SHA256SUMS must cover every payload file exactly once")
    manifest = json.loads(relative_file(root, "manifest.json").read_text())
    if not isinstance(manifest, dict) or manifest.get("version") != 1:
        raise ValueError("unsupported payload manifest version")
    if manifest.get("ubuntu_release") != "26.04":
        raise ValueError("payload must target Ubuntu 26.04")
    if manifest.get("architecture") not in {"amd64", "arm64"}:
        raise ValueError("unsupported payload architecture")
    prefix = manifest.get("hostname_prefix", "shutteros")
    if not isinstance(prefix, str) or not re.fullmatch(r"[a-z][a-z0-9-]{0,39}", prefix) or prefix.endswith("-"):
        raise ValueError("invalid hostname prefix")
    debs = manifest.get("debs")
    snaps = manifest.get("snaps")
    if not isinstance(debs, list) or not debs or not isinstance(snaps, list) or not snaps:
        raise ValueError("manifest must list offline DEBs and ordered signed snaps")
    if len(set(debs)) != len(debs):
        raise ValueError("duplicate DEB paths")
    for name in debs:
        if relative_file(root, name, "debs").suffix != ".deb":
            raise ValueError("DEB path must end in .deb")
    names = set()
    listed_snaps = set()
    listed_assertions = set()
    for snap in snaps:
        if not isinstance(snap, dict) or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", str(snap.get("name", ""))):
            raise ValueError("invalid snap manifest entry")
        if snap["name"] in names or not re.fullmatch(r"[1-9][0-9]*", str(snap.get("revision", ""))):
            raise ValueError("duplicate snap name or invalid signed revision")
        names.add(snap["name"])
        for key, suffix in (("snap", ".snap"), ("assert", ".assert")):
            if relative_file(root, snap.get(key), "snaps").suffix != suffix:
                raise ValueError(f"snap {key} file must end in {suffix}")
        listed_snaps.add(snap["snap"])
        listed_assertions.add(snap["assert"])
    if snaps[-1]["name"] != "chromium":
        raise ValueError("Chromium must follow all its base and content dependencies")
    if {n for n in files if n.startswith("debs/")} != set(debs):
        raise ValueError("manifest must list all DEB files")
    if {n for n in files if n.startswith("snaps/")} != listed_snaps | listed_assertions:
        raise ValueError("manifest must list all snap and assertion files")
    for name in ("kit/install.sh", "kit/verify.sh", "site/index.html", "site/kiosk-config.json",
                 "kit/autoinstall/firstboot.sh", "kit/autoinstall/shutteros-firstboot.service"):
        relative_file(root, name)
    return manifest


def target_matches(manifest: dict) -> None:
    release = dict(line.split("=", 1) for line in Path("/etc/os-release").read_text().splitlines()
                   if "=" in line and not line.startswith("#"))
    if release.get("ID", "").strip('"') != "ubuntu" or release.get("VERSION_ID", "").strip('"') != "26.04":
        raise ValueError("offline provisioning requires Ubuntu 26.04")
    architecture = subprocess.check_output(["dpkg", "--print-architecture"], text=True).strip()
    if architecture != manifest["architecture"]:
        raise ValueError("payload and target architecture differ")


def verify_apt_uris(output: str, root: Path, manifest: dict) -> int:
    allowed = {str(root / name) for name in manifest["debs"]}
    count = 0
    for line in output.splitlines():
        if not line.startswith("'"):
            continue
        fields = shlex.split(line)
        if len(fields) < 3 or not fields[2].isdigit():
            raise ValueError("APT produced a malformed acquisition URI")
        uri = urlsplit(fields[0])
        if uri.scheme != "file" or uri.netloc or uri.query or uri.fragment:
            raise ValueError("APT requested an acquisition outside the local offline payload")
        if re.search(r"%(?![0-9A-Fa-f]{2})", uri.path) or unquote(uri.path) not in allowed:
            raise ValueError("APT requested a file absent from the verified payload manifest")
        count += 1
    return count


def install_debs(root: Path, manifest: dict) -> None:
    target_matches(manifest)
    for path in manifest["debs"]:
        package = subprocess.check_output(["dpkg-deb", "-f", str(root / path), "Package"], text=True).strip()
        if package == "chromium-browser":
            raise ValueError("chromium-browser is a transitional DEB that downloads a snap")
    os.environ["DEBIAN_FRONTEND"] = "noninteractive"
    os.environ["LC_ALL"] = "C"
    with tempfile.TemporaryDirectory(prefix="shutteros-apt-offline-") as temporary:
        work = Path(temporary)
        work.chmod(0o755)
        for directory in ("sources", "lists", "archives/partial"):
            (work / directory).mkdir(parents=True, mode=0o755)
        sources_list = work / "sources.list"
        sources_list.write_text("")
        args = ["apt-get", "--no-remove", "--no-install-recommends", "-y",
                "-o", "Dir::Etc::sourcelist=" + str(sources_list), "-o", "Dir::Etc::sourceparts=" + str(work / "sources"),
                "-o", "Dir::State::lists=" + str(work / "lists"),
                "-o", "Dir::Cache::pkgcache=", "-o", "Dir::Cache::srcpkgcache=",
                "-o", "Dir::Cache::archives=" + str(work / "archives"),
                "-o", "APT::Get::Download=true", "-o", "Dpkg::Use-Pty=0"]
        local = [str(root / name) for name in manifest["debs"]]
        preflight = run(*args, "--print-uris", "--download-only", "install", *local,
                        timeout=180, print_output=False)
        count = verify_apt_uris(preflight, root, manifest)
        print(f"APT URI preflight passed: {count} verified local payload files.", flush=True)
        # Local file acquisition must run so APT resolves its canonical archive
        # name to the actual payload path. --no-download skips this bookkeeping.
        # Empty sources/lists/caches and the preceding URI whitelist keep this
        # installation offline while allowing the normal file acquisition step.
        # Offline upgrades and initramfs generation can be slow on older kiosk disks.
        run(*args, "install", *local, timeout=1800)
    for package in ("cage", "python3", "snapd", "libpam-systemd", "dbus-user-session", "openssh-server", "sudo"):
        status = subprocess.check_output(["dpkg-query", "-W", "-f=${Status}", package], text=True)
        if status != "install ok installed":
            raise ValueError(f"required offline package is not configured: {package}")
    if run("dpkg", "--audit").strip():
        raise ValueError("dpkg reports incomplete package configuration")
    if manifest["architecture"] == "amd64":
        # The ISO installs GRUB before these offline kernel updates. Initrd
        # generation may finish after a package hook already regenerated GRUB;
        # reconcile its menu only once all packages and triggers are configured.
        run("/usr/sbin/update-grub", timeout=180)


def install_snaps(root: Path, manifest: dict, saved: Path = Path("/var/lib/shutteros-provisioning/snap-store-access.json")) -> None:
    target_matches(manifest)
    saved.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    if not saved.exists():
        settings = json.loads(subprocess.check_output(["snap", "get", "-d", "system"], text=True, timeout=30))
        access = settings.get("store", {}).get("access")
        if access not in {None, "offline"}:
            raise ValueError("unexpected previous snap store.access setting")
        # Preserve the original setting across failed attempts and reboots.
        with saved.open("x") as stream:
            os.chmod(saved, 0o600)
            json.dump({"access": access}, stream)
    run("snap", "set", "system", "store.access=offline", timeout=30)
    run("snap", "wait", "system", "seed.loaded", timeout=180)
    for item in manifest["snaps"]:
        run("snap", "ack", str(root / item["assert"]), timeout=60)
    for item in manifest["snaps"]:
        installed = subprocess.run(["snap", "list", item["name"]], text=True, capture_output=True, check=False, timeout=30)
        needs_install = True
        if installed.returncode == 0:
            rows = installed.stdout.splitlines()
            if len(rows) != 2 or len(rows[1].split()) < 3 or rows[1].split()[0] != item["name"]:
                raise ValueError(f"unexpected installed snap listing: {item['name']}")
            needs_install = rows[1].split()[2] != str(item["revision"])
        if needs_install:
            # snap install FILE.snap also refreshes an existing snap from that
            # signed file. No Store refresh is requested; access remains offline.
            run("snap", "install", str(root / item["snap"]), timeout=300)
        listing = run("snap", "list", item["name"], timeout=30).splitlines()
        if len(listing) != 2 or len(listing[1].split()) < 3 or listing[1].split()[0] != item["name"] or listing[1].split()[2] != str(item["revision"]):
            raise ValueError(f"installed snap revision differs from payload: {item['name']}")
    run("snap", "connect", "chromium:etc-chromium-browser-policies", timeout=60)


def restore_store(saved: Path = Path("/var/lib/shutteros-provisioning/snap-store-access.json")) -> None:
    access = json.loads(saved.read_text()).get("access")
    if access is None:
        run("snap", "unset", "system", "store.access", timeout=30)
    elif access == "offline":
        run("snap", "set", "system", "store.access=offline", timeout=30)
    else:
        raise ValueError("invalid saved snap store.access setting")


def set_hostname(manifest: dict) -> None:
    # The installer supplies a fresh machine-id; never replace it or copy one from the ISO.
    machine_id = Path("/etc/machine-id").read_text().strip()
    if not re.fullmatch(r"[0-9a-f]{32}", machine_id) or machine_id == "0" * 32:
        raise ValueError("target machine-id is not initialized")
    hostname = manifest.get("hostname_prefix", "shutteros") + "-" + machine_id[:12]
    run("hostnamectl", "set-hostname", hostname)
    hosts = Path("/etc/hosts")
    lines = [line for line in hosts.read_text().splitlines() if not re.match(r"^127\.0\.1\.1\s", line)]
    hosts.write_text("\n".join(lines + ["127.0.1.1\t" + hostname]) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("verify", "install-debs", "install-snaps", "hostname", "restore-store"))
    parser.add_argument("payload", type=Path)
    args = parser.parse_args()
    root = args.payload.absolute()
    manifest = validate(root)
    if args.action != "verify" and os.geteuid() != 0:
        raise ValueError("installation requires root")
    if args.action == "install-debs":
        install_debs(root, manifest)
    elif args.action == "install-snaps":
        install_snaps(root, manifest)
    elif args.action == "hostname":
        set_hostname(manifest)
    elif args.action == "restore-store":
        restore_store()
    print(f"Payload {args.action} completed.", flush=True)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError, subprocess.SubprocessError, IndexError, TypeError) as error:
        print(f"Offline provisioning failed: {failure_message(error)}", file=sys.stderr, flush=True)
        sys.exit(1)
