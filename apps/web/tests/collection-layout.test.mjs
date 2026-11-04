import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

test('shared pagination keeps table controls valid and excludes entry/print grids', () => {
  const dir = fileURLToPath(new URL('../components/', import.meta.url));
  let collections = 0;
  for (const name of readdirSync(dir).filter(name => name.endsWith('.tsx'))) {
    const source = readFileSync(path.join(dir, name), 'utf8');
    const tree = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(tree) === 'PaginatedCollection') {
        collections++;
        assert.ok(!name.includes('print'), `Dedicated print template paginated: ${name}`);
        let parent = node.parent;
        while (parent && !ts.isJsxElement(parent)) parent = parent.parent;
        const tag = parent?.openingElement.tagName.getText(tree);
        const attrs = node.openingElement.attributes.properties;
        if (tag === 'tbody') {
          assert.ok(attrs.some(attr => attr.name?.text === 'rows'), `${name}: table paginator must emit rows`);
          assert.ok(attrs.some(attr => attr.name?.text === 'columns'), `${name}: table paginator needs a column span`);
        }
        assert.notEqual(tag, 'select', `${name}: dropdown options must not contain navigation`);
        const items = attrs.find(attr => attr.name?.text === 'items')?.initializer?.getText(tree);
        assert.notEqual(items, '{roster}', 'Editable rosters must not be sliced by browsing pagination');
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  assert.ok(collections >= 35, 'School-side pagination coverage unexpectedly shrank');
});
