import { exportBundle } from '../src/research-export/exportBundle';

function arg(name: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) {
    console.error('Usage: npm run export:research -- --output <unused-directory>');
    process.exit(2);
  }
  return process.argv[index + 1];
}

const output = arg('--output');
exportBundle(output)
  .then(({ manifest }) => {
    console.log(`exported schema=${manifest.schema_version} cases=${manifest.case_count} dir=${output}`);
  })
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
