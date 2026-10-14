import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

async function moduleFrom(file, suffix = '') {
  const code = ts.transpile(readFileSync(new URL('../src/' + file, import.meta.url), 'utf8'), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext });
  return import('data:text/javascript;base64,' + Buffer.from(code + '\n//' + suffix).toString('base64'));
}
let saved = null;
globalThis.localStorage = { getItem: () => saved, setItem: (_, value) => { saved = value; } };
const settings = await moduleFrom('settings.ts');
assert.deepEqual(settings.readSettings(), { music: true, effects: true, assist: false });
saved = '{"music":false,"effects":true}';
assert.equal(settings.readSettings().assist, false);
settings.saveSettings({ ...settings.readSettings(), assist: true });
assert.equal(settings.readSettings().assist, true);
saved = 'broken';
assert.equal(settings.readSettings().assist, false);

for (const lang of ['en', 'ms', 'zh']) {
  globalThis.location = { search: '?lang=' + lang };
  const { t, language, messages } = await moduleFrom('i18n.ts', lang);
  assert.equal(language, lang);
  for (const key of Object.keys(messages)) {
    assert.equal(t('  ' + key + '  '), '  ' + t(key) + '  ');
    if (lang !== 'zh') assert.ok(!/\p{Script=Han}/u.test(t(key)), key);
  }
  for (const file of ['puzzle.ts', 'race.ts', 'workshop-dialogue.ts', 'identity.ts']) {
    const source = ts.createSourceFile(file, readFileSync(new URL('../src/' + file, import.meta.url), 'utf8'), ts.ScriptTarget.Latest);
    function visit(node) {
      if (ts.isStringLiteral(node) && /\p{Script=Han}/u.test(node.text) && !/[<>]/.test(node.text) && lang !== 'zh') {
        assert.ok(!/\p{Script=Han}/u.test(t(node.text)), `${file}: ${node.text}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  for (const text of ['拿到第2把钥匙啦！真棒！', '看看水停住后面的第2段水管，它的管口朝向哪里？', '拿起圆柱积木啦！看看机关要什么形状。', '长方体和方形机关对不上，再找找正方体！', '已找到1/3把钥匙 · 花园里还有新的发现。', '大门还差2把钥匙，再去探索吧。', '✓ 已接通 2 / 3 段水管', '你是第 2 名到达终点！', '正在准备天空赛道…']) {
    if (lang !== 'zh') assert.ok(!/\p{Script=Han}/u.test(t(text)), text);
  }
}
const { assistedVelocity } = await moduleFrom('race-assist.ts');
assert.equal(assistedVelocity(0, -30, 1, 7), 7);
assert.equal(assistedVelocity(9, -30, 1, -7), -7);
assert.ok(assistedVelocity(9, -30, 1, 7) < 0);
assert.ok(assistedVelocity(-9, -30, 1, -7) > 0);
assert.ok(assistedVelocity(7.5, -90, 1, 7) < 0);
assert.equal(assistedVelocity(9, -30, -1, 7), 7);
assert.equal(assistedVelocity(9, 8, 1, 7), 7);
console.log('PASS: translations, dynamic hints, settings migration, steering boundaries');
