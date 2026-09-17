'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = require('../engine.js');

let passed = 0;
let failed = 0;
function test(name, run) {
  try {
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}\n${error.stack}`);
  }
}

const fixture = (count = 10) => Array.from({length: count}, (_, index) => ({
  id: `test-${index + 1}`,
  category: 'test',
  en: `English phrase ${index + 1}`,
  es: `Frase española ${index + 1}`,
  note: 'A useful teaching note.'
}));
const ids = items => items.map(item => item.id);
const sorted = values => [...values].sort();
const noShuffle = () => 0.999999;

test('the phrase library contains 300 complete entries in six categories of 50', () => {
  const directory = path.join(__dirname, '..', 'data');
  const files = fs.readdirSync(directory).filter(file => file.endsWith('.json'));
  assert.ok(files.length > 0, 'No phrase data files found');
  const entries = files.flatMap(file => {
    const content = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
    assert.ok(Array.isArray(content), `${file} must contain an array`);
    return content;
  });
  assert.equal(entries.length, 300);
  assert.equal(new Set(ids(entries)).size, 300, 'Phrase IDs must be globally unique');
  const categories = new Map();
  for (const entry of entries) {
    for (const key of ['id', 'category', 'en', 'es', 'note']) {
      assert.equal(typeof entry[key], 'string', `${entry.id}: ${key} must be a string`);
      assert.ok(entry[key].trim(), `${entry.id}: ${key} cannot be blank`);
    }
    const category = categories.get(entry.category) || [];
    category.push(entry);
    categories.set(entry.category, category);
  }
  assert.equal(categories.size, 6);
  for (const [name, category] of categories) {
    assert.equal(category.length, 50, `${name} must contain 50 entries`);
    for (const language of ['en', 'es']) {
      assert.equal(new Set(category.map(item => engine.normalize(item[language]))).size,
        50, `${name} has ambiguous repeated ${language} prompts`);
    }
  }
});

test('rounds contain six pairs by default', () => {
  const pool = fixture();
  const chosen = engine.chooseRound(pool, {}, undefined, noShuffle);
  assert.equal(chosen.length, 6);
  assert.equal(new Set(ids(chosen)).size, 6);
  assert.ok(chosen.every(item => pool.includes(item)));
});

test('retry items come before unseen and previously clean items', () => {
  const pool = fixture(8);
  const progress = {
    'test-1': {lastSeen: 100, needsReview: false},
    'test-2': {lastSeen: 9000, needsReview: true},
    'test-3': {lastSeen: 20, needsReview: false},
    'test-4': {lastSeen: 5000, needsReview: true},
    'test-5': {lastSeen: 10, needsReview: false},
    'test-6': {lastSeen: 30, needsReview: false},
    'test-7': {},
    'test-8': {}
  };
  const chosen = engine.chooseRound(pool, progress, 3, noShuffle);
  assert.deepEqual(sorted(ids(chosen.slice(0, 2))), ['test-2', 'test-4']);
  assert.ok(['test-7', 'test-8'].includes(chosen[2].id));
});

test('a retry backlog fills the next round before introducing new phrases', () => {
  const pool = fixture(10);
  const progress = Object.fromEntries(pool.slice(0, 7).map((item, index) => [
    item.id, {lastSeen: 1000 + index, needsReview: true}
  ]));
  const chosen = engine.chooseRound(pool, progress, 6, noShuffle);
  assert.equal(chosen.length, 6);
  assert.ok(chosen.every(item => progress[item.id]?.needsReview));
});

test('a clean retry leaves the priority bucket when its progress flag clears', () => {
  const pool = fixture(8);
  const progress = {
    'test-1': {lastSeen: 1000, needsReview: true},
    'test-2': {lastSeen: 2000, needsReview: false}
  };
  assert.equal(engine.chooseRound(pool, progress, 1, noShuffle)[0].id, 'test-1');
  progress['test-1'] = {lastSeen: 3000, needsReview: false};
  const chosen = engine.chooseRound(pool, progress, 6, noShuffle);
  assert.deepEqual(sorted(ids(chosen)), sorted(ids(pool.slice(2))));
});

test('unseen phrases precede seen phrases and the oldest seen phrases return first', () => {
  const pool = fixture(6);
  const progress = {
    'test-1': {lastSeen: 900},
    'test-2': {lastSeen: 100},
    'test-3': {lastSeen: 400},
    'test-4': {lastSeen: 200}
  };
  const chosen = engine.chooseRound(pool, progress, 6, noShuffle);
  assert.deepEqual(sorted(ids(chosen.slice(0, 2))), ['test-5', 'test-6']);
  assert.deepEqual(ids(chosen.slice(2)), ['test-2', 'test-4', 'test-3', 'test-1']);
});

test('equal-priority choices are shuffled without changing pool or progress', () => {
  const pool = fixture(10);
  const progress = {'test-1': {lastSeen: 400, needsReview: true}};
  const before = JSON.stringify({pool, progress});
  const first = engine.chooseRound(pool, progress, 6, () => 0.5);
  const second = engine.chooseRound(pool, progress, 6, noShuffle);
  assert.notDeepEqual(ids(first), ids(second));
  assert.equal(first[0].id, 'test-1');
  assert.equal(second[0].id, 'test-1');
  assert.equal(JSON.stringify({pool, progress}), before);
});

test('a round never shows duplicate answers after case, accent, and space normalization', () => {
  const pool = fixture(8);
  pool[1].en = `  ${pool[0].en.toUpperCase()}  `;
  pool[3].es = '  frase espanola 3  ';
  const chosen = engine.chooseRound(pool, {}, 6, noShuffle);
  assert.equal(chosen.length, 6);
  for (const language of ['en', 'es']) {
    assert.equal(new Set(chosen.map(item => engine.normalize(item[language]))).size, 6);
  }
});

test('empty and small pools produce complete pairs without filler or duplicates', () => {
  assert.deepEqual(engine.chooseRound([], {}, 6, noShuffle), []);
  const pool = fixture(3);
  assert.deepEqual(sorted(ids(engine.chooseRound(pool, {}, 6, noShuffle))), sorted(ids(pool)));
});

test('a new round contains the same six IDs on both sides and starts clean', () => {
  const pool = fixture(6);
  const before = JSON.stringify(pool);
  const round = engine.createRound(pool, () => 0);
  assert.deepEqual(sorted(ids(round.left)), sorted(ids(pool)));
  assert.deepEqual(sorted(ids(round.right)), sorted(ids(pool)));
  assert.equal(round.selected, null);
  assert.deepEqual(round.matched, []);
  assert.deepEqual(round.missed, []);
  assert.equal(round.attempts, 0);
  assert.equal(JSON.stringify(pool), before);
});

test('tapping the selected card again deselects it without an attempt', () => {
  const round = engine.createRound(fixture(6), noShuffle);
  assert.equal(engine.select(round, 'en', 'test-1').type, 'selected');
  assert.deepEqual(round.selected, {side: 'en', id: 'test-1'});
  engine.select(round, 'en', 'test-1');
  assert.equal(round.selected, null);
  assert.equal(round.attempts, 0);
  assert.deepEqual(round.missed, []);
});

test('switching cards in the same column changes selection without an error', () => {
  const round = engine.createRound(fixture(6), noShuffle);
  engine.select(round, 'es', 'test-1');
  engine.select(round, 'es', 'test-2');
  assert.deepEqual(round.selected, {side: 'es', id: 'test-2'});
  assert.equal(round.attempts, 0);
  assert.deepEqual(round.missed, []);
  assert.equal(engine.select(round, 'en', 'test-2').type, 'match');
});

test('all six pairs can match in either language order and complete exactly on pair six', () => {
  const round = engine.createRound(fixture(6), noShuffle);
  for (let index = 1; index <= 6; index++) {
    const first = index % 2 ? 'en' : 'es';
    const second = first === 'en' ? 'es' : 'en';
    engine.select(round, first, `test-${index}`);
    const result = engine.select(round, second, `test-${index}`);
    assert.deepEqual(result, {type: 'match', id: `test-${index}`, complete: index === 6});
    assert.equal(round.selected, null);
  }
  assert.equal(round.attempts, 6);
  assert.equal(round.matched.length, 6);
  assert.deepEqual(round.missed, []);
});

test('a wrong pair records both phrases for retry and clears selection', () => {
  const round = engine.createRound(fixture(6), noShuffle);
  engine.select(round, 'es', 'test-2');
  const result = engine.select(round, 'en', 'test-1');
  assert.deepEqual(result, {
    type: 'miss',
    first: {side: 'es', id: 'test-2'},
    second: {side: 'en', id: 'test-1'}
  });
  assert.deepEqual(sorted(round.missed), ['test-1', 'test-2']);
  assert.deepEqual(round.matched, []);
  assert.equal(round.selected, null);
  assert.equal(round.attempts, 1);
  engine.select(round, 'en', 'test-1');
  engine.select(round, 'es', 'test-2');
  assert.deepEqual(sorted(round.missed), ['test-1', 'test-2']);
  assert.equal(round.attempts, 2);
});

test('correcting a mistake in the same round retains the need for a later clean retry', () => {
  const round = engine.createRound(fixture(2), noShuffle);
  engine.select(round, 'en', 'test-1');
  engine.select(round, 'es', 'test-2');
  for (const id of ['test-1', 'test-2']) {
    engine.select(round, 'en', id);
    engine.select(round, 'es', id);
  }
  assert.deepEqual(sorted(round.matched), ['test-1', 'test-2']);
  assert.deepEqual(sorted(round.missed), ['test-1', 'test-2']);
  assert.equal(round.attempts, 3);
});

test('repeated taps on a matched pair cannot duplicate matches or attempts', () => {
  const round = engine.createRound(fixture(6), noShuffle);
  engine.select(round, 'en', 'test-1');
  engine.select(round, 'es', 'test-1');
  assert.equal(engine.select(round, 'es', 'test-1').type, 'ignored');
  assert.equal(engine.select(round, 'en', 'test-1').type, 'ignored');
  assert.deepEqual(round.matched, ['test-1']);
  assert.equal(round.attempts, 1);
  assert.equal(round.selected, null);
});

test('invalid input and matched-card taps preserve an active valid selection', () => {
  const round = engine.createRound(fixture(6), noShuffle);
  engine.select(round, 'en', 'test-1');
  engine.select(round, 'es', 'test-1');
  engine.select(round, 'es', 'test-2');
  const before = JSON.stringify(round);
  for (const [side, id] of [['fr', 'test-2'], ['en', 'missing'], ['en', 'test-1']]) {
    assert.equal(engine.select(round, side, id).type, 'ignored');
    assert.equal(JSON.stringify(round), before);
  }
  assert.equal(engine.select(round, 'en', 'test-2').type, 'match');
});

console.log(`\n${passed} tests passed; ${failed} failed.`);
if (failed) process.exitCode = 1;
