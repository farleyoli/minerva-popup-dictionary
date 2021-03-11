/**
 * This function sends an object to a tab through a message.
 * @param {number} ID of tab to which function sends the object.
 * @param {Object}  Object to be sent.
 */
function sendToTab(tabId, obj) {
    chrome.tabs.sendMessage(tabId, obj);
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
    switch (request.msgType) {
        case "getDeckNames":
            retObj = await getDeckNames();
            break;
        case "addCard":
            retObj = await addCard(request.id, request.word, request.phrase, request.dfn).catch( error => {});
            break;
        default:
            break;
    }
    if (typeof retObj === 'number') {
        retObj = {state: 'success', result: retObj};
    } else {
        retObj = {state: "failure"};
    }
    sendToTab(sender.tab.id, {"msgType": request.msgType, "msg": retObj});
}


chrome.runtime.onMessage.addListener( messageHandler );
