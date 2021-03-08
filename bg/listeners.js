function sendToTab(tabId, obj) {
    chrome.tabs.sendMessage(tabId, obj);
}

async function messageHandler (request, sender) {
    let retObj = {};
    switch (request.msgType) {
        case "getDeckNames":
            retObj = await getDeckNames();
            break;
        default:
    }
    sendToTab(sender.tab.id, {"msgType": request.msgType, "msg": retObj});
}


chrome.runtime.onMessage.addListener( messageHandler );
