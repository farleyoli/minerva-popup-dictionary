const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'fg', 'content.js'), 'utf8') +
    '\nthis.getDictionaryHeadwordForTest = getDictionaryHeadword;';
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const getDictionaryHeadword = sandbox.getDictionaryHeadwordForTest;

test('uses the dictionary capitalization for proper-noun suggestions', () => {
    assert.strictEqual(getDictionaryHeadword({Houthi: []}, 'houthi'), 'Houthi');
});

test('preserves exact dictionary headwords for ordinary suggestions', () => {
    assert.strictEqual(getDictionaryHeadword({run: []}, 'run'), 'run');
});
