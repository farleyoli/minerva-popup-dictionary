/**
 * This function interacts with Anki through localhost. Example use:
 * invoke('createDeck', {deck: 'test1'})
 * @param {string} Action to be performed in Anki (ex: 'deckNames').
 * @param {number} Version of Anki-connect.
 * @param {Object} Parameters to be passed with action.
 * @return {Object} Promise with the result from action in Anki.
 */
function invoke(action, version, params={}) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.addEventListener('error', () => {
            reject('failed to issue request')
        });
        xhr.addEventListener('load', () => {
            try {
                const response = JSON.parse(xhr.responseText);
                if (Object.getOwnPropertyNames(response).length != 2) {
                    throw 'response has an unexpected number of fields';
                }
                if (!response.hasOwnProperty('error')) {
                    throw 'response is missing required error field';
                }
                if (!response.hasOwnProperty('result')) {
                    throw 'response is missing required result field';
                }
                if (response.error) {
                    throw response.error;
                }
                resolve(response.result);
            } catch (e) {
                reject(e);
            }
        });

        xhr.open('POST', 'http://127.0.0.1:8765');
        xhr.send(JSON.stringify({action, version, params}));
    });
}

/**
 * @return {Object} Promise containing name of all decks in Anki.
 */
function getDeckNames() {
    return invoke('deckNames', 6);
}

function addCard(id, word, phrase, dfn) {
    //deck = 'minerva-popup-dictionary';
    //return invoke('deckNames', 6);
    //return invoke('createDeck', 6, {deck: 'test1'});
    params = {
        "note": {
            "deckName": "Default",
            "modelName": "Basic",
            "fields": {
                "Front": word,
                "Back": phrase
            },
            "options": {
                "allowDuplicate": false,
                "duplicateScope": "deck",
                "duplicateScopeOptions": {
                    "deckName": "Default",
                    "checkChildren": false
                }
            }
        }
    }
    let ret =  invoke('addNote', 6, params);
    //alert(JSON.stringify(params));
    return ret;
}
