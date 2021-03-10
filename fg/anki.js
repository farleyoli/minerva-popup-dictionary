async function getDeckNames(request, sender) {
    if (request.msgType == "getDeckNames") {
        let deckNames = request.msg;
        console.log(deckNames);
    }
}
