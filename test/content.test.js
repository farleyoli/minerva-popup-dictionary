const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const utilsSrc = fs.readFileSync(path.join(__dirname, '..', 'fg', 'utils.js'), 'utf8');
const contentSrc = fs.readFileSync(path.join(__dirname, '..', 'fg', 'content.js'), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(utilsSrc, sandbox);
vm.runInContext(contentSrc, sandbox);

const processContent = sandbox.processContent;
const getFullDefinitionText = sandbox.getFullDefinitionText;
const getPlainDefinitionText = sandbox.getPlainDefinitionText;
const getPopupPosition = sandbox.getPopupPosition;
const isInsidePopup = sandbox.isInsidePopup;

test('processContent removes leading template pipes', () => {
    assert.strictEqual(processContent('{{label|something'), 'something');
});

test('processContent replaces mid-word pipe markup with a space', () => {
    assert.strictEqual(processContent('some text {{link|target}}'), 'some text target}}');
});

test('processContent separates glued "singular" from a following suffix', () => {
    assert.strictEqual(processContent('{{form of|lang=en}}singularis'), 'form lang=en}}singular is');
});

test('processContent leaves plain definitions untouched', () => {
    assert.strictEqual(processContent('regular definition without pipes'), 'regular definition without pipes');
});

test('getFullDefinitionText renders numbered, nested senses as HTML', () => {
    const dict = {
        run: [{
            head: ['s'],
            dfn: [
                {ctnt: 'A definition <math>x</math>.', dfn: [
                    {ctnt: 'Sub-definition.', dfn: []}
                ], exs: [], qts: []}
            ]
        }]
    };
    assert.strictEqual(
        getFullDefinitionText(dict, 'run'),
        '<ol><li>A definition x.<ol><li>Sub-definition.</li></ol></li></ol>'
    );
});

test('getFullDefinitionText cleans markup before wrapping in a list', () => {
    const dict = {
        run: [{
            head: ['s'],
            dfn: [{ctnt: '{{form of|lang=en}} To move swiftly.', dfn: [], exs: [], qts: []}]
        }]
    };
    assert.strictEqual(
        getFullDefinitionText(dict, 'run'),
        '<ol><li>form lang=en}} To move swiftly.</li></ol>'
    );
});

test('getFullDefinitionText escapes leftover angle brackets and keeps entities', () => {
    const dict = {
        run: [{
            head: ['s'],
            dfn: [
                {ctnt: 'a &mdash; b < c', dfn: [], exs: [], qts: []},
                {ctnt: 'd > e', dfn: [], exs: [], qts: []}
            ]
        }]
    };
    assert.strictEqual(
        getFullDefinitionText(dict, 'run'),
        '<ol><li>a &mdash; b &lt; c</li><li>d &gt; e</li></ol>'
    );
});

test('getFullDefinitionText renders one list per top-level entry', () => {
    const dict = {
        run: [
            {head: ['s'], dfn: [{ctnt: 'First sense.', dfn: [], exs: [], qts: []}]},
            {head: ['s'], dfn: [{ctnt: 'Second sense.', dfn: [], exs: [], qts: []}]}
        ]
    };
    assert.strictEqual(
        getFullDefinitionText(dict, 'run'),
        '<ol><li>First sense.</li></ol><ol><li>Second sense.</li></ol>'
    );
});

test('getPlainDefinitionText flattens numbered senses into plain text', () => {
    assert.strictEqual(
        getPlainDefinitionText(
            '<ol><li>First sense.</li><li>Second <em>sense</em>.</li></ol>'
        ),
        'First sense. Second sense.'
    );
    assert.strictEqual(
        getPlainDefinitionText('<ol><li>A<ol><li>Nested.</li></ol></li></ol>'),
        'A Nested.'
    );
});

test('getPlainDefinitionText collapses whitespace and trims', () => {
    assert.strictEqual(getPlainDefinitionText('  <ol>  <li>  spaced  </li> </ol>  '), 'spaced');
});

test('getPopupPosition keeps an on-screen popup offset from the mouse', () => {
    sandbox.window = { innerWidth: 1000, innerHeight: 700 };
    assert.deepStrictEqual([...getPopupPosition(300, 200, 100, 100)], [115, 115, 415, 315]);
});

test('getPopupPosition flips the popup when it would overflow the screen', () => {
    sandbox.window = { innerWidth: 1000, innerHeight: 700 };
    assert.deepStrictEqual([...getPopupPosition(300, 200, 900, 600)], [570, 370, 870, 570]);
});

test('isInsidePopup reports points within the popup bounds', () => {
    const popup = { style: { left: '100px', top: '50px', width: '200px', height: '100px' } };
    assert.strictEqual(isInsidePopup(150, 75, popup), true);
    assert.strictEqual(isInsidePopup(100, 50, popup), true);
    assert.strictEqual(isInsidePopup(300, 150, popup), true);
});

test('isInsidePopup reports points outside the popup bounds', () => {
    const popup = { style: { left: '100px', top: '50px', width: '200px', height: '100px' } };
    assert.strictEqual(isInsidePopup(99, 75, popup), false);
    assert.strictEqual(isInsidePopup(301, 75, popup), false);
    assert.strictEqual(isInsidePopup(150, 151, popup), false);
});
