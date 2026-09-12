import projectLicense from '../../../LICENSE?raw';

const maximumNoticesBytes = 512 * 1024;

export type LegalNotices = {
  projectLicense: string;
  thirdPartyNotices: string;
};

export type LegalNoticesResult = { ok: true; notices: LegalNotices } | { ok: false };

/**
 * Use the portable artifact's inert template when present; otherwise load the static
 * notice file. Failure is separate from game configuration so About can report it
 * without blocking a session. The project license is bundled in both distributions.
 */
export async function loadLegalNotices(
  url: string,
  signal: AbortSignal,
): Promise<LegalNoticesResult> {
  const embedded = embeddedThirdPartyNotices();
  if (embedded !== null) return ready(embedded);

  try {
    const response = await fetch(url, { cache: 'no-store', credentials: 'omit', signal });
    if (!response.ok || exceedsConfiguredSize(response.headers.get('content-length'))) {
      return { ok: false };
    }
    const notices = await readBoundedText(response.body);
    return notices === null ? { ok: false } : ready(notices);
  } catch {
    return { ok: false };
  }
}

function ready(thirdPartyNotices: string): LegalNoticesResult {
  return {
    ok: true,
    notices: { projectLicense, thirdPartyNotices },
  };
}

function embeddedThirdPartyNotices(): string | null {
  if (typeof document === 'undefined') return null;
  const template = document.getElementById('third-party-notices');
  if (template?.tagName !== 'TEMPLATE') return null;
  // Read text from the template fragment, not innerHTML: license markup is content,
  // not an instruction to create DOM. About renders the returned string as text too.
  const text = (template as HTMLTemplateElement).content.textContent;
  return text === null || text.length === 0 ? null : text;
}

function exceedsConfiguredSize(contentLength: string | null): boolean {
  if (contentLength === null || !/^\d+$/.test(contentLength)) return false;
  return Number(contentLength) > maximumNoticesBytes;
}

/** Bound streamed bytes as well as the advertised size; see tests/unit/legal-notices.test.ts. */
async function readBoundedText(body: ReadableStream<Uint8Array> | null): Promise<string | null> {
  if (body === null) return '';

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      if (value === undefined) continue;
      bytesRead += value.byteLength;
      if (bytesRead > maximumNoticesBytes) {
        try {
          await reader.cancel();
        } catch {
          // The size error remains authoritative if a hostile stream rejects cancellation.
        }
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}
