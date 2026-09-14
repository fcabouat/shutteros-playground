import { decodeConfiguration } from '../contract/configuration';
import type { GameConfig } from '@shutteros/core/model/configuration';

const maximumConfigurationBytes = 32_768;

export type ConfigurationResult =
  | { ok: true; config: GameConfig }
  | {
      ok: false;
      issues: readonly (
        { kind: 'fetch' | 'size' } | { kind: 'field'; path: string; message: string }
      )[];
    };

/**
 * Translate the external contract into the core's units and copy mutable input data.
 * HTTP and portable startup both use this path so their defaults and validation agree.
 */
export function configure(value: unknown): ConfigurationResult {
  const decoded = decodeConfiguration(value);
  if (!decoded.ok) {
    return {
      ok: false,
      issues: decoded.issues.map((issue) => ({ kind: 'field' as const, ...issue })),
    };
  }
  const dto = decoded.value;
  return {
    ok: true,
    config: {
      sessionDurationMs: dto.sessionMinutes * 60_000,
      idleReminderMs: (dto.idleReminderSeconds ?? 45) * 1_000,
      eventIntervalMs: (dto.eventIntervalSeconds ?? 90) * 1_000,
      acceptedPasswords: [...dto.acceptedPasswords],
      caseSensitivePasswords: dto.caseSensitivePasswords,
      showPasswordHint: dto.showPasswordHint,
      organizationName: dto.organizationName,
      organizationLogo: dto.organizationLogo,
      partnerOrganizationName: dto.partnerOrganizationName,
      partnerOrganizationLogo: dto.partnerOrganizationLogo,
      playerName: dto.playerName,
      supportLabel: dto.supportLabel,
      supportContact: dto.supportContact,
      stationLabel: dto.stationLabel,
      mailLegitimateAddress: dto.mailLegitimateAddress,
      mailImpersonatorAddress: dto.mailImpersonatorAddress,
    },
  };
}

export async function loadConfiguration(
  url: string,
  signal: AbortSignal,
): Promise<ConfigurationResult> {
  try {
    // Operator edits should be visible after reload; this file requires no session
    // cookies. A failed load is surfaced to the composition root, not replaced by defaults.
    const response = await fetch(url, { cache: 'no-store', credentials: 'omit', signal });
    if (!response.ok) return { ok: false, issues: [{ kind: 'fetch' }] };
    if (exceedsConfiguredSize(response.headers.get('content-length'))) {
      return { ok: false, issues: [{ kind: 'size' }] };
    }
    const body = await readBoundedText(response.body);
    if (body === null) return { ok: false, issues: [{ kind: 'size' }] };
    return configure(JSON.parse(body));
  } catch {
    return { ok: false, issues: [{ kind: 'fetch' }] };
  }
}

function exceedsConfiguredSize(contentLength: string | null): boolean {
  if (contentLength === null || !/^\d+$/.test(contentLength)) return false;
  return Number(contentLength) > maximumConfigurationBytes;
}

/**
 * Content-Length is only an early rejection hint: it may be absent or inaccurate.
 * Count received bytes before decoding/parsing the complete body. Stream cancellation
 * and absent-length cases are covered by tests/unit/configuration-loader.test.ts.
 */
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
      if (bytesRead > maximumConfigurationBytes) {
        try {
          await reader.cancel();
        } catch {
          // The size error remains the meaningful result if a hostile stream rejects cancellation.
        }
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}
