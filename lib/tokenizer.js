'use strict';

const Through = require('pull-through');


let debugLog = false;

module.exports = function(options = {}, onEnd) {
    let context = createContext();
    debugLog = !!options.debug;

    return Through(
        function(data) {
            context = tokenize(context, data.toString());
            while (context.output.length) {
                this.queue(context.output.shift());
            }
        },
        function() {
            if (onEnd) {
                onEnd();
            }
            this.queue(null);
        }
    );
};

/**
 * A Through Pull-Stream which takes an input stream
 * and emits tokens suitable for JSON.
 * 
 * @param {*} options 
 * @param {*} onEnd 
 */


/**
 * Entry point for parsing a new string
 */
function tokenize(context, input) {
    context.inputPosition = 0;
    context.length = input.length;
    
    while (context.inputPosition < input.length){
        context = processAlt(context, input);
    }

    context.position += input.length;
    return context;
}


function processAlt(context, input) {
    let { pos, length, buffer, charBuffer } = context;
    
    for (pos; pos < length; pos++) {
        let char = input.charAt(pos);

        charBuffer[2] = charBuffer[1];
        charBuffer[1] = charBuffer[0];
        charBuffer[0] = char;

        if (char == '\n') {
            context.line++;
        }

        if (context.maybeWithinQuote) {
            let clear = false;
            if (char == '*' && charBuffer[1] == '/') {
                context.withinMultiComment = true;
                clear = true;
            }
            if (char == '/' && charBuffer[1] == '/') {
                context.withinComment = true;
                clear = true;
            }
            if( char == '\'' && charBuffer[1] == '\'' && charBuffer[2] == '\'' ){
                context.withinMultiQuote = true;
                clear = true;
            }

            if( clear ){
                context.maybeWithinQuote = false;
                buffer = '';
                continue;
            }

            switch (char) {
                case '{':
                case '}':
                case '[':
                case ']':
                case ':':
                case ',':
                case '\n':
                    context.output.push([
                        parseValue(trimRight(buffer)),
                        context.markPosition,
                        context.line
                    ]);
                    context.maybeWithinQuote = false;
                    buffer = '';

                    if (char !== '\n' && char !== ',') {
                        context.output.push([
                            char,
                            context.position + pos,
                            context.line
                        ]);
                    }
                    break;
            }
        } else if( context.withinMultiQuote ){
            if( char == '\'' && charBuffer[1] == '\'' && charBuffer[2] == '\'' ){
                context.withinMultiQuote = false;
                context.output.push([
                    buffer.substring(0,buffer.length-2),
                    context.markPosition,
                    context.line
                ]);
                buffer = '';
            }
        } else if (context.withinQuote) {
            if (char == '"') {
                context.output.push([
                    buffer,
                    context.markPosition,
                    context.line
                ]);
                context.withinQuote = false;
                buffer = '';
            }
        } else if (context.withinMultiComment) {
            if (char == '/' && charBuffer[1] == '*') {
                context.withinMultiComment = false;
            }
        } else if (context.withinComment) {
            if (char == '\n') {
                context.withinComment = false;
            }
        } else {
            switch (char) {
                case '{':
                case '}':
                case '[':
                case ']':
                case ':':
                    context.output.push([
                        char,
                        context.position + pos,
                        context.line
                    ]);
                case ',':
                    break;
                case ' ':
                case '\n':
                    break;
                case '#':
                    context.withinComment = true;
                    break;
                case '"':
                    context.withinQuote = true;
                    context.markPosition = context.position + pos;
                    char = '';
                    break;
                default:
                    context.maybeWithinQuote = true;
                    context.markPosition = context.position + pos;
                    break;
            }
        }

        if (context.withinQuote || context.maybeWithinQuote || context.withinMultiQuote) {
            buffer = buffer + char;
        }

        Log(
            'readAhead',
            context.position + pos,
            char == '\n' ? '\\n' : char,
            char.charCodeAt(),
            '-*',
            charBuffer,
            context.markPosition,
            contextStatusToString(context),
            buffer
        );
    }

    context.inputPosition = pos;
    context.buffer = buffer;
    context.charBuffer = charBuffer;

    return context;
}

function contextStatusToString(context) {
    if (context.withinComment) {
        return 'comment';
    }
    if (context.withinMultiComment) {
        return 'multiComment';
    }
    if (context.maybeWithinQuote) {
        return 'maybeQuote';
    }
    if (context.withinQuote) {
        return 'quote';
    }
    if (context.withinMultiQuote) {
        return 'multiQuote';
    }
    return '';
}


function createContext() {
    return {
        buffer: '',
        pos: 0,
        length: 0,
        // input: '',
        // state: [STATE_READ],
        output: [],
        // lineStart: 0,
        line: 0,
        // linePos: 0,
        position: 0,
        // lastChar: '',
        charBuffer: ['', '', ''],
        withinQuote: false,
        maybeWithinQuote: false,
        withinMultiQuote: false,
        withinComment: false,
        withinMultiComment: false
    };
}

function trimRight(str, ch = ' ') {
    let ii;
    for (ii = str.length - 1; ii >= 0; ii--) {
        if (ch != str.charAt(ii)) {
            str = str.substring(0, ii + 1);
            break;
        }
    }
    return str;
}

/**
 * 
 * @param {*} str 
 */
function parseValue(str) {
    const c = str.charAt(0);
    switch (c) {
        case 't':
            if (str.length === 4 && str === 'true') {
                return true;
            }
            break;
        case 'f':
            if (str.length === 5 && str === 'false') {
                return false;
            }
            break;
        case 'n':
            if (str.length == 4 && str === 'null') {
                return null;
            }
            break;
        case '-':
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
            return parseNumber(str);

        default:
            break;
    }
    return str;
}

/**
 * 
 * @param {*} str 
 */
function parseNumber(str) {
    // I'm not proud...
    try {
        return JSON.parse(str);
    } catch (err) {
        // Log('parseNumber', err.message, str );
    }
    return str;
}

/**
 * 
 * @param {*} cat 
 * @param {*} args 
 */
function Log(cat, ...args) {
    if (debugLog) {
        console.log(`[${cat}]`, ...args);
    }
}
