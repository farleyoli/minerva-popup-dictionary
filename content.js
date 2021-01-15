// content.js

function constructDfn(dict, word) {
    // Use the word "acid" to test stuff.
    function constructDfnAux(upperDfn, dfn) {
        if (dfn.length <= 0) {
            return upperDfn;
        }
        let s = " ";
        for (let i = 0; i < dfn.length; i++) {
            let loopRet = upperDfn + " ";
            ctnt = dfn[i]['ctnt'];
            loopRet += constructDfnAux(ctnt, dfn[i]['dfn']);
            s += loopRet + "\n";
        }
        return s;
    }
    /*
    dict[word] is an array.
    Structure of dict[word][i]:
        Returns {head, dfn}, where
                   dfn = (list of {ctnt, dfn, exs, qts}) or []
                  ctnt = contents (str)
                   exs = list of examples (str)
        and        qts = list of quotes (str)
        see definition of head. (ex: head(tested) = test)
    */
    if (!(word in dict)) {
        return "Word not found in dictionary.";
    }
    let ret = "";
    for (let i = 0; i < dict[word].length; i++) {
        ret += constructDfnAux("", dict[word][i]['dfn']) + "\n";
    }
    return ret;
}

function getFirstLetter(word) {
    const letters = "abcdefghijklmnopqrstuvwxyz";
    if (word.length == 0) {
        return "other"
    }
    if (letters.indexOf(word[0].toLowerCase()) >= 0) {
        return word[0].toLowerCase();
    }
    return "other";
}

function getDefinition(word) {
    let firstLetter = getFirstLetter(word);
    let dictAdress = './dictionary/' + firstLetter + '.json';
    const url = chrome.runtime.getURL('./dictionary/a.json');
    fetch(url)
        .then((response) => response.json()) //assuming file contains json
        .then((dict) => { 
            let dfn = constructDfn(dict, word);
            alert(dfn);
        });
}

function doubleClickEventHandler() {
    let pos = getSelectedPosition();
    let body = document.body;
    let allText = body.textContent || body.innerText;
    let word = allText.slice(pos[0], pos[1]); 
    getDefinition(word);
}


/**
 * Get position of selected text inside inner text of body
 * @return {Number[]} beginning and ending position.
 */
function getSelectedPosition() {
    let selection = "";
    if (window.getSelection) {
        selection = window.getSelection();
    } else if (document.getSelection) {
        selection = document.getSelection();
    } else if (document.selection) {
        selection = document.selection.createRange();
    } else {
        return [];
    }

    let range = selection.getRangeAt(0);
    let startOffset = range.startOffset;
    let endOffset = startOffset + range.toString().length;

    let node = selection.anchorNode;

    let body = document.body;
    let allText = body.textContent || body.innerText;

    startOffset += allText.indexOf(node.textContent);
    endOffset += allText.indexOf(node.textContent);

    return [startOffset, endOffset];
}

document.body.addEventListener("dblclick", doubleClickEventHandler);
