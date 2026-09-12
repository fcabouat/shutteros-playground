<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ChallengeId } from '@shutteros/core/model/game';
  import { onMount } from 'svelte';
  import { getI18n } from '../i18n/context';
  import Icon from './Icon.svelte';

  type WindowIcon = ChallengeId | 'shield' | 'key' | 'monitor';
  type Point = { x: number; y: number };
  type Props = {
    title: string;
    icon: WindowIcon;
    onMinimize: () => void;
    onClose?: () => void;
    children: Snippet;
    large?: boolean;
    moveLabel?: string;
    moveHint?: string;
    resetScrollKey?: string;
  };

  let {
    title,
    icon,
    onMinimize,
    onClose,
    children,
    large = false,
    moveLabel = 'Move window',
    moveHint = 'Use the arrow keys to move this window. Press Escape to reset its position.',
    resetScrollKey = '',
  }: Props = $props();

  const i18n = getI18n();
  const copy = $derived(i18n.text);
  const hintId = $props.id();
  let frame: HTMLElement;
  let body: HTMLDivElement;
  let offset = $state<Point>({ x: 0, y: 0 });
  let maximized = $state(false);
  let dragging = $state(false);
  let pointerId: number | null = null;
  let dragStart: Point = { x: 0, y: 0 };
  let dragOffset: Point = { x: 0, y: 0 };
  let dragRect: DOMRect | null = null;

  $effect(() => {
    void resetScrollKey;
    body?.scrollTo({ top: 0 });
  });

  function workspace(): HTMLElement | null {
    return frame?.closest<HTMLElement>('.os-workspace') ?? null;
  }

  function clamp(point: Point, rect: DOMRect, bounds: DOMRect): Point {
    // If the window exceeds the available size, pin its leading edge instead of
    // producing an inverted range that can push the title-bar controls out of reach.
    const margin = 12;
    const minX = bounds.left + margin - rect.left;
    const maxX = bounds.right - margin - rect.right;
    const minY = bounds.top + margin - rect.top;
    const maxY = bounds.bottom - margin - rect.bottom;
    return {
      x: Math.min(Math.max(point.x, minX), Math.max(minX, maxX)),
      y: Math.min(Math.max(point.y, minY), Math.max(minY, maxY)),
    };
  }

  function beginDrag(event: PointerEvent) {
    if (maximized || event.button !== 0) return;
    const bounds = workspace()?.getBoundingClientRect();
    if (!bounds) return;
    dragging = true;
    pointerId = event.pointerId;
    dragStart = { x: event.clientX, y: event.clientY };
    dragOffset = { ...offset };
    dragRect = frame.getBoundingClientRect();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent) {
    if (!dragging || pointerId !== event.pointerId || !dragRect) return;
    const bounds = workspace()?.getBoundingClientRect();
    if (!bounds) return;
    // DOM rectangles include the applied transform. Remove the starting offset
    // before clamping the new absolute offset, otherwise repeated drags accumulate drift.
    const baseRect = new DOMRect(
      dragRect.left - dragOffset.x,
      dragRect.top - dragOffset.y,
      dragRect.width,
      dragRect.height,
    );
    offset = clamp(
      {
        x: dragOffset.x + event.clientX - dragStart.x,
        y: dragOffset.y + event.clientY - dragStart.y,
      },
      baseRect,
      bounds,
    );
  }

  function endDrag(event: PointerEvent) {
    if (pointerId !== event.pointerId) return;
    dragging = false;
    pointerId = null;
    dragRect = null;
  }

  function moveBy(dx: number, dy: number) {
    if (maximized) return;
    const bounds = workspace()?.getBoundingClientRect();
    const rect = frame?.getBoundingClientRect();
    if (!bounds || !rect) return;
    const baseRect = new DOMRect(
      rect.left - offset.x,
      rect.top - offset.y,
      rect.width,
      rect.height,
    );
    offset = clamp({ x: offset.x + dx, y: offset.y + dy }, baseRect, bounds);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      maximized = false;
      offset = { x: 0, y: 0 };
      return;
    }
    const amount = 10;
    const movement: Record<string, Point> = {
      ArrowUp: { x: 0, y: -amount },
      ArrowDown: { x: 0, y: amount },
      ArrowLeft: { x: -amount, y: 0 },
      ArrowRight: { x: amount, y: 0 },
    };
    const delta = movement[event.key];
    if (!delta) return;
    event.preventDefault();
    moveBy(delta.x, delta.y);
  }

  function toggleMaximized() {
    maximized = !maximized;
    if (maximized) offset = { x: 0, y: 0 };
  }

  onMount(() => {
    // A new viewport invalidates the old drag bounds. Recenter so zoom/rotation does
    // not strand the controls beyond the usable workspace.
    const resetOnResize = () => {
      offset = { x: 0, y: 0 };
    };
    window.addEventListener('resize', resetOnResize);
    return () => window.removeEventListener('resize', resetOnResize);
  });
</script>

<section
  bind:this={frame}
  class="os-window window-surface flex min-h-0 flex-col overflow-hidden rounded-2xl"
  class:large
  class:maximized
  class:dragging
  style:transform={maximized ? 'translate(0, 0)' : `translate(${offset.x}px, ${offset.y}px)`}
>
  <header
    class="window-titlebar flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3"
  >
    <button
      class="window-title-handle flex min-w-0 flex-1 items-center gap-3 text-left"
      type="button"
      aria-label={moveLabel}
      aria-describedby={hintId}
      onpointerdown={beginDrag}
      onpointermove={moveDrag}
      onpointerup={endDrag}
      onpointercancel={endDrag}
      onkeydown={handleKeydown}
      ondblclick={toggleMaximized}
    >
      <span class="app-icon tiny" data-app={icon}><Icon name={icon} size={15} /></span>
      <span class="truncate text-sm font-medium">{title}</span>
    </button>
    <span id={hintId} class="sr-only">{moveHint}</span>
    <div class="flex shrink-0 items-center gap-2 text-xs">
      <button
        class="window-control"
        type="button"
        onclick={onMinimize}
        aria-label={copy.os.minimize}
        title={copy.os.minimize}
      >
        <Icon name="minus" size={16} />
      </button>
      <button
        class="window-control"
        type="button"
        onclick={toggleMaximized}
        aria-label={maximized ? copy.os.restoreSize : copy.os.maximize}
        title={maximized ? copy.os.restoreSize : copy.os.maximize}
      >
        <Icon name="monitor" size={15} />
      </button>
      {#if onClose}
        <button
          class="window-control"
          type="button"
          onclick={onClose}
          aria-label={copy.shell.close}
          title={copy.shell.close}
        >
          <Icon name="close" size={16} />
        </button>
      {/if}
    </div>
  </header>
  <div bind:this={body} class="window-body min-h-0 flex-1 overflow-y-auto">
    {@render children()}
  </div>
</section>
