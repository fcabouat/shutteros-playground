import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadLegalNotices } from '../../src/lib/infrastructure/legal-notices';

const encoder = new TextEncoder();

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

afterEach(() => vi.unstubAllGlobals());

describe('legal notice loading', () => {
  it('loads bounded same-origin notices without credentials', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(() => Promise.resolve(response(streamFor('Dependency notices'))));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      loadLegalNotices('./THIRD-PARTY-NOTICES.txt', controller.signal),
    ).resolves.toMatchObject({
      ok: true,
      notices: {
        projectLicense: expect.stringContaining('MIT License'),
        thirdPartyNotices: 'Dependency notices',
      },
    });
    expect(fetchMock).toHaveBeenCalledWith('./THIRD-PARTY-NOTICES.txt', {
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    });
  });

  it('reads the inert portable template as text without fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('document', {
      getElementById: vi.fn(() => ({
        tagName: 'TEMPLATE',
        content: { textContent: '<script>remains text</script>' },
      })),
    });

    await expect(
      loadLegalNotices('./THIRD-PARTY-NOTICES.txt', new AbortController().signal),
    ).resolves.toMatchObject({
      ok: true,
      notices: { thirdPartyNotices: '<script>remains text</script>' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects advertised and streamed oversized notice files', async () => {
    const controller = new AbortController();
    let cancelled = 0;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(null, String(512 * 1024 + 1)))
      .mockResolvedValueOnce(response(streamFor('x'.repeat(512 * 1024 + 1), () => cancelled++)));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadLegalNotices('./THIRD-PARTY-NOTICES.txt', controller.signal)).resolves.toEqual(
      { ok: false },
    );
    await expect(loadLegalNotices('./THIRD-PARTY-NOTICES.txt', controller.signal)).resolves.toEqual(
      { ok: false },
    );
    expect(cancelled).toBe(1);
  });
});
