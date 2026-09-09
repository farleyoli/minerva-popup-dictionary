const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class FakeXHR {
    static instances = [];
    constructor() {
        FakeXHR.instances.push(this);
        this.listeners = {};
        this.responseText = '';
    }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    open(method, url) { this.method = method; this.url = url; }
    send(body) { this.body = body; }
}

function loadAnki() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'bg', 'anki.js'), 'utf8') +
        '\nthis.minervaTestExports = { MINERVA_MODEL_FIELDS, MINERVA_CARD_TEMPLATE, MINERVA_MODEL_CSS, DEFAULT_DECK_NAME };';
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    return sandbox;
}

function setup() {
    const sandbox = loadAnki();
    return { sandbox, ...sandbox.minervaTestExports };
}

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

test('invoke POSTs the action, version, and params to Anki-connect', async () => {
    const { sandbox } = setup();
    FakeXHR.instances = [];
    sandbox.XMLHttpRequest = FakeXHR;
    const promise = sandbox.invoke('deckNames', 6, { deck: 'test' });
    const xhr = FakeXHR.instances[0];
    assert.strictEqual(xhr.method, 'POST');
    assert.strictEqual(xhr.url, 'http://127.0.0.1:8765');
    assert.deepStrictEqual(JSON.parse(xhr.body), {
        action: 'deckNames', version: 6, params: { deck: 'test' }
    });
    xhr.responseText = JSON.stringify({ result: ['a'], error: null });
    xhr.listeners.load();
    await promise;
});

test('invoke resolves with the result field', async () => {
    const { sandbox } = setup();
    FakeXHR.instances = [];
    sandbox.XMLHttpRequest = FakeXHR;
    const promise = sandbox.invoke('version', 6);
    const xhr = FakeXHR.instances[0];
    xhr.responseText = JSON.stringify({ result: 6, error: null });
    xhr.listeners.load();
    assert.strictEqual(await promise, 6);
});

test('invoke rejects with the error field message', async () => {
    const { sandbox } = setup();
    FakeXHR.instances = [];
    sandbox.XMLHttpRequest = FakeXHR;
    const promise = sandbox.invoke('addNote', 6);
    const xhr = FakeXHR.instances[0];
    xhr.responseText = JSON.stringify({ result: null, error: 'deck not found' });
    xhr.listeners.load();
    await assert.rejects(promise, (reason) => reason === 'deck not found');
});

test('invoke rejects when the response has an unexpected number of fields', async () => {
    const { sandbox } = setup();
    FakeXHR.instances = [];
    sandbox.XMLHttpRequest = FakeXHR;
    const promise = sandbox.invoke('version', 6);
    const xhr = FakeXHR.instances[0];
    xhr.responseText = JSON.stringify({ result: 6 });
    xhr.listeners.load();
    await assert.rejects(promise);
});

test('invoke rejects when the response is missing the error field', async () => {
    const { sandbox } = setup();
    FakeXHR.instances = [];
    sandbox.XMLHttpRequest = FakeXHR;
    const promise = sandbox.invoke('version', 6);
    const xhr = FakeXHR.instances[0];
    xhr.responseText = JSON.stringify({ result: 6, extra: null });
    xhr.listeners.load();
    await assert.rejects(promise);
});

test('invoke rejects when the response is missing the result field', async () => {
    const { sandbox } = setup();
    FakeXHR.instances = [];
    sandbox.XMLHttpRequest = FakeXHR;
    const promise = sandbox.invoke('version', 6);
    const xhr = FakeXHR.instances[0];
    xhr.responseText = JSON.stringify({ error: null, extra: null });
    xhr.listeners.load();
    await assert.rejects(promise);
});

test('invoke rejects when the response is not valid JSON', async () => {
    const { sandbox } = setup();
    FakeXHR.instances = [];
    sandbox.XMLHttpRequest = FakeXHR;
    const promise = sandbox.invoke('version', 6);
    const xhr = FakeXHR.instances[0];
    xhr.responseText = 'not json';
    xhr.listeners.load();
    await assert.rejects(promise);
});

test('invoke rejects when the request fails to reach Anki', async () => {
    const { sandbox } = setup();
    FakeXHR.instances = [];
    sandbox.XMLHttpRequest = FakeXHR;
    const promise = sandbox.invoke('version', 6);
    const xhr = FakeXHR.instances[0];
    xhr.listeners.error();
    await assert.rejects(promise, (reason) => reason === 'failed to issue request');
});

test('getDeckName resolves with the deck name from storage', async () => {
    const { sandbox } = setup();
    sandbox.chrome = {
        storage: { sync: { get: (defaults, cb) => cb({ deckName: 'My Deck' }) } }
    };
    assert.strictEqual(await sandbox.getDeckName(), 'My Deck');
});

test('getDeckName passes the default deck name to storage', async () => {
    const { sandbox } = setup();
    let capturedDefaults;
    sandbox.chrome = {
        storage: {
            sync: {
                get: (defaults, cb) => {
                    capturedDefaults = defaults;
                    cb(defaults);
                }
            }
        }
    };
    await sandbox.getDeckName();
    assert.deepStrictEqual(plain(capturedDefaults), { deckName: 'Minerva Extension' });
});

test('migrateMinervaModel rejects unknown field layouts', async () => {
    const { sandbox } = setup();
    sandbox.invoke = async () => { throw new Error('must not be called'); };
    assert.strictEqual(await sandbox.migrateMinervaModel(['id', 'bogus']), false);
});

test('migrateMinervaModel rejects layouts with extra trailing fields', async () => {
    const { sandbox, MINERVA_MODEL_FIELDS } = setup();
    const tooMany = [...MINERVA_MODEL_FIELDS, 'extra'];
    sandbox.invoke = async () => { throw new Error('must not be called'); };
    assert.strictEqual(await sandbox.migrateMinervaModel(tooMany), false);
});

test('migrateMinervaModel appends new fields and updates the template in place', async () => {
    const { sandbox, MINERVA_MODEL_FIELDS, MINERVA_CARD_TEMPLATE } = setup();
    const calls = [];
    sandbox.invoke = async (action, version, params) => { calls.push([action, params]); };
    sandbox.getModelFieldNames = async () => [...MINERVA_MODEL_FIELDS];
    sandbox.getModelTemplates = async () => ({ [MINERVA_CARD_TEMPLATE.Name]: MINERVA_CARD_TEMPLATE });

    const oldFields = ['id', 'word', 'example-phrase', 'definition'];
    assert.strictEqual(await sandbox.migrateMinervaModel(oldFields), true);

    const added = calls
        .filter(([action]) => action === 'modelFieldAdd')
        .map(([, params]) => params.fieldName);
    assert.deepStrictEqual(added, ['page-title', 'date-created', 'frequency']);
    assert.ok(calls.some(([action]) => action === 'updateModelTemplates'));
});

test('migrateMinervaModel reports failure when a migration call throws', async () => {
    const { sandbox } = setup();
    sandbox.invoke = async () => { throw new Error('boom'); };
    assert.strictEqual(
        await sandbox.migrateMinervaModel(['id', 'word', 'example-phrase', 'definition']),
        false
    );
});

test('ensureMinervaModel creates the model when it is missing', async () => {
    const { sandbox } = setup();
    let created = false;
    sandbox.getModelNames = async () => [];
    sandbox.createMinervaModel = async () => { created = true; };
    await sandbox.ensureMinervaModel();
    assert.strictEqual(created, true);
});

test('ensureMinervaModel leaves an already-correct model untouched', async () => {
    const { sandbox, MINERVA_MODEL_FIELDS, MINERVA_CARD_TEMPLATE } = setup();
    let created = false;
    let migrated = false;
    sandbox.getModelNames = async () => ['minerva-popup-dictionary'];
    sandbox.getModelFieldNames = async () => [...MINERVA_MODEL_FIELDS];
    sandbox.getModelTemplates = async () => ({ [MINERVA_CARD_TEMPLATE.Name]: MINERVA_CARD_TEMPLATE });
    sandbox.createMinervaModel = async () => { created = true; };
    sandbox.migrateMinervaModel = async () => { migrated = true; return true; };
    sandbox.updateMinervaStyling = async () => {};
    await sandbox.ensureMinervaModel();
    assert.strictEqual(created, false);
    assert.strictEqual(migrated, false);
});

test('ensureMinervaModel throws when an outdated model cannot be migrated', async () => {
    const { sandbox } = setup();
    sandbox.getModelNames = async () => ['minerva-popup-dictionary'];
    sandbox.getModelFieldNames = async () => ['id', 'word'];
    sandbox.getModelTemplates = async () => ({});
    sandbox.migrateMinervaModel = async () => false;
    await assert.rejects(sandbox.ensureMinervaModel());
});

test('ensureDeck creates the deck when it is missing', async () => {
    const { sandbox } = setup();
    const calls = [];
    sandbox.getDeckNames = async () => ['Other'];
    sandbox.invoke = async (action, version, params) => { calls.push([action, params]); };
    await sandbox.ensureDeck('Minerva Extension');
    assert.deepStrictEqual(plain(calls), [['createDeck', { deck: 'Minerva Extension' }]]);
});

test('ensureDeck does nothing when the deck already exists', async () => {
    const { sandbox } = setup();
    let called = false;
    sandbox.getDeckNames = async () => ['Minerva Extension'];
    sandbox.invoke = async () => { called = true; };
    await sandbox.ensureDeck('Minerva Extension');
    assert.strictEqual(called, false);
});

test('wordExistsInDeck reports existing cards using canAddNote', async () => {
    const { sandbox } = setup();
    let captured;
    let canAdd;
    sandbox.ensureMinervaModel = async () => {};
    sandbox.getDeckName = async () => 'My Deck';
    sandbox.ensureDeck = async () => {};
    sandbox.invoke = async (action, version, params) => {
        captured = { action, params };
        return canAdd;
    };

    canAdd = false;
    assert.strictEqual(await sandbox.wordExistsInDeck('foo'), true);
    assert.strictEqual(captured.action, 'canAddNote');
    assert.strictEqual(captured.params.note.deckName, 'My Deck');
    assert.strictEqual(captured.params.note.modelName, 'minerva-popup-dictionary');
    assert.strictEqual(captured.params.note.fields.id, 'foo');
    assert.strictEqual(captured.params.note.fields.word, 'foo');
    assert.strictEqual(captured.params.note.options.allowDuplicate, false);
    assert.strictEqual(captured.params.note.options.duplicateScope, 'deck');

    canAdd = true;
    assert.strictEqual(await sandbox.wordExistsInDeck('foo'), false);
});

test('addCard builds the note from the given fields and adds it', async () => {
    const { sandbox } = setup();
    let captured;
    sandbox.ensureMinervaModel = async () => {};
    sandbox.getDeckName = async () => 'My Deck';
    sandbox.ensureDeck = async () => {};
    sandbox.invoke = async (action, version, params) => {
        captured = { action, params };
        return 123;
    };

    const result = await sandbox.addCard(
        'id-1', 'word', 'phrase', 'dfn', 'Title', '2026-03-07', '100'
    );
    assert.strictEqual(result, 123);
    assert.strictEqual(captured.action, 'addNote');
    assert.strictEqual(captured.params.note.deckName, 'My Deck');
    assert.strictEqual(captured.params.note.modelName, 'minerva-popup-dictionary');
    assert.deepStrictEqual(plain(captured.params.note.fields), {
        id: 'id-1',
        word: 'word',
        'example-phrase': 'phrase',
        definition: 'dfn',
        'page-title': 'Title',
        'date-created': '2026-03-07',
        frequency: '100'
    });
    assert.deepStrictEqual(plain(captured.params.note.options), {
        allowDuplicate: false,
        duplicateScope: 'deck',
        duplicateScopeOptions: {
            deckName: 'My Deck',
            checkChildren: false
        }
    });
});

test('Anki-connect wrapper functions pass the expected action and params', async () => {
    const { sandbox } = setup();
    const calls = [];
    sandbox.invoke = async (action, version, params) => {
        calls.push([action, plain(params || {})]);
        return action;
    };
    await sandbox.getDeckNames();
    await sandbox.getAnkiVersion();
    await sandbox.getModelNames();
    await sandbox.getModelFieldNames('m');
    await sandbox.getModelTemplates('m');
    await sandbox.getModelStyling('m');
    assert.deepStrictEqual(calls, [
        ['deckNames', {}],
        ['version', {}],
        ['modelNames', {}],
        ['modelFieldNames', { modelName: 'm' }],
        ['modelTemplates', { modelName: 'm' }],
        ['modelStyling', { modelName: 'm' }]
    ]);
});

test('createMinervaModel sends the Minerva model definition', async () => {
    const { sandbox, MINERVA_MODEL_FIELDS, MINERVA_CARD_TEMPLATE } = setup();
    let captured;
    sandbox.invoke = async (action, version, params) => { captured = params; };
    await sandbox.createMinervaModel();
    assert.strictEqual(captured.modelName, 'minerva-popup-dictionary');
    assert.deepStrictEqual(plain(captured.inOrderFields), [...MINERVA_MODEL_FIELDS]);
    assert.strictEqual(captured.isCloze, true);
    assert.deepStrictEqual(plain(captured.cardTemplates), [plain(MINERVA_CARD_TEMPLATE)]);
    assert.ok(captured.css.length > 0);
});

test('removeMinervaModel deletes notes and prunes the empty model', async () => {
    const { sandbox } = setup();
    const calls = [];
    sandbox.invoke = async (action, version, params) => {
        calls.push([action, plain(params || {})]);
        if (action === 'findNotes') return [11, 22];
    };
    await sandbox.removeMinervaModel();
    assert.deepStrictEqual(calls, [
        ['findNotes', { query: 'note:"minerva-popup-dictionary"' }],
        ['deleteNotes', { notes: [11, 22] }],
        ['removeEmptyNotes', {}]
    ]);
});

test('removeMinervaModel skips deleteNotes when no notes use the model', async () => {
    const { sandbox } = setup();
    const calls = [];
    sandbox.invoke = async (action) => { calls.push(action); return []; };
    await sandbox.removeMinervaModel();
    assert.deepStrictEqual(calls, ['findNotes', 'removeEmptyNotes']);
});

test('reconcileMinervaStyling gives up when modelStyling is unavailable', async () => {
    const { sandbox } = setup();
    let updated = false;
    sandbox.getModelStyling = async () => { throw new Error('unavailable'); };
    sandbox.invoke = async () => { updated = true; };
    await sandbox.reconcileMinervaStyling();
    assert.strictEqual(updated, false);
});

test('reconcileMinervaStyling does nothing when styling already matches', async () => {
    const { sandbox, MINERVA_MODEL_CSS } = setup();
    let updated = false;
    sandbox.getModelStyling = async () => ({ css: MINERVA_MODEL_CSS });
    sandbox.invoke = async () => { updated = true; };
    await sandbox.reconcileMinervaStyling();
    assert.strictEqual(updated, false);
});

test('reconcileMinervaStyling updates styling when it differs', async () => {
    const { sandbox, MINERVA_MODEL_CSS } = setup();
    let captured;
    sandbox.getModelStyling = async () => ({ css: '' });
    sandbox.invoke = async (action, version, params) => { captured = { action, params }; };
    await sandbox.reconcileMinervaStyling();
    assert.strictEqual(captured.action, 'updateModelStyling');
    assert.strictEqual(captured.params.model.name, 'minerva-popup-dictionary');
    assert.strictEqual(captured.params.model.css, MINERVA_MODEL_CSS);
});

test('reconcileMinervaStyling swallows update failures', async () => {
    const { sandbox } = setup();
    sandbox.getModelStyling = async () => ({ css: '' });
    sandbox.invoke = async () => { throw new Error('no update'); };
    await sandbox.reconcileMinervaStyling();
});

test('updateMinervaStyling never throws when reconciliation fails', async () => {
    const { sandbox } = setup();
    sandbox.reconcileMinervaStyling = async () => { throw new Error('boom'); };
    await sandbox.updateMinervaStyling();
});

test('isDesiredModel rejects a missing or mismatched card template', () => {
    const { sandbox, MINERVA_MODEL_FIELDS, MINERVA_CARD_TEMPLATE } = setup();
    assert.strictEqual(sandbox.isDesiredModel([...MINERVA_MODEL_FIELDS], {}), false);
    assert.strictEqual(
        sandbox.isDesiredModel(
            [...MINERVA_MODEL_FIELDS],
            { [MINERVA_CARD_TEMPLATE.Name]: { Front: 'wrong', Back: MINERVA_CARD_TEMPLATE.Back } }
        ),
        false
    );
});
