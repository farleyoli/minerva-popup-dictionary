const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'bg', 'deepseek.js'), 'utf8');
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    return sandbox;
}

function setDate(sandbox, year, month, day) {
    sandbox.Date = class {
        getFullYear() { return year; }
        getMonth() { return month - 1; }
        getDate() { return day; }
    };
}

function setup({ key = 'sk-abc', limit = 30000, usage = null, onSet = null } = {}) {
    const sandbox = load();
    setDate(sandbox, 2026, 9, 13);
    sandbox.chrome = {
        storage: {
            sync: {
                get: (defaults, cb) => {
                    cb({ ...defaults, deepseekDailyTokenLimit: limit });
                }
            },
            local: {
                get: (defaults, cb) => {
                    const items = { ...defaults, deepseekApiKey: key };
                    if (usage !== null) {
                        items.deepseekUsage = usage;
                    }
                    cb(items);
                },
                set: (items, cb) => {
                    if (onSet) onSet(items);
                    if (cb) cb();
                }
            }
        }
    };
    return sandbox;
}

function fakeResponse({ ok = true, status = 200, body } = {}) {
    return { ok, status, json: async () => body };
}

function completion(content, totalTokens) {
    const message = { choices: [{ message: { content } }] };
    if (totalTokens !== undefined) {
        message.usage = { total_tokens: totalTokens };
    }
    return message;
}

test('getDeepSeekApiKey returns the trimmed key from local storage', async () => {
    const sandbox = setup({ key: '  sk-abc  ' });
    assert.strictEqual(await sandbox.getDeepSeekApiKey(), 'sk-abc');
});

test('getDeepSeekApiKey resolves to an empty string when unset', async () => {
    const sandbox = setup({ key: '' });
    assert.strictEqual(await sandbox.getDeepSeekApiKey(), '');
});

test('getDeepSeekDailyTokenLimit returns the stored limit', async () => {
    const sandbox = setup({ limit: 12345 });
    assert.strictEqual(await sandbox.getDeepSeekDailyTokenLimit(), 12345);
});

test('getDeepSeekDailyTokenLimit falls back on invalid values', async () => {
    const sandbox = setup({ limit: 'bogus' });
    assert.strictEqual(await sandbox.getDeepSeekDailyTokenLimit(), 30000);
});

test('getDeepSeekUsage resets usage recorded on an earlier day', async () => {
    const sandbox = setup({ usage: { date: '2000-01-01', tokens: 5000 } });
    assert.deepStrictEqual(
        JSON.parse(JSON.stringify(await sandbox.getDeepSeekUsage())),
        { date: '2026-09-13', tokens: 0 }
    );
});

test('getDeepSeekUsage keeps usage recorded today', async () => {
    const sandbox = setup({ usage: { date: '2026-09-13', tokens: 500 } });
    assert.deepStrictEqual(
        JSON.parse(JSON.stringify(await sandbox.getDeepSeekUsage())),
        { date: '2026-09-13', tokens: 500 }
    );
});

test('generateExamplePhrase rejects when no key is configured', async () => {
    const sandbox = setup({ key: '' });
    let called = false;
    sandbox.fetch = async () => { called = true; };
    await assert.rejects(
        sandbox.generateExamplePhrase('run', 'move fast', 'I run.'),
        (error) => error.reason === 'config'
    );
    assert.strictEqual(called, false);
});

test('generateExamplePhrase posts the prompt and returns the passage', async () => {
    const sandbox = setup();
    let request;
    sandbox.fetch = async (url, options) => {
        request = { url, options };
        return fakeResponse({ body: completion('  A calm passage.  ', 321) });
    };

    const passage = await sandbox.generateExamplePhrase(
        'determined', 'resolute', 'She was determined to win.'
    );
    assert.strictEqual(passage, 'A calm passage.');
    assert.strictEqual(request.url, 'https://api.deepseek.com/chat/completions');
    assert.strictEqual(request.options.method, 'POST');
    assert.strictEqual(request.options.headers['Content-Type'], 'application/json');
    assert.strictEqual(request.options.headers.Authorization, 'Bearer sk-abc');

    const body = JSON.parse(request.options.body);
    assert.strictEqual(body.model, 'deepseek-chat');
    assert.strictEqual(body.stream, false);
    assert.strictEqual(body.messages.length, 2);
    assert.match(body.messages[1].content, /determined/);
    assert.match(body.messages[1].content, /resolute/);
    assert.match(body.messages[1].content, /She was determined to win\./);
    assert.match(body.messages[1].content, /2 to 3 sentences/);
    assert.match(body.messages[1].content, /every occurrence of the target word is exactly as written/);
});

test('generateExamplePhrase omits the original context when it is empty', async () => {
    const sandbox = setup();
    let request;
    sandbox.fetch = async (url, options) => {
        request = { url, options };
        return fakeResponse({ body: completion('A passage.', 100) });
    };
    await sandbox.generateExamplePhrase('run', 'move fast', '');
    const body = JSON.parse(request.options.body);
    assert.doesNotMatch(body.messages[1].content, /Original context:/);
});

test('generateExamplePhrase strips wrapping quotes from the passage', async () => {
    const sandbox = setup();
    sandbox.fetch = async () => fakeResponse({
        body: completion('"A quoted passage."', 100)
    });
    assert.strictEqual(
        await sandbox.generateExamplePhrase('run', 'move fast', 'I run.'),
        'A quoted passage.'
    );
});

test('generateJapaneseDefinition posts the Japanese words prompt and returns the words', async () => {
    const sandbox = setup();
    let request;
    sandbox.fetch = async (url, options) => {
        request = { url, options };
        return fakeResponse({ body: completion('  走る、走ること。  ', 50) });
    };

    const words = await sandbox.generateJapaneseDefinition('run', 'move fast');
    assert.strictEqual(words, '走る、走ること。');
    assert.strictEqual(request.url, 'https://api.deepseek.com/chat/completions');
    const body = JSON.parse(request.options.body);
    assert.strictEqual(body.model, 'deepseek-chat');
    assert.strictEqual(body.stream, false);
    assert.strictEqual(body.messages.length, 2);
    assert.match(body.messages[0].content, /Japanese/);
    assert.match(body.messages[1].content, /run/);
    assert.match(body.messages[1].content, /move fast/);
    assert.match(body.messages[1].content, /1 to 3 Japanese words/);
    assert.doesNotMatch(body.messages[1].content, /2 to 3 sentences/);
});

test('generateJapaneseDefinition records the tokens reported by the API', async () => {
    let stored;
    const sandbox = setup({
        usage: { date: '2026-09-13', tokens: 100 },
        onSet: (items) => { stored = items.deepseekUsage; }
    });
    sandbox.fetch = async () => fakeResponse({ body: completion('走ること。', 321) });
    await sandbox.generateJapaneseDefinition('run', 'move fast');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(stored)), { date: '2026-09-13', tokens: 421 });
});

test('generateExamplePhrase rejects on a non-OK response', async () => {
    const sandbox = setup();
    sandbox.fetch = async () => fakeResponse({ ok: false, status: 401 });
    await assert.rejects(
        sandbox.generateExamplePhrase('run', 'move fast', 'I run.'),
        (error) => error.reason === 'api' && /status 401/.test(error.message)
    );
});

test('generateExamplePhrase rejects on a malformed completion', async () => {
    const sandbox = setup();
    sandbox.fetch = async () => fakeResponse({ body: { choices: [] } });
    await assert.rejects(
        sandbox.generateExamplePhrase('run', 'move fast', 'I run.'),
        (error) => error.reason === 'api'
    );
});

test('generateExamplePhrase rejects on an empty completion', async () => {
    const sandbox = setup();
    sandbox.fetch = async () => fakeResponse({ body: completion('   ') });
    await assert.rejects(
        sandbox.generateExamplePhrase('run', 'move fast', 'I run.'),
        (error) => error.reason === 'api'
    );
});

test('generateExamplePhrase propagates network failures', async () => {
    const sandbox = setup();
    sandbox.fetch = async () => { throw new Error('network down'); };
    await assert.rejects(
        sandbox.generateExamplePhrase('run', 'move fast', 'I run.'),
        /network down/
    );
});

test('generateExamplePhrase records the tokens reported by the API', async () => {
    let stored;
    const sandbox = setup({
        usage: { date: '2026-09-13', tokens: 100 },
        onSet: (items) => { stored = items.deepseekUsage; }
    });
    sandbox.fetch = async () => fakeResponse({ body: completion('A passage.', 321) });
    await sandbox.generateExamplePhrase('run', 'move fast', 'I run.');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(stored)), { date: '2026-09-13', tokens: 421 });
});

test('generateExamplePhrase estimates usage when the API omits it', async () => {
    let stored;
    const sandbox = setup({ onSet: (items) => { stored = items.deepseekUsage; } });
    sandbox.fetch = async () => fakeResponse({ body: completion('A passage.') });
    await sandbox.generateExamplePhrase('run', 'move fast', 'I run.');
    assert.ok(stored.tokens > 0);
    assert.strictEqual(stored.date, '2026-09-13');
});

test('generateExamplePhrase blocks once the daily limit is reached', async () => {
    const sandbox = setup({ limit: 30000, usage: { date: '2026-09-13', tokens: 30000 } });
    let called = false;
    sandbox.fetch = async () => { called = true; };
    await assert.rejects(
        sandbox.generateExamplePhrase('run', 'move fast', 'I run.'),
        (error) => error.reason === 'limit'
    );
    assert.strictEqual(called, false);
});

test('a daily limit of zero disables the limit', async () => {
    const sandbox = setup({ limit: 0, usage: { date: '2026-09-13', tokens: 999999 } });
    sandbox.fetch = async () => fakeResponse({ body: completion('A passage.', 10) });
    assert.strictEqual(
        await sandbox.generateExamplePhrase('run', 'move fast', 'I run.'),
        'A passage.'
    );
});
