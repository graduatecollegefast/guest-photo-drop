import { test } from 'node:test';
import assert from 'node:assert/strict';
import { themeVars, contrast, COLOR_DOTS, STARTER_SETS } from '../src/utils/palette.js';

const names = COLOR_DOTS.map((c) => c.name);
const combos = [];
for (let i = 0; i < names.length; i++)
  for (let j = i + 1; j < names.length; j++) {
    combos.push([names[i], names[j]]);
    for (let k = j + 1; k < names.length; k++) combos.push([names[i], names[j], names[k]]);
  }

test(`every one of the ${combos.length} possible color picks stays readable`, () => {
  for (const pick of combos) {
    const v = themeVars(pick);
    const label = pick.join('+');
    assert.ok(contrast(v['--primary'], '#FFFFFF') >= 4.5, `button text ${label}`);
    assert.ok(contrast(v['--text'], v['--background']) >= 7, `body text ${label}`);
    assert.ok(contrast(v['--text-muted'], v['--background']) >= 4.5, `muted text ${label}`);
    assert.ok(contrast(v['--primary'], v['--background']) >= 4.5, `names ${label}`);
    assert.ok(contrast(v['--accent'], v['--background']) >= 2, `icons ${label}`);
  }
});

test('starter sets keep their character', () => {
  const nude = themeVars(STARTER_SETS[0].colors);
  assert.equal(nude['--primary'].toLowerCase(), '#7a5c4a'); // Mocha already readable, untouched
  const bw = themeVars(STARTER_SETS[1].colors);
  assert.equal(bw['--primary'].toLowerCase(), '#1c1c1c');
});
