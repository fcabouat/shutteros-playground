#!/usr/bin/env python3
"""Render NoCloud user-data from administrator-supplied JSON without shared credentials."""
import argparse
import json
from pathlib import Path
import re
import sys


def render(admin: dict) -> dict:
    if not isinstance(admin, dict):
        raise ValueError("administrator configuration must be a JSON object")
    username = admin.get("username", "")
    if not isinstance(username, str) or not re.fullmatch(r"[a-z_][a-z0-9_-]{0,30}", username):
        raise ValueError("provide a valid local administrator username")
    if username in {"root", "shutteros-kiosk", "shutteros-static"}:
        raise ValueError("administrator username conflicts with a reserved account")
    password = admin.get("password_hash", "")
    keys = admin.get("ssh_authorized_keys", [])
    if not isinstance(password, str) or (password and not re.fullmatch(r"\$(?:6|y)\$[^\s:]+", password)):
        raise ValueError("password_hash must be a SHA-512 or yescrypt passwd hash")
    if not isinstance(keys, list) or any(not isinstance(key, str) or not re.fullmatch(
            r"(?:ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(?:256|384|521)) [A-Za-z0-9+/]+={0,3}(?: [^\r\n]+)?", key) for key in keys):
        raise ValueError("ssh_authorized_keys must contain SSH public keys")
    if not password and not keys:
        raise ValueError("provide a password_hash or at least one SSH public key")
    prefix = admin.get("hostname_prefix", "shutteros")
    if not isinstance(prefix, str) or not re.fullmatch(r"[a-z][a-z0-9-]{0,39}", prefix) or prefix.endswith("-"):
        raise ValueError("hostname_prefix must be a valid lowercase hostname prefix")
    locale = admin.get("locale", "en_US.UTF-8")
    layout = admin.get("keyboard_layout", "us")
    variant = admin.get("keyboard_variant", "")
    if not isinstance(locale, str) or not re.fullmatch(r"[A-Za-z0-9_.@-]+", locale):
        raise ValueError("invalid locale")
    if not isinstance(layout, str) or not re.fullmatch(r"[A-Za-z0-9,_+-]+", layout):
        raise ValueError("invalid keyboard layout")
    if not isinstance(variant, str) or not re.fullmatch(r"[A-Za-z0-9,_+-]*", variant):
        raise ValueError("invalid keyboard variant")
    # JSON is a strict YAML subset; using JSON encoding also protects hashes and keys.
    config = {
        "version": 1,
        "interactive-sections": ["storage"],
        "refresh-installer": {"update": False},
        "locale": locale,
        "keyboard": {"layout": layout, "variant": variant},
        "source": {"id": "ubuntu-server", "search_drivers": False},
        "drivers": {"install": False},
        "codecs": {"install": False},
        "network": {"version": 2, "ethernets": {
            "offline": {"match": {"name": "*"}, "dhcp4": False, "dhcp6": False,
                        "link-local": [], "optional": True}}},
        "apt": {"mirror-selection": {"primary": []}, "fallback": "offline-install", "geoip": False},
        "identity": {"hostname": prefix + "-install", "username": username, "password": password or "!"},
        # openssh-server and all dependencies are installed from payload DEBs in late-commands.
        "ssh": {"install-server": False, "authorized-keys": keys, "allow-pw": bool(password)},
        "updates": "security",
        "shutdown": "reboot",
        "late-commands": [["/bin/bash", "/cdrom/shutteros-payload/kit/autoinstall/late-command.sh"]],
        "user-data": {
            "disable_root": True,
            "preserve_hostname": True,
            "ssh_deletekeys": False,
            # Target network becomes usable for administrator recovery on first boot;
            # the installer remains offline, and package installation never uses it.
            "write_files": [{"path": "/etc/netplan/90-shutteros-recovery.yaml", "permissions": "0600",
                             "content": "network:\n  version: 2\n  ethernets:\n    offline:\n      match:\n        name: '*'\n      dhcp4: true\n      dhcp6: false\n      optional: true\n"}],
            "runcmd": [["netplan", "apply"]],
        },
    }
    if not password:
        config["user-data"]["users"] = [{
            "name": username, "lock_passwd": True,
            "sudo": "ALL=(ALL) NOPASSWD:ALL", "ssh_authorized_keys": keys,
        }]
    return {"autoinstall": config}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("admin_config", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    content = "#cloud-config\n" + json.dumps(render(json.loads(args.admin_config.read_text())), indent=2) + "\n"
    if args.output:
        # The file contains password hashes; it must not be world-readable on the build host.
        args.output.touch(mode=0o600, exist_ok=True)
        args.output.chmod(0o600)
        args.output.write_text(content)
    else:
        sys.stdout.write(content)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, TypeError) as error:
        print(f"Invalid administrator configuration: {error}", file=sys.stderr)
        sys.exit(1)
