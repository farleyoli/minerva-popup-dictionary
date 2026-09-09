// Example phrase captured from the page when the popup is first opened. It is
// reused for any subword looked up inside the popup, so the phrase always
// comes from the original page rather than the popup's own text.
var currentExamplePhrase = null;
const DEFAULT_PHRASES_BEFORE = 1;
const DEFAULT_PHRASES_AFTER = 1;
var examplePhrasesBefore = DEFAULT_PHRASES_BEFORE;
var examplePhrasesAfter = DEFAULT_PHRASES_AFTER;

/**
 * Converts a configured phrase count to a non-negative integer.
 * @param {*} value Stored option value.
 * @param {number} fallback Value used for invalid input.
 * @return {number} Safe phrase count.
 */
function normalizePhraseCount(value, fallback) {
    const count = Number(value);
    return value !== '' && Number.isInteger(count) && count >= 0 ? count : fallback;
}

/**
 * Loads the configured context size for newly captured Anki example phrases.
 */
function loadExamplePhraseSettings() {
    const defaults = {
        examplePhrasesBefore: DEFAULT_PHRASES_BEFORE,
        examplePhrasesAfter: DEFAULT_PHRASES_AFTER
    };
    const applySettings = function(items) {
        examplePhrasesBefore = normalizePhraseCount(
            items.examplePhrasesBefore, DEFAULT_PHRASES_BEFORE
        );
        examplePhrasesAfter = normalizePhraseCount(
            items.examplePhrasesAfter, DEFAULT_PHRASES_AFTER
        );
    };
    chrome.storage.sync.get(defaults, applySettings);
    chrome.storage.onChanged.addListener(function(changes, areaName) {
        if (areaName !== 'sync') return;
        if (changes.examplePhrasesBefore || changes.examplePhrasesAfter) {
            chrome.storage.sync.get(defaults, applySettings);
        }
    });
}

/**
 * @param {string} A word.
 * @return {boolean} True iff first letter of word is Capital.
 */
function isFirstLetterCapital(word) {    const letters = "abcdefghijklmnopqrstuvwxyz";
    if (word.length == 0) {
        return false;
    }
    if (letters.indexOf(word[0]) >= 0) {
        return true;
    }
    return false;
}

/**
 * @param {string} A string.
 * @return {string} First letter of word.
 */
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

/**
 * Returns plausible dictionary headwords for an English inflected word:
 * verb inflections, -ly adverbs, and -ion nouns. This is deliberately
 * heuristic: callers should verify each result against the dictionary
 * before presenting it to the user.
 * @param {string} word A selected word.
 * @return {Array<string>} Candidate base forms, in preference order.
 */
function getEnglishBaseFormCandidates(word) {
    const normalized = word.trim().toLowerCase();
    if (!/^[a-z]+$/.test(normalized)) {
        return [];
    }

    // These are common irregular verb forms which cannot be recovered from a
    // suffix rule. Multiple base forms are retained where English is genuinely
    // ambiguous (for example, "saw" can be a form of see or saw).
    const irregular = {
        'am': ['be'], 'are': ['be'], 'is': ['be'], 'was': ['be'],
        'were': ['be'], 'been': ['be'], 'being': ['be'],
        'has': ['have'], 'had': ['have'], 'having': ['have'],
        'does': ['do'], 'did': ['do'], 'doing': ['do'],
        'goes': ['go'], 'went': ['go'], 'gone': ['go'],
        'says': ['say'], 'said': ['say'], 'made': ['make'],
        'ate': ['eat'], 'eaten': ['eat'], 'became': ['become'],
        'bent': ['bend'], 'bound': ['bind'], 'bit': ['bite'],
        'bitten': ['bite'], 'bled': ['bleed'], 'blew': ['blow'],
        'blown': ['blow'], 'broke': ['break'], 'broken': ['break'],
        'brought': ['bring'], 'built': ['build'], 'bought': ['buy'],
        'caught': ['catch'], 'chose': ['choose'], 'chosen': ['choose'],
        'came': ['come'], 'cost': ['cost'], 'crept': ['creep'],
        'cut': ['cut'], 'dealt': ['deal'], 'dug': ['dig'],
        'dove': ['dive'], 'drew': ['draw'], 'drawn': ['draw'],
        'drank': ['drink'], 'drunk': ['drink'], 'drove': ['drive'],
        'driven': ['drive'], 'fed': ['feed'], 'fell': ['fall'],
        'fallen': ['fall'], 'felt': ['feel'], 'fought': ['fight'],
        'flew': ['fly'], 'flown': ['fly'], 'found': ['find'],
        'forgot': ['forget'], 'forgotten': ['forget'],
        'forgave': ['forgive'], 'forgiven': ['forgive'],
        'froze': ['freeze'], 'frozen': ['freeze'], 'gave': ['give'],
        'given': ['give'], 'got': ['get'], 'gotten': ['get'],
        'grew': ['grow'], 'grown': ['grow'], 'hung': ['hang'],
        'heard': ['hear'], 'held': ['hold'], 'hid': ['hide'],
        'hidden': ['hide'], 'hit': ['hit'], 'kept': ['keep'],
        'knew': ['know'], 'known': ['know'], 'laid': ['lay'],
        'lay': ['lie'], 'lain': ['lie'], 'led': ['lead'],
        'left': ['leave'], 'lent': ['lend'], 'lost': ['lose'],
        'meant': ['mean'], 'met': ['meet'], 'paid': ['pay'],
        'ran': ['run'], 'rode': ['ride'], 'ridden': ['ride'],
        'rang': ['ring'], 'rung': ['ring'], 'rose': ['rise'],
        'risen': ['rise'], 'sang': ['sing'], 'sung': ['sing'],
        'sat': ['sit'], 'saw': ['see'], 'seen': ['see'],
        'sold': ['sell'], 'sent': ['send'], 'shook': ['shake'],
        'shaken': ['shake'], 'shot': ['shoot'], 'shut': ['shut'],
        'slept': ['sleep'], 'spoke': ['speak'], 'spoken': ['speak'],
        'spent': ['spend'], 'split': ['split'], 'spread': ['spread'],
        'sprang': ['spring'], 'sprung': ['spring'], 'stood': ['stand'],
        'stole': ['steal'], 'stolen': ['steal'], 'stuck': ['stick'],
        'struck': ['strike'], 'swam': ['swim'], 'swum': ['swim'],
        'swept': ['sweep'], 'swung': ['swing'], 'taught': ['teach'],
        'took': ['take'], 'taken': ['take'],
        'told': ['tell'], 'thought': ['think'], 'threw': ['throw'],
        'thrown': ['throw'], 'understood': ['understand'],
        'woke': ['wake'], 'woken': ['wake'], 'wore': ['wear'],
        'worn': ['wear'], 'wept': ['weep'], 'went': ['go'],
        'won': ['win'], 'wound': ['wind'], 'wrote': ['write'],
        'written': ['write']
    };
    if (irregular[normalized]) {
        return irregular[normalized];
    }

    const candidates = [];
    const add = (candidate) => {
        if (candidate.length >= 2 && candidate !== normalized && !candidates.includes(candidate)) {
            candidates.push(candidate);
        }
    };

    if (normalized.endsWith('ily') && normalized.length > 4) {
        add(normalized.slice(0, -3) + 'y'); // happily -> happy
    } else if (normalized.endsWith('ly') && normalized.length > 3) {
        const stem = normalized.slice(0, -2);
        if (stem.length >= 4) {
            add(stem);                       // quickly -> quick
        }
    } else if (normalized.endsWith('ion') && normalized.length > 5) {
        const stem = normalized.slice(0, -3);
        add(stem);                           // action -> act
        add(stem + 'e');                     // promotion -> promote
    } else if (normalized.endsWith('or') && normalized.length > 3) {
        const stem = normalized.slice(0, -2);
        add(stem);                           // actor -> act, editor -> edit
        add(stem + 'e');                     // indicator -> indicate
    } else if (normalized.endsWith('er') && normalized.length > 3) {
        const stem = normalized.slice(0, -2);
        add(stem);                           // worker -> work
        add(stem + 'e');                     // writer -> write
    } else if (normalized.endsWith('ies') && normalized.length > 3) {
        const stem = normalized.slice(0, -3);
        // ties/dies/lies retain "ie"; longer forms change y to i before -s.
        add(stem.length === 1 ? stem + 'ie' : stem + 'y');
    } else if (normalized.endsWith('ied') && normalized.length > 3) {
        const stem = normalized.slice(0, -3);
        // tied/died/lied retain "ie"; longer forms change y to i before -ed.
        add(stem.length === 1 ? stem + 'ie' : stem + 'y');
    } else if (normalized.endsWith('ying') && normalized.length > 4) {
        add(normalized.slice(0, -4) + 'ie'); // lying -> lie
    } else if (normalized.endsWith('ing') && normalized.length > 4) {
        const stem = normalized.slice(0, -3);
        add(stem);                         // walking -> walk
        add(stem + 'e');                   // making -> make
        if (stem.length >= 2 && stem.at(-1) === stem.at(-2)) {
            add(stem.slice(0, -1));        // running -> run
        }
        if (normalized.endsWith('icking')) {
            add(normalized.slice(0, -4));  // panicking -> panic
        }
    } else if (normalized.endsWith('ed') && normalized.length > 3) {
        const stem = normalized.slice(0, -2);
        add(stem);                         // agreed -> agree
        add(stem + 'e');                   // loved -> love
        if (stem.length >= 2 && stem.at(-1) === stem.at(-2)) {
            add(stem.slice(0, -1));        // stopped -> stop
        }
        if (normalized.endsWith('icked')) {
            add(normalized.slice(0, -3));  // panicked -> panic
        }
    } else if (normalized.endsWith('es') && normalized.length > 3) {
        add(normalized.slice(0, -1));      // loves -> love
        add(normalized.slice(0, -2));      // watches -> watch
    } else if (normalized.endsWith('s') && normalized.length > 2 && !normalized.endsWith('ss')) {
        add(normalized.slice(0, -1));      // walks -> walk
    }

    return candidates;
}

/**
 * Returns possible phrasal-verb lemmas when the text immediately following an
 * inflected verb begins with a common particle. The resulting phrases must
 * still be verified against the dictionary by the caller.
 * @param {string} word Selected word, normally a verb or verb inflection.
 * @param {string} followingText Text immediately after the selection.
 * @return {Array<string>} Candidate phrasal-verb headwords.
 */
function getEnglishPhrasalVerbCandidates(word, followingText) {
    const particles = new Set([
        'about', 'across', 'after', 'ahead', 'along', 'around', 'aside',
        'away', 'back', 'by', 'down', 'for', 'forward', 'in', 'into', 'off',
        'on', 'onto', 'out', 'over', 'round', 'through', 'to', 'together',
        'under', 'up', 'upon', 'with'
    ]);
    const selectedWords = word.trim().toLowerCase().match(/[a-z]+/g);
    if (!selectedWords || selectedWords.length > 3) {
        return [];
    }
    const verb = selectedWords[0];
    let phraseParticles = selectedWords.slice(1);
    if (phraseParticles.length === 0) {
        const particleMatch = followingText.match(/^[\s"'“‘([{]*([a-z]+)/i);
        if (!particleMatch) {
            return [];
        }
        phraseParticles = [particleMatch[1].toLowerCase()];
    }
    if (!phraseParticles.every(particle => particles.has(particle))) {
        return [];
    }

    const deconjugatedBases = getEnglishBaseFormCandidates(verb);
    // Preserve an already-base verb (take -> take up), but do not offer the
    // original inflection as a phrasal-verb lemma (taking -> taking off).
    const bases = deconjugatedBases.length > 0 ? deconjugatedBases : [verb];
    return [...new Set(bases.map(base => base + ' ' + phraseParticles.join(' ')))];
}

/**
 * This function gets the position of selected word inside inner text of body.
 * @return {Array<number>} Beginning and ending position of selection.
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

    if (!selection || selection.rangeCount === 0) {
        return [];
    }
    const range = selection.getRangeAt(0);
    const beforeSelection = range.cloneRange();
    beforeSelection.selectNodeContents(document.body);
    beforeSelection.setEnd(range.startContainer, range.startOffset);

    // The previous implementation used indexOf(anchorNode.textContent), which
    // selected the first matching text node in the page. That made the text
    // following a selection unreliable on pages with repeated content, and in
    // turn prevented adjacent-particle phrasal verbs from being recognized.
    const startOffset = beforeSelection.toString().length;
    const endOffset = startOffset + range.toString().length;
    return [startOffset, endOffset];
}

function getMaxZIndex() {
    return Math.max(
      ...Array.from(document.querySelectorAll('body *'), el =>
        parseFloat(window.getComputedStyle(el).zIndex),
      ).filter(zIndex => !Number.isNaN(zIndex)),
      0,
    );
  }

/**
 * Escapes characters that would otherwise be parsed as HTML markup when the
 * text is rendered inside an HTML field (such as an Anki card).
 * @param {string} text Raw text.
 * @return {string} HTML-safe text.
 */
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/**
 * Escapes regex metacharacters so a string matches literally in a RegExp.
 * @param {string} text Raw text.
 * @return {string} Regex-safe text.
 */
function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Strips HTML tags, leaving only their text content. Used to clean markup
 * found inside Wiktionary definitions before it is stored on a card.
 * @param {string} text Text possibly containing HTML markup.
 * @return {string} Text without tags.
 */
function stripHtmlTags(text) {
    return String(text).replace(/<[^>]*>/g, "");
}

/**
 * Wraps the given raw example text in HTML paragraphs: the word is cloze-
 * deleted and each sentence becomes its own <p>. Sentence boundaries are
 * periods, exclamation marks, or question marks followed (optionally by
 * closing quotes and whitespace then) by a capital letter. This also handles
 * textContent where adjacent sentences have no intervening space.
 * The text is HTML-escaped first so characters from the page (like < or &)
 * cannot be interpreted as markup, and only whole-word occurrences of the
 * word are cloze-deleted (matching is case-insensitive and keeps the case
 * found on the page).
 * @param {string} text Raw example text (sentence(s) from the page).
 * @param {string} word Word to be cloze-deleted, or "" to skip.
 * @return {string} HTML string with each sentence wrapped in a <p>.
 */
function wrapExamplePhraseInParagraphs(text, word = "") {
    text = escapeHtml(text);
    if (word.length > 0) {
        const pattern = "(?<![A-Za-z])" + escapeRegExp(escapeHtml(word)) + "(?![A-Za-z])";
        text = text.replace(new RegExp(pattern, "gi"), match => "{{c1::" + match + "}}");
    }
    return "<p>" + text.replace(/([.!?]+["'”’)]*)\s*(?=[A-Z])/g, "$1</p><p>") + "</p>";
}

/**
 * Returns true when the punctuation at index ends a sentence in page text.
 * The check intentionally requires a following capital letter (or text end)
 * to avoid splitting most abbreviations and decimal numbers.
 * @param {string} text Page text.
 * @param {number} index Position of punctuation to inspect.
 * @return {boolean} Whether the punctuation is a sentence boundary.
 */
function isSentenceBoundary(text, index) {
    if (!/[.!?]/.test(text[index])) {
        return false;
    }
    const before = text.slice(Math.max(0, index - 10), index + 1);
    if (/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e)\.$/i.test(before) ||
        /(?:\b[A-Za-z]\.){2,}$/.test(before)) {
        return false;
    }
    let next = index + 1;
    while (next < text.length && /[\s"'”’)]/.test(text[next])) {
        next++;
    }
    return next >= text.length || /[A-Z]/.test(text[next]);
}

/**
 * Extracts the selected sentence and an exact number of neighboring sentences.
 * @param {string} text Page text.
 * @param {number} selectionStart Start offset of the selected word or phrase.
 * @param {number} selectionEnd End offset of the selected word or phrase.
 * @param {number} phrasesBefore Number of preceding sentences to include.
 * @param {number} phrasesAfter Number of following sentences to include.
 * @return {string} Context text for the Anki example.
 */
function getExamplePhraseContext(text, selectionStart, selectionEnd, phrasesBefore, phrasesAfter) {
    let start = 0;
    let previousBoundaries = 0;
    for (let index = selectionStart - 1; index >= 0; index--) {
        if (isSentenceBoundary(text, index)) {
            previousBoundaries++;
            if (previousBoundaries > phrasesBefore) {
                start = index + 1;
                break;
            }
        }
    }
    while (start < text.length && /\s/.test(text[start])) {
        start++;
    }

    let end = text.length;
    let followingBoundaries = 0;
    for (let index = selectionEnd; index < text.length; index++) {
        if (isSentenceBoundary(text, index)) {
            followingBoundaries++;
            if (followingBoundaries > phrasesAfter) {
                end = index + 1;
                break;
            }
        }
    }
    return text.slice(start, end).trim();
}

/**
 * This function gets the position of selected phrase inside inner text of body.
 * It can optionally include phrases that come before or after the phrase in which
 * the original word is found.
 * @param {Number} Number of phrases before the original phrase to include.
 * @param {Number} Number of phrases after the original phrase to include.
 * @return {Array<number>} Beginning and ending position of selection.
 */
function getExamplePhrase(word = "", noPhrasesBefore = examplePhrasesBefore, noPhrasesAfter = examplePhrasesAfter) {
    if (currentExamplePhrase != null) {
        return currentExamplePhrase;
    }
    const allText = document.body.textContent || document.body.innerText;
    const [wordStartPos, wordEndPos] = getSelectedPosition();
    if (wordStartPos === undefined || wordEndPos === undefined ||
        wordEndPos <= wordStartPos) {
        return wrapExamplePhraseInParagraphs("", word);
    }
    const context = getExamplePhraseContext(
        allText, wordStartPos, wordEndPos, noPhrasesBefore, noPhrasesAfter
    );
    return wrapExamplePhraseInParagraphs(context, word);
}
