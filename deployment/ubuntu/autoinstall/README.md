# Offline installation contract

The ISO builder supplies `/shutteros-payload/` with `kit/` (the contents of
`deployment/ubuntu/`), compiled `site/`, `debs/`, `snaps/`, `manifest.json`, and
`SHA256SUMS`. The checksum file uses `sha256sum` text format with paths relative
to the payload root and covers every regular file except itself. Links and
special files are refused. Checksums detect corruption; they do not authenticate
an untrusted ISO.

The manifest has this shape; the actual builder records all dependencies and
their exact downloaded revisions:

```json
{
  "version": 1,
  "ubuntu_release": "26.04",
  "architecture": "amd64",
  "hostname_prefix": "shutteros",
  "debs": ["debs/package_version_amd64.deb"],
  "snaps": [
    {
      "name": "core24",
      "revision": "123",
      "snap": "snaps/core24_123.snap",
      "assert": "snaps/core24_123.assert"
    },
    {
      "name": "chromium",
      "revision": "456",
      "snap": "snaps/chromium_456.snap",
      "assert": "snaps/chromium_456.assert"
    }
  ]
}
```

The ordered snap array must include every base and default content provider
before its consumers, with Chromium last. Each snap is installed from its
asserted local file, without `--dangerous`, `--devmode`, or sandbox exceptions.
An existing snap at the recorded revision is kept. A snap preseeded by the ISO at
a different revision is updated using `snap install` on the signed local file;
the resulting revision must match the manifest exactly before provisioning
continues. The `chromium-browser`
transitional DEB is refused because it downloads Chromium from the store.

The dependency cache is tied to the exact official base ISO, not just the Ubuntu
release. Run the preparer in the supplied Ubuntu 26.04 amd64 environment with
`--base-iso /path/to/ubuntu-26.04.1-live-server-amd64.iso --output /path/to/new-cache`;
place Ubuntu's verified published `SHA256SUMS` beside the ISO. The preparer reads
the `ubuntu-server` filesystem identified by `casper/install-sources.yaml` and
extracts its complete dpkg status without mounting it or changing the host OS.
It downloads the complete dependency closure using an empty isolated dpkg status,
then resolves those local DEBs against the ISO's real installed packages, with
every baseline package named explicitly and APT `--no-remove`. This can include
updates to baseline packages needed to keep exact version dependencies coherent.
Finally, it simulates the complete local installation with no repository lists,
`--no-download`, and `--no-remove`. The manifest records `base_iso_sha256`,
`base_iso_name`, `base_status_sha256` and `baseline_compatible: true`; the builder
refuses a different ISO. An old cache without this compatibility check must be
prepared again or explicitly repaired before assembly. DEB repair retains the
downloaded signed snaps and reruns the same baseline compatibility check.

Generate NoCloud `user-data` using
`python3 -B kit/autoinstall/render-user-data.py ADMIN.json --output user-data`.
Administrator JSON requires `username` and either `password_hash` (SHA-512 or
yescrypt) or `ssh_authorized_keys` (an array of public keys). Optional fields are
`hostname_prefix`, `locale`, `keyboard_layout`, and `keyboard_variant`. A key-only
administrator has a locked password and passwordless sudo. Password hashes and
public keys are written into the installation media, so protect that media and
the configuration. No shared real credentials are embedded in this repository.

The generated config keeps storage interactive: the operator selects the disk
and confirms the install in Subiquity. Provisioning scripts do not partition or
erase disks. Installer refresh, driver installation, and codecs are disabled;
the installer has no DHCP or configured mirror and uses offline fallback.
`updates: security` is a supported schema value; `updates: none` is not.
Security updates cannot download during the offline installation. The source
ID `ubuntu-server` must exist in the selected ISO's `casper/install-sources.yaml`.

`late-command.sh` verifies and copies the payload to
`/opt/shutteros-provisioning`, installs local DEBs through `curtin in-target`
using APT with no source lists, an empty isolated lists directory, disabled package
caches and fresh archives. An acquisition preflight rejects every URI except a
local file recorded in the verified payload manifest. Normal local file acquisition
then runs with `--no-remove` and `Dpkg::Use-Pty=0`; `--no-download` is not used for
the actual installation because it skips APT's local archive path bookkeeping.
After packages and triggers are configured and `dpkg --audit` is clean, the
amd64 target runs `update-grub` explicitly so newly generated kernel initrds are
included in the boot menu before reboot.
The hook enables the first-boot unit,
SSH, and tty2. Packages must include Cage, Python, snapd, `libpam-systemd`,
`dbus-user-session`, `openssh-server`, sudo, and their missing dependencies.

On the installed system, `shutteros-firstboot.service` starts after logind and
uses `Type=exec` so its start job does not block `multi-user.target`. The script
then runs `cloud-init status --wait` before making provisioning changes. This
avoids an ordering cycle with Ubuntu's `cloud-final.service`, which itself starts
after `multi-user.target`. Disabled cloud-init can return normally; cloud-init
errors stop provisioning and remain in the logs. `RuntimeMaxSec=20min` bounds the
whole running script, including that wait. An active/running unit means work is
in progress; the success marker is written only after verification completes.
The script derives a hostname from the administrator prefix and the fresh target
machine-id, and preserves installer-generated SSH host keys. Target Ethernet
DHCP is configured through cloud-init for administrator recovery. Snapd's prior
`store.access` value is saved across retries, then set to `offline`; missing
dependencies therefore fail without downloading. Commands and the complete
unit have time limits. After signed snaps and the Chromium policy interface
are ready, first boot runs the existing `install.sh` and `verify.sh`. Only after
these checks succeed does it restore the previous store setting, write
`/var/lib/shutteros-provisioning/success`, and disable the provisioning unit.
The normal security-update policy is preserved after successful provisioning.

On failure, use Ctrl+Alt+F2 and authenticate with the administrator account and
password, or use administrator SSH. Cage enables VT switching while the kiosk
runs; Ctrl+Alt+F1 returns to the game. The locked kiosk account has no interactive
shell. A key-only administrator has a locked password and requires SSH over a
local network for recovery. Read
`/var/log/shutteros-provisioning/firstboot.log`, or run
`journalctl -u shutteros-firstboot.service`. Installer preparation logs are in
`/var/log/shutteros-provisioning/installer.log`. Fix the offline payload or
reported host problem and retry with
`sudo systemctl restart shutteros-firstboot.service`. Failure does not restore
store access or select an Internet fallback. Hardware and browser policy
acceptance still follow the kit's manual verification instructions.

Lightweight checks:

```sh
shellcheck deployment/ubuntu/autoinstall/*.sh
python3 -B -m unittest discover -s deployment/ubuntu/autoinstall/tests -p 'test_*.py'
```

The configuration was checked against Canonical's published
[autoinstall reference](https://canonical-subiquity.readthedocs-hosted.com/en/latest/reference/autoinstall-reference.html)
and [schema](https://github.com/canonical/subiquity/blob/main/autoinstall-schema.json).
The Subiquity version shipped on the selected ISO performs runtime validation.
Signed local installs and store access are documented by Canonical in
[assertions](https://snapcraft.io/docs/assertions) and
[system options](https://snapcraft.io/docs/reference/administration/system-options/).
