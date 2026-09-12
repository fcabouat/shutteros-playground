# Ubuntu kiosk deployment

`deployment/ubuntu/` installs ShutterOS on a **dedicated Ubuntu Server 24.04 LTS
host with no active graphical display manager**.

**Validation status:** shell analysis plus sandboxed fresh-install, reinstall,
rollback, getty-restoration, and refusal tests cover the scripts and every
kit-owned target path. These fixtures do not run systemd, Cage, Chromium, Snap,
or a real display stack. End-to-end boot integration on a fresh Ubuntu VM or
physical kiosk remains unvalidated. Complete the hardware acceptance checks
below before a public session.

The kit serves a normal ShutterOS `dist/` build on loopback HTTP and runs a
single Chromium window inside Cage on `tty1`:

```text
Chromium (shutteros-kiosk account)
  └─ Cage on tty1
       └─ http://127.0.0.1:8080/
            └─ Python static service (shutteros-static account)
                 └─ /opt/cyber-shutteros/site
```

It does not use the portable HTML artifact. The static directory is copied to
a root-owned, read-only location so the browser account cannot change game
files. The static server and browser use different unprivileged accounts. The
browser account has a root-owned shell which always executes Cage; if Cage
cannot start, it does not fall back to an interactive shell.

## Session architecture

Ubuntu packages Cage, a Wayland compositor designed to run one maximized
application. Its `-s` option explicitly enables VT switching, so the kit does
not use it. See the [Ubuntu Cage manpage](https://manpages.ubuntu.com/manpages/noble/man1/cage.1.html).

Cage reads `XKB_DEFAULT_LAYOUT`, `XKB_DEFAULT_MODEL`,
`XKB_DEFAULT_VARIANT`, and `XKB_DEFAULT_OPTIONS`. The installer copies
validated values from `/etc/default/keyboard` and copies `LANG` from
`/etc/default/locale`. This follows Cage's documented
[XKB environment variables](https://github.com/cage-kiosk/cage/wiki/Configuration#xkb-environment-variables).

The kiosk systemd unit uses `PAMName=login` and `TTYPath=/dev/tty1`, instead of
starting a desktop process as root. `pam_systemd` registers a login session and
creates the per-user runtime directory used by Wayland; this is why the
deployment needs a real PAM/logind session. See [pam_systemd](https://www.freedesktop.org/software/systemd/man/latest/pam_systemd.html).

Ubuntu 24.04 provides Chromium through Snap. The launcher selects native
Wayland with `--ozone-platform=wayland`, a Chromium-supported Ozone runtime
choice. See [Chromium Ozone](https://chromium.googlesource.com/chromium/src/+/main/docs/ozone_overview.md)
and [the Ubuntu Chromium Snap](https://snapcraft.io/install/chromium/ubuntu).

## Preconditions

- Start with Ubuntu **Server 24.04 LTS**, systemd, logind, no active display
  manager, an existing administrator, and an existing SSH recovery path. The
  installer refuses other releases and refuses to repurpose a desktop host.
- Build and test ShutterOS first. Pass only a freshly generated `dist/`
  directory to the installer, never the repository, a home directory, or a
  directory containing source or private files.
- Review `deployment/ubuntu/install.sh` on the host before running it as root.
  It downloads packages only through the configured Ubuntu APT and Snap
  sources; it downloads no script and never changes SSH configuration.
- Keep a second administrator SSH session open while enabling the service. The
  kit reserves `tty1`; normal console recovery remains available on another VT
  and SSH remains untouched.

## Install and verify

Copy the reviewed repository and the generated static build to the host using
your normal administrative method. From the repository checkout, run:

```sh
sudo deployment/ubuntu/install.sh --site-dir /absolute/path/to/dist
sudo deployment/ubuntu/verify.sh
```

Override a host default only when the kiosk needs a different setting:

```sh
sudo deployment/ubuntu/install.sh \
  --site-dir /absolute/path/to/dist \
  --locale fr_FR.UTF-8 \
  --keyboard-layout fr \
  --keyboard-variant oss \
  --keyboard-options compose:ralt
```

`--keyboard-model` is also available. Invalid values are rejected before
package or account changes.

The installer installs only missing `cage`, `python3`, and `snapd` packages,
waits for Snap seeding, and installs the official `chromium` Snap only when it
is absent. A reinstall therefore works without repository access when those
local dependencies are already installed. It validates `kiosk-config.json`
against the V1 deployment contract before changing accounts or services.

It creates the locked, non-administrative `shutteros-kiosk` browser account
and the no-login `shutteros-static` server account, then enables two system
services.
It replaces only `/opt/cyber-shutteros/site`, files under
`/usr/local/lib/shutteros-kiosk`, the two `shutteros-*` unit files, and its own
Chromium policy file. It disables `getty@tty1.service` to avoid two processes
owning the same terminal. The launcher creates its Snap profile below the
kiosk-owned home; the root installer does not create root-owned `snap/` parent
directories in that home.

Before its first mutation, the installer refuses every pre-existing kiosk or
static-server account, kiosk home, `/opt/cyber-shutteros` tree, launcher
directory, unit, or
ShutterOS policy file. A successful installation creates a root-owned `0600`
ownership marker that includes the original `getty@tty1` enabled and active
state. Reinstalls accept only that exact marker and its expected account shape;
they never adopt an existing account. This prevents a kiosk update from
silently repurposing an administrator account or deleting an unrelated home.

`verify.sh` is read-only. It asserts both account shapes and group sets, the
ownership marker, root-owned static tree, site-file types and permissions,
configuration validity, the root-owned environment and unit files, reviewed
policy byte equality, policy Snap connection, active services, local HTTP
response, and a `127.0.0.1`-only TCP listener. It establishes process and HTTP
startup only; it cannot establish that a usable or confined browser is visible.
Before opening the kiosk, test all of these on the actual hardware:

1. cold boot, display wake, touch/mouse, and the whole game;
2. browser and compositor crash recovery, then the administrator SSH recovery
   path;
3. `Ctrl+Alt+Fn`, `Ctrl+Alt+T`, `F12`, `Ctrl+Shift+I`, printing, downloading,
   context-menu actions, and the physical power button;
4. the temporary policy-inspection procedure below, confirming every policy is
   present and error-free in the real kiosk session.

Do not mark the kiosk accepted when any item fails. Capture the service logs
with `journalctl -u shutteros-kiosk.service -b` and restore the console if
needed.

## Chromium policy and Snap check

The kit writes a root-owned JSON file to
`/etc/chromium-browser/policies/managed/shutteros.json`. Chromium documents
this Ubuntu-specific policy location and requires managed files not be writable
by unprivileged users; see the [Linux policy quick start](https://www.chromium.org/administrators/linux-quick-start/).

The Ubuntu Chromium Snap needs the
`chromium:etc-chromium-browser-policies` system-files interface in order to see
that location. The installer refuses to enable the kiosk when that connection
is absent. Snap confinement restricts each package to declared interfaces; see
[Snap confinement](https://snapcraft.io/docs/explanation/security/snap-confinement/).
Run `snap connections chromium` and use the policy-inspection procedure below
after every Chromium Snap refresh. A Snap revision can change integration
details, so a successful install alone is not proof that policy is active.

The URL allowlist uses the loopback origin without a trailing wildcard; Chromium's
[URL filter rules](https://support.google.com/chrome/a/answer/9942583?hl=en)
use path-prefix matching and prohibit a wildcard at the end of the URL.

### Temporary policy inspection

On this Server deployment, stopping Cage leaves no graphical session in which
to inspect Chromium. Use a root-owned runtime systemd override instead. It
starts the existing launcher in the same `shutteros-kiosk` account, profile,
PAM/logind session, and Wayland compositor, but opens only `chrome://policy`
without `--kiosk`.

From the existing administrator SSH path, create the override exactly as shown:

```sh
sudo install -d -m 0755 /run/systemd/system/shutteros-kiosk.service.d
sudo tee /run/systemd/system/shutteros-kiosk.service.d/90-policy-inspection.conf >/dev/null <<'EOF'
[Service]
Environment=SHUTTEROS_INSPECT_POLICY=1
EOF
sudo systemctl daemon-reload
sudo systemctl restart shutteros-kiosk.service
```

Read `chrome://policy` on the kiosk display and confirm the ShutterOS policies
are present without errors. The installed URL policy is intentionally unchanged:
Chromium warns that URL blocklists are not a reliable way to block internal
`chrome://` pages, so this diagnostic page remains available while browsing
outside the loopback allowlist stays blocked.

Remove the override immediately and restart the normal kiosk. Do not leave this
mode enabled unattended:

```sh
sudo rm -f /run/systemd/system/shutteros-kiosk.service.d/90-policy-inspection.conf
sudo rmdir /run/systemd/system/shutteros-kiosk.service.d
sudo systemctl daemon-reload
sudo systemctl restart shutteros-kiosk.service
```

The managed policy disables password managers and autofill, pop-ups, Developer
Tools, printing, Sync, Translate, metrics/crash reporting, extension
installation, all downloads, camera and microphone capture, geolocation, and
notifications. It forces Incognito mode. It blocks every URL except
`http://127.0.0.1:8080`; it also blocks `view-source:`. Chromium
documents that `DeveloperToolsAvailability: 2` disables Developer Tools, its
keyboard shortcuts, menu entries, and element inspection. Its
[`DownloadRestrictions: 3`](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/policy/resources/templates/policy_definitions/Miscellaneous/DownloadRestrictions.yaml)
blocks all downloads. URL filtering is useful containment, but Chromium notes
that it does not govern dynamically loaded data or reliably block all internal
`chrome://` pages; use the specific policy for each sensitive capability rather
than treating URL filtering as a complete browser boundary. See
[URLBlocklist](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/policy/resources/templates/policy_definitions/Miscellaneous/URLBlocklist.yaml).

Chromium's current definitions document value `2` as forced Incognito and as
the blocking value for geolocation and notifications; camera and microphone
are disabled with their dedicated boolean policies. Confirm the effective
values and lack of errors at `chrome://policy`, because the installed Snap
revision is the authority on support. The source of truth used for this kit is
Chromium's upstream
[policy-definition tree](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/policy/resources/templates/policy_definitions/).

The launcher uses an incognito browser session and stores its required Snap
profile only in the kiosk account's confined home directory. It does **not**
pass `--no-sandbox`; do not add that flag as a workaround for graphics trouble.
If Chromium does not start under Cage, inspect the journal, Snap connections,
and GPU/Wayland support instead of weakening its sandbox.

## Shortcut, mouse, and physical-control limits

Cage’s single-app model reduces window escape and its default behavior does not
allow VT switching. Chromium policy removes developer-tool and printing entry
points. The local application itself is not relied on for operating-system
lockdown.

The kit does not implement a system-wide key or mouse-button allowlist. Input
handling depends on Cage, Chromium, and the device hardware. Fn keys are
hardware-specific; context-menu restrictions do not establish a security
boundary. Test shortcut and mouse behavior on the target device.

For a public kiosk, the device owner must validate and apply the vendor's
firmware/UEFI controls, physical port protection, boot order, Secure Boot
policy, keyboard/touch hardware configuration, power recovery behavior, and
monitor/console access controls. Test them after firmware and OS updates.

## Operation, update, and rollback

Both services retry indefinitely after failures. Their restart delay rises in
five steps from 2 seconds to a 30-second ceiling, using Ubuntu's documented
[`RestartSteps` and `RestartMaxDelaySec`](https://manpages.ubuntu.com/manpages/noble/man5/systemd.service.5.html).
They were added in systemd 254; Ubuntu 24.04 ships
[systemd 255](https://packages.ubuntu.com/noble/systemd). Output goes only to
the journal so browser errors are not written on
the public tty. A renderer that remains alive but hung is outside this process
restart mechanism and must be covered by hardware acceptance and operational
monitoring.

To deploy a newly reviewed build, run the installer again with its new `dist/`
directory, repeating any locale or keyboard overrides from installation.
It rejects a source inside the kiosk root, copies and checks a
staging tree first, stops both kiosk services, then swaps the site directory on
the same filesystem. It explicitly checks the static HTTP endpoint and kiosk
unit; if either fails and an earlier site exists, it restores that earlier
site. A first-install activation failure restores the recorded getty state and
removes only accounts and files created by that attempt. If power loss leaves
only `.site-rollback`, the next verified reinstall restores it before staging;
if both site directories exist, the installer refuses to guess and requires an
administrator to inspect them. Schedule updates outside kiosk use. Chromium
Snap refreshes can alter startup or policy behavior, so retest the manual
acceptance list after every refresh.

To restore the normal `tty1` login while keeping Chromium and Cage installed:

```sh
sudo deployment/ubuntu/uninstall.sh
```

The uninstaller refuses to run without the valid root-owned marker. It stops
and removes only the marked ShutterOS services, both accounts, policy,
launcher, and static files, then restores the recorded `getty@tty1.service`
enabled and
active state instead of always enabling it. It never disables SSH and
deliberately leaves the `cage`, `python3`, `snapd`, and Chromium packages in
place for an administrator to manage under normal change control.

If the screen is unusable, connect through the existing SSH administrator path
and run the uninstaller. Do not rely on a kiosk user password: the account is
locked by design.
