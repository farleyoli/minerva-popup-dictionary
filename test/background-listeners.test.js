const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load() {
    const ankiSrc = fs.readFileSync(path.join(__dirname, '..', 'bg', 'anki.js'), 'utf8');
    const deepseekSrc = fs.readFileSync(path.join(__dirname, '..', 'bg', 'deepseek.js'), 'utf8');
    const listenersSrc = fs.readFileSync(path.join(__dirname, '..', 'bg', 'listeners.js'), 'utf8');
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(ankiSrc, sandbox);
    vm.runInContext(deepseekSrc, sandbox);
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

test('addCard with the deepseek card type routes to addAiCard with the original phrase and Japanese definition', async () => {
    let captured;
    const sent = await run({
        msgType: 'addCard', id: 'id-1', word: 'run', phrase: 'p',
        originalPhrase: 'orig', dfn: 'd', pageTitle: 'Title',
        dateCreated: '2026-03-07', frequency: '100', ipa: 'rʌn',
        cardType: 'deepseek', japaneseDefinition: '走る。'
    }, {
        addAiCard: async (...args) => { captured = args; return 321; },
        addCard: async () => { throw new Error('wrong model'); }
    });
    assert.deepStrictEqual(captured, [
        'id-1', 'run', 'p', 'orig', 'd', 'Title', '2026-03-07', '100', 'rʌn',
        '走る。'
    ]);
    assert.deepStrictEqual(sent, [[7, { msgType: 'addCard', msg: { state: 'success', result: 321 } }]]);
});

test('addCard with the page card type routes to addCard', async () => {
    let captured;
    const sent = await run({
        msgType: 'addCard', id: 'id-1', word: 'run', phrase: 'p', dfn: 'd',
        pageTitle: 'Title', dateCreated: '2026-03-07', frequency: '100', ipa: 'rʌn'
    }, {
        addCard: async (...args) => { captured = args; return 123; },
        addAiCard: async () => { throw new Error('wrong model'); }
    });
    assert.deepStrictEqual(captured, [
        'id-1', 'run', 'p', 'd', 'Title', '2026-03-07', '100', 'rʌn'
    ]);
    assert.deepStrictEqual(sent, [[7, { msgType: 'addCard', msg: { state: 'success', result: 123 } }]]);
});

test('generateExamplePhrase reports the generated passage and Japanese definition as success', async () => {
    const sent = await run({
        msgType: 'generateExamplePhrase', word: 'run', definition: 'd', originalPhrase: 'o'
    }, {
        generateExamplePhrase: async () => 'A short passage.',
        generateJapaneseDefinition: async () => '短い説明。'
    });
    assert.deepStrictEqual(sent, [[7, {
        msgType: 'generateExamplePhrase',
        msg: {
            state: 'success',
            result: 'A short passage.',
            japaneseDefinition: '短い説明。'
        }
    }]]);
});

test('generateExamplePhrase reports an empty Japanese definition when its request fails', async () => {
    const sent = await run({
        msgType: 'generateExamplePhrase', word: 'run', definition: 'd', originalPhrase: 'o'
    }, {
        generateExamplePhrase: async () => 'A short passage.',
        generateJapaneseDefinition: async () => { throw new Error('no japanese'); }
    });
    assert.deepStrictEqual(sent, [[7, {
        msgType: 'generateExamplePhrase',
        msg: { state: 'success', result: 'A short passage.', japaneseDefinition: '' }
    }]]);
});

test('generateExamplePhrase does not request a Japanese definition when the phrase fails', async () => {
    let japaneseCalled = false;
    const sent = await run({
        msgType: 'generateExamplePhrase', word: 'run', definition: 'd', originalPhrase: 'o'
    }, {
        generateExamplePhrase: async () => { throw new Error('no phrase'); },
        generateJapaneseDefinition: async () => { japaneseCalled = true; return '短い説明。'; }
    });
    assert.strictEqual(japaneseCalled, false);
    assert.deepStrictEqual(sent, [[7, {
        msgType: 'generateExamplePhrase',
        msg: { state: 'failure' }
    }]]);
});

test('generateExamplePhrase reports failure when generation throws', async () => {
    const sent = await run({
        msgType: 'generateExamplePhrase', word: 'run', definition: 'd', originalPhrase: 'o'
    }, { generateExamplePhrase: async () => { throw new Error('no key'); } });
    assert.deepStrictEqual(sent, [[7, {
        msgType: 'generateExamplePhrase',
        msg: { state: 'failure' }
    }]]);
});

test('generateExamplePhrase forwards the failure reason when present', async () => {
    const sent = await run({
        msgType: 'generateExamplePhrase', word: 'run', definition: 'd', originalPhrase: 'o'
    }, {
        generateExamplePhrase: async () => {
            throw Object.assign(new Error('limit reached'), { reason: 'limit' });
        }
    });
    assert.deepStrictEqual(sent, [[7, {
        msgType: 'generateExamplePhrase',
        msg: { state: 'failure', reason: 'limit' }
    }]]);
});

test('checkWordExists checks the model matching the requested card type', async () => {
    let captured;
    await run({ msgType: 'checkWordExists', word: 'run', cardType: 'deepseek' }, {
        wordExistsInDeck: async (word, model) => { captured = { word, model }; return false; }
    });
    assert.strictEqual(captured.word, 'run');
    assert.strictEqual(captured.model.name, 'minerva-popup-dictionary-ai');
});

test('checkWordExists defaults to the page model', async () => {
    let captured;
    await run({ msgType: 'checkWordExists', word: 'run' }, {
        wordExistsInDeck: async (word, model) => { captured = { word, model }; return false; }
    });
    assert.strictEqual(captured.model.name, 'minerva-popup-dictionary');
});

test('unknown message types resolve to failure without calling Anki', async () => {
    let called = false;
    const sent = await run({ msgType: 'bogus' }, { getAnkiVersion: async () => { called = true; } });
    assert.strictEqual(called, false);
    assert.deepStrictEqual(sent, [[7, { msgType: 'bogus', msg: { state: 'failure' } }]]);
});
