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
const getEnglishBaseFormCandidates = sandbox.getEnglishBaseFormCandidates;
const getEnglishPhrasalVerbCandidates = sandbox.getEnglishPhrasalVerbCandidates;
const normalizePhraseCount = sandbox.normalizePhraseCount;
const getExamplePhraseContext = sandbox.getExamplePhraseContext;
const stripHtmlTags = sandbox.stripHtmlTags;

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

test('splits on question and exclamation sentence endings', () => {
    const raw = 'Is this working? Yes! It is.';
    const expected = '<p>Is this working?</p><p>Yes!</p><p>It is.</p>';
    assert.strictEqual(wrapExamplePhraseInParagraphs(raw, ''), expected);
});

test('captures exactly the configured surrounding sentences', () => {
    const raw = 'First sentence. Second has target! Third sentence? Fourth sentence.';
    const start = raw.indexOf('target');
    const end = start + 'target'.length;
    assert.strictEqual(
        getExamplePhraseContext(raw, start, end, 0, 0),
        'Second has target!'
    );
    assert.strictEqual(
        getExamplePhraseContext(raw, start, end, 1, 1),
        'First sentence. Second has target! Third sentence?'
    );
});

test('does not split common abbreviations when selecting context', () => {
    const raw = 'Dr. Smith found target. Then he left.';
    const start = raw.indexOf('target');
    const end = start + 'target'.length;
    assert.strictEqual(
        getExamplePhraseContext(raw, start, end, 0, 0),
        'Dr. Smith found target.'
    );
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

test('escapes HTML-significant characters in the captured text', () => {
    const raw = 'Use the <b> tag with a & b and 5 > 3 to test.';
    const expected = '<p>Use the &lt;b&gt; tag with a &amp; b and 5 &gt; 3 to test.</p>';
    assert.strictEqual(wrapExamplePhraseInParagraphs(raw, ''), expected);
});

test('escapes the cloze word itself', () => {
    const raw = 'The operator < means less than.';
    const expected = '<p>The operator {{c1::&lt;}} means less than.</p>';
    assert.strictEqual(wrapExamplePhraseInParagraphs(raw, '<'), expected);
});

test('clozes only whole-word occurrences', () => {
    const raw = 'He said he would visit the shelter.';
    const expected = '<p>{{c1::He}} said {{c1::he}} would visit the shelter.</p>';
    assert.strictEqual(wrapExamplePhraseInParagraphs(raw, 'he'), expected);
});

test('does not cloze the word inside longer words', () => {
    const raw = 'The determined woodpecker determined the outcome.';
    const expected = '<p>The {{c1::determined}} woodpecker {{c1::determined}} the outcome.</p>';
    assert.strictEqual(wrapExamplePhraseInParagraphs(raw, 'determined'), expected);
});

test('strips HTML tags from definition markup', () => {
    assert.strictEqual(
        stripHtmlTags('An equation involving a function <math>f(x)</math> and integrals.'),
        'An equation involving a function f(x) and integrals.'
    );
});

test('accepts only non-negative whole phrase counts', () => {
    assert.strictEqual(normalizePhraseCount(0, 1), 0);
    assert.strictEqual(normalizePhraseCount('3', 1), 3);
    assert.strictEqual(normalizePhraseCount(-1, 1), 1);
    assert.strictEqual(normalizePhraseCount('1.5', 1), 1);
    assert.strictEqual(normalizePhraseCount('', 1), 1);
});

test('finds regular English verb base-form candidates', () => {
    assert.deepStrictEqual([...getEnglishBaseFormCandidates('studies')], ['study']);
    assert.deepStrictEqual([...getEnglishBaseFormCandidates('ties')], ['tie']);
    assert.deepStrictEqual([...getEnglishBaseFormCandidates('denied')], ['deny']);
    assert.deepStrictEqual([...getEnglishBaseFormCandidates('tied')], ['tie']);
    assert.deepStrictEqual([...getEnglishBaseFormCandidates('lying')], ['lie']);
    assert.deepStrictEqual([...getEnglishBaseFormCandidates('making')], ['mak', 'make']);
    assert.deepStrictEqual([...getEnglishBaseFormCandidates('running')], ['runn', 'runne', 'run']);
    assert.deepStrictEqual([...getEnglishBaseFormCandidates('loved')], ['lov', 'love']);
    assert.deepStrictEqual([...getEnglishBaseFormCandidates('panicked')], ['panick', 'panicke', 'panic']);
    assert.deepStrictEqual([...getEnglishBaseFormCandidates('panicking')], ['panick', 'panicke', 'panic']);
});

test('finds common irregular English verb base forms', () => {
    assert.deepStrictEqual([...getEnglishBaseFormCandidates('were')], ['be']);
    assert.deepStrictEqual([...getEnglishBaseFormCandidates('written')], ['write']);
    assert.deepStrictEqual([...getEnglishBaseFormCandidates('GONE')], ['go']);
    assert.deepStrictEqual([...getEnglishBaseFormCandidates('swum')], ['swim']);
    assert.deepStrictEqual([...getEnglishBaseFormCandidates('sang')], ['sing']);
});

test('does not try to deconjugate non-words or non-English spellings', () => {
    assert.deepStrictEqual([...getEnglishBaseFormCandidates('')], []);
    assert.deepStrictEqual([...getEnglishBaseFormCandidates("can't")], []);
    assert.deepStrictEqual([...getEnglishBaseFormCandidates('42nd')], []);
});

test('finds adjacent-particle phrasal verb candidates', () => {
    assert.deepStrictEqual(
        [...getEnglishPhrasalVerbCandidates('taking', ' off at noon')],
        ['tak off', 'take off']
    );
    assert.deepStrictEqual(
        [...getEnglishPhrasalVerbCandidates('take', ' up a hobby')],
        ['take up']
    );
    assert.deepStrictEqual(
        [...getEnglishPhrasalVerbCandidates('looking for', ' a solution')],
        ['look for', 'looke for']
    );
    assert.deepStrictEqual(
        [...getEnglishPhrasalVerbCandidates('looking forward to', ' a break')],
        ['look forward to', 'looke forward to']
    );
});

test('does not treat ordinary following words as phrasal-verb particles', () => {
    assert.deepStrictEqual([...getEnglishPhrasalVerbCandidates('taking', ' notes')], []);
});
