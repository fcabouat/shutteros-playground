# Content notes and sources

ShutterOS teaches practical checks, not incident response for a live compromise. Scenario text is deliberately concise and fictional. Organisations should adapt names, their known security contact, campaign copy, and their own approved procedure before deployment.

## Scenario guidance

### Simulated login

The login accepts only configured fictional phrases. It is a game gate, not authentication. Never ask a participant to enter a real password on a shared kiosk. The teaching point is that a password on a visible note is exposed; recommend a long, unique secret kept in a password manager. The organisation’s password policy determines ordinary renewal. A suspected compromise must be reported immediately and handled through that organisation’s procedure, without waiting for a scheduled change. The game does not prescribe its own rotation calendar or character-mix rules.

Keep professional and personal passwords separate. MFA adds protection, but a participant must never disclose a password, one-time code, or approve an authentication prompt they did not initiate.

### Unknown USB drive

An unknown device can introduce risk merely by being connected. A media sanitisation station (French: “station de décontamination”, also called “station blanche”) is a dedicated workstation used by the organisation to scan media and handle detected threats, such as by deletion or quarantine. Its analysis reduces risk without guaranteeing safety. The scenario never reads an actual device.

In the simulation, the desktop icon first opens a fictional file explorer. Selecting a file is harmless in the game; running the disguised executable triggers the consequence, and the archive also triggers a simulated infection. The readme opens a fictional text editor and is harmless in this exercise. It does not establish that the drive or its other files are safe. This deliberate discovery step is not a claim that browsing a real unknown drive is safe.

### Suspected incident

The lesson is to isolate network connectivity and contact the designated security reporting channel. In a real situation, participants must follow their organisation's process and avoid improvised restarting, deletion, or forensic work.

In free exploration, isolating the network starts a fresh discovery step without revealing the reporting answer. Calling the number displayed in the alert, reporting to the known security contact, and deleting affected files are equally styled native actions; the optional guided choices lead to the same outcomes.

### Two suspicious messages

Both activities put the participant in the recipient’s position. The first message makes an ordinary request but has an unusual address and attachment. The second uses a familiar sender and address but asks for work information through an unusual personal channel. Either can be played first from the same mailbox; continuing its feedback opens the other unfinished message.

Reporting through the organisation’s designated security channel is protective in both cases. Inspecting the sender is useful, but is neither mandatory nor sufficient to finish safely. Replying, following the attachment, or complying with the unusual request triggers the relevant consequence. A forged display name or address, or a compromised real mailbox, can make an apparently familiar message unsafe. Verify unexpected requests through a separate, already-known channel. No message is sent and no attachment exists outside the simulation.

### Look-alike web login

The safe action is to return through a known address or bookmark. HTTPS protects the connection to the site reached; it does not by itself prove that the site is the intended service. The form is fictional and does not receive real credentials.

### Unexpected sign-in confirmation

An unexpected authentication request should be denied and reported. Never share an OTP or approve a prompt just to stop repeated notifications. A participant who accidentally approves a real request should use their organisation's established security reporting process immediately. The phone explains that it confirms access after a password. No authentication vocabulary is needed to notice that the participant did not request this sign-in.

### AI assistant and work information

In the AI situation, choose an internal or commercial tool, inspect the exercise policy, preview a prepared message, then send it. There is no real login, free-text entry, upload or AI request. Five variants cover routine car park meeting notes and security notes, each with or without names, plus a general template request. Neutral titles and an interleaved order encourage reading the drafts; the security notes carry only a “[Security]” marker.

The fictional policy permits both versions of the routine project and general templates in the internal tool. The commercial tool permits the anonymised routine project and the general template. Neither accepts either version of the restricted security notes: removing names does not remove access vulnerabilities or remediation dates. Feedback explains the distinction after sending. Approval of this fictional draft is not a guarantee that removing names adequately anonymises a real document. These exercise rules do not replace the deploying organisation’s policy or AI usage charter.

Every outcome shows a common reminder about confidentiality, anonymisation and organisational rules. Removing names does not necessarily anonymise a document or make internal information shareable. Proper anonymisation can help within an approved use; a paid subscription alone grants no permission. Encourage asking before sending, reporting mistakes promptly, and checking generated answers. Guided completion offers both the native controls and equivalent guided choices.

### Quiet routines

Three optional desktop routines reinforce password handling, company-approved system and software updates, and screen locking. Start provides direct access to account, update and lock controls. Their reminders wait while an activity or explanation is open, and do not interrupt guided completion. Title bars identify these tools as workstation protection; password renewal is separate from the mailbox. Follow the organisation's update and password policies while avoiding arbitrary password rotation as a game rule.

### Teaching and facilitation

The guided ending targets three to five minutes: observe a cue, choose an action, see the simulated consequence, and read one practical takeaway; the session deadline still applies (fifteen minutes by default, configurable before deployment). Optional two-choice microchecks open in a separate view after the password routine (My account or guided routines) and after incident/MFA feedback. The login lesson contains no quiz. Microchecks are skippable and do not alter the primary score. Offer plausible choices, explain the consequence in about one sentence, and let participants replay situations to try different choices. Microcheck answers are retained for the current session.

Use supportive language: reporting a click or an approval quickly is a protective action, not a failure. The game is a local simulator. The mailbox contains fixed fictional messages; it does not send mail or demonstrate a real spoofing technique.

## Editorial rules

Target first-time awareness: decisions must follow visible clues, not knowledge of acronyms or security protocols. Introduce an unfamiliar action through a concrete example; keep technical references in these notes. Optional hints help locate controls without requiring a prior scenario. Feedback must describe the action actually taken. The seven scenarios use the same first-attempt assessment. A separate workstation-protection activity records three completed steps (password, updates and locking), without adding them to the scenario score. Direct controls and guided choices share the same action definitions and feedback, with the selected option identified in text as well as colour.

Keep claims specific and proportionate. Do not imply that a media sanitisation station, a padlock icon, a signature, MFA, or a single visual signal guarantees safety. Familiar desktop conventions are acceptable; use original artwork and fictional service identities. Do not add real brands, real login forms, executable files, tracking, external embeds, or network-backed demonstrations.

## Official references

- [Cybermalveillance.gouv.fr: password guidance](https://www.cybermalveillance.gouv.fr/tous-nos-contenus/bonnes-pratiques/mots-de-passe)
- [Cybermalveillance.gouv.fr: compromised mailbox](https://www.cybermalveillance.gouv.fr/tous-nos-contenus/actualites/que-faire-en-cas-de-piratage-de-boite-mail)
- [Cybermalveillance.gouv.fr: phishing response](https://www.cybermalveillance.gouv.fr/tous-nos-contenus/fiches-reflexes/hameconnage-phishing)
- [ANSSI: 10 rules for digital security](https://cyber.gouv.fr/securisation/10-regles-or-securite-numerique/)
- [ANSSI: MFA and password recommendations](https://messervices.cyber.gouv.fr/guides/recommandations-relatives-lauthentification-multifacteur-et-aux-mots-de-passe)
- [CERT-FR: Compromission système — Endiguement, CERTFR-2024-RFX-006-2](https://cert.ssi.gouv.fr/uploads/CERTFR-2024-RFX-006-2.pdf)
- [CERT-FR: CERTFR-2016-ACT-007](https://cert.ssi.gouv.fr/actualite/CERTFR-2016-ACT-007)
- [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html) and [NIST FAQ on password expiration](https://pages.nist.gov/800-63-FAQ/)
- [ENISA: behavioural aspects of cybersecurity](https://www.enisa.europa.eu/news/enisa-news/behavioural-aspects-of-cybersecurity)
- [CNIL: using generative AI, including internal usage policies](https://www.cnil.fr/fr/les-questions-reponses-de-la-cnil-sur-lutilisation-dun-systeme-dia-generative)
- [CNIL: anonymisation of personal data](https://www.cnil.fr/fr/technologies/lanonymisation-de-donnees-personnelles)
- [Cybermalveillance.gouv.fr: using AI at home and at work](https://www.cybermalveillance.gouv.fr/tous-nos-contenus/bonnes-pratiques/utiliser-ia-conseils-pour-les-particuliers-et-les-professionnels)
