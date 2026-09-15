<script lang="ts">
  const gradientId = $props.id();
</script>

<svg class="wallpaper-curtain" viewBox="0 0 1440 820" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <linearGradient id={`${gradientId}-sheen`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#75c8d1" stop-opacity=".28" />
      <stop offset=".52" stop-color="#2b789b" stop-opacity=".14" />
      <stop offset="1" stop-color="#092b4e" stop-opacity=".04" />
    </linearGradient>
    <linearGradient id={`${gradientId}-fold`} x1=".08" y1="0" x2=".88" y2="1">
      <stop offset="0" stop-color="#82d1d7" stop-opacity=".18" />
      <stop offset=".45" stop-color="#185a80" stop-opacity=".2" />
      <stop offset="1" stop-color="#62b7c7" stop-opacity=".12" />
    </linearGradient>
  </defs>
  <path
    d="M492-70C772 70 879 231 802 418c-67 163 94 307 638 402V-70Z"
    fill={`url(#${gradientId}-sheen)`}
  />
  <path
    d="M729-54c278 177 302 340 175 500-101 128 54 256 536 344V600c-300-86-341-179-235-309 96-118 27-241-179-345Z"
    fill={`url(#${gradientId}-fold)`}
  />
  <path
    d="M1002-40c198 175 162 323 50 454-83 97 34 205 388 303V548c-190-77-229-153-139-259 83-98 46-203-94-329Z"
    fill="#9cdee0"
    fill-opacity=".09"
  />
  <path d="M572 820c249-121 488-107 868-9v9Z" fill="#04182e" fill-opacity=".28" />
</svg>
