import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankGenreJaccard } from '../src/services/genreJaccard';
import { START_TRACK_IDS, fmaRecordById } from '../src/catalog/fma40';

test('genre Jaccard ranks by overlap then numeric FMA id and can exhaust', () => {
  const first = rankGenreJaccard('fma-015769', new Set(['fma-015769']), 8);
  assert.equal(first.length, 8);
  const seed = new Set(fmaRecordById.get('fma-015769')!.genre_ids);
  let previous = { shared: Number.POSITIVE_INFINITY, union: 1, id: '' };
  for (const item of first) {
    const genres = new Set(fmaRecordById.get(item.track.id)!.genre_ids);
    const shared = [...seed].filter(id => genres.has(id)).length;
    const union = new Set([...seed, ...genres]).size;
    assert.equal(item.sharedGenreCount, shared);
    assert.equal(item.unionGenreCount, union);
    const better = shared * previous.union - previous.shared * union;
    assert.ok(better < 0 || better === 0);
    if (better === 0 && previous.id) {
      assert.ok(Number(item.track.id.slice(4)) > Number(previous.id.slice(4)));
    }
    previous = { shared, union, id: item.track.id };
  }
  const excluded = new Set(first.map(item => item.track.id));
  excluded.add('fma-015769');
  const second = rankGenreJaccard(first[0].track.id, excluded, 7);
  assert.equal(second.length, 7);
  const all = new Set([...START_TRACK_IDS, first[0].track.id, ...first.map(item => item.track.id), 'fma-015769']);
  for (const record of ['fma-015770', 'fma-015771', 'fma-015772']) all.add(record);
  const exhausted = rankGenreJaccard('fma-015769', new Set([
    'fma-007481','fma-007482','fma-007483','fma-007487','fma-007488','fma-007489','fma-007490','fma-007491','fma-007492',
    'fma-011916','fma-011917','fma-011918','fma-011919','fma-015769','fma-015770','fma-015771','fma-015772','fma-023371',
    'fma-042761','fma-042789','fma-052628','fma-052629','fma-052630','fma-052631','fma-052632','fma-058207','fma-068837',
    'fma-068838','fma-073170','fma-073171','fma-073172','fma-075782','fma-075783','fma-075784','fma-075785','fma-075786',
    'fma-075787','fma-075788','fma-091788','fma-091791',
  ]), 8);
  assert.equal(exhausted.length, 0);
});
