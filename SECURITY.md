# Security policy

ShutterOS is a static, local awareness simulation. It intentionally has no user accounts, backend, telemetry, persistent storage, or real credential handling. It is not an operating-system security boundary, browser sandbox replacement, or incident-response tool.

## Reporting a vulnerability

Do not publish an exploitable vulnerability in a public issue before maintainers can assess it. Contact François Cabouat privately at [francois.cabouat@gmail.com](mailto:francois.cabouat@gmail.com) and include a minimal reproduction, affected build mode, browser version, and impact. If private vulnerability reporting is enabled on GitHub, the repository Security tab is another suitable route. Do not include real credentials or personal data.

Routine documentation corrections and non-sensitive defects can use normal issues.

## Deployment responsibilities

Deployers are responsible for the host, browser version, static-server configuration, filesystem permissions, physical kiosk access, and Cage/Chromium lockdown policy. The in-game `Ctrl+Alt+Home` shortcut only resets the simulated game. It cannot constrain operating-system shortcuts or recover a crashed browser.

The default Content Security Policy permits only same-origin resources and inline styles required by the generated application. Keep the application self-contained: do not add third-party scripts, analytics, remote fonts, or external content without an explicit security review.

## Security scope

Review the static build and portable `shutteros.html` independently. Pay particular attention to configuration validation, untrusted text rendering, fictional-form behavior, keyboard shortcuts, and the guarantee that no real input is sent or persisted.
