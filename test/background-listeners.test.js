const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load() {
    const ankiSrc = fs.readFileSync(path.join(__dirname, '..', 'bg', 'anki.js'), 'utf8');
    const listenersSrc = fs.readFileSync(path.join(__dirname, '..', 'bg', 'listeners.js'), 'utf8');
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(ankiSrc, sandbox);
    sandbox.chrome = {
        runtime: { onMessage: { addListener: () => {} } },
        tabs: { sendMessage: () => {} }
    };
    vm.runInContext(listenersSrc, sandbox);
    return sandbox;
}

function run(request, overrides) {
    const sandbox = load();
    const sent = [];
    sandbox.chrome.tabs.sendMessage = (tabId, obj) => sent.push([tabId, obj]);
    Object.assign(sandbox, overrides);
    return sandbox.messageHandler(request, { tab: { id: 7 } }).then(() =>
        sent.map(([tabId, obj]) => [tabId, JSON.parse(JSON.stringify(obj))])
    );
}

test('checkAnki reports a numeric Anki-connect version as success', async () => {
    const sent = await run({ msgType: 'checkAnki' }, { getAnkiVersion: async () => 6 });
    assert.deepStrictEqual(sent, [[7, { msgType: 'checkAnki', msg: { state: 'success', result: 6 } }]]);
});

test('checkAnki reports failure when Anki-connect is unreachable', async () => {
    const sent = await run({ msgType: 'checkAnki' }, {
        getAnkiVersion: async () => { throw new Error('unreachable'); }
    });
    assert.deepStrictEqual(sent, [[7, { msgType: 'checkAnki', msg: { state: 'failure' } }]]);
});

test('checkWordExists reports the boolean result as success', async () => {
    const sent = await run({ msgType: 'checkWordExists', word: 'run' }, {
        wordExistsInDeck: async () => true
    });
    assert.deepStrictEqual(sent, [[7, { msgType: 'checkWordExists', msg: { state: 'success', result: true } }]]);
});

test('addCard reports the numeric note id as success', async () => {
    const sent = await run({
        msgType: 'addCard', id: 'id-1', word: 'run', phrase: 'p', dfn: 'd',
        pageTitle: 'Title', dateCreated: '2026-03-07', frequency: '100', ipa: 'rʌn'
    }, { addCard: async () => 123 });
    assert.deepStrictEqual(sent, [[7, { msgType: 'addCard', msg: { state: 'success', result: 123 } }]]);
});

test('addCard reports failure when adding the card throws', async () => {
    const sent = await run({
        msgType: 'addCard', id: 'id-1', word: 'run', phrase: 'p', dfn: 'd',
        pageTitle: 'Title', dateCreated: '2026-03-07', frequency: '100', ipa: 'rʌn'
    }, { addCard: async () => { throw new Error('boom'); } });
    assert.deepStrictEqual(sent, [[7, { msgType: 'addCard', msg: { state: 'failure' } }]]);
});

test('unknown message types resolve to failure without calling Anki', async () => {
    let called = false;
    const sent = await run({ msgType: 'bogus' }, { getAnkiVersion: async () => { called = true; } });
    assert.strictEqual(called, false);
    assert.deepStrictEqual(sent, [[7, { msgType: 'bogus', msg: { state: 'failure' } }]]);
});
