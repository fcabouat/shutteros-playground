# Ubuntu kiosk deployment

`deployment/ubuntu/` is a reviewed deployment kit for a **dedicated Ubuntu
Server 24.04 LTS host with no active graphical display manager**. It has not
been applied to a physical kiosk or tested against
every graphics, touch, keyboard, GPU, display, firmware, or Snap revision. Do
not use it as a claim of hardware lockdown. Validate it on the target device
before a public session.

The kit serves a normal ShutterOS `dist/` build on loopback HTTP and runs a
single Chromium window inside Cage on `tty1`:

```text
Chromium (shutteros-kiosk account)
  └─ Cage on tty1
       └─ http://127.0.0.1:8080/
            └─ Python static service → /opt/cyber-shutteros/site
```

It does not use the portable HTML artifact. The static directory is copied to
a root-owned, read-only location so the browser account cannot change game
files. The account has a root-owned shell which always executes Cage; if Cage
cannot start, it does not fall back to an interactive shell.

## Why this design

Ubuntu packages Cage, a Wayland compositor designed to run one maximized
application. Its `-s` option explicitly enables VT switching, so the kit does
not use it. See the [Ubuntu Cage manpage](https://manpages.ubuntu.com/manpages/noble/man1/cage.1.html).

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

The installer installs `cage`, `python3`, and `snapd` through APT if needed,
installs the official `chromium` Snap if absent, creates the locked,
non-administrative `shutteros-kiosk` account, and enables two system services.
It replaces only `/opt/cyber-shutteros/site`, files under
`/usr/local/lib/shutteros-kiosk`, the two `shutteros-*` unit files, and its own
Chromium policy file. It disables `getty@tty1.service` to avoid two processes
owning the same terminal.

Before its first mutation, the installer refuses every pre-existing kiosk
account, kiosk home, `/opt/cyber-shutteros` tree, launcher directory, unit, or
ShutterOS policy file. A successful installation creates a root-owned `0600`
ownership marker that includes the original `getty@tty1` enabled and active
state. Reinstalls accept only that exact marker and its expected account shape;
they never adopt an existing account. This prevents a kiosk update from
silently repurposing an administrator account or deleting an unrelated home.

`verify.sh` is read-only. It asserts the ownership marker, root-owned static
tree, site-file types and permissions, reviewed-policy byte equality, policy
Snap connection, active services, local HTTP response, and a `127.0.0.1`-only
TCP listener. It then prints manual acceptance checks. Before opening the kiosk,
test all of these on the actual hardware:

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
Tools, printing, Sync, extension installation, and all downloads. It blocks
every URL except `http://127.0.0.1:8080/*`; it also blocks `view-source:`. Chromium
documents that `DeveloperToolsAvailability: 2` disables Developer Tools, its
keyboard shortcuts, menu entries, and element inspection. Its
[`DownloadRestrictions: 3`](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/policy/resources/templates/policy_definitions/Miscellaneous/DownloadRestrictions.yaml)
blocks all downloads. URL filtering is useful containment, but Chromium notes
that it does not govern dynamically loaded data or reliably block all internal
`chrome://` pages; use the specific policy for each sensitive capability rather
than treating URL filtering as a complete browser boundary. See
[URLBlocklist](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/policy/resources/templates/policy_definitions/Miscellaneous/URLBlocklist.yaml).

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

There is no portable, maintained Ubuntu setting in this kit that safely
whitelists only left-click, letters, digits, Shift, and Caps Lock while blocking
every modifier, Fn, firmware, keyboard-controller, and context-menu path. Fn
keys are hardware-specific, and right-click is a browser/application action,
not a reliable security boundary. The kit intentionally does not install an
unreviewed input filter or pretend that JavaScript can control these keys.

For a public kiosk, the device owner must validate and apply the vendor's
firmware/UEFI controls, physical port protection, boot order, Secure Boot
policy, keyboard/touch hardware configuration, power recovery behavior, and
monitor/console access controls. Test them after firmware and OS updates.

## Operation, update, and rollback

To deploy a newly reviewed build, run the installer again with its new `dist/`
directory. It rejects a source inside the kiosk root, copies and checks a
staging tree first, stops both kiosk services, then swaps the site directory on
the same filesystem. It explicitly restarts both services; if the new services
fail and an earlier site exists, it restores that earlier site. Schedule this
outside kiosk use. Chromium Snap refreshes can alter startup or policy behavior,
so retest the manual acceptance list after every refresh.

To restore the normal `tty1` login while keeping Chromium and Cage installed:

```sh
sudo deployment/ubuntu/uninstall.sh
```

The uninstaller refuses to run without the valid root-owned marker. It stops
and removes only the marked ShutterOS services, account, policy, launcher, and
static files, then restores the recorded `getty@tty1.service` enabled and
active state instead of always enabling it. It never disables SSH and
deliberately leaves the `cage`, `python3`, `snapd`, and Chromium packages in
place for an administrator to manage under normal change control.

If the screen is unusable, connect through the existing SSH administrator path
and run the uninstaller. Do not rely on a kiosk user password: the account is
locked by design.
