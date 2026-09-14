import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalJson } from './canonical';
import { FMA_FIXTURE, buildV2Bundle, fixtureCases, type BundleV2 } from './buildV2';
import { validateBundleObject } from './validateV2';

export { FMA_FIXTURE, buildV2Bundle, bundleFromSession, fixtureCases } from './buildV2';
export type { BundleV2 } from './buildV2';

export async function exportBundleV2(outputDir: string, bundle?: BundleV2): Promise<BundleV2> {
  if (existsSync(outputDir)) throw new Error(`Refusing to overwrite ${outputDir}; choose an unused directory`);
  const payload = bundle ?? await buildV2Bundle({
    bundleId: FMA_FIXTURE.bundleId,
    createdAt: FMA_FIXTURE.createdAt,
    sessionId: FMA_FIXTURE.sessionId,
    cases: fixtureCases(),
    events: [],
  });
  await validateBundleObject(payload as unknown as Record<string, unknown>);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, 'bundle.json'), `${canonicalJson(payload)}\n`);
  return payload;
}
