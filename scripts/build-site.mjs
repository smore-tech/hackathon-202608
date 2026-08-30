/**
 * 公開用のファイルだけを _site/ に集める。
 *
 * ビルドらしいビルド（トランスパイル・バンドル）は一切しない。
 * やるのは「テストやCI設定など、配信する必要のないものを外す」ことだけ。
 */
import { cp, mkdir, rm, writeFile, stat } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '_site');

/** 配信するもの。ここに書いていないものは公開されない。 */
const INCLUDE = [
  'index.html',
  'shared',
  'route-golf',
  'pipeline-golf',
  'future-prediction',
  'memory-maze',
  'prototypes',
  'docs',
  'README.md',
];

const exists = async p => stat(p).then(() => true, () => false);

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const entry of INCLUDE){
  const from = join(ROOT, entry);
  if (!await exists(from)){
    console.warn(`skip: ${entry}（存在しません）`);
    continue;
  }
  await cp(from, join(OUT, entry), {
    recursive: true,
    filter: src => !/(^|\/)\.DS_Store$/.test(src),
  });
  console.log(`copy: ${entry}`);
}

// Jekyll を通さない（_ 始まりのファイルが消えるのを防ぐ / 単純に速い）
await writeFile(join(OUT, '.nojekyll'), '');
console.log(`\n出力: ${OUT}`);
