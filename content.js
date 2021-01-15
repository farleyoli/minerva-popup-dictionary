// content.js

function getDefinition(word) {
    const url = chrome.runtime.getURL('./a.json');
    fetch(url)
        .then((response) => response.json()) //assuming file contains json
        .then((dict) => {
             alert(dict[word][0]['dfn'][0]['ctnt']);
        });
    //dict = getA();
}

function doubleClickEventHandler() {
    let pos = getSelectedPosition();
    let body = document.body;
    let allText = body.textContent || body.innerText;
    let word = allText.slice(pos[0], pos[1]); 
    getDefinition(word);
}


/**
 * Get position of selected text inside inner text of body
 * @return {Number[]} beginning and ending position.
 */
function getSelectedPosition() {
    let selection = "";
    if (window.getSelection) {
        selection = window.getSelection();
    } else if (document.getSelection) {
        selection = document.getSelection();
    } else if (document.selection) {
        selection = document.selection.createRange();
    } else {
        return [];
    }

    let range = selection.getRangeAt(0);
    let startOffset = range.startOffset;
    let endOffset = startOffset + range.toString().length;

    let node = selection.anchorNode;

    let body = document.body;
    let allText = body.textContent || body.innerText;

    startOffset += allText.indexOf(node.textContent);
    endOffset += allText.indexOf(node.textContent);

    return [startOffset, endOffset];
}

document.body.addEventListener("dblclick", doubleClickEventHandler);
