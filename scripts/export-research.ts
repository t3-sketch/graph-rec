import { exportBundle } from '../src/research-export/exportBundle';
import { exportBundleV2 } from '../src/research-export/exportBundleV2';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

const output = arg('--output');
if (!output) {
  console.error('Usage: npm run export:research -- [--dataset fma40] --output <unused-directory>');
  process.exit(2);
}
const dataset = arg('--dataset');
const run = dataset === 'fma40'
  ? exportBundleV2(output)
  : dataset
    ? Promise.reject(new Error(`unsupported --dataset ${dataset}`))
    : exportBundle(output);

run.then(result => {
  console.log(`exported schema=${result.manifest.schema_version} cases=${result.manifest.case_count} dir=${output}`);
}).catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
