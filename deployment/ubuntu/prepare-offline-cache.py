#!/usr/bin/env python3
"""Download the complete Ubuntu 26.04 amd64 offline cache in a supplied environment.

Run explicitly as root in your prepared Ubuntu 26.04 VM or other environment:
  sudo python3 prepare-offline-cache.py --base-iso /path/to/ubuntu-26.04.1-live-server-amd64.iso --output /path/to/new-cache

Requires apt-get, dpkg-deb, snap, xorriso, unsquashfs, python3-yaml and the Ubuntu archive
keyring. It installs nothing, starts no VM, and keeps APT state under OUTPUT/.apt.
A complete verified cache is reused as recorded; refreshes require a new directory.
"""
from __future__ import annotations

import argparse
import base64
from datetime import datetime, timezone
import hashlib
import importlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import shutil
import subprocess
import sys
import tempfile

REQUESTED_DEBS = (
    "cage", "python3", "snapd", "libpam-systemd", "dbus-user-session",
    "openssh-server", "sudo", "locales", "keyboard-configuration",
)
ARCHIVE_KEYRING = Path("/usr/share/keyrings/ubuntu-archive-keyring.gpg")
SNAP_NAME = re.compile(r"[a-z0-9][a-z0-9-]*")


def run(*args: str, cwd: Path | None = None, env: dict | None = None,
        capture: bool = False, timeout: int = 7200) -> str:
    print("+ " + shlex.join(args), flush=True)
    result = subprocess.run(args, cwd=cwd, env=env, check=True, text=True,
                            stdout=subprocess.PIPE if capture else None, timeout=timeout)
    return result.stdout or ""


def require_environment():
    if os.geteuid() != 0:
        raise ValueError("run explicitly as root in your supplied Ubuntu 26.04 amd64 environment")
    release = {}
    for line in Path("/etc/os-release").read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            key, value = line.split("=", 1)
            release[key] = value.strip('"')
    if release.get("ID") != "ubuntu" or release.get("VERSION_ID") != "26.04":
        raise ValueError("this preparer requires Ubuntu 26.04; it never creates or upgrades the environment")
    missing = [name for name in ("apt-get", "dpkg", "dpkg-deb", "snap", "xorriso", "unsquashfs") if not shutil.which(name)]
    if missing:
        raise ValueError("preinstall required tools in your environment: " + ", ".join(missing))
    if run("dpkg", "--print-architecture", capture=True, timeout=30).strip() != "amd64":
        raise ValueError("this preparer requires native amd64")
    if not ARCHIVE_KEYRING.is_file() or ARCHIVE_KEYRING.is_symlink():
        raise ValueError("preinstall ubuntu-keyring: the system Ubuntu archive keyring is missing")
    try:
        return importlib.import_module("yaml")
    except ImportError as error:
        raise ValueError("preinstall python3-yaml in your supplied environment") from error


def digest(path: Path, algorithm: str = "sha256") -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, algorithm).hexdigest()


def verify_base_iso(iso: Path) -> dict:
    if not iso.is_file() or iso.is_symlink() or not re.fullmatch(r"ubuntu-26\.04(?:\.\d+)?-live-server-amd64\.iso", iso.name):
        raise ValueError("provide official Ubuntu 26.04 amd64 Server media as --base-iso")
    sums = iso.parent / "SHA256SUMS"
    if not sums.is_file() or sums.is_symlink():
        raise ValueError("place Ubuntu's verified published SHA256SUMS beside the base ISO")
    matching = []
    for line in sums.read_text().splitlines():
        match = re.fullmatch(r"([0-9a-f]{64}) [ *](.+)", line)
        if match and match[2] == iso.name:
            matching.append(match[1])
    if len(matching) != 1 or digest(iso) != matching[0]:
        raise ValueError("official base ISO SHA256SUMS verification failed")
    return {"base_iso_sha256": matching[0], "base_iso_name": iso.name}


def installed_packages(status: str) -> list[str]:
    records = []
    fields = {}
    previous = None
    for line in (status + "\n\n").splitlines():
        if not line.strip():
            if fields:
                records.append(fields)
                fields = {}
                previous = None
        elif line[0].isspace() and previous:
            fields[previous] += " " + line.strip()
        elif re.fullmatch(r"[A-Za-z0-9-]+:.*", line):
            previous, value = line.split(":", 1)
            fields[previous] = value.lstrip()
        else:
            raise ValueError("invalid dpkg status in base ISO")
    names = []
    for record in records:
        if record.get("Status", "").split()[-1:] != ["installed"]:
            continue
        name = record.get("Package", "")
        if not re.fullmatch(r"[a-z0-9][a-z0-9+.-]+", name) or record.get("Architecture") not in {"amd64", "all"}:
            raise ValueError("base ISO status has invalid or foreign-architecture packages")
        names.append(name)
    if not {"apt", "dpkg", "libc6", "base-files", "systemd"} <= set(names) or len(names) != len(set(names)):
        raise ValueError("base ISO overlay does not contain a complete native server dpkg status")
    return sorted(names)


def extract_baseline(output: Path, iso: Path, yaml, *, supplied_status: Path | None = None) -> tuple[Path, dict]:
    state = output / ".apt/state"
    state.mkdir(parents=True, exist_ok=True)
    if supplied_status is not None:
        # An explicit repair harness may supply the status already extracted from
        # this exact verified ISO. The supported CLI always extracts it itself.
        status = supplied_status.read_text()
        source_path = "operator-extracted-ubuntu-server-status"
    else:
        with tempfile.TemporaryDirectory(prefix="iso-baseline-", dir=output / ".apt") as temporary:
            work = Path(temporary)
            sources = work / "install-sources.yaml"
            run("xorriso", "-osirrox", "on", "-indev", str(iso), "-extract", "/casper/install-sources.yaml", str(sources), timeout=120)
            try:
                document = yaml.safe_load(sources.read_text())
            except yaml.YAMLError as error:
                raise ValueError("invalid install-sources.yaml in verified ISO") from error
            entries = document.get("sources") if isinstance(document, dict) else None
            if not isinstance(entries, list):
                raise ValueError("base ISO has no installation source list")
            matching = [entry for entry in entries if isinstance(entry, dict) and entry.get("id") == "ubuntu-server"]
            if len(matching) != 1 or matching[0].get("type") not in {"fsimage", "fsimage-layered"}:
                raise ValueError("base ISO has no supported ubuntu-server installation source")
            path = matching[0].get("path")
            if not isinstance(path, str) or not re.fullmatch(r"[A-Za-z0-9_.+-]+\.squashfs", path):
                raise ValueError("invalid ubuntu-server filesystem path in base ISO")
            source_path = "casper/" + path
            squashfs = work / "server.squashfs"
            run("xorriso", "-osirrox", "on", "-indev", str(iso), "-extract", "/" + source_path, str(squashfs), timeout=300)
            status = run("unsquashfs", "-cat", str(squashfs), "var/lib/dpkg/status", capture=True, timeout=120)
    names = installed_packages(status)
    destination = state / "base-status"
    destination.write_text(status)
    return destination, {"base_source_id": "ubuntu-server", "base_source_path": source_path,
                         "base_status_sha256": digest(destination), "baseline_package_count": len(names)}


def cache_file(output: Path, value: object, directory: str, suffix: str) -> Path:
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_./+~-]+", value):
        raise ValueError(f"invalid cache path: {value!r}")
    path = PurePosixPath(value)
    if path.is_absolute() or str(path) != value or len(path.parts) != 2 or path.parts[0] != directory or ".." in path.parts:
        raise ValueError(f"unsafe cache path: {value}")
    target = output / value
    if target.suffix != suffix or not target.is_file() or target.is_symlink():
        raise ValueError(f"missing regular {suffix} cache file: {value}")
    return target


def metadata(snap: Path, yaml) -> dict:
    try:
        result = yaml.safe_load(run("unsquashfs", "-cat", str(snap), "meta/snap.yaml", capture=True, timeout=60))
    except yaml.YAMLError as error:
        raise ValueError(f"invalid snap YAML metadata: {snap}") from error
    if not isinstance(result, dict):
        raise ValueError(f"invalid snap metadata: {snap}")
    architectures = result.get("architectures", ["amd64"])
    if not isinstance(architectures, list) or not set(architectures) & {"amd64", "all"}:
        raise ValueError(f"snap does not support amd64: {snap}")
    if result.get("confinement", "strict") != "strict":
        raise ValueError(f"offline kiosk cache requires strict snap confinement: {snap}")
    return result


def dependencies(info: dict) -> list[str]:
    names = []
    snap_type = info.get("type", "app")
    # Legacy application snaps without a base use core. Base/OS/snapd snaps do not.
    base = info.get("base", "core" if snap_type == "app" else None)
    if base not in (None, "none"):
        if not isinstance(base, str) or not SNAP_NAME.fullmatch(base):
            raise ValueError("invalid snap base name")
        names.append(base)
    plugs = info.get("plugs", {})
    if not isinstance(plugs, dict):
        raise ValueError("snap plugs metadata must be a mapping")
    for name, attributes in plugs.items():
        if not isinstance(attributes, dict) or attributes.get("interface", name) != "content":
            continue
        provider = attributes.get("default-provider")
        if provider is None:
            continue
        if not isinstance(provider, str) or not SNAP_NAME.fullmatch(provider.split(":", 1)[0]):
            raise ValueError("invalid content default-provider")
        names.append(provider.split(":", 1)[0])
    return list(dict.fromkeys(names))


def assert_revision(assertion: Path, snap: Path) -> str:
    text = assertion.read_text()
    headers = re.findall(r"^type: snap-revision\n(.*?)(?:\n\n|\Z)", text, re.MULTILINE | re.DOTALL)
    if len(headers) != 1:
        raise ValueError(f"expected one signed snap-revision assertion: {assertion}")
    fields = dict(re.findall(r"^([a-z0-9-]+): ([^\n]+)$", headers[0], re.MULTILINE))
    revision = fields.get("snap-revision", "")
    if not re.fullmatch(r"[1-9][0-9]*", revision):
        raise ValueError(f"invalid snap revision assertion: {assertion}")
    if fields.get("snap-size") != str(snap.stat().st_size):
        raise ValueError(f"snap size differs from assertion: {snap}")
    with snap.open("rb") as stream:
        actual = base64.urlsafe_b64encode(hashlib.file_digest(stream, "sha3_384").digest()).decode().rstrip("=")
    if fields.get("snap-sha3-384") != actual:
        raise ValueError(f"snap hash differs from assertion: {snap}")
    return revision


def apt_arguments(output: Path, *, archive_keyring: Path | None = None) -> tuple[list[str], dict]:
    apt = output / ".apt"
    for directory in ("lists/partial", "archives/partial", "state", "cache", "etc", "log"):
        (apt / directory).mkdir(mode=0o755, parents=True, exist_ok=True)
    (apt / "state/status").write_text("")
    config = apt / "etc/apt.conf"
    config.write_text('Dir::Etc::main "/dev/null";\nDir::Etc::parts "-";\n')
    sources = apt / "etc/sources.sources"
    sources.write_text(
        "Types: deb\nURIs: http://archive.ubuntu.com/ubuntu\n"
        "Suites: resolute resolute-updates\nComponents: main universe\nArchitectures: amd64\n"
        f"Signed-By: {archive_keyring or ARCHIVE_KEYRING}\n\n"
        "Types: deb\nURIs: http://security.ubuntu.com/ubuntu\n"
        "Suites: resolute-security\nComponents: main universe\nArchitectures: amd64\n"
        f"Signed-By: {archive_keyring or ARCHIVE_KEYRING}\n"
    )
    options = {
        "Dir::State": str(apt / "state"), "Dir::State::status": str(apt / "state/status"),
        "Dir::State::lists": str(apt / "lists"), "Dir::Cache": str(apt / "cache"),
        "Dir::Log": str(apt / "log"),
        "Dir::Cache::archives": str(apt / "archives"), "Dir::Etc::sourcelist": str(sources),
        "Dir::Etc::sourceparts": "-", "Dir::Etc::main": "/dev/null", "Dir::Etc::parts": "-",
        "APT::Architecture": "amd64", "APT::Architectures::": "amd64",
        "APT::Install-Recommends": "false", "APT::Install-Suggests": "false",
        "APT::Get::List-Cleanup": "false", "APT::Update::Error-Mode": "any",
        "Acquire::Retries": "3",
    }
    args = ["apt-get"]
    for key, value in options.items():
        args.extend(("-o", key + "=" + value))
    env = dict(os.environ, APT_CONFIG=str(config), DEBIAN_FRONTEND="noninteractive", LC_ALL="C")
    return args, env


def deb_metadata(source: Path) -> tuple[str, str, str]:
    package = run("dpkg-deb", "-f", str(source), "Package", capture=True, timeout=30).strip()
    version = run("dpkg-deb", "-f", str(source), "Version", capture=True, timeout=30).strip()
    architecture = run("dpkg-deb", "-f", str(source), "Architecture", capture=True, timeout=30).strip()
    if package == "chromium-browser" or architecture not in {"amd64", "all"}:
        raise ValueError(f"unexpected package in native offline cache: {source.name}")
    if not re.fullmatch(r"[a-z0-9][a-z0-9+.-]+", package) or not re.fullmatch(r"[A-Za-z0-9.+:~-]+", version):
        raise ValueError(f"invalid DEB package metadata: {source.name}")
    return package, version, architecture


def select_debs(output: Path) -> dict[str, tuple[Path, str, str]]:
    selected = {}
    for source in sorted((output / "debs").glob("*.deb")) + sorted((output / ".apt/archives").glob("*.deb")):
        package, version, architecture = deb_metadata(source)
        previous = selected.get(package)
        if previous:
            if version == previous[1]:
                if digest(source) != digest(previous[0]):
                    raise ValueError(f"same DEB version has different contents: {package}")
                continue
            result = subprocess.run(["dpkg", "--compare-versions", version, "gt", previous[1]], check=False)
            if result.returncode not in {0, 1}:
                raise ValueError("cannot compare downloaded Debian versions")
            if result.returncode == 1:
                continue
        selected[package] = (source, version, architecture)
    if not set(REQUESTED_DEBS) <= set(selected):
        raise ValueError("APT did not download every requested package; the cache is incomplete")
    return selected


def baseline_debs(output: Path, args: list[str], env: dict, status: Path) -> list[str]:
    local = [str(value[0]) for value in select_debs(output).values()]
    baseline_args = [*args, "-o", "Dir::State::status=" + str(status)]
    # Preserve every package installed by the selected ISO. Explicit package
    # roots let APT upgrade reverse dependencies such as libpython3.14 instead
    # of removing them when the empty-status closure upgrades python's stdlib.
    names = installed_packages(status.read_text())
    run(*baseline_args, "--download-only", "--no-install-recommends", "--no-remove", "-y",
        "install", *local, *names, env=env)
    selected = select_debs(output)
    local = [str(value[0]) for value in selected.values()]
    offline_lists = output / ".apt/offline-lists"
    offline_lists.mkdir(exist_ok=True)
    offline_args = [*baseline_args, "-o", "Dir::Etc::sourcelist=/dev/null", "-o", "Dir::Etc::sourceparts=-",
                    "-o", "Dir::State::lists=" + str(offline_lists), "-o", "Dir::Cache::pkgcache=",
                    "-o", "Dir::Cache::srcpkgcache="]
    simulation = run(*offline_args, "--simulate", "--no-download", "--no-install-recommends", "--no-remove",
                     "install", *local, env=env, capture=True)
    if any(line.startswith("Remv ") for line in simulation.splitlines()):
        raise ValueError("offline package simulation would remove a base ISO package")
    (output / ".apt/baseline-simulation.txt").write_text(simulation)
    debs = []
    retained = set()
    for package, (source, version, architecture) in sorted(selected.items()):
        safe_version = version.replace(":", "_epoch_").replace("~", "_tilde_")
        target = output / "debs" / f"{package}_{safe_version}_{architecture}.deb"
        if source != target:
            if target.exists() and digest(target) != digest(source):
                raise ValueError(f"duplicate package download differs: {target.name}")
            if not target.exists():
                source.rename(target)
        retained.add(target)
        debs.append(target.relative_to(output).as_posix())
    # Only replace older cache versions after the complete baseline simulation
    # succeeds. The installed environment is never changed.
    for path in (output / "debs").glob("*.deb"):
        if path not in retained:
            path.unlink()
    return debs


def download_debs(output: Path, status: Path) -> list[str]:
    args, env = apt_arguments(output)
    run(*args, "update", env=env)
    run(*args, "--download-only", "--no-install-recommends", "--no-remove", "-y", "install", *REQUESTED_DEBS, env=env)
    return baseline_debs(output, args, env, status)


def download_snaps(output: Path, yaml) -> list[dict]:
    entries = {}
    ordered = []
    visiting = set()

    def visit(name: str) -> None:
        if name in visiting:
            raise ValueError(f"cyclic snap dependency: {name}")
        if name in entries:
            return
        if not SNAP_NAME.fullmatch(name):
            raise ValueError(f"invalid snap dependency name: {name}")
        visiting.add(name)
        stage = output / ".apt/snap-downloads" / name
        stage.mkdir(parents=True)
        run("snap", "download", name, "--channel=stable", cwd=stage,
            env=dict(os.environ, UBUNTU_STORE_ARCH="amd64"))
        downloaded = list(stage.glob("*.snap"))
        if len(downloaded) != 1 or downloaded[0].is_symlink():
            raise ValueError(f"snap download did not produce one regular .snap: {name}")
        source = downloaded[0]
        assertion = source.with_suffix(".assert")
        if not assertion.is_file() or assertion.is_symlink():
            raise ValueError(f"snap download did not produce signed assertions: {name}")
        revision = assert_revision(assertion, source)
        if source.name != f"{name}_{revision}.snap":
            raise ValueError("downloaded filename differs from asserted revision")
        info = metadata(source, yaml)
        if info.get("name") != name:
            raise ValueError(f"downloaded snap metadata has the wrong name: {name}")
        required = dependencies(info)
        target = output / "snaps" / source.name
        target_assertion = target.with_suffix(".assert")
        source.rename(target)
        assertion.rename(target_assertion)
        for dependency in required:
            visit(dependency)
        entries[name] = {"name": name, "revision": revision,
                         "snap": target.relative_to(output).as_posix(),
                         "assert": target_assertion.relative_to(output).as_posix(),
                         "dependencies": required}
        ordered.append(entries[name])
        visiting.remove(name)

    visit("chromium")
    return ordered


def verify_cache(output: Path, yaml, *, base_iso: dict | None = None, require_baseline: bool = True) -> dict:
    manifest_path = output / "manifest.json"
    if not manifest_path.is_file() or manifest_path.is_symlink():
        raise ValueError("existing cache is incomplete; use a new empty output directory")
    manifest = json.loads(manifest_path.read_text())
    if not isinstance(manifest, dict) or manifest.get("version") != 1 or manifest.get("ubuntu_release") != "26.04" or manifest.get("architecture") != "amd64":
        raise ValueError("existing cache has an incompatible manifest")
    if manifest.get("requested_debs") != list(REQUESTED_DEBS) or not manifest.get("prepared_at"):
        raise ValueError("existing cache was not completed by this preparer")
    if require_baseline:
        if not isinstance(manifest.get("base_iso_sha256"), str) or not re.fullmatch(r"[0-9a-f]{64}", manifest["base_iso_sha256"]):
            raise ValueError("cache is not bound to a verified base ISO; prepare or repair it explicitly")
        if not isinstance(manifest.get("base_iso_name"), str) or not re.fullmatch(r"ubuntu-26\.04(?:\.\d+)?-live-server-amd64\.iso", manifest["base_iso_name"]):
            raise ValueError("cache has an invalid base ISO name")
        if manifest.get("baseline_compatible") is not True or manifest.get("base_source_id") != "ubuntu-server" or not re.fullmatch(r"[0-9a-f]{64}", str(manifest.get("base_status_sha256", ""))):
            raise ValueError("cache has no successful offline base ISO compatibility check")
        if base_iso is not None and any(manifest.get(key) != value for key, value in base_iso.items()):
            raise ValueError("cache was prepared for a different base ISO; use a new output directory")
    debs = manifest.get("debs")
    snaps = manifest.get("snaps")
    hashes = manifest.get("sha256")
    if not isinstance(debs, list) or not debs or not isinstance(snaps, list) or not snaps or not isinstance(hashes, dict):
        raise ValueError("existing cache has incomplete file lists")
    expected = set()
    for name in debs:
        cache_file(output, name, "debs", ".deb")
        if name in expected:
            raise ValueError("existing cache lists a package twice")
        expected.add(name)
    seen = set()
    for entry in snaps:
        if not isinstance(entry, dict) or not isinstance(entry.get("name"), str) or not SNAP_NAME.fullmatch(entry["name"]) or entry["name"] in seen:
            raise ValueError("existing cache has invalid or duplicate snap entries")
        snap = cache_file(output, entry.get("snap"), "snaps", ".snap")
        assertion = cache_file(output, entry.get("assert"), "snaps", ".assert")
        if assert_revision(assertion, snap) != str(entry.get("revision")):
            raise ValueError("existing cache revision differs from signed assertion")
        info = metadata(snap, yaml)
        if info.get("name") != entry["name"] or not set(dependencies(info)) <= seen:
            raise ValueError("existing cache has missing or incorrectly ordered snap dependencies")
        seen.add(entry["name"])
        expected.update((entry["snap"], entry["assert"]))
    if snaps[-1]["name"] != "chromium" or set(hashes) != expected:
        raise ValueError("existing cache is incomplete or has incomplete checksums")
    actual_files = set()
    for name in ("debs", "snaps"):
        directory = output / name
        if not directory.is_dir() or directory.is_symlink():
            raise ValueError("existing cache directories are invalid")
        for file in directory.rglob("*"):
            if file.is_symlink() or not file.is_file():
                raise ValueError("existing cache contains links, subdirectories or special files")
            actual_files.add(file.relative_to(output).as_posix())
    if actual_files != expected:
        raise ValueError("existing cache contains unrecorded or missing files")
    for name in sorted(expected):
        if not isinstance(hashes[name], str) or not re.fullmatch(r"[0-9a-f]{64}", hashes[name]) or digest(output / name) != hashes[name]:
            raise ValueError(f"existing cache checksum mismatch: {name}")
    return manifest


def prepare(output: Path, base_iso: Path, yaml) -> dict:
    base = verify_base_iso(base_iso)
    if output.is_symlink():
        raise ValueError("output directory must not be a symlink")
    if output.exists() and (not output.is_dir() or any(output.iterdir())):
        manifest = verify_cache(output, yaml, base_iso=base)
        print("Verified complete cache reused without contacting APT or the Snap Store.", flush=True)
        return manifest
    output.mkdir(mode=0o755, parents=True, exist_ok=True)
    (output / "debs").mkdir()
    (output / "snaps").mkdir()
    status, baseline = extract_baseline(output, base_iso, yaml)
    debs = download_debs(output, status)
    snaps = download_snaps(output, yaml)
    files = debs + [entry[key] for entry in snaps for key in ("snap", "assert")]
    manifest = {"version": 1, "ubuntu_release": "26.04", "architecture": "amd64",
                **base, **baseline, "baseline_compatible": True,
                "prepared_at": datetime.now(timezone.utc).isoformat(),
                "requested_debs": list(REQUESTED_DEBS), "debs": debs, "snaps": snaps,
                "sha256": {name: digest(output / name) for name in files}}
    temporary = output / ".manifest.json.tmp"
    temporary.write_text(json.dumps(manifest, indent=2) + "\n")
    temporary.replace(output / "manifest.json")
    verify_cache(output, yaml, base_iso=base)
    print(f"Prepared complete offline cache: {len(debs)} DEBs and {len(snaps)} signed snaps.", flush=True)
    return manifest


def repair_debs(output: Path, base_iso: Path, yaml, *, baseline_status: Path | None = None,
                archive_keyring: Path | None = None) -> dict:
    """Explicit repair harness: add compatible DEBs while preserving signed snaps.

    This helper does not weaken the CLI environment requirement. Optional inputs
    are for an operator's explicit isolated repair of an already complete cache;
    baseline_status must come from this exact ISO's ubuntu-server overlay.
    """
    if output.is_symlink() or not output.is_dir():
        raise ValueError("repair requires an existing real complete cache directory")
    base = verify_base_iso(base_iso)
    manifest = verify_cache(output, yaml, require_baseline=False)
    if manifest.get("base_iso_sha256") and manifest["base_iso_sha256"] != base["base_iso_sha256"]:
        raise ValueError("cannot silently repair a cache bound to a different ISO")
    snap_hashes = {name: sha for name, sha in manifest["sha256"].items() if name.startswith("snaps/")}
    status, baseline = extract_baseline(output, base_iso, yaml, supplied_status=baseline_status)
    args, env = apt_arguments(output, archive_keyring=archive_keyring)
    run(*args, "update", env=env)
    debs = baseline_debs(output, args, env, status)
    if any(digest(output / name) != sha for name, sha in snap_hashes.items()):
        raise ValueError("signed snap cache changed during DEB repair")
    files = debs + list(snap_hashes)
    manifest.update({**base, **baseline, "baseline_compatible": True, "debs": debs,
                     "repaired_at": datetime.now(timezone.utc).isoformat(),
                     "sha256": {name: digest(output / name) for name in files}})
    temporary = output / ".manifest.json.tmp"
    temporary.write_text(json.dumps(manifest, indent=2) + "\n")
    temporary.replace(output / "manifest.json")
    verify_cache(output, yaml, base_iso=base)
    print(f"Repaired compatible offline DEBs: {len(debs)} packages; signed snaps unchanged.", flush=True)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--base-iso", required=True, type=Path,
                        help="official Ubuntu 26.04 Server amd64 ISO with verified SHA256SUMS beside it")
    args = parser.parse_args()
    yaml = require_environment()
    prepare(args.output.absolute(), args.base_iso.absolute(), yaml)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.SubprocessError, TypeError, KeyError) as error:
        print(f"Cache preparation failed: {error}", file=sys.stderr, flush=True)
        print("No installed packages were changed. An incomplete cache is retained for diagnosis; use a new output directory to retry.", file=sys.stderr)
        sys.exit(1)
