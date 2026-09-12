<script lang="ts">
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
  import Check from '@lucide/svelte/icons/check';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import CircleHelp from '@lucide/svelte/icons/circle-help';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import File from '@lucide/svelte/icons/file';
  import FileText from '@lucide/svelte/icons/file-text';
  import Folder from '@lucide/svelte/icons/folder';
  import Globe from '@lucide/svelte/icons/globe';
  import HardDrive from '@lucide/svelte/icons/hard-drive';
  import Hourglass from '@lucide/svelte/icons/hourglass';
  import KeyRound from '@lucide/svelte/icons/key-round';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
  import LogOut from '@lucide/svelte/icons/log-out';
  import Mail from '@lucide/svelte/icons/mail';
  import Minus from '@lucide/svelte/icons/minus';
  import Monitor from '@lucide/svelte/icons/monitor';
  import MousePointer2 from '@lucide/svelte/icons/mouse-pointer-2';
  import Network from '@lucide/svelte/icons/network';
  import Power from '@lucide/svelte/icons/power';
  import RotateCw from '@lucide/svelte/icons/rotate-cw';
  import Send from '@lucide/svelte/icons/send';
  import Shield from '@lucide/svelte/icons/shield';
  import ShieldAlert from '@lucide/svelte/icons/shield-alert';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Usb from '@lucide/svelte/icons/usb';
  import UserRound from '@lucide/svelte/icons/user-round';
  import Wifi from '@lucide/svelte/icons/wifi';
  import WifiOff from '@lucide/svelte/icons/wifi-off';
  import X from '@lucide/svelte/icons/x';

  const icons = {
    arrow: ArrowRight,
    external: ArrowUpRight,
    check: Check,
    down: ChevronDown,
    back: ChevronLeft,
    next: ChevronRight,
    help: CircleHelp,
    clock: Clock3,
    eye: Eye,
    eyeOff: EyeOff,
    file: File,
    document: FileText,
    folder: Folder,
    web: Globe,
    drive: HardDrive,
    hourglass: Hourglass,
    key: KeyRound,
    light: Lightbulb,
    lock: LockKeyhole,
    logout: LogOut,
    mail: Mail,
    minus: Minus,
    monitor: Monitor,
    cursor: MousePointer2,
    network: Network,
    power: Power,
    reload: RotateCw,
    spoof: Send,
    incident: ShieldAlert,
    shield: Shield,
    secure: ShieldCheck,
    sparkles: Sparkles,
    usb: Usb,
    user: UserRound,
    wifi: Wifi,
    wifiOff: WifiOff,
    close: X,
    mfa: KeyRound,
  };
  let {
    name,
    size = 20,
    class: className = '',
  }: { name: keyof typeof icons; size?: number; class?: string } = $props();
  const Component = $derived(icons[name]);
</script>

<Component {size} strokeWidth={1.7} class={className} aria-hidden="true" />
