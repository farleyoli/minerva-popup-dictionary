async function getDeckNames(request, sender) {
    if (request.msgType == "getDeckNames") {
        let deckNames = request.msg;
        console.log(deckNames);
        return deckNames;
    }
}

async function getAddCardResult(request, sender) {
    if (request.msgType == "addCard") {
        if (typeof request.msg === "object" && 'state' in request.msg && request.msg.state == "success") {
            console.log("Card was added successfully.");
        } else {
            console.log("There was some problem with adding the card.");
        }
    }
}
