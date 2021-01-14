// content.js

function doubleClickEventHandler() {
    let t = getSelectedParagraphText();
    alert(t);
}


function getSelectedParagraphText() {
    // Reminder: to get position, add marker to part of HTML of interest

    // This part seems to be working well.
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

    let node = selection.anchorNode;
    parent = node.parentNode;

    if (parent != null) {
        // This is a decent first approximation.
        return parent.innerText || parent.textContent;
    }

    return selection;
}

document.addEventListener("dblclick", doubleClickEventHandler);
