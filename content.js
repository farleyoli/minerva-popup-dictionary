// content.js

function doubleClickEventHandler() {
    let t = getSelectedPosition();
    let body = document.body;
    let allText = body.textContent || body.innerText;
    //alert(t);
    alert(allText.slice(t, t+20));
}


/**
 * Get position of selected text inside inner text of body
 * @return {Number}     position.
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

    let node = selection.anchorNode;

    let body = document.body;
    let allText = body.textContent || body.innerText;

    pos = allText.indexOf(node.textContent) + startOffset;

    return pos;
}

document.body.addEventListener("dblclick", doubleClickEventHandler);
