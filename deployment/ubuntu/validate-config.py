#!/usr/bin/python3
"""Validate the deployed kiosk-config.json with the public V1 wire contract."""

import json
import re
import sys
from pathlib import Path

REQUIRED = {
    "version",
    "sessionMinutes",
    "challengeSeconds",
    "acceptedPasswords",
    "caseSensitivePasswords",
    "showPasswordHint",
    "organizationName",
    "playerName",
    "supportLabel",
    "supportContact",
    "stationLabel",
    "mailLegitimateAddress",
    "mailImpersonatorAddress",
    "defaultCalmMode",
}
OPTIONAL = {
    "explorationSeconds",
    "idleReminderSeconds",
    "eventIntervalSeconds",
    "organizationLogo",
}
# Python's isspace/strip differs from ECMAScript (notably U+0085 and U+FEFF).
JS_WHITESPACE = "\t\n\v\f\r \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff"
EMAIL_PART = "[^" + re.escape(JS_WHITESPACE) + "@<>]+"
EMAIL = re.compile(EMAIL_PART + "@" + EMAIL_PART + r"\." + EMAIL_PART)
LOGO = re.compile(r"^[a-z0-9][a-z0-9._-]*\.(png|webp|svg)$", re.IGNORECASE | re.ASCII)


def js_length(value: str) -> int:
    """Match JavaScript String.length (UTF-16 code units), including non-BMP text."""
    return len(value.encode("utf-16-le", errors="surrogatepass")) // 2


def reject(condition: bool, message: str, issues: list[str]) -> None:
    if condition:
        issues.append(message)


def number(config: dict, key: str, minimum: int, maximum: int, issues: list[str]) -> None:
    value = config.get(key)
    reject(
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not minimum <= value <= maximum,
        f"{key}: must be a number from {minimum} to {maximum}",
        issues,
    )


def text(config: dict, key: str, maximum: int, issues: list[str]) -> None:
    value = config.get(key)
    reject(
        not isinstance(value, str) or not value.strip(JS_WHITESPACE) or js_length(value) > maximum,
        f"{key}: must be a non-blank string of at most {maximum} characters",
        issues,
    )


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: validate-config.py kiosk-config.json", file=sys.stderr)
        return 2
    try:
        raw = Path(sys.argv[1]).read_bytes()
        if len(raw) > 32768:
            raise ValueError("file exceeds 32768 bytes")
        # Fetch decodes UTF-8 and JavaScript parses every JSON number as binary64.
        config = json.loads(raw.decode("utf-8-sig"), parse_int=float)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
        print(f"kiosk-config.json: {error}", file=sys.stderr)
        return 1
    if not isinstance(config, dict):
        print("kiosk-config.json: root must be an object", file=sys.stderr)
        return 1

    issues: list[str] = []
    unknown = sorted(set(config) - REQUIRED - OPTIONAL)
    missing = sorted(REQUIRED - set(config))
    issues.extend(f"{key}: unknown key" for key in unknown)
    issues.extend(f"{key}: is required" for key in missing)
    reject(
        isinstance(config.get("version"), bool)
        or not isinstance(config.get("version"), (int, float))
        or config.get("version") != 1,
        "version: must equal 1",
        issues,
    )
    number(config, "sessionMinutes", 1, 30, issues)
    number(config, "challengeSeconds", 10, 120, issues)
    for key, minimum, maximum in (
        ("explorationSeconds", 0, 60),
        ("idleReminderSeconds", 10, 300),
        ("eventIntervalSeconds", 30, 300),
    ):
        if key in config:
            number(config, key, minimum, maximum, issues)

    passwords = config.get("acceptedPasswords")
    if not isinstance(passwords, list) or not 1 <= len(passwords) <= 30:
        issues.append("acceptedPasswords: must contain 1 to 30 passwords")
    else:
        for index, value in enumerate(passwords):
            reject(
                not isinstance(value, str) or not value.strip(JS_WHITESPACE) or js_length(value) > 100,
                f"acceptedPasswords[{index}]: must be a non-blank string of at most 100 characters",
                issues,
            )
    for key, maximum in (
        ("organizationName", 80),
        ("playerName", 80),
        ("supportLabel", 80),
        ("supportContact", 120),
        ("stationLabel", 80),
    ):
        text(config, key, maximum, issues)
    for key in ("mailLegitimateAddress", "mailImpersonatorAddress"):
        value = config.get(key)
        reject(
            not isinstance(value, str)
            or not 3 <= js_length(value) <= 120
            or EMAIL.fullmatch(value) is None,
            f"{key}: must be a simple email address from 3 to 120 characters",
            issues,
        )
    for key in ("caseSensitivePasswords", "showPasswordHint", "defaultCalmMode"):
        reject(type(config.get(key)) is not bool, f"{key}: must be a boolean", issues)
    if "organizationLogo" in config:
        value = config["organizationLogo"]
        reject(
            not isinstance(value, str) or js_length(value) > 120 or LOGO.fullmatch(value) is None,
            "organizationLogo: must be a local PNG, WebP, or SVG filename",
            issues,
        )
    if issues:
        print("invalid kiosk-config.json:\n  " + "\n  ".join(issues), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
