#!/usr/bin/env python3
"""Run this exact checkout outside a slow/synced Documents filesystem."""
import argparse
import hashlib
import os
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('task', choices=['dev', 'build', 'test', 'typecheck', 'start'])
args = parser.parse_args()
source = Path(__file__).resolve().parents[1]
cache = Path.home() / '.cache' / 'sonder-runtime'
checkout = cache / 'check'
checkout.mkdir(parents=True, exist_ok=True)
lock = (source / 'package-lock.json').read_bytes()
if not (cache / 'node_modules').is_dir() or not (cache / 'package-lock.json').exists() or (cache / 'package-lock.json').read_bytes() != lock:
    for name in ['package.json', 'package-lock.json']:
        (cache / name).write_bytes((source / name).read_bytes())
    subprocess.run(['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], cwd=cache, check=True)
files = [p for folder in ['src', 'tests', 'public', 'scripts'] for p in (source / folder).rglob('*') if p.is_file()]
files += [source / name for name in ['package.json', 'package-lock.json', 'tsconfig.json', 'next.config.ts', 'next-env.d.ts']]
manifest = {}
for path in files:
    relative = path.relative_to(source)
    data = path.read_bytes()
    target = checkout / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists() or target.read_bytes() != data:
        target.write_bytes(data)
    manifest[str(relative)] = hashlib.sha256(data).hexdigest()
tsx = cache / 'node_modules' / '.bin' / 'tsx'
if tsx.exists() and (source / 'scripts' / 'write-provenance.ts').exists():
    subprocess.run([str(tsx), str(source / 'scripts' / 'write-provenance.ts')], cwd=source, check=True)
    generated = source / 'src' / 'research-export' / 'provenance.generated.ts'
    if generated.exists():
        target = checkout / generated.relative_to(source)
        data = generated.read_bytes()
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        manifest[str(generated.relative_to(source))] = hashlib.sha256(data).hexdigest()
# Remove only obsolete source files from our generated verification copy.
for folder in ['src', 'tests', 'public', 'scripts']:
    for path in (checkout / folder).rglob('*'):
        if path.is_file() and str(path.relative_to(checkout)) not in manifest:
            path.unlink()
link = checkout / 'node_modules'
if not link.exists():
    link.symlink_to('../node_modules')
import json
codex = source / '.codex'
codex.mkdir(parents=True, exist_ok=True)
(codex / 'SOURCE_SNAPSHOT.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Running {args.task} from {checkout}; source remains {source}', flush=True)
command = ['npm', 'run', args.task]
if args.task in ['dev', 'build']:
    command += ['--', '--webpack']
os.chdir(checkout)
os.execvp(command[0], command)
