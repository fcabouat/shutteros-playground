import { decodeConfiguration } from '../contract/configuration';
import type { GameConfig } from '@shutteros/core/model/configuration';
import { fr } from '@shutteros/core/data/fr';

const maximumConfigurationBytes = 32_768;

export type ConfigurationResult =
  { ok: true; config: GameConfig } | { ok: false; issues: readonly string[] };

export function configure(value: unknown): ConfigurationResult {
  const decoded = decodeConfiguration(value);
  if (!decoded.ok) {
    return { ok: false, issues: decoded.issues.map((issue) => `${issue.path}: ${issue.message}`) };
  }
  const dto = decoded.value;
  return {
    ok: true,
    config: {
      sessionDurationMs: dto.sessionMinutes * 60_000,
      challengeDurationMs: dto.challengeSeconds * 1_000,
      explorationDurationMs: (dto.explorationSeconds ?? 25) * 1_000,
      idleReminderMs: (dto.idleReminderSeconds ?? 45) * 1_000,
      eventIntervalMs: (dto.eventIntervalSeconds ?? 90) * 1_000,
      acceptedPasswords: [...dto.acceptedPasswords],
      caseSensitivePasswords: dto.caseSensitivePasswords,
      showPasswordHint: dto.showPasswordHint,
      organizationName: dto.organizationName,
      organizationLogo: dto.organizationLogo,
      playerName: dto.playerName,
      supportLabel: dto.supportLabel,
      supportContact: dto.supportContact,
      stationLabel: dto.stationLabel,
      defaultCalmMode: dto.defaultCalmMode,
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
    const response = await fetch(url, { cache: 'no-store', credentials: 'omit', signal });
    if (!response.ok) return { ok: false, issues: [fr.fetchError] };
    if (exceedsConfiguredSize(response.headers.get('content-length'))) {
      return { ok: false, issues: [fr.sizeError] };
    }
    const body = await readBoundedText(response.body);
    if (body === null) return { ok: false, issues: [fr.sizeError] };
    return configure(JSON.parse(body));
  } catch {
    return { ok: false, issues: [fr.fetchError] };
  }
}

function exceedsConfiguredSize(contentLength: string | null): boolean {
  if (contentLength === null || !/^\d+$/.test(contentLength)) return false;
  return Number(contentLength) > maximumConfigurationBytes;
}

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
