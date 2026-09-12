import type { ChallengeId } from '../model/game';
import type { ChallengeContent } from './challenges';

export const englishChallenges: Record<ChallengeId, ChallengeContent> = {
  usb: {
    title: 'One drive. Lots of curiosity.',
    app: 'File explorer',
    tagline: 'A USB drive was found near the coffee machine.',
    question: 'What do you do with it?',
    hints: [
      'There is a device whose origin nobody knows.',
      'Analysis happens on a dedicated, isolated station, not on your computer.',
    ],
    choices: [
      { id: 'open', label: 'Open the drive', detail: 'Just to find out who it belongs to.' },
      {
        id: 'station',
        label: 'Use the white station',
        detail: 'Follow the procedure for external media.',
      },
      {
        id: 'report',
        label: 'Give it to support',
        detail: 'Without plugging it into my workstation.',
      },
    ],
    feedback: {
      safe: 'The drive stays off the workstation. You avoided a risk before opening a file.',
      risky:
        'Bingo: in this simulation, the drive infected the workstation. It should have gone through the required check first.',
      timeout:
        'An unknown drive can wait. Asking support is safer than plugging it in out of curiosity.',
    },
    lesson:
      'Do not plug unknown media into your workstation. Give it to support or the designated white station: a dedicated, isolated computer. Analysis reduces risk without guaranteeing safety.',
    shortLesson: 'Unknown media goes through the checking procedure first.',
  },
  incident: {
    title: 'The workstation is not behaving as before.',
    app: 'Security center',
    tagline: 'Files are becoming unreadable. You need to act.',
    question: 'What is your first move?',
    hints: [
      'The security center offers an exercise for the day when a click goes wrong.',
      'First stop the workstation communicating, then use the support contact you normally use.',
    ],
    choices: [
      {
        id: 'restart',
        label: 'Restart the workstation',
        detail: 'Maybe the problem will disappear.',
      },
      {
        id: 'isolate',
        label: 'Cut the network connection',
        detail: 'Unplug the cable and disable Wi-Fi.',
      },
      {
        id: 'ignore',
        label: 'Continue working',
        detail: 'Wait to see whether the problem is confirmed.',
      },
    ],
    feedback: {
      safe: 'Workstation isolated, support alerted: you limited the spread and enabled incident response.',
      risky:
        'Waiting, restarting, or erasing traces can complicate response. First isolate the network, then alert support.',
      timeout:
        'The point is not to improvise a repair. Remember the two steps: isolate the workstation, then alert support.',
    },
    lesson:
      'Isolate the workstation from the network, then promptly contact IT or the security team through a known channel. Do not restart, shut down, or delete files without their instructions.',
    shortLesson: 'Isolate the network. Alert support. Follow their instructions.',
  },
  mail: {
    title: 'A bonus. And a lot of urgency.',
    app: 'Mail',
    tagline: 'A human resources message demands immediate action.',
    question: 'How do you check this request?',
    hints: [
      'An email awaits a reply. The sender name looks familiar…',
      'Show the full address. To confirm, do not use contact details in the suspicious message.',
    ],
    choices: [
      { id: 'open', label: 'Open the link', detail: 'The request looks official.' },
      {
        id: 'reply',
        label: 'Reply to the message',
        detail: 'Ask its author whether the email is genuine.',
      },
      {
        id: 'verify',
        label: 'Contact HR via the directory',
        detail: 'Check through a second, already known channel.',
      },
    ],
    feedback: {
      safe: 'You left the potentially trapped channel. Your usual contact can confirm the request independently.',
      risky:
        'The link and reply stay in the channel chosen by the sender. An impostor can confirm their own story.',
      timeout:
        'Urgency is part of the trap. You do not have to obey a deadline imposed by a doubtful message.',
    },
    lesson:
      'Check the full address and whether the request makes sense. When in doubt, contact the person through a number or channel you already know. The absence of a digital signature alone does not prove fraud.',
    shortLesson: 'Confirm an unusual request through a second known channel.',
  },
  spoof: {
    title: 'What if the sender were you?',
    app: 'Sender studio',
    tagline: 'Change the “From” field, then watch the received message.',
    question: 'Is a reassuring name enough to trust?',
    hints: [
      'You know how to inspect an email. Now try changing its sender.',
      'Choose the impostor address, keep a credible name, then send it in the simulation.',
    ],
    choices: [],
    feedback: {
      safe: 'A few characters were enough to change the displayed identity. What you see in the header alone does not prove identity.',
      risky:
        'A familiar name and a signature at the bottom can be copied. Return to a known contact to check.',
      timeout:
        'The “From” field does not tell the whole story. Delegation can be legitimate; a displayed name can also imitate someone.',
    },
    lesson:
      'A delegated sending address may be legitimate. The displayed name is easy to change. A valid digital signature provides integrity and certificate assurances, not a guarantee that the content is safe.',
    shortLesson: 'Displayed identity can change. Trust must be checked.',
  },
  web: {
    title: 'A nearly familiar portal.',
    app: 'Browser',
    tagline: 'The document link leads to a new sign-in page.',
    question: 'What do you do before signing in?',
    hints: [
      'A shared document asks you to sign in again on a portal.',
      'Look at the domain. The padlock indicates encryption, not that the site is legitimate.',
    ],
    choices: [
      { id: 'submit', label: 'Sign in', detail: 'The page looks like my usual space.' },
      {
        id: 'trust-lock',
        label: 'Trust the padlock',
        detail: 'The connection is encrypted, so the site must be trustworthy.',
      },
      {
        id: 'known-address',
        label: 'Return to my known bookmark',
        detail: 'Access the service without using this link.',
      },
    ],
    feedback: {
      safe: 'You took a known route to the service. The trap received no credentials.',
      risky:
        'The portal could have captured your credentials. Its appearance and encrypted connection do not prove its identity.',
      timeout: 'You can leave this form alone and find the service through your usual route.',
    },
    lesson:
      'HTTPS encrypts the connection, including to a fraudulent site. Check the domain and use a known address or bookmark. Here, the fields were fictional: no real data was sent.',
    shortLesson: 'The padlock encrypts the connection; it does not certify the site.',
  },
  mfa: {
    title: 'Another sign-in request.',
    app: 'Sign-in check',
    tagline: 'Your phone keeps insisting, but you requested nothing.',
    question: 'Do you approve it?',
    hints: [
      'A sign-in request is waiting for your approval.',
      'If you did not start the sign-in, do not approve it. Then alert support.',
    ],
    choices: [
      { id: 'approve', label: 'Approve', detail: 'To make the notifications disappear.' },
      { id: 'ignore', label: 'Ignore the requests', detail: 'They will eventually stop.' },
      { id: 'deny-report', label: 'Deny and report', detail: 'I did not start this sign-in.' },
    ],
    feedback: {
      safe: 'You denied the sign-in and raised the alert. The repeated requests did not get your approval.',
      risky:
        'Approving could give a third party access to your account. Ignoring without reporting leaves an attempt unhandled.',
      timeout:
        'No approval happened. Also remember to report an unexpected request: someone may be trying to use your account.',
    },
    lesson:
      'Deny and report an unexpected MFA approval request. If you accepted by mistake, contact support immediately. The displayed location may be approximate; the key signal is that you did not request the sign-in.',
    shortLesson: 'An unrequested sign-in: deny, then report.',
  },
};

export const englishIncidentNotify = {
  question: 'The workstation is isolated. Who do you alert?',
  choices: [
    {
      id: 'call-number',
      label: 'The number in the suspicious window',
      detail: 'It offers immediate assistance.',
    },
    { id: 'notify', label: 'My usual support', detail: 'From another device or a known channel.' },
    { id: 'delete', label: 'Nobody; delete the files', detail: 'Fix the problem myself.' },
  ],
} satisfies { question: string; choices: readonly { id: string; label: string; detail: string }[] };
