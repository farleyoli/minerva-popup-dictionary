/**
 * Function to be passed to a listener.
 * @param {Object} Message received from background script.
 * @param {Object} Information about the sender of such message.
 * @return {Array<String>} List of names of the decks in Anki.
 */
async function getDeckNames(request, sender) {
    if (request.msgType == "getDeckNames") {
        let deckNames = request.msg;
        console.log(deckNames);
        return deckNames;
    }
}

/**
 * Asks the background script whether Anki is reachable through Anki-connect
 * and invokes the callback with a boolean once a response arrives.
 * @param {Function} callback Called with true if Anki is available, false otherwise.
 */
function checkAnkiAvailability(callback) {
    chrome.runtime.sendMessage({msgType: "checkAnki"});
    chrome.runtime.onMessage.addListener(function handleCheckAnki(request) {
        if (request.msgType == "checkAnki") {
            chrome.runtime.onMessage.removeListener(handleCheckAnki);
            callback(!!(request.msg && request.msg.state === "success"));
        }
    });
}

/**
 * Asks the background script whether a card for the given word already exists
 * in the deck and invokes the callback with a boolean once a response arrives.
 * @param {string} word Word whose existence is to be checked.
 * @param {Function} callback Called with true if the word already exists.
 */
function checkWordExists(word, callback) {
    chrome.runtime.sendMessage({msgType: "checkWordExists", word: word});
    chrome.runtime.onMessage.addListener(function handleWordExists(request) {
        if (request.msgType != "checkWordExists") return;
        chrome.runtime.onMessage.removeListener(handleWordExists);
        callback(!!(request.msg && request.msg.state === "success" && request.msg.result === true));
    });
}
