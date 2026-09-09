const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'fg', 'content.js'), 'utf8') +
    '\nthis.getDictionaryHeadwordForTest = getDictionaryHeadword;' +
    '\nthis.filterVerifiedHeadwordsForTest = filterVerifiedHeadwords;' +
    '\nthis.filterVerifiedPhrasalVerbsForTest = filterVerifiedPhrasalVerbs;';
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const getDictionaryHeadword = sandbox.getDictionaryHeadwordForTest;
const filterVerifiedHeadwords = sandbox.filterVerifiedHeadwordsForTest;
const filterVerifiedPhrasalVerbs = sandbox.filterVerifiedPhrasalVerbsForTest;

const mkEntry = (ctnt) => [{head: ['s'], dfn: [{ctnt: ctnt, dfn: [], exs: [], qts: []}]}];

test('uses the dictionary capitalization for proper-noun suggestions', () => {
    assert.strictEqual(getDictionaryHeadword({Houthi: []}, 'houthi'), 'Houthi');
});

test('preserves exact dictionary headwords for ordinary suggestions', () => {
    assert.strictEqual(getDictionaryHeadword({run: []}, 'run'), 'run');
});

test('shows links to every dictionary-verified candidate', () => {
    const dictionaries = {
        distill: mkEntry('(transitive) To subject a substance to distillation.'),
        distil: mkEntry('(transitive) To subject a substance to distillation.')
    };
    assert.deepStrictEqual(
        [...filterVerifiedHeadwords(dictionaries, ['distill', 'distille', 'distil'])],
        ['distill', 'distil']
    );
});

test('keeps the candidate order when showing all links', () => {
    const dictionaries = {
        distill: mkEntry('(transitive) To subject a substance to distillation.'),
        distil: mkEntry('(transitive) To subject a substance to distillation.')
    };
    assert.deepStrictEqual(
        [...filterVerifiedHeadwords(dictionaries, ['distil', 'distill'])],
        ['distil', 'distill']
    );
});

test('drops candidates that are not in the dictionary', () => {
    const dictionaries = {
        run: mkEntry('(heading) To move swiftly.')
    };
    assert.deepStrictEqual(
        [...filterVerifiedHeadwords(dictionaries, ['runn', 'runne', 'run'])],
        ['run']
    );
});

test('keeps proper nouns among the suggested links', () => {
    const dictionaries = {Houthi: mkEntry('A member of the Houthi movement.')};
    assert.deepStrictEqual(
        [...filterVerifiedHeadwords(dictionaries, ['houthi'])],
        ['Houthi']
    );
});

test('deduplicates repeated candidates', () => {
    const dictionaries = {run: mkEntry('(heading) To move swiftly.')};
    assert.deepStrictEqual(
        [...filterVerifiedHeadwords(dictionaries, ['run', 'run'])],
        ['run']
    );
});

test('shows links to every dictionary-verified phrasal verb', () => {
    const dictionaries = {
        'take off': mkEntry('To remove.'),
        'tak off': mkEntry('(obsolete) to remove.')
    };
    assert.deepStrictEqual(
        [...filterVerifiedPhrasalVerbs(dictionaries, ['tak off', 'take off', 'take up'])],
        ['tak off', 'take off']
    );
});
