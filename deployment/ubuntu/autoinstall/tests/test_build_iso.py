"""Preflight checks use tiny fixtures, never an ISO, VM or package manager."""
import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

KIT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("build_iso", KIT / "build-iso.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
spec = importlib.util.spec_from_file_location("prepare_cache", KIT / "prepare-offline-cache.py")
preparer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preparer)


class BuildPreflight(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.dist = self.root / "dist"
        self.dist.mkdir()
        (self.dist / "index.html").write_text("<html>local game</html>")
        (self.dist / "kiosk-config.json").write_text("{}")
        self.info = {"basePath": "", "publicBuild": False,
                     "indexSha256": builder.digest(self.dist / "index.html")}
        self.branding = self.root / "private/configuration.json"
        self.write_info()

    def write_info(self):
        (self.dist / "build-info.json").write_text(json.dumps(self.info))

    def validate(self):
        return builder.validate_build(self.dist, private_branding=self.branding)

    def test_root_build_accepts_private_identity(self):
        self.branding.parent.mkdir()
        self.branding.write_text("{}")
        self.assertEqual(self.validate(), self.info)

    def test_pages_build_rejected(self):
        self.info["basePath"] = "/demo"
        self.write_info()
        with self.assertRaisesRegex(ValueError, "root-path"):
            self.validate()

    def test_stale_index_rejected(self):
        (self.dist / "index.html").write_text("different build")
        with self.assertRaisesRegex(ValueError, "fresh"):
            self.validate()

    def test_matching_source_fingerprint_accepted(self):
        fingerprint = "a" * 64
        self.info["sourceSha256"] = fingerprint
        self.write_info()
        self.assertEqual(builder.validate_build(
            self.dist, private_branding=self.branding,
            source_fingerprint=fingerprint), self.info)

    def test_stale_source_fingerprint_rejected(self):
        self.info["sourceSha256"] = "a" * 64
        self.write_info()
        with self.assertRaisesRegex(ValueError, "changed since the build"):
            builder.validate_build(self.dist, private_branding=self.branding,
                                   source_fingerprint="b" * 64)

    def test_public_build_rejected_when_private_branding_exists(self):
        self.branding.parent.mkdir()
        self.branding.write_text("{}")
        self.info["publicBuild"] = True
        self.write_info()
        with self.assertRaisesRegex(ValueError, "private branding"):
            self.validate()

    def test_public_build_without_private_branding_allowed(self):
        self.info["publicBuild"] = True
        self.write_info()
        self.assertTrue(self.validate()["publicBuild"])

    def test_linked_build_parent_rejected(self):
        alias = self.root / "alias"
        alias.symlink_to(self.root, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "parents"):
            builder.validate_build(alias / "dist")


class CachePreflight(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.cache = self.root / "cache"
        (self.cache / "debs").mkdir(parents=True)
        (self.cache / "snaps").mkdir()
        (self.cache / "debs/cage_1_amd64.deb").write_bytes(b"fixture DEB")
        self.manifest = {"version": 1, "ubuntu_release": "26.04", "architecture": "amd64",
                         "base_iso_sha256": "b" * 64,
                         "base_iso_name": "ubuntu-26.04.1-live-server-amd64.iso",
                         "base_status_sha256": "d" * 64, "base_source_id": "ubuntu-server",
                         "baseline_compatible": True, "baseline_package_count": 709,
                         "prepared_at": "2026-10-12T00:00:00+00:00",
                         "requested_debs": list(preparer.REQUESTED_DEBS),
                         "debs": ["debs/cage_1_amd64.deb"], "snaps": []}
        for name, dependencies in (("core24", []), ("gnome-46-2404", ["core24"]),
                                   ("chromium", ["core24", "gnome-46-2404"])):
            snap = self.cache / f"snaps/{name}_1.snap"
            snap.write_bytes((name + " fixture").encode())
            sha3 = base64.urlsafe_b64encode(hashlib.sha3_384(snap.read_bytes()).digest()).decode().rstrip("=")
            assertion = snap.with_suffix(".assert")
            assertion.write_text(f"type: snap-revision\nsnap-revision: 1\nsnap-size: {snap.stat().st_size}\nsnap-sha3-384: {sha3}\n\nfixture signature\n")
            self.manifest["snaps"].append({"name": name, "revision": "1", "dependencies": dependencies,
                                           "snap": snap.relative_to(self.cache).as_posix(),
                                           "assert": assertion.relative_to(self.cache).as_posix()})
        self.write_manifest()

    def write_manifest(self):
        self.manifest["sha256"] = {path.relative_to(self.cache).as_posix(): builder.digest(path)
                                   for directory in ("debs", "snaps")
                                   for path in (self.cache / directory).iterdir() if path.is_file()}
        (self.cache / "manifest.json").write_text(json.dumps(self.manifest))

    def test_complete_recorded_cache_accepted(self):
        self.assertEqual(builder.validate_cache(
            self.cache, expected_base_sha256="b" * 64,
            expected_base_name="ubuntu-26.04.1-live-server-amd64.iso"), self.manifest)

    def test_cache_from_different_baseline_hash_rejected(self):
        with self.assertRaisesRegex(ValueError, "baseline ISO SHA256 differs"):
            builder.validate_cache(self.cache, expected_base_sha256="c" * 64)

    def test_cache_from_different_point_release_rejected(self):
        with self.assertRaisesRegex(ValueError, "baseline ISO name differs"):
            builder.validate_cache(self.cache, expected_base_name="ubuntu-26.04-live-server-amd64.iso")

    def test_baseline_metadata_required(self):
        for key in ("base_iso_sha256", "base_iso_name"):
            with self.subTest(key=key):
                manifest = {name: value for name, value in self.manifest.items() if name != key}
                (self.cache / "manifest.json").write_text(json.dumps(manifest))
                with self.assertRaisesRegex(ValueError, "baseline ISO name and SHA256"):
                    builder.validate_cache(self.cache)

    def test_successful_baseline_compatibility_metadata_required(self):
        for key in ("base_status_sha256", "base_source_id", "baseline_compatible", "baseline_package_count"):
            with self.subTest(key=key):
                manifest = {name: value for name, value in self.manifest.items() if name != key}
                (self.cache / "manifest.json").write_text(json.dumps(manifest))
                with self.assertRaisesRegex(ValueError, "successful offline compatibility"):
                    builder.validate_cache(self.cache)

    def test_invalid_baseline_compatibility_metadata_rejected(self):
        for key, value in (("base_status_sha256", "not-a-hash"), ("base_source_id", "ubuntu-server-minimal"),
                           ("baseline_compatible", False), ("baseline_compatible", 1),
                           ("baseline_package_count", 0), ("baseline_package_count", True),
                           ("baseline_package_count", "709")):
            with self.subTest(key=key, value=value):
                manifest = dict(self.manifest, **{key: value})
                (self.cache / "manifest.json").write_text(json.dumps(manifest))
                with self.assertRaisesRegex(ValueError, "successful offline compatibility"):
                    builder.validate_cache(self.cache)

    def test_missing_declared_provider_rejected_even_with_coherent_hashes(self):
        provider = self.manifest["snaps"].pop(1)
        for key in ("snap", "assert"):
            (self.cache / provider[key]).unlink()
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "dependency"):
            builder.validate_cache(self.cache)

    def test_wrong_provider_order_rejected(self):
        self.manifest["snaps"][0], self.manifest["snaps"][1] = self.manifest["snaps"][1], self.manifest["snaps"][0]
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "ordered"):
            builder.validate_cache(self.cache)

    def test_linked_cache_directories_rejected(self):
        for directory in ("debs", "snaps"):
            with self.subTest(directory=directory):
                path = self.cache / directory
                moved = self.root / directory
                path.rename(moved)
                path.symlink_to(moved, target_is_directory=True)
                with self.assertRaisesRegex(ValueError, "links"):
                    builder.validate_cache(self.cache)
                path.unlink()
                moved.rename(path)

    def test_linked_cache_root_rejected(self):
        alias = self.root / "alias"
        alias.symlink_to(self.cache, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "links"):
            builder.validate_cache(alias)

    def test_unsafe_assertion_path_rejected_before_contents_are_read(self):
        self.manifest["snaps"][0]["assert"] = "../../outside.assert"
        self.write_manifest()
        with patch.object(Path, "read_text", autospec=True, side_effect=AssertionError("outside read")) as read:
            read.side_effect = lambda path, *args, **kwargs: json.dumps(self.manifest) if path.name == "manifest.json" else self.fail("assertion read before path validation")
            with self.assertRaisesRegex(ValueError, "unsafe"):
                builder.validate_cache(self.cache)

    def test_missing_assertion_rejected(self):
        (self.cache / self.manifest["snaps"][0]["assert"]).unlink()
        with self.assertRaisesRegex(ValueError, "missing"):
            builder.validate_cache(self.cache)

    def test_hash_coverage_rejected_before_assertions(self):
        self.manifest["sha256"].pop("snaps/core24_1.assert")
        (self.cache / "manifest.json").write_text(json.dumps(self.manifest))
        with self.assertRaisesRegex(ValueError, "cover every"):
            builder.validate_cache(self.cache)

    def test_checksum_mismatch_rejected(self):
        (self.cache / "snaps/core24_1.snap").write_bytes(b"corrupted")
        with self.assertRaisesRegex(ValueError, "checksum"):
            builder.validate_cache(self.cache)

    def test_assertion_binding_checked_after_checksums(self):
        path = self.cache / "snaps/core24_1.assert"
        path.write_text(path.read_text().replace("snap-revision: 1", "snap-revision: 2"))
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "signed revision"):
            builder.validate_cache(self.cache)

    def test_invalid_manifest_field_types_rejected(self):
        for field, value in (("debs", {}), ("snaps", [None]), ("sha256", []),
                             ("requested_debs", "cage"), ("prepared_at", True)):
            with self.subTest(field=field):
                manifest = dict(self.manifest, **{field: value})
                (self.cache / "manifest.json").write_text(json.dumps(manifest))
                with self.assertRaises(ValueError):
                    builder.validate_cache(self.cache)


class BootAndCI(unittest.TestCase):
    def test_ci_refuses_before_arguments_or_filesystem_access(self):
        with patch.dict("os.environ", {"CI": "true"}), patch.object(builder.argparse, "ArgumentParser") as parser, patch.object(Path, "resolve") as resolve:
            with self.assertRaisesRegex(ValueError, "excluded from CI"):
                builder.main()
            parser.assert_not_called()
            resolve.assert_not_called()

    def test_grub_seed_semicolon_is_escaped(self):
        config = builder.boot_config("set timeout=30\n linux /casper/vmlinuz quiet ---\n initrd /casper/initrd\n")
        self.assertIn("ds=nocloud\\;s=/cdrom/shutteros-seed/", config)
        self.assertIn("network-config=disabled ---", config)
        self.assertIn("set timeout=10", config)
        self.assertEqual(config.count(" autoinstall "), 1)

    def test_grub_without_supported_kernel_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "kernel entry"):
            builder.boot_config("linux /unrelated/kernel\n")


if __name__ == "__main__":
    unittest.main()
