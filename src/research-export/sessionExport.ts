import type { ExplorationSession } from '@/domain/types';
import { bundleFromSession, type BundleV2 } from './buildV2';
import { canonicalJson } from './canonical';

export async function exportSessionBundle(session: ExplorationSession): Promise<BundleV2> {
  return bundleFromSession(session);
}

export function downloadBundleJson(bundle: BundleV2): void {
  const blob = new Blob([canonicalJson(bundle)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${bundle.manifest.bundle_id}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
