#!/usr/bin/env python3
"""Exercise corruption and write failures in temporary files, never host services."""
import importlib.util
import io
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

KIT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("integrity", KIT / "site-integrity.py")
integrity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(integrity)


class SiteIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.site = self.root / "site"
        (self.site / "_app").mkdir(parents=True)
        (self.site / "index.html").write_bytes(b"<html>game</html>")
        (self.site / "kiosk-config.json").write_text("{}")
        (self.site / "_app/game.js").write_text("console.log(1);")
        self.manifest = self.root / "site.json"
        integrity.record(self.site, self.manifest)

    def test_intact_tree_and_empty_optional_file_are_supported(self):
        (self.site / "optional.txt").touch()
        integrity.record(self.site, self.manifest)
        integrity.verify(self.site, self.manifest)

    def test_missing_empty_or_changed_asset_is_detected(self):
        path = self.site / "_app/game.js"
        for content in (None, "", "console.log(2);"):
            with self.subTest(content=content):
                if content is None:
                    path.unlink()
                else:
                    path.write_text(content)
                with self.assertRaisesRegex(ValueError, "_app/game.js"):
                    integrity.verify(self.site, self.manifest)

    def test_empty_entry_points_are_rejected_even_when_recording(self):
        for name in ("index.html", "kiosk-config.json"):
            with self.subTest(name=name):
                original = (self.site / name).read_bytes()
                (self.site / name).write_bytes(b"")
                with self.assertRaisesRegex(ValueError, "missing or empty"):
                    integrity.record(self.site, self.manifest)
                (self.site / name).write_bytes(original)

    def test_inventory_missing_or_empty_is_not_a_success(self):
        for content in ("", "{}", '{"version": 1, "files": {}}'):
            self.manifest.write_text(content)
            with self.assertRaises(ValueError):
                integrity.verify(self.site, self.manifest)
        self.manifest.unlink()
        with self.assertRaisesRegex(ValueError, "inventory is missing"):
            integrity.verify(self.site, self.manifest)

    def test_additional_file_and_link_are_rejected(self):
        extra = self.site / "extra"
        extra.write_text("extra")
        with self.assertRaisesRegex(ValueError, "unexpected"):
            integrity.verify(self.site, self.manifest)
        extra.unlink()
        extra.symlink_to(self.root)
        with self.assertRaisesRegex(ValueError, "link or special file"):
            integrity.record(self.site, self.manifest)

    def test_inventory_cannot_be_part_of_served_site(self):
        with self.assertRaisesRegex(ValueError, "outside"):
            integrity.record(self.site, self.site / "inventory.json")

    def test_http_200_requires_exact_nonempty_index_and_no_redirect(self):
        expected = (self.site / "index.html").read_bytes()
        for body, status, url, accepted in (
            (expected, 200, "http://127.0.0.1:8080/", True),
            (b"", 200, "http://127.0.0.1:8080/", False),
            (b"different", 200, "http://127.0.0.1:8080/", False),
            (expected + b"extra", 200, "http://127.0.0.1:8080/", False),
            (expected, 500, "http://127.0.0.1:8080/", False),
            (expected, 200, "http://127.0.0.1:8080/other", False),
        ):
            with self.subTest(body=body, status=status, url=url):
                response = io.BytesIO(body)
                response.status = status
                response.geturl = lambda: url
                with patch.object(integrity, "build_opener") as opener:
                    opener.return_value.open.return_value = response
                    if accepted:
                        integrity.verify_http(self.site)
                    else:
                        with self.assertRaisesRegex(ValueError, "HTTP response"):
                            integrity.verify_http(self.site)


class DurableFileTests(unittest.TestCase):
    def test_injected_copy_or_sync_failure_preserves_previous_file(self):
        for failure in ("none", "copy", "sync"):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                source, target = root / "source", root / "target"
                source.write_text("new complete file\n")
                target.write_text("previous complete file\n")
                binary = root / "bin"
                binary.mkdir()
                # Drop owner arguments only in this unprivileged fixture.
                install = binary / "install"
                install.write_text("#!/usr/bin/python3\nimport os, sys\n"
                                   "args = sys.argv[1:]\n"
                                   "while '-o' in args or '-g' in args:\n"
                                   "    i = args.index('-o') if '-o' in args else args.index('-g')\n"
                                   "    del args[i:i+2]\n"
                                   "if os.environ['FAILURE'] == 'copy':\n"
                                   "    open(args[-1], 'w').close()\n"
                                   "else:\n"
                                   "    os.execv('/usr/bin/install', ['install', *args])\n")
                install.chmod(0o755)
                sync = binary / "sync"
                sync.write_text("#!/bin/sh\n"
                                "[ \"$FAILURE\" != sync ] || exit 24\n"
                                "exec /usr/bin/sync \"$@\"\n")
                sync.chmod(0o755)
                script = root / "test.sh"
                script.write_text('. "$1"\nkiosk_install_file "$2" "$3" 0644\n')
                result = subprocess.run(["sh", str(script), str(KIT / "durable-files.sh"),
                                         str(source), str(target)], capture_output=True, text=True,
                                        env=dict(os.environ, PATH=str(binary) + ":/usr/bin:/bin", FAILURE=failure))
                self.assertEqual(result.returncode == 0, failure == "none", result.stderr)
                self.assertEqual(target.read_text(), source.read_text() if failure == "none" else "previous complete file\n")
                self.assertFalse(list(root.glob(".shutteros-file.*")))


if __name__ == "__main__":
    unittest.main()
