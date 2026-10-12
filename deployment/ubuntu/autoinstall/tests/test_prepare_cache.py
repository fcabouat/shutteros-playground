#!/usr/bin/env python3
"""Fixture-only cache tests: no VM, repository or Snap Store is contacted."""
import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[2] / "prepare-offline-cache.py"
SPEC = importlib.util.spec_from_file_location("prepare_cache", SOURCE)
cache = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(cache)
YAML = SimpleNamespace(safe_load=json.loads, YAMLError=ValueError)


class CacheBaselineTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.directory = Path(self.temporary.name)
        self.output = self.directory / "cache"
        self.iso = self.directory / "ubuntu-26.04.1-live-server-amd64.iso"
        self.iso.write_bytes(b"official ISO fixture")
        (self.directory / "SHA256SUMS").write_text(cache.digest(self.iso) + " *" + self.iso.name + "\n")
        names = ["apt", "dpkg", "libc6", "base-files", "systemd", "libpython3.14", "libpython3.14-stdlib"]
        self.status = "".join(f"Package: {name}\nStatus: install ok installed\nVersion: 3.14.4-1ubuntu0.1\nArchitecture: amd64\nConffiles:\n /etc/example abc123\nDescription: example\n continuation\n .\n another paragraph\n\n" for name in names)
        self.calls = []
        self.removal = False
        self.patcher = patch.object(cache, "run", side_effect=self.fake_run)
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()
        self.temporary.cleanup()

    def write_deb(self, name, version="3.14.4-1ubuntu0.2"):
        archive = self.output / ".apt/archives" / f"{name}.deb"
        archive.write_text(json.dumps({"Package": name, "Version": version, "Architecture": "amd64"}))

    def fake_run(self, *args, cwd=None, env=None, capture=False, timeout=7200):
        self.calls.append(args)
        if args[0] == "xorriso":
            target = Path(args[-1])
            if args[-2].endswith("install-sources.yaml"):
                target.write_text(json.dumps({"version": 2, "sources": [{"id": "ubuntu-server", "type": "fsimage-layered", "path": "ubuntu-server-minimal.ubuntu-server.squashfs"}]}))
            else:
                target.write_text(self.status)
        elif args[0] == "unsquashfs":
            return Path(args[2]).read_text()
        elif args[0] == "dpkg-deb":
            return json.loads(Path(args[2]).read_text())[args[3]] + "\n"
        elif args[0] == "apt-get" and "--simulate" in args:
            return "Remv libpython3.14\n" if self.removal else "Inst libpython3.14 [3.14.4-1ubuntu0.1] (3.14.4-1ubuntu0.2 local)\n"
        elif args[0] == "apt-get" and "install" in args:
            if any("Dir::State::status=" + str(self.output / ".apt/state/base-status") == arg for arg in args):
                # Regression: libpython's exact stdlib dependency requires its
                # matching update; it must be retained as an explicit root.
                assert "libpython3.14" in args
                assert "--no-remove" in args
                self.write_deb("libpython3.14")
            else:
                for name in cache.REQUESTED_DEBS:
                    self.write_deb(name)
                self.write_deb("libpython3.14-stdlib")
        elif args[:2] == ("snap", "download"):
            name = args[2]
            info = {"name": name, "type": "base"} if name == "core24" else {"name": name, "base": "core24"}
            snap = cwd / f"{name}_123.snap"
            snap.write_text(json.dumps(info))
            sha = base64.urlsafe_b64encode(hashlib.sha3_384(snap.read_bytes()).digest()).decode().rstrip("=")
            snap.with_suffix(".assert").write_text(f"type: snap-revision\nsnap-revision: 123\nsnap-size: {snap.stat().st_size}\nsnap-sha3-384: {sha}\n\nfixture-signature\n")
        return ""

    def test_preparation_preserves_matching_reverse_dependency_and_checks_offline(self):
        manifest = cache.prepare(self.output, self.iso, YAML)
        self.assertTrue(any("libpython3.14_3.14.4-1ubuntu0.2" in path for path in manifest["debs"]))
        self.assertEqual(manifest["base_iso_sha256"], cache.digest(self.iso))
        self.assertEqual(manifest["base_iso_name"], self.iso.name)
        self.assertEqual(manifest["base_source_path"], "casper/ubuntu-server-minimal.ubuntu-server.squashfs")
        self.assertTrue(manifest["baseline_compatible"])
        simulation = next(call for call in self.calls if "--simulate" in call)
        for value in ("--no-download", "--no-remove", "Dir::Etc::sourcelist=/dev/null", "Dir::Cache::pkgcache="):
            self.assertIn(value, simulation)
        self.assertIn("Dir::State::lists=" + str(self.output / ".apt/offline-lists"), simulation)

    def test_complete_same_iso_cache_reused_without_repository_access(self):
        cache.prepare(self.output, self.iso, YAML)
        self.calls.clear()
        cache.prepare(self.output, self.iso, YAML)
        self.assertTrue(all(call[0] == "unsquashfs" for call in self.calls))

    def test_different_iso_refused_before_any_download(self):
        cache.prepare(self.output, self.iso, YAML)
        self.iso.write_bytes(b"different official fixture")
        (self.directory / "SHA256SUMS").write_text(cache.digest(self.iso) + " *" + self.iso.name + "\n")
        self.calls.clear()
        with self.assertRaisesRegex(ValueError, "different base ISO"):
            cache.prepare(self.output, self.iso, YAML)
        self.assertEqual(self.calls, [])

    def test_removal_plan_never_marks_cache_complete(self):
        self.removal = True
        with self.assertRaisesRegex(ValueError, "remove a base ISO package"):
            cache.prepare(self.output, self.iso, YAML)
        self.assertFalse((self.output / "manifest.json").exists())

    def test_explicit_deb_repair_preserves_signed_snap_files(self):
        manifest = cache.prepare(self.output, self.iso, YAML)
        for field in ("base_iso_sha256", "base_iso_name", "base_status_sha256", "baseline_compatible"):
            manifest.pop(field)
        (self.output / "manifest.json").write_text(json.dumps(manifest))
        hashes = {path: sha for path, sha in manifest["sha256"].items() if path.startswith("snaps/")}
        supplied = self.directory / "iso-status"
        supplied.write_text(self.status)
        self.calls.clear()
        with patch.object(cache, "download_snaps", side_effect=AssertionError("snaps must be preserved")):
            repaired = cache.repair_debs(self.output, self.iso, YAML, baseline_status=supplied,
                                         archive_keyring=self.directory / "archive-keyring.gpg")
        self.assertEqual({path: repaired["sha256"][path] for path in hashes}, hashes)
        self.assertTrue(repaired["baseline_compatible"])
        self.assertFalse(any(call[0] == "xorriso" or call[:2] == ("snap", "download") for call in self.calls))

    def test_invalid_official_checksum_and_incomplete_status_refused(self):
        self.iso.write_bytes(b"corrupted")
        with self.assertRaisesRegex(ValueError, "SHA256SUMS"):
            cache.prepare(self.output, self.iso, YAML)
        self.assertFalse(self.output.exists())
        with self.assertRaisesRegex(ValueError, "complete native server"):
            cache.installed_packages("Package: libpython3.14\nStatus: install ok installed\nArchitecture: amd64\n")

    def test_real_iso_deb822_status_stanzas(self):
        # Unaltered public package stanzas extracted from the official
        # ubuntu-26.04.1-live-server-amd64 ubuntu-server overlay. They include
        # Conffiles: without a value on the header line and folded descriptions.
        status = (Path(__file__).parent / "fixtures/ubuntu26-dpkg-status").read_text()
        self.assertIn("Conffiles:\n", status)
        self.assertEqual(cache.installed_packages(status),
                         ["apt", "base-files", "dpkg", "libc6", "libpython3.14", "systemd"])


if __name__ == "__main__":
    unittest.main()
