/**
 * This function handles single-clicks from the user. It removes the definition popup
 * from the DOM if the user clicked outside it.
 */
function clickEventHandler() {
    let e = window.event;
    let mouseX = e.clientX;
    let mouseY = e.clientY;
    let openPopup = document.getElementById("minerva-popup");
    if (openPopup != null) {
        let isInside = isInsidePopup(mouseX, mouseY, openPopup);
        if (isInside) {
            return;
        }
        openPopup.remove();
    }
}

/**
 * This function handles double-clicks from the user. It adds the definition
 * of the selected word by the user to a popup and adds the popup to the
 * DOM.
 */
function doubleClickEventHandler() {
    let e = window.event;
    let mouseX = e.clientX;
    let mouseY = e.clientY;

    let pos = getSelectedPosition();
    let body = document.body;
    let allText = body.textContent || body.innerText;
    let word = allText.slice(pos[0], pos[1]); 
    let openPopup = document.getElementById("minerva-popup");
    if (openPopup != null) {
        openPopup.remove();
    }
    let dfnDiv = processDefinition(word, mouseX, mouseY);
}


/**
 * This function sends a request to the background script to add a card to anki.
 * @param {string} ID of the word dfn to be added (which uniquely identifies it).
 * There can be many of these for each word.
 * @param {string} Word to be added.
 * @param {string} Example phrase to be added.
 * @param {string} Definition relative to ID to be added. 
 */
function addCard(id, word, phrase, dfn="") {
    chrome.runtime.sendMessage({
        msgType: "addCard",
        id: id,
        word: word,
        phrase: phrase,
        dfn: dfn
    });
    chrome.runtime.onMessage.addListener(getAddCardResult);
}


document.body.addEventListener("dblclick", doubleClickEventHandler);
document.body.addEventListener("click", clickEventHandler);
//chrome.runtime.onMessage.addListener(getDeckNames);
//chrome.runtime.sendMessage({word: word});
