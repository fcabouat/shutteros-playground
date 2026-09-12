# Content notes and sources

ShutterOS teaches practical checks, not incident response for a live compromise. Scenario text is deliberately concise and fictional. Organisations should adapt names, their known support contact, campaign copy, and their own approved procedure before deployment.

## Scenario guidance

### Simulated login

The login accepts only configured fictional phrases. It is a game gate, not authentication. Never ask a participant to enter a real password on a shared kiosk. The teaching point is that a password on a visible post-it is exposed; recommend a long, unique secret kept in a password manager. Change a password promptly when it is compromised or suspected compromised. Follow company password renewal requirements and apply the system/software updates scheduled by IT. A suspected compromise requires immediate action, regardless of the next scheduled change. The game does not prescribe its own rotation calendar or character-mix rules.

Keep professional and personal passwords separate. MFA adds protection, but a participant must never disclose a password, one-time code, or approve an authentication prompt they did not initiate.

### Unknown USB drive

An unknown device can introduce risk merely by being connected. The “white station” is a local organisation process or a dedicated isolated inspection workstation, not a magic safety guarantee. The scenario never reads an actual device.

In the simulation, the desktop icon first opens a fictional file explorer. Selecting a file is harmless in the game; opening/running it triggers the consequence. This deliberate discovery step is not a claim that browsing a real unknown drive is safe.

### Suspected incident

The lesson is to isolate network connectivity and contact the normal support or security channel. In a real situation, participants must follow their organisation's process and avoid improvised restarting, deletion, or forensic work.

### Urgent email

The participant checks a request through a second, already-known contact path. Replying to a suspicious message or using the contact details it contains keeps the participant inside the attacker-controlled path.

### Sender spoofing demonstration

This is a purely local compose-and-receive preview. Selecting a legitimate address or a configurable impersonator address, changing the display name, and pressing the simulated send button causes no network request and sends no email. It illustrates that a display name alone does not establish identity.

A delegated sender address can be legitimate. Conversely, a familiar name can be imitated. A valid digital signature can provide integrity and certificate-related assurance for the signed material; it does not make the message's request, link, or attachment inherently safe. The game therefore teaches verification through a known channel rather than a single visual signal.

### Look-alike web login

The safe action is to return through a known address or bookmark. HTTPS protects the connection to the site reached; it does not by itself prove that the site is the intended service. The form is fictional and does not receive real credentials.

### Unexpected MFA request

An unexpected authentication request should be denied and reported. Never share an OTP or approve a prompt just to stop repeated notifications. A participant who accidentally approves a real request should use their organisation's established support process immediately. The detailed lesson also introduces passkeys and security keys as options for stronger phishing resistance, while keeping the main decision focused on an unexpected prompt.

### Quiet routines

Three optional desktop routines reinforce password handling, company-approved system and software updates, and screen locking. Their reminders open a relevant account, update or lock view for practice. They have no additional timed challenges. Follow the organisation's update and password policies while avoiding arbitrary password rotation as a game rule.

### Teaching and facilitation

The guided ending targets three to five minutes: observe a cue, choose an action, see the simulated consequence, and read one practical takeaway; the global ten-minute limit is the maximum. Optional two-choice microchecks open in a separate view after password renewal in My account and after incident/MFA feedback. The login lesson contains no quiz. Microchecks are skippable and do not alter the primary score. Offer plausible choices, explain the consequence in about one sentence, and allow a new session to try different choices. Microcheck answers are retained for the current session.

Use supportive language: reporting a click or an approval quickly is a protective action, not a failure. The game is a local simulator. Its sender demonstration changes a fictional display field and previews a message; it does not bypass email controls, send mail, or demonstrate a real spoofing technique.

## Editorial rules

Keep claims specific and proportionate. Do not imply that an inspection station, a padlock icon, a signature, MFA, or a single visual signal guarantees safety. Do not add real brands, real login forms, executable files, tracking, external embeds, or network-backed demonstrations.

## Official references

- [Cybermalveillance.gouv.fr: password guidance](https://www.cybermalveillance.gouv.fr/tous-nos-contenus/bonnes-pratiques/mots-de-passe)
- [Cybermalveillance.gouv.fr: phishing response](https://www.cybermalveillance.gouv.fr/tous-nos-contenus/fiches-reflexes/hameconnage-phishing)
- [ANSSI: 10 rules for digital security](https://cyber.gouv.fr/securisation/10-regles-or-securite-numerique/)
- [ANSSI: MFA and password recommendations](https://messervices.cyber.gouv.fr/guides/recommandations-relatives-lauthentification-multifacteur-et-aux-mots-de-passe)
- [CERT-FR: Compromission système — Endiguement, CERTFR-2024-RFX-006-2](https://cert.ssi.gouv.fr/uploads/CERTFR-2024-RFX-006-2.pdf)
- [CERT-FR: CERTFR-2016-ACT-007](https://cert.ssi.gouv.fr/actualite/CERTFR-2016-ACT-007)
- [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html) and [NIST FAQ on password expiration](https://pages.nist.gov/800-63-FAQ/)
- [ENISA: behavioural aspects of cybersecurity](https://www.enisa.europa.eu/news/enisa-news/behavioural-aspects-of-cybersecurity)
