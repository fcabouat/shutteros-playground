#!/usr/bin/env python3
"""Check that first boot respects a hostname entered in Subiquity."""

import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch


SOURCE = Path(__file__).resolve().parents[1] / "payload.py"
spec = importlib.util.spec_from_file_location("offline_payload_hostname", SOURCE)
payload = importlib.util.module_from_spec(spec)
spec.loader.exec_module(payload)


class HostnameTests(unittest.TestCase):
    def test_interactive_administrator_keeps_installer_hostname(self):
        with patch.object(payload, "Path", side_effect=AssertionError("read target hostname files")), \
             patch.object(payload, "run", side_effect=AssertionError("replace installer hostname")):
            payload.set_hostname({"admin_interactive": True, "hostname_prefix": "shutteros"})


if __name__ == "__main__":
    unittest.main()
