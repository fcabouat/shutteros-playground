# Ubuntu 26.04 offline USB kiosk

[Guide opérateur en français](kiosk.fr.md#clé-usb-ubuntu-2604-hors-ligne)

The dedicated OS kit supports **Ubuntu Server 26.04 amd64**, Cage and the official
Chromium Snap. Prepare one USB image with local dependencies, then install each
kiosk without Internet access. The administrator identity, password, machine name,
storage selection and installation confirmation are entered on each PC. Use a
dedicated machine without an active graphical display
manager. The static game remains available separately for ordinary HTTP hosting.

## Prepare the media

Install the locked project dependencies on the build machine. Provide the official
`ubuntu-26.04.1-live-server-amd64.iso` locally at
`../shutteros-build/cache/ubuntu/ubuntu-26.04.1-live-server-amd64.iso`, verified against
Ubuntu's published checksums, with `SHA256SUMS` kept beside the ISO. The same ISO
is required for cache preparation and assembly; its name and hash bind the cache.
The remaster keeps the official ISO boot support.
The build machine needs Python 3, OpenSSL and `xorriso` in addition to Node/pnpm
(or Bun as the script runner).

Prepare the complete dependency cache once in an operator-supplied Ubuntu 26.04
amd64 VM with Internet access and the source checkout available. Preinstall APT,
snapd, `xorriso`, `unsquashfs` (squashfs-tools), `python3-yaml` and the Ubuntu archive keyring in that environment.
Make the same base ISO and its verified `SHA256SUMS` available there at the path
above, relative to the VM's checkout. From that checkout, run:

```sh
sudo pnpm kiosk:prepare
# Without pnpm in that VM, use the equivalent Python entry point:
sudo python3 -B deployment/ubuntu/prepare-offline-cache.py \
  --output ../shutteros-build/cache/offline \
  --base-iso ../shutteros-build/cache/ubuntu/ubuntu-26.04.1-live-server-amd64.iso
```

The preparer reads the selected ISO's installed package baseline (709 packages in
the tested 26.04.1 source), rather than using the preparation VM's installed state.
It downloads the compatible DEB closure and Chromium's signed Snap, bases and
content providers. An offline APT simulation uses `--no-download` and `--no-remove`;
a proposed removal or incompatible dependency set makes preparation fail. It records revisions and checksums under
`../shutteros-build/cache/offline`. It does not install the downloaded packages or
create a VM. A complete verified cache is reused; use a new directory when preparing
updated dependencies. Copy the cache to the build machine if those machines differ.

From the build checkout:

```sh
pnpm kiosk:iso
# Bun may run the same script after the locked dependency installation:
bun run kiosk:iso
```

The wrapper rebuilds a root-path game with the current local `private/configuration.json`
and logos, without the public-verification branding override. The image, SHA-256
file and manifest are written under `../shutteros-build/kiosk-iso`. Missing ISO or
cache inputs fail locally; assembly does not fetch substitutes. These commands
are local operator work, excluded from CI, and never start a VM automatically.

`--base-iso` and `--cache` select other local inputs. `--skip-build` requires matching
build metadata for the current sources, root path, configuration and private
branding. It does not accept an old public build as the local organisation's kiosk.

By default, Subiquity prompts for the administrator account, machine name and
password during each PC installation. You may choose `kiosk-admin` as the account
name. The shared ISO contains no administrator password hash. Store the password
according to your organisation's administration rules so you can later use the
local console or SSH. Existing `../shutteros-build/config/operator.json` and
`operator-password.txt` are not silently reused; `private/` contains local
branding and fictional game configuration only.

To provide a reviewed administrator configuration:

```sh
pnpm kiosk:iso --admin-config /path/to/operator.json
```

This explicit option requires `username` and a `password_hash` (SHA-512 or
yescrypt) or `ssh_authorized_keys`. Optional fields select the hostname prefix,
locale and keyboard layout/variant. The hash or public keys are then included on
the ISO. Key-only administrators have a locked password and passwordless sudo.
See the [offline payload contract](../deployment/ubuntu/autoinstall/README.md).

## Install from USB

Write the ISO to the intended USB device with your normal imaging tool. Boot the
PC, enter its administrator account, machine name and password, select the intended
target disk, and confirm installation in Subiquity. Check
that the disk contains no data you need before confirming: installation replaces
its selected storage layout.

On a USB drive larger than the hybrid ISO, `fdisk` may report that the backup GPT
ends at the image boundary instead of the physical drive boundary. This capacity
mismatch alone does not establish a boot failure. The ISO cannot encode the final
sector of every USB size. Verify the SHA-256 of the ISO file, check that the USB
shows the data and EFI partitions, then test UEFI boot on a target PC. A whole-USB
byte comparison can differ in GPT metadata after the drive has been inspected.

The local payload supplies DEBs without repository downloads. At first boot,
`shutteros-firstboot.service` installs asserted local Snap revisions, connects
`chromium:etc-chromium-browser-policies`, then runs the kiosk installer and verifier.
Missing dependencies fail without a store fallback. The machine gets a unique
hostname chosen during installation. The explicit `--admin-config` mode instead
derives one from the fresh machine-id. Ethernet DHCP and SSH provide an
administrator recovery path when a local network is available; Internet is not
required for installation or first boot. Normal security-update policy resumes
after successful provisioning.

## Validation

The locally generated ISO of 2026-10-13 passed installation on a fresh 20GB
virtual disk with 1536MiB RAM, one CPU, UEFI and no network device. The operator
selected only that virtual disk and entered the administrator identity in
Subiquity. Offline package installation, first boot, the visible branded game,
the first-boot success marker, administrator login and sudo on tty2, and return
to tty1 passed. On a separate boot of the same installed disk, restricted QEMU
user networking with one localhost SSH forward confirmed administrator login.
The virtual machine shut down cleanly after each check. Build and qualification
evidence is kept outside Git under `../shutteros-build/validation`.

This does not establish USB boot, storage selection, graphics, input devices or
firmware behavior on the intended physical PC. Qualify one target PC before
deploying the other machines. Lightweight fixtures and service startup checks
alone do not establish either VM or hardware acceptance.
Keep local VM disks, logs and screenshots under `../shutteros-build`, outside Git.
Record the final ISO and hardware acceptance result before deploying the other PCs.

## Install and verify

For a later reviewed application update on an already provisioned Ubuntu 26.04
host, copy the new static delivery and reviewed kit to the host, then run:

```sh
sudo deployment/ubuntu/install.sh --site-dir /absolute/path/to/shutteros-build/dist
sudo deployment/ubuntu/verify.sh
```

The installer configures the kiosk only. It requires preinstalled Cage, Python,
snapd, Chromium, `libpam-systemd` and `dbus-user-session`; it never downloads missing
packages. `--locale`, `--keyboard-layout`, `--keyboard-model`, `--keyboard-variant`
and `--keyboard-options` override host defaults. An interactive terminal offers a
keyboard menu unless the layout is supplied explicitly.

The locked `shutteros-kiosk` browser account has no administrator or supplementary
groups. The separate no-login `shutteros-static` account serves the root-owned
site at `127.0.0.1:8080`. Chromium runs under Cage in its PAM/logind Wayland session,
using `/snap/bin/chromium` and the profile
`~/snap/chromium/common/shutteros-kiosk`. The launcher never adds `--no-sandbox`;
inspect GPU/Wayland and Snap logs rather than weakening Chromium confinement.

The installer refuses unrelated existing accounts and paths. Its root-owned
`0600` ownership marker records the original tty1 getty state. Reinstallation
requires that marker and the expected accounts, stages the site before swapping,
and restores the earlier site and support files on reported activation failure.
Catchable failures are covered; power loss or `SIGKILL` during support-file updates
can require administrator repair. An interrupted site swap with only
`.site-rollback` is restored on the next verified reinstall; two competing site
directories require manual inspection.

`verify.sh` checks account shapes, ownership, permissions, configuration, reviewed
units and policy, Snap policy connection, active services and loopback HTTP. A
reachable server or stable process does not prove a visible, usable browser.
Accept the target hardware only after checking:

1. Cold boot, shutdown/power-on, display wake, the whole game, touch/mouse and keyboard navigation.
2. Browser/compositor crash recovery and administrator recovery.
3. Before and after game login: `Ctrl+Alt+Fn`, `Ctrl+Alt+T`, `F12`, `Ctrl+Shift+I`,
   `Ctrl+W`, `Alt+F4`, `Ctrl+Shift+Q`, `Ctrl+N`, `Ctrl+T`, `Escape`, context menus,
   printing, downloads, Ctrl + wheel, pinch zoom and the reset `Ctrl+Alt+Home`.
4. Effective Chromium policy in the real kiosk session, using the procedure below.
5. Firmware boot order, physical ports, console access and the organisation's power/recovery policy.

The page's `?kiosk=1` keyboard/fullscreen guard is a convenience. Browser and OS
support can reject capture; a long Escape can release it. Cage and the host own
confinement. Closing Chromium causes systemd to restart the kiosk, returning to
welcome without saved progress. Restart delay rises from two to thirty seconds.
A hung renderer that stays alive is outside this process-restart mechanism.

## Chromium policy inspection

The policy is `/etc/chromium-browser/policies/managed/shutteros.json`, owned by root.
The installer and verifier require the Snap policy interface connection. After
browser updates, inspect `snap connections chromium` and verify effective values
and errors at `chrome://policy`; byte equality alone is insufficient.

From an administrator session, temporarily open that page in the existing Cage,
profile and unprivileged browser session:

```sh
sudo install -d -m 0755 /run/systemd/system/shutteros-kiosk.service.d
sudo tee /run/systemd/system/shutteros-kiosk.service.d/90-policy-inspection.conf >/dev/null <<'DROPIN'
[Service]
Environment=SHUTTEROS_INSPECT_POLICY=1
DROPIN
sudo systemctl daemon-reload
sudo systemctl restart shutteros-kiosk.service
```

Enter `chrome://policy` in the address bar if a new private tab appears. Verify
Incognito, password/autofill restrictions, blocked downloads, printing, Developer
Tools, extensions, Sync, capture and notifications. URL filtering allows the
loopback game origin; internal browser pages are not a complete URL-policy boundary.
Remove the diagnostic override immediately after inspection:

```sh
sudo rm -f /run/systemd/system/shutteros-kiosk.service.d/90-policy-inspection.conf
sudo rmdir /run/systemd/system/shutteros-kiosk.service.d
sudo systemctl daemon-reload
sudo systemctl restart shutteros-kiosk.service
```

## Recovery and removal

Cage enables VT switching so local recovery remains available while the kiosk
runs. Use `Ctrl+Alt+F2` and authenticate with the administrator account and password;
return to the kiosk with `Ctrl+Alt+F1`. The locked kiosk account does not provide an
interactive shell. An administrator configured with SSH keys only has a locked
password and requires SSH over a local network for recovery.

For first-boot failure, open that administrator console or SSH session. Inspect:

```sh
sudo journalctl -u shutteros-firstboot.service -b
sudo cat /var/log/shutteros-provisioning/firstboot.log
sudo cat /var/log/shutteros-provisioning/installer.log
```

Correct the reported payload or host issue, then retry with
`sudo systemctl restart shutteros-firstboot.service`. Failure retains offline
store access and does not trigger Internet fallback.

For a failed graphical session, read the kiosk journal and user-session logs:

```sh
sudo journalctl -u shutteros-kiosk.service -b
sudo journalctl -b _UID="$(id -u shutteros-kiosk)"
```

PAM and Snap children can outlive Cage's service cgroup. The uninstaller stops the
dedicated user slice and lets `userdel` refuse removal while processes remain.
To restore the recorded tty1 console while leaving system packages installed:

```sh
sudo deployment/ubuntu/uninstall.sh
```

Removal requires the ownership marker, removes only the owned services/accounts,
site, launcher and policy, and preserves SSH. Administrator-created service
drop-ins require separate cleanup. Do not use the locked kiosk account for recovery.

For a VM graphics diagnosis, a temporary runtime drop-in can set
`Environment=WLR_RENDERER=pixman` under `[Service]`, followed by daemon reload and
kiosk restart. Confirm the actual display and remove that drop-in afterwards.
Software rendering uses more CPU; qualify the physical kiosk with its native
renderer rather than treating the VM workaround as hardware acceptance.

## Host controls and maintenance

Keep an administrator recovery path before changing machine-wide policy. GRUB
editing/recovery authentication, Magic SysRq, Ctrl+Alt+Delete (including its burst
action), emergency/initramfs access, UEFI controls and disk encryption belong to the
machine owner. A hidden GRUB menu is not authentication; encryption also changes
unattended boot and recovery. Test each chosen control before and after OS updates.

Schedule updates outside events and repeat hardware/policy acceptance after browser,
kernel or firmware changes. A bounded Snap hold can cover an event:

```sh
snap info chromium
sudo snap refresh --hold=12h chromium
```

Review the existing hold and organisational policy first; do not indefinitely
freeze security updates. Upstream references: [Chromium Linux policy](https://www.chromium.org/administrators/linux-quick-start/),
[Snap confinement](https://snapcraft.io/docs/explanation/security/snap-confinement/),
[Subiquity autoinstall](https://canonical-subiquity.readthedocs-hosted.com/en/latest/reference/autoinstall-reference.html).
