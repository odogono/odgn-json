'use strict'

const Through = require('pull-through');

const STATE_READ = 'RD';// 0;
const STATE_READ_KEY = 'RDKEY';// 2;
const STATE_READ_VALUE = 'RDVAL'; //3;


let debugLog = false;


module.exports = function(options = {}, onEnd) {
    let context = createContext();
    debugLog = !!options.debug;

    return Through(
        function(data) {
            context = processReadValue(context, data);

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
// function Parser(options={}, onEnd) {
//     let terminateCalled = false
//     // let count = 0;

//     let context = createContext();
//     debugLog = !!options.debug;

//     function terminate(abort) {
//         if(terminateCalled || !onEnd) { return }
//         terminateCalled = true
//         onEnd(abort === true ? null : abort)
//     }

//     return function(readCb) {

//         return function next(end, writeCb) {
//             if(end) { terminate(end); }
//             let sync, loop = true;

//             while(loop){
//                 loop = false;
//                 sync = true;
                
//                 // read from the input stream
//                 readCb(end, function (end, data) {
//                     if(!end) {
//                         Log('readCb', data);

//                         if( Array.isArray(data) ){
//                             while(data.length){
//                                 context = processReadValue(context, data.shift());
//                             }
//                         } else {
//                             context = processReadValue(context, data);
//                         }
                        
//                         // console.log('[parser]', data );
                        
//                         // if there is nothing yet to output, then read again
//                         if( context.output.length <= 0 ){
//                             return sync ? loop = true : next(end,writeCb);
//                         }
//                     }
//                     else {
//                         terminate(end);
//                     }

//                     // write to the output stream
//                     // if end, the buffer will be ignored anyway
//                     // const out = context.output.shift();
//                     // console.log('writeCb', out );
//                     // writeCb(end, out );
//                     writeCb(end, context.output);
//                     context.output = [];
//                 })
//                 sync = false;
//             }
//         }
//     }
// };



/**
 * 
 * @param {*} context 
 * @param {*} input 
 */
function processReadValue(context, input){
    let frame = peekContextStack(context);

    const [token, position, lineNo] = input;

    Log('processReadValue', token);

    switch(token){
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
            // Log('processReadValue', 'nycuk', frame, context);
            if( frame.isObject ){
                return context;
            }
            // if( !frame.isArray && frame.buffer.length ){
            //     frame.key = frame.buffer.pop();
            //     frame.isObject = true;
            //     frame.value = {};
            //     Log('processReadValue', 'repurposed', frame );
            //     return context;
            // }
            // Log('processReadValue', 'not object?');
        default:
            return pushValue(context,token);
    }

    let message = 'Unexpected token ' + token + ' in JSON';
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
    // Log('pushValue', value);
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
        // frame.buffer = frame.buffer || [];
        // frame.buffer.push(value);
        Log('pushValue', value, context);
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

    if( !context.stack.length ){
        let frame = {state:STATE_READ};
        context.stack.push(frame);
        return frame;
    }

    return context.stack[context.stack.length-1];
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
        Log('popContextState', 'pushValue', frame.value);
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