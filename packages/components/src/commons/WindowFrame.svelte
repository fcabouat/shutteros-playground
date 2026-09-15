<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ChallengeId } from '@shutteros/core/model/game';
  import { onMount } from 'svelte';
  import { getI18n } from '../i18n/context';
  import Icon from './Icon.svelte';

  type WindowIcon = ChallengeId | 'shield' | 'key' | 'monitor' | 'document' | 'light';
  type Point = { x: number; y: number };
  const resizeEdges = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
  type ResizeEdge = (typeof resizeEdges)[number];
  type Props = {
    title: string;
    family?: 'vigilance' | 'protection';
    icon: WindowIcon;
    onMinimize?: () => void;
    closeLabel?: string;
    minimizeLabel?: string;
    onClose?: () => void;
    children: Snippet;
    sidebar?: Snippet;
    sidebarOpen?: boolean;
    maximized?: boolean;
    variant?: 'application' | 'device';
    sizing?: 'content' | 'workspace';
    resizable?: boolean;
    moveLabel: string;
    moveHint: string;
    resetScrollKey?: string;
  };

  let {
    title,
    family,
    icon,
    onMinimize,
    onClose,
    closeLabel,
    minimizeLabel,
    children,
    sidebar,
    sidebarOpen = false,
    maximized = $bindable(false),
    variant = 'application',
    sizing = 'content',
    resizable = true,
    moveLabel,
    moveHint,
    resetScrollKey = '',
  }: Props = $props();

  const i18n = getI18n();
  const copy = $derived(i18n.text);
  const hintId = $props.id();
  let frame: HTMLElement;
  let body: HTMLDivElement;
  let offset = $state<Point>({ x: 0, y: 0 });
  let dragging = $state(false);
  let resizing = $state(false);
  let size = $state<{ width: number; height: number } | null>(null);
  let resizeEdge: ResizeEdge = 'se';
  let pointerId: number | null = null;
  let dragStart: Point = { x: 0, y: 0 };
  let dragOffset: Point = { x: 0, y: 0 };
  let dragRect: DOMRect | null = null;
  const canResize = $derived(resizable && variant !== 'device');

  $effect(() => {
    void resetScrollKey;
    body?.scrollTo({ top: 0 });
  });

  function workspace(): HTMLElement | null {
    return (
      frame?.closest<HTMLElement>('.os-workspace') ??
      frame?.closest<HTMLElement>('.view-host') ??
      null
    );
  }

  function clamp(point: Point, rect: DOMRect, bounds: DOMRect): Point {
    // If the window exceeds the available size, pin its leading edge instead of
    // producing an inverted range that can push the title-bar controls out of reach.
    const margin = 0;
    const minX = bounds.left + margin - rect.left;
    const maxX = bounds.right - margin - rect.right;
    const minY = bounds.top + margin - rect.top;
    const maxY = bounds.bottom - margin - rect.bottom;
    return {
      x: Math.min(Math.max(point.x, minX), Math.max(minX, maxX)),
      y: Math.min(Math.max(point.y, minY), Math.max(minY, maxY)),
    };
  }

  function beginDrag(event: PointerEvent, edge?: ResizeEdge) {
    const resize = edge !== undefined;
    if (maximized || (resize && !canResize) || event.button !== 0) return;
    const bounds = workspace()?.getBoundingClientRect();
    if (!bounds) return;
    dragging = !resize;
    resizing = resize;
    resizeEdge = edge ?? 'se';
    // Pointer-only edges must not move focus into controls hidden from assistive tools.
    if (edge && edge !== 'se') event.preventDefault();
    pointerId = event.pointerId;
    dragStart = { x: event.clientX, y: event.clientY };
    dragOffset = { ...offset };
    dragRect = frame.getBoundingClientRect();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent) {
    if ((!dragging && !resizing) || pointerId !== event.pointerId || !dragRect) return;
    const bounds = workspace()?.getBoundingClientRect();
    if (!bounds) return;
    if (resizing) {
      resizeBy(event.clientX - dragStart.x, event.clientY - dragStart.y, resizeEdge, dragRect);
      return;
    }
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
    resizing = false;
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

  function resizeBy(dx: number, dy: number, edge: ResizeEdge = 'se', origin?: DOMRect) {
    if (!canResize || maximized) return;
    const bounds = workspace()?.getBoundingClientRect();
    const rect = frame.getBoundingClientRect();
    if (!bounds) return;
    const start = origin ?? rect;
    const host = frame.closest<HTMLElement>('.view-host')!.getBoundingClientRect();
    const west = edge.includes('w');
    const north = edge.includes('n');
    const horizontal = west || edge.includes('e');
    const vertical = north || edge.includes('s');
    const availableWidth = Math.max(
      0,
      Math.min(host.width, west ? start.right - bounds.left : bounds.right - start.left),
    );
    const availableHeight = Math.max(
      0,
      Math.min(host.height, north ? start.bottom - bounds.top : bounds.bottom - start.top),
    );
    const width = horizontal
      ? Math.min(
          availableWidth,
          Math.max(Math.min(320, availableWidth), start.width + (west ? -dx : dx)),
        )
      : start.width;
    const height = vertical
      ? Math.min(
          availableHeight,
          Math.max(Math.min(180, availableHeight), start.height + (north ? -dy : dy)),
        )
      : start.height;
    const left = west ? start.right - width : start.left;
    const top = north ? start.bottom - height : start.top;
    // The host centers its child. Translate by the change in center so the edge
    // opposite the handle stays fixed, including after reaching a size limit.
    offset = {
      x: offset.x + left - rect.left + (width - rect.width) / 2,
      y: offset.y + top - rect.top + (height - rect.height) / 2,
    };
    size = { width, height };
  }

  function handleKeydown(event: KeyboardEvent, edge?: ResizeEdge) {
    if (event.key === 'Escape') {
      if (!canResize) return;
      event.stopPropagation();
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
    if (edge) resizeBy(delta.x, delta.y, edge);
    else moveBy(delta.x, delta.y);
  }

  function toggleMaximized() {
    if (!canResize) return;
    maximized = !maximized;
    if (maximized) offset = { x: 0, y: 0 };
  }

  onMount(() => {
    const resetOnResize = () => {
      offset = { x: 0, y: 0 };
      size = null;
    };
    window.addEventListener('resize', resetOnResize);
    // Content and guidance can change size without a viewport resize. Preserve a
    // deliberate position whenever it still fits; only clamp the overflowing edge.
    const observer = new ResizeObserver(() => {
      if (!resizing && !maximized && frame.getClientRects().length > 0) moveBy(0, 0);
    });
    const bounds = workspace();
    if (bounds) observer.observe(bounds);
    const host = frame.closest<HTMLElement>('.view-host');
    if (host) observer.observe(host);
    observer.observe(frame);
    return () => {
      window.removeEventListener('resize', resetOnResize);
      observer.disconnect();
    };
  });
</script>

<section
  bind:this={frame}
  role="group"
  aria-label={title}
  tabindex="-1"
  data-window-focus
  class="os-window window-surface relative flex min-h-0 flex-col overflow-hidden rounded-2xl"
  data-sizing={sizing}
  class:maximized
  class:with-choices={sidebarOpen}
  class:device-window={variant === 'device'}
  class:dragging
  style:width={!maximized && size ? `min(${size.width}px, 100%)` : undefined}
  style:height={!maximized && size ? `${size.height}px` : undefined}
  style:transform={maximized ? 'translate(0, 0)' : `translate(${offset.x}px, ${offset.y}px)`}
>
  <header
    data-family={family}
    class="window-titlebar flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3"
    hidden={variant === 'device' && !sidebarOpen}
  >
    <button
      class="window-title-handle flex min-w-0 flex-1 items-center gap-3 text-left"
      type="button"
      aria-label={moveLabel}
      aria-describedby={hintId}
      onpointerdown={(event) => beginDrag(event)}
      onpointermove={moveDrag}
      onpointerup={endDrag}
      onpointercancel={endDrag}
      onlostpointercapture={endDrag}
      onkeydown={handleKeydown}
    >
      <span class="app-icon tiny" data-app={icon}><Icon name={icon} size={15} /></span>
      <span class="truncate text-sm font-medium">{title}</span>
    </button>
    {#if family}<span class="activity-family" data-family={family}
        ><Icon name={family === 'protection' ? 'secure' : 'shield'} size={14} />{copy.guidance
          .families[family]}</span
      >{/if}
    <span id={hintId} class="sr-only">{moveHint}</span>
    <div class="flex shrink-0 items-center gap-2 text-xs">
      {#if onMinimize}
        <button
          class="window-control"
          type="button"
          onclick={onMinimize}
          aria-label={minimizeLabel ?? copy.os.minimize}
          title={minimizeLabel ?? copy.os.minimize}
        >
          <Icon name="minus" size={16} />
        </button>
      {/if}
      {#if canResize}
        <button
          class="window-control"
          type="button"
          onclick={toggleMaximized}
          aria-label={maximized ? copy.os.restoreSize : copy.os.maximize}
          title={maximized ? copy.os.restoreSize : copy.os.maximize}
        >
          <Icon name="monitor" size={15} />
        </button>
      {/if}
      {#if onClose}
        <button
          class="window-control"
          type="button"
          onclick={onClose}
          aria-label={closeLabel ?? copy.shell.close}
          title={closeLabel ?? copy.shell.close}
        >
          <Icon name="close" size={16} />
        </button>
      {/if}
    </div>
  </header>
  <div class="window-panes min-h-0 flex-1" class:with-sidebar={sidebarOpen}>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (a scrollable reading area needs a keyboard entry point even when it contains no controls) -->
    <div
      bind:this={body}
      class="window-body min-h-0 flex-1 overflow-y-auto"
      role="group"
      aria-label={title}
      tabindex="0"
    >
      {@render children()}
    </div>
    {#if sidebar}
      <div class="guidance-panel-host" hidden={!sidebarOpen} inert={!sidebarOpen}>
        {@render sidebar()}
      </div>
    {/if}
  </div>
  {#if canResize && !maximized}
    <span id={`${hintId}-resize`} class="sr-only">{copy.os.resizeHint}</span>
    {#each resizeEdges as edge (edge)}
      <button
        class="window-resize-handle"
        data-resize-edge={edge}
        type="button"
        tabindex={edge === 'se' ? 0 : -1}
        aria-hidden={edge !== 'se'}
        aria-label={copy.os.resize}
        aria-describedby={edge === 'se' ? `${hintId}-resize` : undefined}
        title={copy.os.resizeHint}
        onpointerdown={(event) => beginDrag(event, edge)}
        onpointermove={moveDrag}
        onpointerup={endDrag}
        onpointercancel={endDrag}
        onlostpointercapture={endDrag}
        onkeydown={(event) => handleKeydown(event, edge)}
      ></button>
    {/each}
  {/if}
</section>

<style>
  .window-resize-handle {
    position: absolute;
    z-index: 2;
    padding: 0;
    touch-action: none;
  }
  .window-resize-handle:is([data-resize-edge='n'], [data-resize-edge='s']) {
    left: 16px;
    right: 16px;
    height: 6px;
    cursor: ns-resize;
  }
  .window-resize-handle:is([data-resize-edge='e'], [data-resize-edge='w']) {
    top: 16px;
    bottom: 16px;
    width: 6px;
    cursor: ew-resize;
  }
  .window-resize-handle:is([data-resize-edge='ne'], [data-resize-edge='sw']) {
    width: 16px;
    height: 16px;
    cursor: nesw-resize;
  }
  .window-resize-handle:is([data-resize-edge='nw'], [data-resize-edge='se']) {
    width: 16px;
    height: 16px;
    cursor: nwse-resize;
  }
  .window-resize-handle[data-resize-edge*='n'] {
    top: 0;
  }
  .window-resize-handle[data-resize-edge*='s'] {
    bottom: 0;
  }
  .window-resize-handle[data-resize-edge*='e'] {
    right: 0;
  }
  .window-resize-handle[data-resize-edge*='w'] {
    left: 0;
  }
</style>
