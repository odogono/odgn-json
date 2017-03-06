'use strict'

const STATE_READ = 'RD';// 0;
const STATE_READ_OBJECT = 'RDOBJ';// 1;
const STATE_READ_KEY = 'RDKEY';// 2;
const STATE_READ_VALUE = 'RDVAL'; //3;
const STATE_READ_SINGLE_LINE_COMMENT = 'RDSLC';
const STATE_READ_ARRAY = 'RDARR';

const TERMINATE_NON_WHITESPACE = -10;
const TERMINATE_END_OF_INPUT = -11;

let debugLog = false;


/**
 * A Through Pull-Stream which takes an input stream
 * and emits tokens suitable for JSON.
 * 
 * @param {*} options 
 * @param {*} onEnd 
 */
function Tokenizer(options={}, onEnd) {
    let terminateCalled = false
    let count = 0;

    let context = createContext();
    context.includePosition = !!options.includePosition;
    debugLog = !!options.debug;

    function terminate(abort) {
        if(terminateCalled || !onEnd) { return }
        terminateCalled = true
        onEnd(abort === true ? null : abort)
    }


    return function(readCb) {

        return function next(end, writeCb) {
            if(end) { terminate(end); }
            let sync, loop = true;

            while(loop){
                loop = false;
                sync = true;
                
                readCb(end, function (end, data) {
                    if(!end) {
                        context = tokenize( context, data.toString() );
                        // console.log('[tokenize]', data.toString())
                        // if there is nothing yet to output, then read again
                        if( context.output.length <= 0 ){
                            return sync ? loop = true : next(end,writeCb);
                        }
                    }
                    else {
                        terminate(end);
                    }

                    // if end, the buffer will be ignored anyway
                    writeCb(end, context.output);
                    context.output = [];
                })
                sync = false;
            }
        }
    }
};

module.exports = Tokenizer;



/**
 * Entry point for parsing a new string
 */
function tokenize(context, input){
    let pos = context.pos = 0;
    let len = context.len = input.length;
    context.input = input;
    let it = 0;

    while( context.pos < context.len && it < 100 ){
        context = process(context);
        it++;
    }

    if( it >= 100 ){
        throw new Error('process did not complete');
    }

    // Log('tokenize', 'final state', context.state);
    context.position += input.length;
    return context;
}


function process(context){
    let terminator;
    
    switch( peekContextState(context) ){

        case STATE_READ_OBJECT:
            // Log('process', '[RDOBJ] last state was', context.lastState, 'terminator was', context.terminator );
            if( context.terminator == '}' ){
                popContextState(context);
            }
            else if( context.lastState == STATE_READ_KEY ){
                pushContextState( context, STATE_READ_VALUE );    
            } else {
                pushContextState( context, STATE_READ_KEY );
            }
            break;

        case STATE_READ_ARRAY:
            // Log('process', '[RDARR] last state was', context.lastState, 'terminator was', context.terminator );
            if( context.terminator == ']' ){
                popContextState(context);
            } else {
                pushContextState( context, STATE_READ_VALUE );
            }
            break;

        case STATE_READ_KEY:
            terminator = readAhead(context, ':', '}', ']');
            // Log('process', '[RDKEY] read', context.buffer, terminator );
            if( terminator == '}' ){
                // remove last separator?
                clearLastOutput(context, ',', '\n' );
                addOutput(context, false, terminator);
                popContextState(context);
            }
            else if( terminator == ':'){
                addOutput(context, true, terminator );
                popContextState(context);
            }
            break;

        default:
        case STATE_READ_VALUE:
            terminator = readAhead(context, '[', '{', ']', '}', ',', "\n" );
            if( terminator == '{' ){
                addOutput(context, false, terminator );
                pushContextState( context, STATE_READ_OBJECT );
            }
            else if( terminator == '['){
                addOutput(context, false, terminator );
                pushContextState( context, STATE_READ_ARRAY );
            }
            else if( terminator == '}' || terminator == ']' ){
                clearLastOutput(context, ',', '\n' );
                addOutput(context, true, terminator );
                popContextState(context);
                popContextState(context); // pop the array/object context as well
            }
            else if( terminator == ',' || terminator == "\n" ){
                addOutput(context, true );
                popContextState(context);
            }

            break;
    }

    return context;
}

function createContext(){
    return {
        buffer:'',
        pos: 0,
        len: 0,
        input:'',
        state: [STATE_READ],
        output: [],
        lineStart:0,
        line:1,
        linePos:0,
        position: 0
    };
}

/**
 * 
 * @param {*} context 
 * @param {*} terminators 
 */
function readAhead(context, ...terminators){
    let {pos,len,buffer} = context;
    let terminator;
    
    for(pos;pos<len;pos++){
        const char = context.input.charAt(pos);
        const last = context.input.charAt(pos-1);
        // context.position = context.position + pos;
        
        if( context.withinSingleComment ){
            if( char == '\n' ){
                context.withinSingleComment = false;
            }
            continue;
        }
        else if( context.withinComment ){
            if( char == '/' && context.lastChar == '*' ){
                context.withinComment = false;
            }
            context.lastChar = char;
            continue;
        }
        else if( context.withinQuote ){
            if( char == '"' ){
                context.withinQuote = false;
            }
        } else {
            Log('readAhead', (context.position+pos), `[${peekContextState(context)}]`, char == "\n" ? '\\n' : char, '-*', terminators);

            if( char == '*' && context.lastChar == '/' ){
                context.withinComment = true;
                // remove last from buffer
                buffer = buffer.slice(0,-1);
                continue;
            }
            else if( char == '/' && context.lastChar == '/' ){
                context.withinSingleComment = true;
                buffer = buffer.slice(0,-1);
                continue;
            }
            else if( char == '#' ){
                context.withinSingleComment = true;
                continue;
            }
            else if( (terminator = equalsChar(char,terminators)) ){
                context.terminator = char;
                context.pos = pos+1;
                context.buffer = buffer;
                return char;
            }
            else if( char == '"' ){
                context.withinQuote = true;
            }
        }

        buffer = buffer + char;
        context.lastChar = char;
    }

    // end of input
    context.pos = pos;
    // context.position += pos;
    context.buffer = buffer;
    context.terminator = false;
    return TERMINATE_END_OF_INPUT;
}

// /**
//  * Returns the next non-whitespace char to appear
//  */
// function readToNonWhitespace(context){
//     let {pos,len} = context;
//     for(pos;pos<len;pos++){
//         const char = context.input.charAt(pos);
//         if( !isWhiteSpace(char) ){
//             return char;
//         }
//     }
//     return '';
// }

/**
 * 
 * @param {*} char 
 * @param {*} charOrChars 
 */
function equalsChar( char, charOrChars ){
    if( charOrChars == TERMINATE_NON_WHITESPACE ){
        return isWhiteSpace(char) ? false : TERMINATE_NON_WHITESPACE;
    }
    if( Array.isArray(charOrChars) && charOrChars.length ){
        if( charOrChars[0] == TERMINATE_NON_WHITESPACE ){
            return isWhiteSpace(char) ? false : TERMINATE_NON_WHITESPACE;
        }
        const index = charOrChars.indexOf(char);
        return index == -1 ? false : charOrChars[index];
    } else {
        return char == charOrChars ? charOrChars : false;
    }
}

/**
 * 
 * @param {*} char 
 */
function isWhiteSpace(char){
    return /\s/.test(char);
}

/**
 * 
 * @param {*} str 
 */
function trim(str){
    str = str.trim();
    if( str.charAt(0) == '"' && str.charAt(str.length-1) == '"' ){
        str = str.substring(1,str.length-1);
    }
    return str;
}

/**
 * Count the offset of the first word char in the string
 * @param {*} str 
 */
function countTrimLeft(str){
    if( !str || !str.length ){ 
        return 0;
    }
    let index = 0;
    while( str.charAt(index++) == ' ' );
    // Log('countTrimLeft', `'${str}'`, index);
    return index ? index-1 : 0;
}

/**
 * 
 * @param {*} context 
 */
function peekContextState(context){
    if( !context.state ){
        Log('peekContextState', 'invalid context', context);
        throw new Error('invalid context');
    }
    return context.state.length ? context.state[context.state.length-1] : STATE_READ;
}

/**
 * 
 * @param {*} context 
 * @param {*} state 
 */
function pushContextState( context, state ){
    context.lastState = peekContextState(context);
    context.buffer = '';
    context.state.push(state);
    Log('pushContextState', context.state);
    return state;
}

/**
 * 
 * @param {*} context 
 */
function popContextState( context ){
    Log('popContextState', context.state);// peekContextState(context));
    context.lastState = context.state.pop();
    context.buffer = '';
    return peekContextState(context);
}

/**
 * 
 * @param {*} context 
 * @param {*} outputBuffer 
 * @param {*} output 
 */
function addOutput(context, outputBuffer, addChar='' ){
    let pos = context.position+context.pos-1;
    if(outputBuffer){
        pos -= context.buffer ? context.buffer.length : 0;
        pos += countTrimLeft(context.buffer);
        let str = trim(context.buffer);
        if( str.length ){
            str = parseValue(str);
            if( context.includePosition ){
                context.output.push( [str,pos] );
            } else {
                context.output.push( str );
            }
        }
    }
    if( addChar != '' ){
        if( context.includePosition ){
            context.output.push( [addChar,context.position+context.pos-1] );
        } else {
            context.output.push( addChar );
        }
    }

    // context.output = [...context.output, ...output];
    Log('addOutput', pos, outputBuffer ? `'${trim(context.buffer)}'`:'', addChar );
}

/**
 * 
 * @param {*} str 
 */
function parseValue(str){
    const c = str.charAt(0);
    switch(c){
        case 't':
            if( str.length === 4 && str === 'true' ){
                return true;
            }
            break;
        case 'f':
            if( str.length === 5 && str === 'false' ){
                return false;
            }
            break;
        case 'n':
            if( str.length == 4 && str === 'null' ){
                return null;
            }
            break;
        case '-': 
        case '0': case '1': case '2': 
        case '3': case '4': case '5': 
        case '6': case '7': case '8': 
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
function parseNumber(str){
    // I'm not proud...
    try{
        return JSON.parse(str);
    } catch(err){
        // Log('parseNumber', err.message, str );
    }
    return str;
}

/**
 * Removes values from the end of context output so long
 * as they are equal to one of the tokens
 */
function clearLastOutput( context, ...tokens ){
    while( context.output.length ){
        if( equalsChar(context.output[context.output.length-1], tokens) ){
            context.output.pop();
        } else {
            // no more to remove
            return context;
        }
    }
}


/**
 * 
 * @param {*} context 
 * @param {*} extra 
 */
function cloneContext(context, ...extra){
    return Object.assign({}, context, ...extra );
}


/**
 * 
 * @param {*} cat 
 * @param {*} args 
 */
function Log(cat,...args){
    if( debugLog ){ console.log(`[${cat}]`, ...args); }
}
