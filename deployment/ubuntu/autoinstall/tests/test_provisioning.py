#!/usr/bin/env python3
"""Small fixture tests; do not install packages, start services, or contact a store."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

DIRECTORY = Path(__file__).resolve().parents[1]


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, DIRECTORY / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


payload = load("payload", "payload.py")
renderer = load("renderer", "render-user-data.py")


class ProvisioningTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / "payload"
        self.root.mkdir()
        self.manifest = {"version": 1, "ubuntu_release": "26.04", "architecture": "amd64",
                         "debs": ["debs/cage.deb"], "snaps": [
                             {"name": name, "revision": "123", "snap": f"snaps/{name}_123.snap",
                              "assert": f"snaps/{name}_123.assert"} for name in ("core24", "chromium")]}
        for name in ("kit/install.sh", "kit/verify.sh", "site/index.html", "site/kiosk-config.json",
                     "kit/autoinstall/firstboot.sh", "kit/autoinstall/shutteros-firstboot.service",
                     "debs/cage.deb", "snaps/core24_123.snap", "snaps/core24_123.assert",
                     "snaps/chromium_123.snap", "snaps/chromium_123.assert"):
            path = self.root / name
            path.parent.mkdir(exist_ok=True, parents=True)
            path.write_text("fixture\n")
        self.resign()

    def tearDown(self):
        self.temp.cleanup()

    def resign(self):
        (self.root / "manifest.json").write_text(json.dumps(self.manifest))
        lines = []
        for path in sorted(self.root.rglob("*")):
            if path.is_file() and path.name != "SHA256SUMS":
                lines.append(hashlib.sha256(path.read_bytes()).hexdigest() + "  " + str(path.relative_to(self.root)))
        (self.root / "SHA256SUMS").write_text("\n".join(lines) + "\n")

    def set_core_revision(self, revision):
        entry = self.manifest["snaps"][0]
        for key, suffix in (("snap", ".snap"), ("assert", ".assert")):
            updated = f"snaps/core24_{revision}{suffix}"
            (self.root / entry[key]).rename(self.root / updated)
            entry[key] = updated
        entry["revision"] = revision
        self.resign()

    def test_checksums_cover_every_file(self):
        self.assertEqual(payload.validate(self.root), self.manifest)
        (self.root / "undeclared-file").write_text("extra")
        with self.assertRaisesRegex(ValueError, "every payload file"):
            payload.validate(self.root)

    def test_modified_site_refused(self):
        (self.root / "site/index.html").write_text("changed")
        with self.assertRaisesRegex(ValueError, "checksum mismatch"):
            payload.validate(self.root)

    def test_traversal_and_symlink_refused(self):
        self.manifest["debs"] = ["debs/../../outside.deb"]
        self.resign()
        with self.assertRaisesRegex(ValueError, "unsafe payload path"):
            payload.validate(self.root)
        (self.root / "link").symlink_to(self.root / "site/index.html")
        with self.assertRaisesRegex(ValueError, "link or special file"):
            payload.validate(self.root)

    def test_chromium_must_follow_dependencies(self):
        self.manifest["snaps"].reverse()
        self.resign()
        with self.assertRaisesRegex(ValueError, "Chromium must follow"):
            payload.validate(self.root)

    def test_local_apt_command_cannot_fetch(self):
        def inspect_sources(*args, **kwargs):
            if args[0] == "apt-get":
                sources = Path(next(arg.split("=", 1)[1] for arg in args if arg.startswith("Dir::Etc::sourcelist=")))
                parts = Path(next(arg.split("=", 1)[1] for arg in args if arg.startswith("Dir::Etc::sourceparts=")))
                lists = Path(next(arg.split("=", 1)[1] for arg in args if arg.startswith("Dir::State::lists=")))
                self.assertTrue(sources.is_file())
                self.assertEqual(sources.read_text(), "")
                self.assertEqual(list(parts.iterdir()), [])
                self.assertEqual(list(lists.iterdir()), [])
            return ""

        with patch.object(payload, "target_matches"), patch.object(payload, "run", side_effect=inspect_sources) as run, \
             patch.object(payload.subprocess, "check_output", side_effect=lambda args, **kwargs:
                          "cage\n" if args[0] == "dpkg-deb" else "install ok installed"):
            payload.install_debs(self.root, self.manifest)
        preflight, install = (run.call_args_list[index].args for index in (0, 1))
        for apt in (preflight, install):
            for option in ("--no-remove", "--no-install-recommends",
                           "Dir::Cache::pkgcache=", "Dir::Cache::srcpkgcache=", "Dpkg::Use-Pty=0"):
                self.assertIn(option, apt)
            self.assertTrue(any(arg.startswith("Dir::State::lists=") for arg in apt))
            self.assertTrue(any(arg.startswith("Dir::Etc::sourceparts=/") for arg in apt))
            self.assertTrue(any(arg.startswith("Dir::Etc::sourcelist=/") for arg in apt))
            self.assertNotIn("Dir::Etc::sourceparts=-", apt)
            self.assertNotIn("Dir::Etc::sourcelist=/dev/null", apt)
            self.assertIn(str(self.root / "debs/cage.deb"), apt)
        self.assertIn("--print-uris", preflight)
        self.assertIn("--download-only", preflight)
        self.assertNotIn("--no-download", install)
        self.assertNotIn("--download-only", install)

    def test_apt_uri_guard_accepts_manifest_files_only(self):
        allowed = "'file:" + str(self.root / "debs/cage.deb") + "' cage_1_amd64.deb 12 \n"
        self.assertEqual(payload.verify_apt_uris(allowed, self.root, self.manifest), 1)
        for uri in ("https://archive.ubuntu.com/package.deb", "file:/tmp/unlisted.deb",
                    "file://remote-host" + str(self.root / "debs/cage.deb"),
                    "file:" + str(self.root / "debs/cage.deb") + "?query=1"):
            with self.subTest(uri=uri), self.assertRaises(ValueError):
                payload.verify_apt_uris("'" + uri + "' cage_1_amd64.deb 12 \n", self.root, self.manifest)

    def test_grub_reconciled_after_all_package_readiness_checks_and_clean_audit(self):
        events = []

        def fake_run(*args, **kwargs):
            events.append(args)
            return ""

        def fake_read(args, **kwargs):
            events.append(tuple(args))
            return "cage\n" if args[0] == "dpkg-deb" else "install ok installed"

        with patch.object(payload, "target_matches"), patch.object(payload, "run", side_effect=fake_run), \
             patch.object(payload.subprocess, "check_output", side_effect=fake_read):
            payload.install_debs(self.root, self.manifest)
        audit = events.index(("dpkg", "--audit"))
        grub = events.index(("/usr/sbin/update-grub",))
        readiness = [i for i, event in enumerate(events) if event[0] == "dpkg-query"]
        self.assertEqual(len(readiness), 7)
        self.assertLess(max(readiness), audit)
        self.assertLess(audit, grub)
        self.assertEqual(grub, len(events) - 1)

    def test_incomplete_package_configuration_never_regenerates_grub(self):
        def fake_run(*args, **kwargs):
            return "pending package configuration\n" if args == ("dpkg", "--audit") else ""

        with patch.object(payload, "target_matches"), patch.object(payload, "run", side_effect=fake_run) as run, \
             patch.object(payload.subprocess, "check_output", side_effect=lambda args, **kwargs:
                          "cage\n" if args[0] == "dpkg-deb" else "install ok installed"):
            with self.assertRaisesRegex(ValueError, "incomplete package configuration"):
                payload.install_debs(self.root, self.manifest)
        self.assertFalse(any(call.args[0] == "/usr/sbin/update-grub" for call in run.call_args_list))

    def test_remote_apt_uri_refused_before_install(self):
        with patch.object(payload, "target_matches"), \
             patch.object(payload, "run", return_value="'https://archive.ubuntu.com/package.deb' package.deb 12 \n") as run, \
             patch.object(payload.subprocess, "check_output", return_value="cage\n"):
            with self.assertRaisesRegex(ValueError, "outside the local offline payload"):
                payload.install_debs(self.root, self.manifest)
        self.assertEqual(run.call_count, 1)

    def test_large_apt_commands_and_errors_have_compact_summaries(self):
        args = ["apt-get", "--no-remove", "install", *[f"/payload/debs/package-{i}.deb" for i in range(311)]]
        summary = payload.command_summary(args)
        self.assertIn("311 local DEBs", summary)
        self.assertLess(len(summary), 120)
        message = payload.failure_message(subprocess.CalledProcessError(100, args))
        self.assertIn("exit status 100", message)
        self.assertNotIn("package-310", message)

    @unittest.skipUnless(shutil.which("apt-get") and shutil.which("dpkg-deb"), "requires APT fixture tools")
    def test_real_apt_file_uri_and_acquisition_download_only(self):
        # A sub-kilobyte synthetic DEB is only acquired, never installed. Its
        # epoch demonstrates why APT's archive filename differs from the source.
        package = Path(self.temp.name) / "fixture-package"
        (package / "DEBIAN").mkdir(parents=True)
        (package / "DEBIAN/control").write_text(
            "Package: shutteros-offline-fixture\nVersion: 1:2\nArchitecture: amd64\n"
            "Maintainer: Fixture <fixture@example.invalid>\nDescription: never installed\n")
        deb = self.root / "debs/fixture_1_epoch_2_amd64.deb"
        subprocess.run(["dpkg-deb", "--build", str(package), str(deb)],
                       check=True, capture_output=True, timeout=15)
        work = Path(self.temp.name) / "isolated-apt"
        for directory in ("state", "lists/partial", "archives/partial", "cache", "log", "etc/sources"):
            (work / directory).mkdir(parents=True)
        status = work / "state/status"
        status.write_text("")
        config = work / "etc/apt.conf"
        config.write_text('Dir::Etc::main "/dev/null";\nDir::Etc::parts "-";\n')
        sources = work / "etc/sources.list"
        sources.write_text("")
        options = {"Dir::State": work / "state", "Dir::State::status": status,
                   "Dir::State::lists": work / "lists", "Dir::Cache": work / "cache",
                   "Dir::Cache::archives": work / "archives", "Dir::Log": work / "log",
                   "Dir::Etc::sourcelist": sources, "Dir::Etc::sourceparts": work / "etc/sources",
                   "Dir::Etc::main": "/dev/null", "Dir::Etc::parts": "-",
                   "Dir::Cache::pkgcache": "", "Dir::Cache::srcpkgcache": "",
                   "APT::Sandbox::User": "root", "Dpkg::Use-Pty": "0"}
        args = ["apt-get", "--download-only", "--no-remove", "--no-install-recommends", "-y"]
        for key, value in options.items():
            args.extend(("-o", f"{key}={value}"))
        env = dict(os.environ, APT_CONFIG=str(config), LC_ALL="C")
        printed = subprocess.run([*args, "--print-uris", "install", str(deb)], env=env,
                                 capture_output=True, text=True, check=True, timeout=30)
        self.assertEqual(payload.verify_apt_uris(printed.stdout, self.root,
                         {"debs": ["debs/fixture_1_epoch_2_amd64.deb"]}), 1)
        self.assertIn("shutteros-offline-fixture_1%3a2_amd64.deb", printed.stdout)
        acquired = subprocess.run([*args, "install", str(deb)], env=env,
                                  capture_output=True, text=True, check=True, timeout=30)
        self.assertIn("download only mode", acquired.stdout.lower())
        self.assertEqual(status.read_text(), "")

    def test_apt_refusal_aborts_before_package_readiness_checks(self):
        def refuse_removal(*args, **kwargs):
            self.assertEqual(args[0], "apt-get")
            self.assertIn("--no-remove", args)
            raise subprocess.CalledProcessError(100, args)

        with patch.object(payload, "target_matches"), patch.object(payload, "run", side_effect=refuse_removal), \
             patch.object(payload.subprocess, "check_output", return_value="cage\n") as read:
            with self.assertRaises(subprocess.CalledProcessError):
                payload.install_debs(self.root, self.manifest)
        self.assertEqual(read.call_count, 1)
        self.assertEqual(read.call_args.args[0][0], "dpkg-deb")

    def test_snap_offline_ack_order_and_restore(self):
        saved = Path(self.temp.name) / "state/store.json"
        calls = []

        def fake_run(*args, **kwargs):
            calls.append(args)
            return f"Name Version Rev Tracking Publisher Notes\n{args[2]} 1 123 - canonical -\n" if args[1] == "list" else ""

        with patch.object(payload, "target_matches"), patch.object(payload, "run", side_effect=fake_run), \
             patch.object(payload.subprocess, "check_output", return_value="{}"), \
             patch.object(payload.subprocess, "run", return_value=subprocess.CompletedProcess([], 1, "", "")):
            payload.install_snaps(self.root, self.manifest, saved)
            payload.restore_store(saved)
        self.assertEqual(calls[0], ("snap", "set", "system", "store.access=offline"))
        self.assertEqual([call[2] for call in calls if call[1] == "install"],
                         [str(self.root / snap["snap"]) for snap in self.manifest["snaps"]])
        self.assertEqual(len([call for call in calls if call[1] == "ack"]), 2)
        self.assertIn(("snap", "connect", "chromium:etc-chromium-browser-policies"), calls)
        self.assertEqual(calls[-1], ("snap", "unset", "system", "store.access"))

    def test_snap_failure_does_not_restore_online_access(self):
        saved = Path(self.temp.name) / "state/store.json"
        calls = []

        def fake_run(*args, **kwargs):
            calls.append(args)
            if args[1] == "install":
                raise subprocess.CalledProcessError(1, args)
            return ""

        with patch.object(payload, "target_matches"), patch.object(payload, "run", side_effect=fake_run), \
             patch.object(payload.subprocess, "check_output", return_value="{}"), \
             patch.object(payload.subprocess, "run", return_value=subprocess.CompletedProcess([], 1, "", "")):
            with self.assertRaises(subprocess.CalledProcessError):
                payload.install_snaps(self.root, self.manifest, saved)
        self.assertFalse(any(call[1] == "unset" for call in calls))
        self.assertEqual(json.loads(saved.read_text()), {"access": None})

    def test_seeded_base_snap_is_updated_from_signed_payload_and_same_revision_skipped(self):
        self.set_core_revision("2124")
        saved = Path(self.temp.name) / "state/store.json"
        calls = []

        def current_listing(name, revision):
            return f"Name Version Rev Tracking Publisher Notes\n{name} 1 {revision} latest/stable canonical -\n"

        def installed(args, **kwargs):
            revision = "1643" if args[2] == "core24" else "123"
            return subprocess.CompletedProcess(args, 0, current_listing(args[2], revision), "")

        def fake_run(*args, **kwargs):
            calls.append(args)
            return current_listing(args[2], "2124" if args[2] == "core24" else "123") if args[1] == "list" else ""

        with patch.object(payload, "target_matches"), patch.object(payload, "run", side_effect=fake_run), \
             patch.object(payload.subprocess, "check_output", return_value="{}"), \
             patch.object(payload.subprocess, "run", side_effect=installed):
            payload.install_snaps(self.root, self.manifest, saved)
        installs = [call for call in calls if call[1] == "install"]
        self.assertEqual(installs, [("snap", "install", str(self.root / "snaps/core24_2124.snap"))])
        self.assertLess(calls.index(("snap", "ack", str(self.root / "snaps/core24_2124.assert"))), calls.index(installs[0]))
        self.assertLess(calls.index(("snap", "set", "system", "store.access=offline")), calls.index(installs[0]))
        self.assertFalse(any(call[1] in {"refresh", "unset"} for call in calls))
        self.assertFalse(any("--dangerous" in call or "--devmode" in call for call in calls))

    def test_local_snap_update_requires_exact_post_install_revision(self):
        self.set_core_revision("2124")
        saved = Path(self.temp.name) / "state/store.json"
        calls = []
        old = "Name Version Rev Tracking Publisher Notes\ncore24 1 1643 latest/stable canonical -\n"

        def fake_run(*args, **kwargs):
            calls.append(args)
            return old if args[1] == "list" else ""

        with patch.object(payload, "target_matches"), patch.object(payload, "run", side_effect=fake_run), \
             patch.object(payload.subprocess, "check_output", return_value="{}"), \
             patch.object(payload.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, old, "")):
            with self.assertRaisesRegex(ValueError, "installed snap revision differs from payload"):
                payload.install_snaps(self.root, self.manifest, saved)
        self.assertIn(("snap", "install", str(self.root / "snaps/core24_2124.snap")), calls)
        self.assertFalse(any(call[1] in {"connect", "unset"} for call in calls))

    def test_credentials_required_storage_interactive(self):
        with self.assertRaisesRegex(ValueError, "password_hash or"):
            renderer.render({"username": "administrator"})
        config = renderer.render({"username": "administrator", "ssh_authorized_keys": ["ssh-ed25519 AAAA fixture"]})["autoinstall"]
        self.assertEqual(config["interactive-sections"], ["storage"])
        self.assertNotIn("storage", config)
        self.assertFalse(config["refresh-installer"]["update"])
        self.assertEqual(config["apt"]["mirror-selection"]["primary"], [])
        self.assertFalse(config["ssh"]["install-server"])
        self.assertEqual(config["identity"]["password"], "!")
        self.assertEqual(config["user-data"]["users"][0]["sudo"], "ALL=(ALL) NOPASSWD:ALL")


if __name__ == "__main__":
    unittest.main()
