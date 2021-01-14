// content.js

function doubleClickEventHandler() {
    let pos = getSelectedPosition();
    let beg = pos[0];
    let end = pos[1];
    let body = document.body;
    let allText = body.textContent || body.innerText;
    //alert(t);
    alert(allText.slice(beg, end));
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
        return "";
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
