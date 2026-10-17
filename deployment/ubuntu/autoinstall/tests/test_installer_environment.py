#!/usr/bin/env python3
"""The installer hook must retain Subiquity's bundled curtin environment."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

HOOK = Path(__file__).resolve().parents[1] / "late-command.sh"


class InstallerEnvironmentTests(unittest.TestCase):
    def test_snap_bundled_curtin_uses_inherited_path_and_pythonpath(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            payload = root / "payload"
            kit = payload / "kit/autoinstall"
            kit.mkdir(parents=True)
            (kit / "payload.py").write_text("# Fixture checksum verifier: environment behavior is under test.\n")
            (kit / "shutteros-firstboot.service").write_text("[Unit]\nDescription=Fixture\n")
            target = root / "target"
            (target / "etc/systemd/system").mkdir(parents=True)
            snap_bin = root / "snap/subiquity/current/bin"
            snap_bin.mkdir(parents=True)
            marker = root / "curtin-invocation"
            wrappers = {
                "id": "#!/bin/sh\nprintf '0\\n'\n",
                "chown": "#!/bin/sh\nexit 0\n",
                "systemctl": "#!/bin/sh\nexit 0\n",
                "curtin": "#!/bin/sh\nset -eu\n"
                          "[ \"$PYTHONPATH\" = \"$SUBIQUITY_FIXTURE_PYTHONPATH\" ]\n"
                          "printf '%s\\n' \"$@\" > \"$CURTIN_FIXTURE_MARKER\"\n",
            }
            for name, content in wrappers.items():
                path = snap_bin / name
                path.write_text(content)
                path.chmod(0o755)
            pythonpath = str(root / "snap/subiquity/current/lib/python3.12/site-packages")
            env = dict(os.environ, PATH=str(snap_bin) + ":/usr/sbin:/usr/bin:/sbin:/bin",
                       PYTHONPATH=pythonpath, SUBIQUITY_FIXTURE_PYTHONPATH=pythonpath,
                       CURTIN_FIXTURE_MARKER=str(marker))
            result = subprocess.run(["/bin/bash", str(HOOK), str(payload), str(target)],
                                    env=env, capture_output=True, text=True, timeout=30)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(marker.read_text().splitlines(), [
                "in-target", "--target=" + str(target), "--", "/bin/sh",
                "/opt/shutteros-provisioning/kit/autoinstall/install-packages.sh",
            ])
            self.assertTrue((target / "etc/systemd/system/shutteros-firstboot.service").is_file())


if __name__ == "__main__":
    unittest.main()
