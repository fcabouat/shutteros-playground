# Licensing, attribution, and campaign identity

## Project identity

**ShutterOS Playground** (`shutteros-playground`) is an independent cybersecurity awareness game for European Cybersecurity Month, created by F. Cabouat and distributed under the MIT license.

The game is a personal project. It is not affiliated with, endorsed by, certified by, or an official product of European Cybersecurity Month, ENISA, the European Commission, or Cybermalveillance.gouv.fr. Listing an activity on a campaign website does not by itself establish endorsement. A deploying organisation's name and logo identify that local deployment, separately from the software's authorship.

The UI uses original ShutterOS window-and-curtains artwork and familiar desktop conventions. It bundles no Microsoft, EU, ENISA, Cybermalveillance, or campaign logo. Names, logos, and third-party identifiers remain with their respective rights holders. The software license grants no trademark rights; deploying or renaming the game does not establish rights to a product name.

## Official campaign material

[ENISA describes European Cybersecurity Month](https://www.enisa.europa.eu/topics/cyber-hygiene/european-cybersecurity-month) as the EU's annual awareness campaign supported by ENISA and the European Commission. Reference to the occasion is distinct from using institutional artwork.

The [ENISA legal notice](https://www.enisa.europa.eu/about-enisa/legal-notice) gives specific conditions for reuse of its material and logo. Its [corporate identity guidance](https://www.enisa.europa.eu/press-office/corporate-identity) also prohibits presenting the logo as a certification or endorsement. The campaign has its own [visual identity manual](https://cybersecuritymonth.eu/press-campaign-toolbox/visual-identity/logo-usage-manual). These sources are not a blanket licence to brand third-party software as an official EU product. No such artwork is needed or included here. Review the applicable campaign terms separately before adding any to a customised deployment or promotional page.

## Software redistribution

- The project source is under the [MIT license](../LICENSE). Preserve its copyright and permission notice when redistributing it.
- Dependencies retain their own terms. Packaging inventories rendered code and emitted Tailwind CSS, collects dependency license files, and fails when a bundled dependency has no license file. Successful builds include `dist/LICENSE` and `dist/THIRD-PARTY-NOTICES.txt`; the standalone HTML includes the same notices.
- The in-game **About ShutterOS** view exposes these notices. Keep the notice files with a static-site distribution, including an offline kiosk copy.

`static/THIRD-PARTY-NOTICES.txt` supplies the same notice text during development and Storybook. A production build compares it with the dependencies actually rendered into the regular and portable deliveries, plus Tailwind's emitted CSS. If that inventory changes, the build stops and keeps the generated manifests; run `pnpm notices:update`, review the updated notice file, then run `pnpm build` again. This explicit refresh prevents a dependency update from shipping stale in-app notices.

The public documentation site also redistributes TypeDoc and Storybook assets. Its root `THIRD-PARTY-NOTICES.txt` adds their license texts and the catalog font attribution; upstream bundled license comments are preserved. The game-only kiosk notices remain separate from these documentation dependencies.

- The MIT license does not license a deploying organisation's private logo, institutional marks, third-party identifiers, or external source material. Keep private branding outside the public repository and review the actual built artifact before sharing it.
- Educational text is written for the game and points to its primary references in [content notes](content.md). Links to guidance do not imply approval of the game by those sources.

## Privacy of deployment

The application stores progress only in memory and has no participant account, telemetry, analytics, or score export. A static host can still process connection metadata such as IP addresses in its own access logs. A public Pages deployment is not equivalent to a disconnected local kiosk: review the hosting provider's privacy terms and add no analytics by default. Organisation configuration and branding included in a public build are public data.
