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
                    writeCb(end, context.output);
                    context.output = [];
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

    // Log('[parse]', context);
    while( it < 100 ){
        context = process(context, input);
        it++;
    }

    if( it >= 100 ){
        throw new Error('process did not complete');
    }

    Log('tokenize', 'final state', context.state);

    return context;
}


function process(context, pushState=0){
    
    Log('[process]', context.input);

    return context;
}



function createContext( input ){
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
