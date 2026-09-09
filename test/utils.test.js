const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'fg', 'utils.js'), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const getFirstLetter = sandbox.getFirstLetter;
const escapeHtml = sandbox.escapeHtml;
const escapeRegExp = sandbox.escapeRegExp;
const isSentenceBoundary = sandbox.isSentenceBoundary;

test('getFirstLetter lowercases alphabetic first letters', () => {
    assert.strictEqual(getFirstLetter('Apple'), 'a');
    assert.strictEqual(getFirstLetter('apple'), 'a');
    assert.strictEqual(getFirstLetter('Zebra'), 'z');
    assert.strictEqual(getFirstLetter('zebra'), 'z');
});

test('getFirstLetter returns "other" for empty or non-alphabetic starts', () => {
    assert.strictEqual(getFirstLetter(''), 'other');
    assert.strictEqual(getFirstLetter('1foo'), 'other');
    assert.strictEqual(getFirstLetter('éclair'), 'other');
    assert.strictEqual(getFirstLetter('"quoted"'), 'other');
});

test('escapeHtml neutralizes markup-significant characters', () => {
    assert.strictEqual(escapeHtml('<b> & </b> 5 > 3'), '&lt;b&gt; &amp; &lt;/b&gt; 5 &gt; 3');
});

test('escapeHtml leaves ordinary text untouched', () => {
    assert.strictEqual(escapeHtml('plain text'), 'plain text');
});

test('escapeRegExp escapes regex metacharacters', () => {
    assert.strictEqual(escapeRegExp('a.b*c?'), 'a\\.b\\*c\\?');
    assert.strictEqual(escapeRegExp('[x]+^${}(a)|b/'), '\\[x\\]\\+\\^\\$\\{\\}\\(a\\)\\|b/');
});

test('isSentenceBoundary recognizes period, question, and exclamation endings', () => {
    assert.strictEqual(isSentenceBoundary('Hello world. Next', 'Hello world.'.length - 1), true);
    assert.strictEqual(isSentenceBoundary('Done.', 'Done.'.length - 1), true);
    assert.strictEqual(isSentenceBoundary('Hello! Next', 'Hello!'.length - 1), true);
    assert.strictEqual(isSentenceBoundary('Really? Next', 'Really?'.length - 1), true);
});

test('isSentenceBoundary does not split common abbreviations', () => {
    assert.strictEqual(isSentenceBoundary('Mr. Smith', 'Mr.'.length - 1), false);
    assert.strictEqual(isSentenceBoundary('Dr. Smith', 'Dr.'.length - 1), false);
    assert.strictEqual(isSentenceBoundary('See e.g. this', 'See e.g.'.length - 1), false);
});

test('isSentenceBoundary does not split decimals', () => {
    const text = 'Value 3.14';
    assert.strictEqual(isSentenceBoundary(text, text.indexOf('.')), false);
});
