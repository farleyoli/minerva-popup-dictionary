const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'fg', 'utils.js'), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const wrapExamplePhraseInParagraphs = sandbox.wrapExamplePhraseInParagraphs;

test('clozes the word and wraps each sentence in its own <p>', () => {
    const raw = 'In an intervention that is expected to draw fierce criticism from the US and Israel, the foreign secretary will impose a UK ban on the trade in goods and some services from illegal Israeli settlements.He has also told civil society groups he is determined to reassert support for a two-state solution to the conflict with an appeal for the protection of Palestinian rights and respect for international law.In his statement to MPs, Miliband is expected to use firmer language than his recent predecessors in calling out the humanitarian injustices suffered by Palestinians in Gaza.';
    const expected = '<p>In an intervention that is expected to draw fierce criticism from the US and Israel, the foreign secretary will impose a UK ban on the trade in goods and some services from illegal Israeli settlements.</p><p>He has also told civil society groups he is {{c1::determined}} to reassert support for a two-state solution to the conflict with an appeal for the protection of Palestinian rights and respect for international law.</p><p>In his statement to MPs, Miliband is expected to use firmer language than his recent predecessors in calling out the humanitarian injustices suffered by Palestinians in Gaza.</p>';
    assert.strictEqual(wrapExamplePhraseInParagraphs(raw, 'determined'), expected);
});

test('splits on period+space sentence boundaries', () => {
    const raw = 'First sentence. Second sentence. Third sentence.';
    const expected = '<p>First sentence.</p><p>Second sentence.</p><p>Third sentence.</p>';
    assert.strictEqual(wrapExamplePhraseInParagraphs(raw, ''), expected);
});

test('splits on period with no following space (textContent behavior)', () => {
    const raw = 'settlements.He has also told law.In his statement';
    const expected = '<p>settlements.</p><p>He has also told law.</p><p>In his statement</p>';
    assert.strictEqual(wrapExamplePhraseInParagraphs(raw, ''), expected);
});

test('leaves a single sentence as one paragraph', () => {
    const raw = 'Just one sentence';
    const expected = '<p>Just one sentence</p>';
    assert.strictEqual(wrapExamplePhraseInParagraphs(raw, ''), expected);
});

test('does not wrap the word when word is empty', () => {
    const raw = 'He is determined to win.';
    assert.strictEqual(wrapExamplePhraseInParagraphs(raw, ''), '<p>He is determined to win.</p>');
});
