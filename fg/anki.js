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
 * Function to be passed to a listener to confirm that card has been added.
 * @param {Object} Message received from background script.
 * @param {Object} Information about the sender of such message.
 * @return {boolean} True iff card was successfully added.
 */
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

async function getAddCardResult(request, sender) {
    if (request.msgType == "addCard") {
        if (typeof request.msg === "object" && 'state' in request.msg && request.msg.state == "success") {
            console.log("Card was added successfully.");
            return true;
        } else {
            console.log("There was some problem with adding the card.");
            return false;
        }
    }
}
