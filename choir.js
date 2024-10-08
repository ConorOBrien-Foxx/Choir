// 
const CODE_PAGE = "¬…±×÷Œœµ«»¶ΣΠ§¡¿⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿ□!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂";
const codePageIndex = chr =>
    " \n\r\t".includes(chr)
        ? chr.charCodeAt()
        : CODE_PAGE.indexOf(chr);
const readableByteToCodePage = byt =>
    [32, 10, 13, 8].includes(byt)
        ? String.fromCharCode(byt)
        : CODE_PAGE[byt];
const normalizeChoirOutput = str =>
    [...str].map(codePageIndex).map(readableByteToCodePage).join("");

// https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
// only 1-3 characters are too short (aka "minor words")
const APA_MINOR_WORDS = [
    // conjunctions; APA gives these as "examples", but they seem exhaustive
    "and", "as", "but", "for", "if", "nor", "or", "so", "yet",
    // articles
    "a", "an", "the",
    // prepositions
    "as", "at", "by", "for", "in", "of", "off", "on", "per", "to", "up", "via",
    // prepositions not listed by the e.g.
    "vs",
    // obviously, a simple program like this cannot capture the infinitude of English complexity
    // we've excluded:
    // - "bar", as in "bar none" (although IMO, as an American, this is mostly idiomatic, anyway)
    // - "ere", as in, "ere break of day" (literary shortening of "before")
    // - "o.", "o'er", "'mid", "abt.", and other shortenings which use punctuation
    // - "out" (e.g. out the window), since this is contextually determined
    // - latin "qua", "cum", etc.
];

const toBase = (n, base) => {
    n = BigInt(n);
    base = BigInt(base);
    let digits = [];
    while(n >= 1n) {
        digits.unshift(Number(n % base));
        n /= base;
    }
    return digits;
};

const fromBase = (arr, base) => {
    base = BigInt(base);
    let output = 0n;
    for(let x of arr) {
        output *= base;
        output += BigInt(x);
    }
    return output;
};

const titleCaseSingle = word =>
    word
        ? word[0].toUpperCase() + word.slice(1).toLowerCase()
        : word;

const bytesToLiterateChoir = bytes => {
    let isLiteral = true;
    let result = "";
    for(let byt of bytes) {
        let currentIsLiteral = !!(byt & 0b10000000);
        if(currentIsLiteral !== isLiteral) {
            result += "/";
            isLiteral = currentIsLiteral;
        }
        let lower = byt & 0b01111111;
        let ch = CODE_PAGE[lower];
        if(!isLiteral && ch === "/") {
            result += "\\";
        }
        result += ch;
    }
    return result;
};

const choirLiterateToBytes = str => {
    let isInstruction = true;
    let bytes = [];
    for(let [ ins ] of str.matchAll(/\\\/|[\s\S]/g)) {
        if(ins === "\\/") {
            ins = "/";
        }
        else if(ins === "/") {
            isInstruction = !isInstruction;
            continue;
        }
        
        let ord = codePageIndex(ins);
        ord += isInstruction << 7;
        bytes.push(ord);
        
        if(isInstruction && ins === '"') {
            isInstruction = !isInstruction;
        }
    }
    // console.log(bytes);
    return bytes;
};

const swapCase = str => 
    str.replace(/\w/g,
        chr => chr == chr.toLowerCase()
            ? chr.toUpperCase()
            : chr.toLowerCase()
    );

const indexTrieFromWordList = wordList => {
    let indexTrie = {};
    wordList.forEach((word, idx) => {
        let iter = indexTrie;
        for(let ch of [...word, null]) {
            if(ch === null) {
                iter[ch] = idx;
            }
            else {
                iter[ch] ||= {};
                iter = iter[ch];
            }
        }
    });
    return indexTrie;
};

const longestPrefixInIndexTrie = (str, indexTrie) => {
    let longestIndex = -1;
    let trieIndex = -1;
    let iter = indexTrie;
    for(let i = 0; i < str.length; i++) {
        iter = iter[str[i]];
        // console.log(iter);
        if(!iter) {
            break;
        }
        if(null in iter) {
            longestIndex = i;
            trieIndex = iter[null];
        }
    }
    return { longestIndex, trieIndex };
};

let SHORT_WORDS_TRIE = null;
let WORDS_TRIE = null;
const initializeTries = () => {
    SHORT_WORDS_TRIE ||= indexTrieFromWordList(SHORT_WORDS);
    WORDS_TRIE ||= indexTrieFromWordList(WORDS);
};

const compressStringToBigInt = str => {
    initializeTries();
    // console.log("-------------- COMPRESSING --------------");
    
    // isolate into parts
    let parts = [];
    for(let i = 0; i < str.length; i++) {
        // ignore spaces, for now TODO: don't
        let spaceStart = str[i] === " ";
        if(spaceStart) {
            i++;
        }
        
        let head = str.slice(i);
        let headSwapped = swapCase(head);
        // TODO: check for swapcase
        let longestIndex = -1;
        let dictionaryIndex = -1;
        let wordIndex = -1;
        let isSwap = false;
        let word;
        for(let headIter of [ head, headSwapped ]) {
            for(let didx of [ 0, 1 ]) {
                let trie = didx === 0 ? SHORT_WORDS_TRIE : WORDS_TRIE;
                let {
                    longestIndex: stringIndexCombo,
                    trieIndex: trieIndexCombo,
                } = longestPrefixInIndexTrie(headIter, trie);
                
                if(stringIndexCombo > longestIndex) {
                    longestIndex = stringIndexCombo;
                    dictionaryIndex = didx;
                    wordIndex = trieIndexCombo;
                    isSwap = headIter === headSwapped;
                    word = headIter.slice(0, longestIndex + 1);
                }
            }
        }
        
        if(longestIndex !== -1) {
            parts.unshift({
                word,
                wordIndex,
                dictionaryIndex,
                spaceStart,
                isFirst: parts.length === 0,
                isSwap,
            });
            i += longestIndex;
        }
        else {
            if(spaceStart) {
                i--;
            }
            parts.unshift({ word: str[i] });
        }
        
    }
    
    // compress parts back-to-front
    // unwrapping is a reverse process, so we start at the end
    // we stored the parts in the reverse order already
    let n = 0n;
    console.log("parts:", JSON.stringify(parts));
    for(let part of parts) {
        let { word } = part;
        let interpretMode = 0n;
        if(word.length === 1 && !part.spaceStart) {
            if(word < ' ' || word > '~') {
                console.warn("Cannot encode character", word);
                word = ' ';
            }
            let ord = word.charCodeAt(0);
            n *= 96n;
            n += BigInt(ord - 32) + 1n;
            console.log("after char", n);
        }
        else {
            let {
                wordIndex,
                dictionaryIndex,
                spaceStart,
                isFirst,
                isSwap,
            } = part;
            let dict = dictionaryIndex === 0 ? SHORT_WORDS : WORDS;
            interpretMode = 1n;
            
            n *= BigInt(dict.length);
            n += BigInt(wordIndex);
            
            n *= 2n;
            n += BigInt(dictionaryIndex);
            
            let flag = 0n;
            if(isFirst && spaceStart) {
                interpretMode = 2n;
                flag = 1n;
            }
            if(!isFirst && !spaceStart) {
                interpretMode = 2n;
                flag = 1n;
            }
            if(isSwap) {
                interpretMode = 2n;
                if(flag === 1n) {
                    flag = 2n;
                }
            }
            
            if(interpretMode === 2n) {
                // TODO: flag
                n *= 3n;
                n += flag;
            }
        }
        n *= 3n;
        n += interpretMode;
    }
    
    return n;
    
    // return n;
};

const decompressStringFromBigInt = n => {
    // console.log("-------------- DECOMPRESSING --------------");
    let result = "";
    n = BigInt(n);
    while(n) {
        let interpretMode = n % 3n;
        // console.log({ interpretMode });
        n /= 3n;
        if(interpretMode === 0n) {
            // interpret as ASCII character
            // console.log("ASCII character interpret", n);
            let asciiOrd = n % 96n;
            n /= 96n;
            let chr = String.fromCharCode(Number(asciiOrd) + 32 - 1);
            result += chr;
        }
        else {
            // console.log("word index");
            let flagSwapCase = false;
            let flagPrependSpace = result != "";
            if(interpretMode === 2n) {
                // add space/casing information
                let flag = n % 3n;
                // there's technically 4 options (since there's 2 flags), but the 4th option is implicitly the case (interpretMode == 1)
                n /= 3n;
                flagSwapCase = flag != 1;
                flagPrependSpace ^= flag != 0;
                // console.log("Derivated flags:", {flag, flagSwapCase, flagPrependSpace});
            }
            // which dictionary do we wish to index into?
            let dictionaryIndex = n % 2n;
            n /= 2n;
            // console.log("dictionary index", dictionaryIndex);
            let dict = dictionaryIndex === 0n ? SHORT_WORDS : WORDS;
            let wordIndex = n % BigInt(dict.length);
            n /= BigInt(dict.length);
            // TODO: flags
            let word = dict[Number(wordIndex)];
            // console.log({ word, wordIndex });
            
            if(flagSwapCase) {
                word = swapCase(word);
            }
            
            if(flagPrependSpace) {
                word = " " + word;
            }
            
            result += word;
        }
    }
    return result;
};

const compressString = str => {
    let n;
    if(typeof str === "string") {
        n = compressStringToBigInt(str);
    }
    else {
        n = str;
    }
    
    let bits = toBase(n, 2).map(n => Number(n));
    
    let mode1 = [ 0b10000000 + "d".charCodeAt() ];
    let mode1bits = [...bits];
    while(mode1bits.length % 7 !== 0) {
        mode1bits.unshift(0);
    }
    for(let i = 0; i < mode1bits.length; i += 7) {
        mode1.push(Number(fromBase(mode1bits.slice(i, i + 7), 2)));
    }
    return bytesToLiterateChoir(mode1);
};
// console.log(compressString("hello"));

const extractChoirSections = commands => {
    let sections = [];
    let section = {
        isLiteral: false,
        commands: "",
    };
    
    let isLiteral = false;
    for(let cmd of commands) {
        let highBit   = cmd & 0b10000000;
        let lowerBits = cmd & 0b01111111;
        if(!!highBit === isLiteral) {
            isLiteral = !isLiteral;
            sections.push(section);
            section = {
                isLiteral,
                commands: "",
            };
        }
        // console.log(cmd, highBit, isLiteral);
        section.commands += CODE_PAGE[lowerBits];
    }
    
    if(section.commands.length > 0) {
        sections.push(section);
    }
    
    return sections;
};

// TODO: BigInts
const CHOIR_NORETURN = Symbol("CHOIR_NORETURN");
const CHOIR_COMMANDS = {
    "¬": function setNotRegister(s) {
        this.registers["¬"] = s;
        return s;
    },
    "…": function spreadBuildString() {
        let str = this.popBuildString();
        this.stack.push(...str);
        return CHOIR_NORETURN;
    },
    // ±
    // ×
    // ÷
    // Œ
    // œ
    // µ
    // «
    // »
    // ¶
    // Σ
    // Π
    // §
    // ¡
    // ¿
    // ⁰
    // ¹
    // ²
    // ³
    // ⁴
    // ⁵
    // ⁶
    // ⁷
    // ⁸
    // ⁹
    "⁺": function increment(n) { return +n + 1; },
    "⁻": function decrement(n) { return +n - 1; },
    "⁼": function setSupEqualsRegister(s) {
        this.registers["⁼"] = s;
        return s;
    },
    // ⁽
    // ⁾
    "ⁿ": function setSupNRegister(s) {
        // TODO: something with numbers?
        this.registers["ⁿ"] = s;
        return s;
    },
    // □
    // !
    '"': function startQuote() {
        this.pushNextLiteralSection = true;
        return CHOIR_NORETURN;
    },
    "#": function eraseBuildString() {
        this.buildString = "";
        return CHOIR_NORETURN;
    },
    "$": function dropTop(n) { return CHOIR_NORETURN; },
    // %
    // &
    // '
    // (
    // )
    "*": function add(n1, n2) { return +n1 * +n2; },
    "+": function add(n1, n2) { return +n1 + +n2; },
    // ,
    "-": function subtract(n1, n2) { return +n1 - +n2; },
    // .
    "/": function add(n1, n2) { return +n1 / +n2; },
    // 0-9 excepted
    ":": function duplicate() {
        return this.peek();
    },
    // ;
    // <
    // =
    // >
    // ?
    "@": function elementAt(s, n) {
        if(typeof s === "number" && typeof n === "string") {
            [ s, n ] = [ n, s ];
        }
        
        return s[n];
    },
    "A": function pushUppercaseAlphabet() {
        return "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    },
    // B
    "C": function center(s, n) {
        if(typeof s === "number" && typeof n === "string") {
            [ s, n ] = [ n, s ];
        }
        
        let start = s.length / 2;
        let end = Math.ceil(start);
        if(start === end) end++;
        n--;
        // console.log(start, end, n);
        return s.slice(start - n, end + n);
    },
    // D
    // E
    // F
    // G
    "H": function head(s, n) {
        if(typeof s === "number" && typeof n === "string") {
            [ s, n ] = [ n, s ];
        }
        
        return s.slice(0, n);
    },
    "I": function doubleIncrement(n) { return +n + 2; },
    "J": function doubleDecrement(n) { return +n - 2; },
    // K
    // L
    // M
    // N
    // O
    // P
    // Q
    "R": function unirange(n) {
        return CHOIR_COMMANDS.r(0, n - 1);
    },
    "S": function pushSpace() {
        return " ";
    },
    "T": function head(s, n) { 
        if(typeof s === "number" && typeof n === "string") {
            [ s, n ] = [ n, s ];
        }
        
        return s.slice(-n);
    },
    // U
    // V
    // W
    // X
    // Y
    "Z": function pushASCII() {
        return " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";
    },
    // [
    // \
    // ]
    // ^
    // _
    // `
    "a": function pushLowercaseAlphabet() {
        return "abcdefghijklmnopqrstuvwxyz";
    },
    "b": function reverseConcatenate(s1, s2) {
        return "" + s2 + s1;
    },
    "c": function concatenate(s1, s2) {
        return "" + s1 + s2;
    },
    "d": function setCompressMode1() {
        this.compressMode = 1;
        return CHOIR_NORETURN;
    },
    // e
    // f
    // g
    // h
    "i": function initialUpperCase(s) {
        return s && s[0].toUpperCase() + s.slice(1).toLowerCase();
    },
    "j": function joinBy(a, s) {
        if(Array.isArray(s) && typeof a === "string") {
            [ a, s ] = [ s, a ];
        }
        
        return a.join(s);
    },
    // k
    // l
    // m
    // n
    // o
    // p
    // q
    "r": function birange(n1, n2) {
        if(n1 > n2) {
            return CHOIR_COMMANDS.r(n2, n1);
        }
        if(typeof n1 === "string" && typeof n2 === "string") {
            // TODO: better string range
            return CHOIR_COMMANDS.r(n1.charCodeAt(0), n2.charCodeAt(0))
                .map(n => String.fromCharCode(n))
                .join("");
        }
        let arr = [];
        for(let i = +n1; i <= +n2; i++) {
            arr.push(i);
        }
        return arr;
    },
    // s
    "t": function titleCase(s) {
        console.log("title case:", s);
        return s.replace(/\w+/g, titleCaseSingle);
    },
    // u
    // v
    // w
    // x
    // y
    // z
    // {
    // |
    "}": function pushBuild() {
        let save = this.buildString;
        this.buildString = "";
        return save;
    },
    "~": function swapTopTwo(a, b) {
        this.stack.push(b);
        return a;
    },
    // ⌂
    "⌂D": function debug() {
        console.log("DEBUGGING!");
        console.log(this.stack);
        return CHOIR_NORETURN;
    },
    "⌂t": function APATitleCase(s) {
        let isFirstWord = true;
        
        return s.replace(/([—-]|[:;.] )?(\w+)/g, (match, punct, word) => {
            if(word === word.toUpperCase()) {
                return match;
            }
            
            word = word.toLowerCase();
            
            let capitalize = punct || isFirstWord || !APA_MINOR_WORDS.includes(word);
            
            isFirstWord = false;
            
            if(capitalize) {
                word = titleCaseSingle(word);
            }
            return (punct ?? "") + word;
        });
    },
};

const evalChoir = (commands, input) => {
    // split into sections: literal and instruction
    
    let state = {
        buildString: "",
        compressMode: 0,
        pushNextLiteralSection: false,
        stack: [],
        inputs: input ? input.split("\n") : [],
        inputIndex: 0,
        registers: {
            "⁼": "",
        },
        popBuildString() {
            let save = this.buildString;
            this.buildString = "";
            return save;
        },
        pop() {
            if(this.stack.length) {
                return this.stack.pop();
            }
            if(this.inputIndex < this.inputs.length) {
                return this.inputs[this.inputIndex++];
            }
            else {
                return this.popBuildString();
            }
        },
        peek() {
            return this.stack.length
                ? this.stack.at(-1)
                : this.inputs[this.inputIndex] || this.buildString;
        },
        resetForNewSection() {
            this.stack = [];
            this.inputIndex = 0;
        },
        endInstructionSection() {
            if(this.pushNextLiteralSection) {
                return;
            }
            let value = this.stack.length ? this.pop() : CHOIR_NORETURN;
            if(value !== CHOIR_NORETURN) {
                this.buildString += value;
            }
            state.resetForNewSection();
        },
        popArguments(n) {
            let args = [];
            while(args.length < n) {
                args.unshift(this.pop());
            }
            return args;
        },
    };
    let sections = extractChoirSections(commands);
    
    for(let { isLiteral, commands } of sections) {
        if(isLiteral) {
            console.log("Appending literal section", commands, "under", state.compressMode);
            let result;
            if(state.compressMode === 0) {
                if(state.registers["¬"] !== null) {
                    commands = commands.replace(/¬/g, state.registers["¬"]);
                }
                if(state.registers["⁼"] !== null) {
                    commands = commands.replace(/⁼/g, state.registers["⁼"]);
                }
                if(state.registers["ⁿ"] !== null) {
                    commands = commands.replace(/ⁿ/g, state.registers["ⁿ"]);
                }
                result = normalizeChoirOutput(commands);
            }
            else if(state.compressMode === 1) {
                let totalBits = [...commands].flatMap(chr => {
                    let bits = toBase(codePageIndex(chr), 2);
                    while(bits.length < 7) {
                        bits.unshift(0);
                    }
                    return bits;
                });
                console.log("Total bits before decompression:", totalBits);
                let n = fromBase(totalBits, 2);
                console.log(totalBits, n);
                result = decompressStringFromBigInt(n);
            }
            else {
                console.warn("Unhandled compress mode:", state.compressMode);
            }
            if(state.pushNextLiteralSection) {
                state.pushNextLiteralSection = false;
                console.log("Pushing net literal section", result);
                state.stack.push(result);
            }
            else {
                state.buildString += result;
            }
            state.compressMode = 0; // reset
        }
        else {
            for(let [ command, digits ] of commands.matchAll(/([0-9]+)|['⌂].|./g)) {
                console.log(command);
                let fn = CHOIR_COMMANDS[command];
                if(fn) {
                    let args = state.popArguments(fn.length);
                    let value = fn.apply(state, args);
                    if(value !== CHOIR_NORETURN) {
                        state.stack.push(value);
                    }
                }
                else if(command[0] === "'") {
                    state.stack.push(command.slice(1));
                }
                else if(digits) {
                    state.stack.push(+digits);
                }
                else {
                    console.warn("Unimplemented command", command);
                }
            }
            state.endInstructionSection();
        }
    }
    
    console.log(state.buildString);
    console.log(state);
    
    return state;
};

// evalChoir(choirLiterateToBytes(`2H/.../2T`), "AdmBorkBork");
// evalChoir(choirLiterateToBytes(`:/spooky/2+/me`), 6);
// evalChoir(choirLiterateToBytes(`:D/².2/I/me`), 6);
