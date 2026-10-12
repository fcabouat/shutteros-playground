#!/usr/bin/env python3
"""Verify boot ordering without starting system services or a VM."""
import configparser
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import unittest

DIRECTORY = Path(__file__).resolve().parents[1]


class FirstbootStartupTests(unittest.TestCase):
    def test_unit_starts_without_waiting_for_script_completion_and_bounds_runtime(self):
        config = configparser.ConfigParser(interpolation=None, strict=False)
        config.read(DIRECTORY / "shutteros-firstboot.service")
        self.assertEqual(config["Service"]["Type"], "exec")
        self.assertEqual(config["Service"]["RuntimeMaxSec"], "20min")
        self.assertEqual(config["Service"]["TimeoutStartSec"], "60s")
        self.assertEqual(config["Service"]["RemainAfterExit"], "yes")
        self.assertEqual(config["Install"]["WantedBy"], "multi-user.target")
        self.assertNotIn("cloud-final.service", config["Unit"]["After"].split())
        self.assertNotIn("ExecStartPre", config["Service"])

    @unittest.skipUnless(shutil.which("systemd-analyze"), "requires offline systemd verifier")
    def test_systemd_accepts_ubuntu_cloud_final_order_and_reproduces_old_cycle(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            units = root / "usr/lib/systemd/system"
            units.mkdir(parents=True)
            (root / "bin").mkdir()
            for name in ("bash", "true"):
                binary = root / "bin" / name
                binary.write_text("#!/bin/sh\nexit 0\n")
                binary.chmod(0o755)
            for name in ("sysinit.target", "basic.target", "shutdown.target"):
                (units / name).write_text("[Unit]\nDefaultDependencies=no\n")
            (units / "multi-user.target").write_text("[Unit]\nWants=shutteros-firstboot.service cloud-init.target\n")
            (units / "cloud-init.target").write_text("[Unit]\nDefaultDependencies=no\nWants=cloud-final.service\n")
            # Ubuntu's real cloud-final ordering is the edge which caused the
            # observed cycle; no cloud-init code or systemd jobs run here.
            (units / "cloud-final.service").write_text("[Unit]\nAfter=multi-user.target\n[Service]\nType=oneshot\nExecStart=/bin/true\n")
            for name in ("systemd-logind.service", "snapd.service", "getty@.service"):
                (units / name).write_text("[Service]\nType=exec\nExecStart=/bin/true\n")
            (units / "snapd.socket").write_text("[Socket]\nListenStream=/run/snapd.socket\n")
            text = (DIRECTORY / "shutteros-firstboot.service").read_text()
            unit = units / "shutteros-firstboot.service"
            unit.write_text(text)
            command = ["systemd-analyze", "--root=" + str(root), "verify", "--man=no",
                       "multi-user.target", "shutteros-firstboot.service", "cloud-final.service"]
            result = subprocess.run(command, text=True, capture_output=True, timeout=15)
            self.assertEqual(result.returncode, 0, result.stderr)
            old = text.replace("After=systemd-logind.service snapd.socket snapd.service",
                               "After=systemd-logind.service snapd.socket snapd.service cloud-final.service")
            unit.write_text(old)
            result = subprocess.run(command, text=True, capture_output=True, timeout=15)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("ordering cycle", result.stderr.lower())

    def run_script_fixture(self, *, disabled=False, error=False, pause=False):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            payload = root / "payload"
            (payload / "kit").mkdir(parents=True)
            logs, state = root / "logs", root / "state"
            calls, release = root / "calls", root / "release-cloud-init"
            binary = root / "bin"
            binary.mkdir()
            script = (DIRECTORY / "firstboot.sh").read_text()
            script = script.replace("readonly payload=/opt/shutteros-provisioning", "readonly payload=" + str(payload))
            script = script.replace("readonly state=/var/lib/shutteros-provisioning", "readonly state=" + str(state))
            script = script.replace("/var/log/shutteros-provisioning", str(logs))
            script = script.replace("PATH=/usr/sbin:/usr/bin:/sbin:/bin", "PATH=" + str(binary) + ":/usr/sbin:/usr/bin:/sbin:/bin")
            test_script = root / "firstboot.sh"
            test_script.write_text(script)
            wrappers = {
                "id": "#!/bin/sh\nprintf '0\\n'\n",
                "python3": "#!/bin/sh\n"
                           "[ \"${PATH##*:}\" = /snap/bin ] || exit 91\n"
                           "printf '%s\\n' \"$3\" >> \"$FIRSTBOOT_CALLS\"\n",
                "ssh-keygen": "#!/bin/sh\nprintf 'ssh-keygen\\n' >> \"$FIRSTBOOT_CALLS\"\n",
                "systemctl": "#!/bin/sh\nprintf 'systemctl %s\\n' \"$*\" >> \"$FIRSTBOOT_CALLS\"\n",
                "cloud-init": "#!/bin/sh\nprintf 'cloud-init-wait\\n' >> \"$FIRSTBOOT_CALLS\"\n"
                              "while [ ! -e \"$CLOUD_INIT_RELEASE\" ]; do sleep 0.01; done\n"
                              "printf 'status: %s\\n' \"$CLOUD_INIT_STATUS\"\n"
                              "printf 'cloud-init-return\\n' >> \"$FIRSTBOOT_CALLS\"\n"
                              "exit \"$CLOUD_INIT_EXIT\"\n",
            }
            for name, content in wrappers.items():
                file = binary / name
                file.write_text(content)
                file.chmod(0o755)
            for name in ("install", "verify"):
                (payload / "kit" / (name + ".sh")).write_text(
                    "#!/bin/sh\nprintf 'kit-" + name + "\\n' >> \"$FIRSTBOOT_CALLS\"\n")
            env = dict(os.environ, FIRSTBOOT_CALLS=str(calls), CLOUD_INIT_RELEASE=str(release),
                       CLOUD_INIT_STATUS="disabled" if disabled else "error" if error else "done",
                       CLOUD_INIT_EXIT="2" if error else "0")
            if not pause:
                release.touch()
            process = subprocess.Popen(["/bin/bash", str(test_script)], env=env, text=True,
                                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            try:
                if pause:
                    deadline = time.monotonic() + 3
                    while (not calls.exists() or "cloud-init-wait" not in calls.read_text()) and time.monotonic() < deadline:
                        time.sleep(0.01)
                    self.assertIsNone(process.poll())
                    self.assertEqual(calls.read_text().splitlines(), ["verify", "cloud-init-wait"])
                    self.assertFalse((state / "success").exists())
                    release.touch()
                output, _ = process.communicate(timeout=5)
                events = calls.read_text().splitlines()
                self.assertEqual(process.returncode, 2 if error else 0, output)
                self.assertEqual((state / "success").exists(), not error)
                self.assertLess(events.index("cloud-init-wait"), events.index("cloud-init-return"))
                if error:
                    self.assertNotIn("hostname", events)
                    self.assertNotIn("install-snaps", events)
                    self.assertNotIn("systemctl disable shutteros-firstboot.service", events)
                    self.assertIn("Provisioning failed", output)
                else:
                    self.assertLess(events.index("cloud-init-return"), events.index("hostname"))
                    self.assertLess(events.index("cloud-init-return"), events.index("install-snaps"))
                    self.assertLess(events.index("kit-verify"), events.index("restore-store"))
                    self.assertEqual(events[-1], "systemctl disable shutteros-firstboot.service")
                    if disabled:
                        self.assertIn("status: disabled", output)
            finally:
                release.touch()
                if process.poll() is None:
                    process.kill()
                    process.communicate(timeout=5)

    def test_running_cloud_init_blocks_mutations_inside_script_only(self):
        self.run_script_fixture(pause=True)

    def test_disabled_cloud_init_does_not_block_administrator_recovery_provisioning(self):
        self.run_script_fixture(disabled=True)

    def test_cloud_init_error_preserves_failed_provisioning_and_missing_marker(self):
        self.run_script_fixture(error=True)


if __name__ == "__main__":
    unittest.main()
