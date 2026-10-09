# Debian and Ubuntu kiosk deployment

`deployment/ubuntu/` installs ShutterOS on a **dedicated Debian 13 or Ubuntu
Server 24.04 / 26.04 LTS host with no active graphical display manager**.
The directory name is retained for existing deployment commands.

| Distribution             | Chromium delivery      | Managed policy directory                 | Browser profile under its home         |
| ------------------------ | ---------------------- | ---------------------------------------- | -------------------------------------- |
| Debian 13                | APT package `chromium` | `/etc/chromium/policies/managed`         | `.config/shutteros-kiosk`              |
| Ubuntu 24.04 / 26.04 LTS | Official Chromium Snap | `/etc/chromium-browser/policies/managed` | `snap/chromium/common/shutteros-kiosk` |

Only these releases are accepted for installation; derivatives and future
versions need their own validation. The same installer, verifier and uninstaller
select these fixed paths through `platform.sh`. The release guard applies to
installation and updates; verification and removal retain the family’s paths
so an administrator can still recover an existing kiosk after an OS upgrade.

## Validation

The earlier Ubuntu 24.04.5 KVM validation used Cage 0.1.5 and Chromium Snap 152.
Installation, HTTP service, cold boot to graphical login, AZERTY/QWERTY selection,
offline reinstall, crash recovery, failure cleanup and uninstall passed.

The current kit was also exercised on Debian 13.7 with Cage 0.2.0 and native
Chromium 154, in a software-emulated VM with 2 vCPUs, 1 GiB RAM and 1 GiB swap.
Installation, read-only verification, keyboard reconfiguration, reinstall,
compositor crash recovery, cold-boot services, all 20 effective managed Chromium
policies, and uninstall restoring the console passed. The complete graphical
page was confirmed on the virtual display using Cage’s `pixman` renderer;
the standard Debian kernel was needed for DRM/KMS support.

Ubuntu 26.04.1 was tested with Cage 0.2.1 and Chromium Snap 155. Installation,
read-only verification, keyboard reconfiguration, reinstall, compositor crash
recovery, uninstall restoring the console and all 20 managed policies passed.
The final graphical qualification used KVM, Q35, standard VGA, 1 vCPU, 1 GiB RAM
and 1 GiB swap. The unmodified kit opened the game automatically after a cold
boot and after a compositor crash. Keyboard input completed welcome, guided
sign-in, its feedback and entry into the USB activity. No forced navigation,
debugging port, relaxed policy, `--disable-gpu` or compositor override was used
for those final checks.

Initial software-emulated runs were inconclusive: the browser remained black
and an HTTP recovery check timed out during startup. A comparison using the same
RAM, VGA model, disk and kit under TCG reproduced black output and compositor
failures opening the DRM device or initialising EGL. KVM passed those checks.
These results isolate the failure to the emulated VM configuration; they do not
establish a general Ubuntu 26.04 incompatibility. Inspect both the actual display
and service logs rather than treating an active process as graphical acceptance.

CI uses isolated filesystem and command fixtures for all three supported
releases. These cover installation, previous-kit upgrades, rollback, refusal,
permission checks and removal without modifying the runner. The launcher tests
exercise both browser/profile paths and the policy-inspection route.
Virtual graphics and service tests do not qualify a physical kiosk; complete the
hardware acceptance checks below before public use.

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

Debian and Ubuntu package Cage, a Wayland compositor designed to run one maximized
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

The Cage unit uses `Type=simple`: Ubuntu 24.04's PAM helper can retain the
exec-status pipe and leave `Type=exec` stuck in startup even after the browser
appears. The installer separately checks HTTP availability and process stability.

Ubuntu provides Chromium through Snap; Debian uses its native Chromium package. The launcher selects native
Wayland with `--ozone-platform=wayland`, a Chromium-supported Ozone runtime
choice. See [Chromium Ozone](https://chromium.googlesource.com/chromium/src/+/main/docs/ozone_overview.md)
and [the Ubuntu Chromium Snap](https://snapcraft.io/install/chromium/ubuntu).

## Preconditions

- Start with **Debian 13** or **Ubuntu Server 24.04 / 26.04 LTS**, systemd, logind, no active display
  manager, an existing administrator, and an existing SSH recovery path. The
  installer refuses other releases and refuses to repurpose a desktop host.
- Provide a working DRM/KMS graphics driver. Minimal cloud kernels may omit GPU
  drivers; use the distribution’s standard kernel for a graphical VM. The kit
  does not change the kernel or bootloader.
- Build and test ShutterOS first. Pass only a freshly generated `dist/`
  directory to the installer, never the repository, a home directory, or a
  directory containing source or private files.
- Review `deployment/ubuntu/install.sh` on the host before running it as root.
  It downloads packages only through the configured distribution APT sources and, on Ubuntu, the official Snap
  store; it downloads no script and never changes SSH configuration.
- Keep a second administrator SSH session open while enabling the service. The
  kit reserves `tty1` and disables VT switching inside Cage. Use SSH for recovery
  while the kiosk is running; SSH configuration remains untouched.

## Graphics in a virtual machine

Cage normally uses the graphics driver’s renderer. In the Debian 13 VM used for
validation, the virtual GPU displayed only the page background despite a healthy
Chromium process. Cage’s [software renderer](https://github.com/swaywm/wlroots/blob/master/docs/env_vars.md)
(`WLR_RENDERER=pixman`) restored the complete framebuffer. This is a compositor setting; Chromium’s sandbox remains enabled.
Use it only when the target’s virtual graphics need it:

```sh
sudo install -d -m 0755 /etc/systemd/system/shutteros-kiosk.service.d
sudo tee /etc/systemd/system/shutteros-kiosk.service.d/90-software-renderer.conf >/dev/null <<'EOF'
[Service]
Environment=WLR_RENDERER=pixman
EOF
sudo systemctl daemon-reload
sudo systemctl restart shutteros-kiosk.service
```

Confirm the actual display, not just the HTTP response or service status.
Software rendering uses more CPU; a physical kiosk should first use its native
graphics driver. To return to that renderer, remove only this drop-in, run
`systemctl daemon-reload`, and restart the service. Administrator-created
persistent drop-ins also need removing when uninstalling the kit.

## Install and verify

Copy the reviewed repository and the generated static build to the host using
your normal administrative method. From the repository checkout, run:

```sh
sudo deployment/ubuntu/install.sh --site-dir /absolute/path/to/dist
sudo deployment/ubuntu/verify.sh
```

In an interactive terminal, the installer offers the detected keyboard, French
AZERTY, US QWERTY, or another XKB layout. Press Enter to keep the detected layout.
For automation, pass `--keyboard-layout` to skip the menu. Without a terminal,
omitted keyboard settings use the host defaults. Changing the layout clears an
inherited variant unless `--keyboard-variant` explicitly supplies one.

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

The installer installs missing `cage`, `python3`, `libpam-systemd`, and
`dbus-user-session` dependencies. On Debian it adds the native `chromium` package.
On Ubuntu it adds `snapd`, waits for seeding, and installs the official `chromium`
Snap only when absent. A reinstall therefore works without repository access when those
local dependencies are already installed. It validates `kiosk-config.json`
against the V1 deployment contract before changing accounts or services.

It creates the locked, non-administrative `shutteros-kiosk` browser account
and the no-login `shutteros-static` server account, then enables two system
services.
It replaces only `/opt/cyber-shutteros/site`, files under
`/usr/local/lib/shutteros-kiosk`, the two `shutteros-*` unit files, and its own
Chromium policy file. It disables `getty@tty1.service` to avoid two processes
owning the same terminal. The launcher creates the distribution-specific profile below the
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
policy byte equality, the Snap policy connection on Ubuntu, active services, local HTTP
response, and a `127.0.0.1`-only TCP listener. It establishes process and HTTP
startup only; it cannot establish that a usable or confined browser is visible.
Before opening the kiosk, test all of these on the actual hardware:

1. cold boot, display wake, touch/mouse, and the whole game;
2. browser and compositor crash recovery, then the administrator SSH recovery
   path;
3. `Ctrl+Alt+Fn`, `Ctrl+Alt+T`, `F12`, `Ctrl+Shift+I`, printing, downloading,
   context-menu actions, and the physical power button;
   before and after login, also test `Ctrl+W`, `Alt+F4`, `Ctrl+Shift+Q`, `Ctrl+N`,
   `Ctrl+T`, `Escape`, `Ctrl` + wheel and pinch zoom, then normal keyboard
   navigation and the operator reset `Ctrl+Alt+Home`;
4. the temporary policy-inspection procedure below, confirming every policy is
   present and error-free in the real kiosk session.

The launcher adds `?kiosk=1`. A login gesture requests JavaScript fullscreen and
[Keyboard Lock](https://developer.chrome.com/docs/capabilities/web-apis/keyboard-lock)
when available. The page filters captured browser shortcuts while preserving
text entry, AltGraph, navigation and `Ctrl+Alt+Home`. Chrome
[cancelled the proposed permission prompt](https://developer.chrome.com/blog/keyboard-lock-pointer-lock-permission).
Capture still depends on the browser and OS; a long Escape can release it. The
page never forces fullscreen back after a user exit. A later login gesture can
request it again. Unsupported or rejected requests do not prevent play.

The kiosk launcher also uses Chromium's
[`--disable-pinch`](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/input/switches.cc)
to suppress touch-screen pinch zoom. Ordinary touch scrolling remains available;
confirm both behaviours on the installed browser and touch hardware. This option
does not affect the public web demo or the temporary policy-inspection window.

Closing Chromium remains an accepted recovery path: systemd restarts Cage and
Chromium with `--kiosk`, returning to the welcome screen with no saved progress.
The restart delay starts at two seconds and backs off to thirty seconds on
repeated exits. No interactive shell or desktop is launched in between.

Do not mark the kiosk accepted when any item fails. Capture the service logs
with `journalctl -u shutteros-kiosk.service -b`. PAM and Snap move browser
children into user-session scopes; include
`journalctl -b _UID="$(id -u shutteros-kiosk)"` for their graphics and browser logs.
Restore the console if needed.

## Chromium policy and Ubuntu Snap check

The kit writes a root-owned JSON file to
`/etc/chromium/policies/managed/shutteros.json` on Debian, or
`/etc/chromium-browser/policies/managed/shutteros.json` on Ubuntu. Chromium documents
these distribution-specific policy locations and requires managed files not be writable
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
PAM/logind session, and Wayland compositor, without `--kiosk`. It requests `chrome://policy`; if Chromium shows a new
private tab instead, enter `chrome://policy` in its address bar.

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
values and lack of errors at `chrome://policy`, because the installed browser
version is the authority on support. The source of truth used for this kit is
Chromium's upstream
[policy-definition tree](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/policy/resources/templates/policy_definitions/).

The launcher uses an incognito browser session and stores its required
profile only in the kiosk account's home directory. It does **not**
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

### Boot and physical access: administrator acceptance

These host-wide settings belong to the machine owner; the kit does not change
or undo them. Keep the SSH recovery path and a backup of the current boot
configuration before applying the organisation's policy.

- **GRUB:** protect command-line editing and recovery entries with locally managed
  [GRUB authentication](https://www.gnu.org/software/grub/manual/grub/html_node/Authentication-and-authorisation.html)
  (`superusers`, `password_pbkdf2`; export `superusers` for submenus).
  Leave only the intended normal boot entry
  `--unrestricted` for unattended startup. A hidden menu or zero timeout is not
  authentication. Regenerate with `update-grub` after changing the distribution’s source
  configuration; verify editing, recovery and normal startup after kernel updates.
- **Magic SysRq:** check `sysctl kernel.sysrq`. To disable keyboard-triggered
  [SysRq operations](https://docs.kernel.org/admin-guide/sysrq.html), manage
  `kernel.sysrq = 0` in an administrator-owned `/etc/sysctl.d/` file, apply it
  with `sysctl -p /path/to/that-file.conf`, and check again after reboot.
  This removes a keyboard emergency-recovery mechanism too; administrative
  `/proc/sysrq-trigger` access is unaffected.
- **Ctrl+Alt+Delete:** if the local policy disables keyboard-triggered reboots,
  mask `ctrl-alt-del.target` and set `CtrlAltDelBurstAction=none` under `[Manager]` in a
  `/etc/systemd/system.conf.d/` drop-in. The
  [burst action](https://manpages.ubuntu.com/manpages/noble/man5/systemd-system.conf.5.html)
  is separate from the target. Apply through a planned reboot and test both
  single and repeated key sequences, including before Cage starts.
- **Emergency access and power:** retain the locked root account and verify that
  recovery/initramfs paths offer no unauthenticated shell;
  [`sulogin --force`](https://manpages.ubuntu.com/manpages/noble/man8/sulogin.8.html)
  can bypass a locked root account. The physical power button keeps its normal
  behaviour. Test shutdown followed by power-on: the game should return without
  operator input. Enabled units alone do not prove a successful graphical boot.

Where theft is in scope, include disk encryption in the host policy and test
how it affects unattended startup and administrator recovery.

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
unit; if either fails, it restores both the earlier site and the installed
launcher, environment, units, and Chromium policy before restarting the old
installation. A first-install failure restores the recorded getty state and
removes only accounts, groups, and files created by that attempt, including the
kiosk identity if `useradd` committed it before reporting a home-creation
failure. This rollback handles reported errors and catchable signals, not an
atomic recovery from power loss or `SIGKILL`: launcher, unit, environment and
policy files may then be partially updated and require administrator repair.
For site files only, if an interruption leaves just `.site-rollback`, the next
verified reinstall restores it before staging. If both site directories exist,
the installer refuses to guess and requires an administrator to inspect them.
Schedule updates outside kiosk use. Chromium package updates and, on Ubuntu,
Snap refreshes can alter startup or policy behavior, so retest the manual
acceptance list after every browser update.

To restore the normal `tty1` login while keeping Chromium and Cage installed:

```sh
sudo deployment/ubuntu/uninstall.sh
```

The uninstaller refuses to run without the valid root-owned marker. It stops
and removes only the marked ShutterOS services, both accounts, policy,
launcher, and static files, then restores the recorded `getty@tty1.service`
enabled and active state instead of always enabling it. It requests a synchronous
stop of the dedicated user slice before removing the account: Snap processes can
outlive Cage's own service cgroup. If that stop fails, account removal is still
attempted; `userdel` refuses removal while processes remain. It never disables SSH and
deliberately leaves the `cage`, `python3`, `snapd`, and Chromium packages in
place for an administrator to manage under normal change control.
Once removal starts, an exit trap also attempts to restore the recorded tty1
state if a later account or file removal fails. It refuses removal if an
administrator has already changed getty away from the installed kiosk state.

If the screen is unusable, connect through the existing SSH administrator path
and run the uninstaller. Do not rely on a kiosk user password: the account is
locked by design.

### Event-day browser updates

On Ubuntu, before an event, the administrator can temporarily postpone Chromium refreshes
using [Snap's bounded hold](https://snapcraft.io/docs/how-to-guides/manage-snaps/manage-updates/):

```sh
snap info chromium
sudo snap refresh --hold=12h chromium
```

Check the existing hold and organisation policy before replacing it. Choose a
duration covering the event; it expires automatically. The installer and
uninstaller leave administrator-owned Snap update policy unchanged. Do not
freeze security updates indefinitely. On Debian, schedule APT upgrades outside the event using the organisation’s
normal maintenance process. After the event, follow the organisation's
maintenance schedule and repeat the acceptance checks after updating Chromium.
