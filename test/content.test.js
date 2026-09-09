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

test('getFullDefinitionText flattens recursive definitions and strips tags', () => {
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
    assert.strictEqual(getFullDefinitionText(dict, 'run'), 'A definition x. Sub-definition.');
});

test('getFullDefinitionText cleans markup before joining', () => {
    const dict = {
        run: [{
            head: ['s'],
            dfn: [{ctnt: '{{form of|lang=en}} To move swiftly.', dfn: [], exs: [], qts: []}]
        }]
    };
    assert.strictEqual(getFullDefinitionText(dict, 'run'), 'form lang=en}} To move swiftly.');
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
