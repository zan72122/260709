// smoke.mjs — 全モジュールの構文チェック + DOM 非依存モジュールの import 確認
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;

// 1. 全 src ファイルの構文チェック
for (const f of readdirSync(join(root, 'src'))) {
  if (!f.endsWith('.js')) continue;
  try {
    execFileSync(process.execPath, ['--check', join(root, 'src', f)], { stdio: 'pipe' });
    console.log(`  ok - syntax ${f}`);
  } catch (e) {
    failures++;
    console.error(`  NG - syntax ${f}: ${e.stderr}`);
  }
}

// 2. DOM 非依存モジュールは node でも import できる(構成ミスの早期検知)
for (const mod of ['layout.js', 'physics.js', 'audio.js', 'camera.js', 'ui.js', 'input.js', 'particles.js', 'ball.js', 'machine.js', 'gimmicks.js', 'materials.js', 'guide.js']) {
  try {
    await import(join(root, 'src', mod));
    console.log(`  ok - import ${mod}`);
  } catch (e) {
    failures++;
    console.error(`  NG - import ${mod}: ${e.message}`);
  }
}

if (failures) { console.error(`smoke: ${failures} failure(s)`); process.exit(1); }
console.log('smoke: all ok');
