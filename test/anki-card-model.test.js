const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadBackgroundAnki() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'bg', 'anki.js'), 'utf8') +
        '\nthis.minervaTestExports = { MINERVA_MODEL_FIELDS, MINERVA_CARD_TEMPLATE, isDesiredModel };';
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    return sandbox.minervaTestExports;
}

function loadContentWithDate(date) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'fg', 'content.js'), 'utf8') +
        '\nthis.minervaTestExports = { getCardCreationDate };';
    const sandbox = {Date: class {
        getFullYear() { return date.year; }
        getMonth() { return date.month - 1; }
        getDate() { return date.day; }
    }};
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    return sandbox.minervaTestExports;
}

test('Minerva model includes source metadata, IPA, and answer-side word', () => {
    const {MINERVA_MODEL_FIELDS, MINERVA_CARD_TEMPLATE} = loadBackgroundAnki();

    assert.deepStrictEqual([...MINERVA_MODEL_FIELDS], [
        'id', 'word', 'example-phrase', 'definition', 'page-title',
        'date-created', 'frequency', 'ipa'
    ]);
    assert.match(MINERVA_CARD_TEMPLATE.Front, /{{page-title}}/);
    assert.match(MINERVA_CARD_TEMPLATE.Front, /{{date-created}}/);
    assert.doesNotMatch(MINERVA_CARD_TEMPLATE.Front, /{{frequency}}/);
    assert.doesNotMatch(MINERVA_CARD_TEMPLATE.Front, /{{word}}/);
    assert.match(MINERVA_CARD_TEMPLATE.Back, /{{frequency}}/);
    assert.match(MINERVA_CARD_TEMPLATE.Back, /{{ipa}}/);
    assert.ok(
        MINERVA_CARD_TEMPLATE.Back.indexOf('{{cloze:example-phrase}}') <
        MINERVA_CARD_TEMPLATE.Back.indexOf('{{word}}')
    );
    assert.ok(
        MINERVA_CARD_TEMPLATE.Back.indexOf('{{word}}') <
        MINERVA_CARD_TEMPLATE.Back.indexOf('{{definition}}')
    );
});

test('the previous Minerva model is recognized as needing migration', () => {
    const {MINERVA_MODEL_FIELDS, MINERVA_CARD_TEMPLATE, isDesiredModel} = loadBackgroundAnki();
    const oldFields = ['id', 'word', 'example-phrase', 'definition'];
    const oldTemplates = {
        'Minerva Card': {
            Front: '{{cloze:example-phrase}}',
            Back: '{{cloze:example-phrase}}<hr id="answer"><div class="definition">{{definition}}</div>'
        }
    };
    const currentTemplates = {[MINERVA_CARD_TEMPLATE.Name]: MINERVA_CARD_TEMPLATE};

    assert.strictEqual(isDesiredModel(oldFields, oldTemplates), false);
    assert.strictEqual(isDesiredModel([...MINERVA_MODEL_FIELDS], currentTemplates), true);
});

test('card creation dates use a zero-padded local calendar date', () => {
    const {getCardCreationDate} = loadContentWithDate({year: 2026, month: 3, day: 7});
    assert.strictEqual(getCardCreationDate(), '2026-03-07');
});
