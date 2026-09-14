/**
 * This function sends an object to a tab through a message.
 * @param {number} ID of tab to which function sends the object.
 * @param {Object}  Object to be sent.
 */
function sendToTab(tabId, obj) {
    chrome.tabs.sendMessage(tabId, obj);
}

/**
 * Maps the card type configured in the options page to its Anki model.
 * @param {string} cardType "page" or "deepseek".
 * @return {Object} Model descriptor to use for the card.
 */
function modelForCardType(cardType) {
    return cardType === "deepseek" ? AI_MODEL : MINERVA_MODEL;
}

/**
 * Routes an add-card request to the model selected in the options page.
 * @param {Object} request Message sent by the content script.
 * @return {Object} Promise containing the new note id.
 */
function addCardForRequest(request) {
    if (request.cardType === "deepseek") {
        return addAiCard(
            request.id, request.word, request.phrase, request.originalPhrase,
            request.dfn, request.pageTitle, request.dateCreated,
            request.frequency, request.ipa
        );
    }
    return addCard(
        request.id, request.word, request.phrase, request.dfn,
        request.pageTitle, request.dateCreated, request.frequency,
        request.ipa
    );
}

/**
 * This function handles a message received from some content script,
 * deciding what to do based on the msgType field embedded in the 
 * request message.
 * @param {Object} Request from content script.
 * @param {Object} Information about the tab which sent request.
 */
async function messageHandler (request, sender) {
    var retObj = {};
    var failureReason = null;
    switch (request.msgType) {
        case "getDeckNames":
            retObj = await getDeckNames();
            break;
        case "addCard":
            retObj = await addCardForRequest(request).catch( error => {});
            break;
        case "generateExamplePhrase":
            retObj = await generateExamplePhrase(
                request.word, request.definition, request.originalPhrase
            ).catch( error => {
                failureReason = error && error.reason ? error.reason : null;
            });
            break;
        case "checkAnki":
            retObj = await getAnkiVersion().catch( error => {});
            break;
        case "checkWordExists":
            retObj = await wordExistsInDeck(
                request.word, modelForCardType(request.cardType)
            ).catch( error => {});
            break;
        default:
            break;
    }
    if (typeof retObj === 'number' || typeof retObj === 'boolean' ||
        typeof retObj === 'string') {
        retObj = {state: 'success', result: retObj};
    } else {
        retObj = {state: "failure"};
        if (failureReason) {
            retObj.reason = failureReason;
        }
    }
    sendToTab(sender.tab.id, {"msgType": request.msgType, "msg": retObj});
}


chrome.runtime.onMessage.addListener( messageHandler );
