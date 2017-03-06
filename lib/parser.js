'use strict'

const STATE_READ = 'RD';// 0;
const STATE_READ_KEY = 'RDKEY';// 2;
const STATE_READ_VALUE = 'RDVAL'; //3;


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
    // let count = 0;

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
                        
                        context = processReadValue(context, data);

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
                })
                sync = false;
            }
        }
    }
};

module.exports = Parser;



/**
 * 
 * @param {*} context 
 * @param {*} input 
 */
function processReadValue(context, input){
    let frame = peekContextStack(context);
    let position = -1;
    if( Array.isArray(input) ){
        position = input[1];
        input = input[0];
    }

    Log('processReadValue', input);

    switch(input){
        case '{':
            return pushNewObject(context);
        case '}':
            if( frame.isObject ){
                return popContextState(context);
            }
            break;
        case '[':
            return pushNewArray(context);
        case ']':
            if( frame.isArray ){
                return popContextState(context);
            }
            break;
        // allowable ignorable tokens
        case ':':
            if( frame.isObject ){
                return context;
            }
        default:
            return pushValue(context,input);
    }

    let message = 'Unexpected token ' + input + ' in JSON';
    if( position !== -1 ){
        message = message + ' at position ' + position;
    }

    context.output.push( new Error(message) );

    return context;
}


/**
 * 
 * @param {*} context 
 * @param {*} value 
 */
function pushValue(context, value){
    let frame = peekContextStack(context);

    if( frame.isArray ){
        frame.value.push( value );
    } else if( frame.isObject ){
        if( !frame.key ){
            frame.key = value;
        } else {
            frame.value[ frame.key ] = value;
            frame.key = undefined;
        }
    } else {
        // possibly controversial - this allows single values to be output 
        context.output.push( value );
    }
    
    return context;
}


/**
 * 
 * @param {*} context 
 */
function pushNewObject(context){
    let frame = { value:{}, isObject:true };
    context.stack.push( frame );
    return context;
}

/**
 * 
 * @param {*} context 
 */
function pushNewArray(context){
    let frame = { value:[], isArray:true };
    context.stack.push(frame);
    return context;
}

/**
 * 
 * @param {*} context 
 */
function peekContextStack(context){
    if( !context.stack ){
        Log('[peekContextStack]', 'invalid context', context);
        throw new Error('invalid context');
    }
    return context.stack.length ? context.stack[context.stack.length-1] : {state:STATE_READ};
}

/**
 * 
 * @param {*} context 
 */
function popContextState( context ){
    let frame = peekContextStack(context);
    const length = context.stack.length;
    
    context.stack.pop();

    if( length <= 1){
        Log('popContextState', 'output', JSON.stringify(frame.value) ); 
        context.output.push( frame.value );
    } else {
        pushValue(context,frame.value);
    }

    return context;
}

/**
 * 
 */
function createContext(){
    return {
        stack: [],
        output: [],
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



function ParserError(message){
    if( message instanceof Error ){
        this.message = message.message;
        this.stack = message.stack || message.stackTrace || '';
    } else {
        this.message = message || 'Request Error';
        this.stack = (new Error()).stack;
    }
    this.name = 'ParserError';
}
ParserError.prototype = Object.create(Error.prototype);
ParserError.prototype.constructor = ParserError;