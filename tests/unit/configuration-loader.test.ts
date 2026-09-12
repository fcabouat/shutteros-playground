import { describe, expect, it, vi } from 'vitest';
import { configure, loadConfiguration } from '../../src/lib/infrastructure/configuration';

const configuration = {
  version: 1,
  sessionMinutes: 5,
  challengeSeconds: 40,
  acceptedPasswords: ['welcome'],
  caseSensitivePasswords: false,
  showPasswordHint: true,
  organizationName: 'Organisation',
  playerName: 'Camille',
  supportLabel: 'Support',
  supportContact: 'support@example.test',
  stationLabel: 'Reception',
  mailLegitimateAddress: 'team@organisation.example',
  mailImpersonatorAddress: 'impostor@external.example',
  defaultCalmMode: false,
};

const encoder = new TextEncoder();

// An open stream with a cancellation observer exposes whether the byte limit stops
// consumption itself, rather than waiting for end-of-body and rejecting JSON afterward.
function streamFor(text: string, onCancel?: () => void): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      if (onCancel === undefined) controller.close();
    },
    cancel: onCancel,
  });
}

function response(body: ReadableStream<Uint8Array> | null, contentLength?: string): Response {
  return {
    ok: true,
    headers: new Headers(
      contentLength === undefined ? undefined : { 'content-length': contentLength },
    ),
    body,
  } as Response;
}

describe('loadConfiguration', () => {
  it('omits credentials while loading a valid streamed configuration', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(() =>
      Promise.resolve(response(streamFor(JSON.stringify(configuration)))),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadConfiguration('/kiosk-config.json', controller.signal)).resolves.toMatchObject(
      {
        ok: true,
        config: {
          sessionDurationMs: 300_000,
          explorationDurationMs: 25_000,
          idleReminderMs: 45_000,
          eventIntervalMs: 90_000,
        },
      },
    );
    expect(fetchMock).toHaveBeenCalledWith('/kiosk-config.json', {
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    });
    vi.unstubAllGlobals();
  });

  it('maps an optional local organisation logo filename', () => {
    expect(
      configure({ ...configuration, organizationLogo: 'logo-organisation.svg' }),
    ).toMatchObject({
      ok: true,
      config: { organizationLogo: 'logo-organisation.svg' },
    });
  });

  it('rejects advertised and streamed oversized bodies before parsing them', async () => {
    const controller = new AbortController();
    let cancelled = 0;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(null, '32769'))
      .mockResolvedValueOnce(response(streamFor('x'.repeat(32_769), () => cancelled++)));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadConfiguration('/kiosk-config.json', controller.signal)).resolves.toEqual({
      ok: false,
      issues: [{ kind: 'size' }],
    });
    await expect(loadConfiguration('/kiosk-config.json', controller.signal)).resolves.toEqual({
      ok: false,
      issues: [{ kind: 'size' }],
    });
    expect(cancelled).toBe(1);
    vi.unstubAllGlobals();
  });

  it('returns the existing fetch diagnostic when the caller aborts', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const loaded = loadConfiguration('/kiosk-config.json', controller.signal);
    controller.abort();
    await expect(loaded).resolves.toEqual({ ok: false, issues: [{ kind: 'fetch' }] });
    vi.unstubAllGlobals();
  });
});
