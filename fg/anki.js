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
 * in the deck for the given card type and invokes the callback with a boolean
 * once a response arrives.
 * @param {string} word Word whose existence is to be checked.
 * @param {string} cardType "page" or "deepseek".
 * @param {Function} callback Called with true if the word already exists.
 */
function checkWordExists(word, cardType, callback) {
    chrome.runtime.sendMessage({msgType: "checkWordExists", word: word, cardType: cardType});
    chrome.runtime.onMessage.addListener(function handleWordExists(request) {
        if (request.msgType != "checkWordExists") return;
        chrome.runtime.onMessage.removeListener(handleWordExists);
        callback(!!(request.msg && request.msg.state === "success" && request.msg.result === true));
    });
}

const GENERATE_PHRASE_TIMEOUT_MS = 35000;

/**
 * Asks the background script to generate an example phrase with DeepSeek and
 * invokes the callback once a response arrives or the request times out.
 * @param {string} word Word being studied.
 * @param {string} definition Plain-text definition of the word.
 * @param {string} originalPhrase Raw page context where the word appeared.
 * @param {Function} callback Called with
 * (success, passage, reason, japaneseDefinition).
 */
function generateExamplePhrase(word, definition, originalPhrase, callback) {
    let settled = false;
    function finish(success, passage, reason, japaneseDefinition) {
        if (settled) return;
        settled = true;
        chrome.runtime.onMessage.removeListener(handleResult);
        clearTimeout(timeoutId);
        callback(
            success, passage, reason || "",
            typeof japaneseDefinition === "string" ? japaneseDefinition : ""
        );
    }
    function handleResult(request) {
        if (request.msgType != "generateExamplePhrase") return;
        const result = request.msg && request.msg.result;
        const success = !!request.msg && request.msg.state === "success" &&
            typeof result === "string" && result.trim().length > 0;
        const reason = request.msg && request.msg.reason ? request.msg.reason : "";
        const japaneseDefinition = request.msg && request.msg.japaneseDefinition;
        finish(success, success ? result : "", reason, japaneseDefinition);
    }
    const timeoutId = setTimeout(function() { finish(false, ""); }, GENERATE_PHRASE_TIMEOUT_MS);
    chrome.runtime.onMessage.addListener(handleResult);
    chrome.runtime.sendMessage({
        msgType: "generateExamplePhrase",
        word: word,
        definition: definition,
        originalPhrase: originalPhrase
    });
}
