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
function Parser(options={}, onEnd) {
    let terminateCalled = false
    let count = 0;

    let context = createContext();
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
                
                // read from the input stream
                readCb(end, function (end, data) {
                    if(!end) {
                        context = parse( context, data );

                        // if there is nothing yet to output, then read again
                        if( context.output.length <= 0 ){
                            return sync ? loop = true : next(end,writeCb);
                        }
                    }
                    else {
                        terminate(end);
                    }

                    // write to the output stream
                    // if end, the buffer will be ignored anyway
                    const out = context.output.shift();
                    // Log('writeCb', out );
                    writeCb(end, out );
                    

                    // Log('writeCb', context.output );
                    // writeCb(end, context.output.shift() );
                    // context.output = [];
                })
                sync = false;
            }
        }
    }
};

module.exports = Parser;



/**
 * Entry point for parsing a new string
 */
function parse(context, input){
    // let pos = context.pos = 0;
    // let len = context.len = input.length;
    // context.input = input;
    let it = 0;

    // while( it < 10 ){
        const frame = peekContextStack(context);
        // Log('parse', 'current', frame, 'input', input );
        switch(frame.state){
            case STATE_READ:
                context = processRead(context, input);
                break;
            case STATE_READ_KEY:
                context = processReadKey(context, input);
                break;
            case STATE_READ_VALUE:
                context = processReadValue(context, input);
                break;
        }
        // context = process(context, input);
        // it++;
    // }

    if( it >= 100 ){
        throw new Error('process did not complete');
    }

    // Log('tokenize', 'final state', context.state);

    return context;
}


function processRead(context, input){   
    // Log('process', input);

    switch(input){
        case '{':
            context = pushNewObject(context);
            // push the stack, create a new object
            break;
        case '}':
            break;
        case '[':
            context = pushNewArray(context);
            break;
        case ']':
            break;
        case ':':
            break;
        default:
            // a value
            break;
    }

    return context;
}

function processReadKey(context, input){
    // Log('[processReadKey]', input);
    let frame = peekContextStack(context);

    switch(input){
        case '}':
            return popContextState(context);
        default:
            frame.key = input;
            frame.state = STATE_READ_VALUE;
            break;
    }

    return context;
}

function processReadValue(context, input){
    // Log('[processReadKey]', input);
    let frame = peekContextStack(context);

    switch(input){
        case '{':
            context = pushNewObject(context);
            break;
        case '}':
            if( frame.isObject ){
                return popContextState(context);
            }
            break;
        case '[':
            context = pushNewArray(context);
            break;
        case ']':
            if( frame.isArray ){
                return popContextState(context);
            }
            break;
        case ':':
            break;
        default:
            pushValue(context,input);
            // if( frame.isArray ){
            //     frame.value.push( input );
            // } else {
            //     frame.value[ frame.key ] = input;
            //     frame.key = undefined;
            //     frame.state = STATE_READ_KEY;
            // }
            break;
    }

    return context;
}



function pushValue(context, value){
    let frame = peekContextStack(context);

    if( frame.isArray ){
        frame.value.push( value );
    } else {
        frame.value[ frame.key ] = value;
        frame.key = undefined;
        frame.state = STATE_READ_KEY;
    }
    
    return context;
}


function pushNewObject(context){
    let frame = { state:STATE_READ_KEY, value:{}, isObject:true };
    context.stack.push( frame );
    return context;
}

function pushNewArray(context){
    let frame = { state:STATE_READ_VALUE, value:[], isArray:true };
    context.stack.push(frame);
    return context;
}

function peekContextStack(context){
    if( !context.stack ){
        Log('[peekContextStack]', 'invalid context', context);
        throw new Error('invalid context');
    }
    return context.stack.length ? context.stack[context.stack.length-1] : {state:STATE_READ};
}

function popContextState( context ){
    // Log('popContextState', context.stack.length);
    let frame = peekContextStack(context);
    const length = context.stack.length;
    
    context.last = context.stack.pop();

    if( length <= 1){// pushOutput ){    
        context.output.push( frame.value );
    } else {
        pushValue(context,frame.value);
    }

    return context;
}


function createContext(){
    return {
        buffer:'',
        pos: 0,
        len: 0,
        stack: [],
        output: [],
        lineStart:0,
        line:1,
        linePos:0,
    };
}

/**
 * 
 * @param {*} cat 
 * @param {*} args 
 */
function Log(cat,...args){
    if( debugLog ){ console.log(`[${cat}]`, ...args); }
}
