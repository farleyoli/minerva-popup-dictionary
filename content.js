// TODO: create connection to anki-connect; get phrase, set parameters and construct
// TODO: check if dictionary is getting unloaded from memory.

/**
 * @param {string} A word.
 * @return {boolean} True iff first letter of word is Capital.
 */
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

/**
 * This function receives the popup div (with content already inside), 
 * adds CSS properties to it and embeds it in the document.
 * @param {number} Horizontal position of upper-left corner of popup.
 * @param {number} Vertical position of upper-left corner of popup.
 * @param {number} Width of popup.
 * @param {number} Height of popup.
 * @param {Object} Div HTML object which is to be added to the document's
 * body.
 */
function constructPopup(x, y, width, height, dfnDiv) {
    //TODO: use CSS file to set this properties through a class
    dfnDiv.style.display = "flex";
    dfnDiv.style.flexDirection = "column";
    dfnDiv.style.wrap = "nowrap";
    dfnDiv.style.paddingTop = "0.75%";
    dfnDiv.style.paddingRight = "1%";
    dfnDiv.style.paddingBottom = "0.75%";
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

/**
 * This method gets the dictionary, recursively (see structure in
 * comments inside) parses it and constructs a div element
 * containing the meaning of the word. CSS is added by a different method.
 * @param {Object} Dictionary JSON file containing word.
 * @param {Object} Word whose meaning is to be written.
 * @return {Object} Div HTML object with definition to be embedded in popup.
 */
function constructDfn(dict, word) {
    // Use the words "draw", "acid" to test stuff.
    const retDiv = document.createElement("div");
    function constructDfnAux(dfn) {
        const ret = document.createElement("div");
        if (dfn.length <= 0) {
            return ret;
        }
        for (let i = 0; i < dfn.length; i++) {
            const textNode = document.createElement("div");
            textNode.innerText = dfn[i]['ctnt'];
            textNode.style.marginTop = "1.5%";
            textNode.style.marginBottom = "1.5%";
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
            constructPopup(100, 100, 350, 250, dfnDiv);
            dfnDiv.id = "minerva-popup";
            //alert(dfn);
        });
}

function isInsidePopup(x, y) {
    //constructPopup(100, 100, 350, 250, dfnDiv);
    if (x >= 100 && x <= 100 + 350) {
        if(y >= 100 && y <= 100 + 250) {
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
 * Get position of selected text inside inner text of body.
 * @return {Array<Number>} Beginning and ending position.
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
