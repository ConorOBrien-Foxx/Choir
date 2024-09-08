// 
const CODE_PAGE = "¬¡±×÷Œœµ«»¶ΣΠ§¡¿⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿ□!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂";
const codePageIndex = chr => " \n\r\t".includes(chr) ? chr.charCodeAt() : CODE_PAGE.indexOf(chr);

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
        result += CODE_PAGE[lower];
    }
    return result;
};

const choirLiterateToBytes = str => {
    let isInstruction = true;
    let bytes = [];
    for(let [ ins ] of str.matchAll(/\/\/|./g)) {
        if(ins === "//") {
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
    console.log(bytes);
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
        if(word.length === 1) {
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
    let n = compressStringToBigInt(str);
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
        isLiteral: true,
        commands: "",
    };
    
    let isLiteral = true;
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
    // ¬
    // ¡
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
    // ⁼
    // ⁽
    // ⁾
    // ⁿ
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
    // 0
    // 1
    // 2
    // 3
    // 4
    // 5
    // 6
    // 7
    // 8
    // 9
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
    // A
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
    // R
    // S
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
    // Z
    // [
    // \
    // ]
    // ^
    // _
    // `
    // a
    // b
    "c": function concatenate(s1, s2) {
        return s1 + s2;
    },
    "d": function setCompressMode1() {
        this.compressMode = 1;
        return CHOIR_NORETURN;
    },
    // e
    // f
    // g
    // h
    // i
    // j
    // k
    // l
    // m
    // n
    // o
    // p
    // q
    // r
    // s
    "t": function titleCase(s) {
        console.log("title case:", s);
        return s.split(" ").map(word => word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word).join(" ");
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
    // ~
    // ⌂
    "⌂D": function debug() {
        console.log("DEBUGGING!");
        console.log(this.stack);
        return CHOIR_NORETURN;
    },
};

const evalChoir = (commands, input) => {
    // split into sections: literal and instruction
    
    let state = {
        buildString: "",
        compressMode: 0,
        pushNextLiteralSection: false,
        stack: [],
        popBuildString() {
            let save = this.buildString;
            this.buildString = "";
            return save;
        },
        pop() {
            // TODO: multiple inputs; reset inputs index on new sections
            return this.stack.length
                ? this.stack.pop()
                : input
                    ? input
                    : this.popBuildString();
        },
        peek() {
            // TODO: multiple inputs; reset inputs index on new sections
            return this.stack.length ? this.stack.at(-1) : input || this.buildString;
        },
        resetForNewSection() {
            this.stack = [];
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
                result = commands;
            }
            else if(state.compressMode === 1) {
                let totalBits = [...commands].flatMap(chr => {
                    let bits = toBase(codePageIndex(chr), 2);
                    while(bits.length < 7) {
                        bits.unshift(0);
                    }
                    return bits;
                });
                let n = fromBase(totalBits, 2);
                console.log(totalBits, n);
                result = decompressStringFromBigInt(n);
            }
            else {
                console.warn("Unhandled compress mode:", state.compressMode);
            }
            if(state.pushNextLiteralSection) {
                state.pushNextLiteralSection = false;
                console.log("Pushing net literal section", commands);
                state.stack.push(commands);
            }
            else {
                state.buildString += commands;
            }
            state.compressMode = 0; // reset
        }
        else {
            for(let [ command, digits ] of commands.matchAll(/([0-9]+)|⌂.|./g)) {
                console.log(command);
                let fn = CHOIR_COMMANDS[command];
                if(fn) {
                    let args = state.popArguments(fn.length);
                    let value = fn.apply(state, args);
                    if(value !== CHOIR_NORETURN) {
                        state.stack.push(value);
                    }
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
