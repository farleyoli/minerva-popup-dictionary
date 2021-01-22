// content.js
// TODO: transform dictionary definitions to html; when doing it, get id of each acception (path in tree) and add it to id of div; use css-flex; create connection to anki-connect; get phrase, set parameters and construct

function isFirstLetterCapital(word) {
    const letters = "abcdefghijklmnopqrstuvwxyz";
    if (word.length == 0) {
        return false;
    }
    if (letters.indexOf(word[0]) >= 0) {
        return true;
    }
    return false;
}

function constructPopup(x, y, width, height, dfnDiv) {
    //TODO: use CSS file to set this properties through a class
    //const newDiv = document.createElement("div");
    dfnDiv.style.boxShadow = "1px 1px 8px 8px grey";
    dfnDiv.style.position = 'fixed';
    dfnDiv.style.fontSize = '13px';
    dfnDiv.style.top = x.toString() + 'px';
    dfnDiv.style.left = y.toString() + 'px';
    dfnDiv.style.width = width.toString() + 'px';
    dfnDiv.style.height = height.toString() + 'px';
    dfnDiv.style.backgroundColor = 'white';
    dfnDiv.style.zIndex = '1000';
    dfnDiv.style.overflow = 'scroll';
    dfnDiv.style.overflowX = 'hidden';
    dfnDiv.style.overflowY = 'auto';
    dfnDiv.style.borderRadius = '10px';
    document.body.appendChild(dfnDiv);
}

function constructDfn(dict, word) {
    const retDiv = document.createElement("div");
    // Use the words "draw", "acid" to test stuff.
    function constructDfnAux(dfn) {
        const ret = document.createElement("div");
        if (dfn.length <= 0) {
            return ret;
        }
        for (let i = 0; i < dfn.length; i++) {
            const textNode = document.createElement("div");
            textNode.innerText = dfn[i]['ctnt'];
            ret.appendChild(textNode);
            ret.appendChild(constructDfnAux(dfn[i]['dfn']));
        }
        ret.style.marginLeft = "5%";
        return ret;
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
        retDiv.innerText = "Word not found in dictionary.";
        return retDiv;
    }
    //return retDiv;

    for (let i = 0; i < dict[word].length; i++) {
        retDiv.appendChild(constructDfnAux(dict[word][i]['dfn']));
    }
    return retDiv;
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
    const url = chrome.runtime.getURL(dictAdress);
    fetch(url)
        .then((response) => response.json())
        .then((dict) => { 
            let dfnDiv = constructDfn(dict, word);
            constructPopup(100, 100, 420, 270, dfnDiv);
            dfnDiv.id = "minerva-popup";
            //alert(dfn);
        });
}

function isInsidePopup(x, y) {
    //constructPopup(100, 100, 420, 270, dfnDiv);
    if (x >= 100 && x <= 100 + 420) {
        if(y >= 100 && y <= 100 + 270) {
            return true;
        }
    }
    return false;
}

function clickEventHandler() {
    let e = window.event;
    let mouseX = e.clientX;
    let mouseY = e.clientY;
    let isInside = isInsidePopup(mouseX, mouseY);
    if (isInside) {
        return;
    }
    let openPopup = document.getElementById("minerva-popup");
    if (openPopup != null) {
        openPopup.remove();
    }
}
function doubleClickEventHandler() {
    let pos = getSelectedPosition();
    let body = document.body;
    let allText = body.textContent || body.innerText;
    let word = allText.slice(pos[0], pos[1]); 
    let openPopup = document.getElementById("minerva-popup");
    if (openPopup != null) {
        openPopup.remove();
    }
    getDefinition(word.toLowerCase());
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
document.body.addEventListener("click", clickEventHandler);
