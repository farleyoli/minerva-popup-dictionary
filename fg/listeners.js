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
        currentExamplePhrase = null;
        currentExampleWord = null;
        currentExampleFollowingText = "";
    }
}

/**
 * This function handles double-clicks from the user. It adds the definition
 * of the selected word by the user to a popup and adds the popup to the
 * DOM. If a popup is already open and the double-click happened inside it,
 * its contents are replaced with the new word instead of closing and reopening.
 */
function doubleClickEventHandler() {
    let e = window.event;
    let mouseX = e.clientX;
    let mouseY = e.clientY;

    let pos = getSelectedPosition();
    if (pos.length < 2 || pos[1] <= pos[0]) {
        return;
    }
    let body = document.body;
    let allText = body.textContent || body.innerText;
    let word = allText.slice(pos[0], pos[1]); 
    let followingText = allText.slice(pos[1]);
    let openPopup = document.getElementById("minerva-popup");

    if (openPopup != null && isInsidePopup(mouseX, mouseY, openPopup)) {
        // Double-click inside the open popup: navigate in place, reusing the
        // example phrase captured from the original page.
        processDefinition(word, mouseX, mouseY, true);
        return;
    }

    // New lookup from the page: capture the raw example phrase before the
    // popup is added to the DOM.
    currentExamplePhrase = getExamplePhraseText();
    currentExampleWord = word;
    currentExampleFollowingText = followingText;
    processDefinition(word, mouseX, mouseY, false, followingText);
}


/**
 * This function sends a request to the background script to add a card to anki.
 * @param {string} ID of the word dfn to be added (which uniquely identifies it).
 * There can be many of these for each word.
 * @param {string} Word to be added.
 * @param {string} Example phrase to be added.
 * @param {string} Definition relative to ID to be added.
 * @param {string} pageTitle Title of the source page.
 * @param {string} dateCreated Date on which the card was created.
 * @param {string} frequency Word frequency rank.
 * @param {string} ipa Word IPA transcription.
 * @param {Function} callback Called with a boolean once the result arrives.
 * @param {string} originalPhrase Page context for the answer side of AI cards.
 * @param {string} cardType "page" or "deepseek".
 * @param {string} japaneseDefinition Simple Japanese definition for AI cards.
 */
function addCard(id, word, phrase, dfn="", pageTitle="", dateCreated="", frequency="", ipa="", callback, originalPhrase="", cardType="page", japaneseDefinition="") {
    chrome.runtime.sendMessage({
        msgType: "addCard",
        id: id,
        word: word,
        phrase: phrase,
        dfn: dfn,
        pageTitle: pageTitle,
        dateCreated: dateCreated,
        frequency: frequency,
        ipa: ipa,
        originalPhrase: originalPhrase,
        cardType: cardType,
        japaneseDefinition: japaneseDefinition
    });
    chrome.runtime.onMessage.addListener(function addCardResultHandler(request) {
        if (request.msgType != "addCard") return;
        chrome.runtime.onMessage.removeListener(addCardResultHandler);
        const success = typeof request.msg === "object" &&
                        request.msg.state === "success";
        if (callback) callback(success);
    });
}


document.body.addEventListener("dblclick", doubleClickEventHandler);
document.body.addEventListener("click", clickEventHandler);
loadExamplePhraseSettings();
//chrome.runtime.onMessage.addListener(getDeckNames);
//chrome.runtime.sendMessage({word: word});
