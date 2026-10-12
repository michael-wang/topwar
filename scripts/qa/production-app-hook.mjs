import assert from 'node:assert/strict';
export async function exposeProductionApp(page) {
  await page.route(/\/topwar\/assets\/index-.*\.js$/, async route => {
    const response = await route.fetch(), body = await response.text();
    const pattern = /new [\w$]+\([\w$]+,[\w$]+,[\w$]+,[\w$]+,[\w$]+\(window\.location\.search\)(?:,[\w$]+)*\)/g;
    assert.equal([...body.matchAll(pattern)].length, 1, 'GameApp construction hook drift');
    await route.fulfill({ response, body: body.replace(pattern, match => '(window.__testApp=' + match + ')') });
  });
}
