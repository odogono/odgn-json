const PullFile = require('pull-file');
const Pull = require('pull-stream');
const Path = require('path');
const inputFile = Path.resolve(__dirname, './fixtures/features.odgnjson');
const test = require('tape');
const PullLog = require('pull-stream/sinks/log');

const Parser = require('../lib/parser');

test.only('parser', t => {
    const tests = [
        // [ [ '{', 'msg', 'hello', '}' ],
        //     { msg:'hello'} , 'key value', {debug:false}],

        // [ [ 'welcome', ':', 'home' ],
        //     ['welcome', ':', 'home'] , 'single values', {debug:false, log:false}],

        // [ [ '{', 'msg', ':', 'hello', 'date', ':', 'today', '}'],
        //     {msg:'hello', date:'today'}, 'multiple pair object', {debug:false}],

        // [ [ '[', true, false, null, 25, 0.25, ']' ],
        //     [ true, false, null, 25, 0.25, ],  'an array of values', {debug:false}],

        // [ [ '{', 'msg', ':', 'hello', '}', '{', 'active', ':', true, '}' ],
        //     [ {msg:'hello'}, {active:true} ], 'multiple objects', {debug:false}],

        // [ [ '{', 'msg', 'hello', 'record', ':', '{', 'active', ':', false, '}', '}' ],
        //     { msg: 'hello', record: { active: false } },
        //     'nested object', {debug:false}],

        // [ [ '[', 'alpha', '[', 'beta', '[', 'gamma', ']', ']', ']' ],
        //     [ 'alpha', [ 'beta', [ 'gamma' ] ] ],
        //     'nested array', {debug:false}],

        // [ [ '{', 'msg', 'hello', '}', '[', 'alpha', ']' ],
        //     [ { msg: 'hello' }, [ 'alpha' ] ] ,
        //     'object then array', {debug:false}],

        // [ [ '}', '[', 'sing', ']' ],
        //     [ new Error('Unexpected token } in JSON'), [ 'sing' ] ],
        //     'invalid token', {debug:false, log:false} ],

        // // NOTE: line number not yet working
        // // [ [ ['}',4] ],
        // //     [ new Error('Unexpected token } in JSON at position 4'), [ 'sing' ] ],
        // //     'unexpected token with position', {debug:false, log:false} ],

        // [ [ ['{', 'msg'], ['hello', '}'] ],
        //     { msg:'hello'} , 'multiple calls',  {debug:false, log:false} ],

        // [ [ ['{', 'firstName', ':', 'John'],
        //     ['lastName', ':', 'Smith', 'isAlive', ':', true],
        //     ['age', ':', 25, 'address', ':', '{'],
        //     ['streetAddress', ':', '21 2nd Street'],
        //     ['city', ':', 'New York', 'state', ':', 'NY'],
        //     ['postalCode', ':', '10021-3100', '}', '}'] ],
        //     { address: { city: 'New York', postalCode: '10021-3100', state: 'NY', streetAddress: '21 2nd Street' }, age: 25, firstName: 'John', isAlive: true, lastName: 'Smith' },
        //     'multiple input', {debug:false, log:false} ],

        // [
        //     [
        //         ['{', 0, 0],
        //         ['human', 42, 2],
        //         [':', 47, 2],
        //         ['Hjson', 51, 3],
        //         ['machine', 73, 3],
        //         [':', 80, 3],
        //         ['JSON', 82, 4],
        //         ['}', 99, 4]
        //     ],
        //     { human: 'Hjson', machine: 'JSON' },
        //     'tldr',
        //     { debug: false, log: false }
        // ],

        [
            [
                ['this', 0, 0],
                [':', 4, 0],
                ['is OK though', 6, 0],
                // [':', 18, 0],
                // ['{', 20, 0],
                // ['}', 21, 0],
                // ['[', 22, 0],
                // [']', 23, 0],
                // [':', 25, 0]
            ],
            [], // nothing comes out - because there is no terminator for the object
            'invalid',
            { debug:true }
        ]
    ];

    t.plan(tests.length);

    tests.forEach(testCase => applyParser(t, ...testCase));

    t.end();
});

function applyParser(t, input, expected, msg, options = {}, cb) {
    const debug = !!options.debug;
    input = Array.isArray(input) ? input : [input];

    Pull(
        // a source which convert the input array into a stream of values
        Pull.values(input),
        // the parser converts incoming tokens into objects or arrays
        Parser(options),
        // converts any Error instances into objects (for test purposes)
        errorToObject,
        // ((options.debug||options.log) && logger),

        // Pull.drain( (options.debug && console.log) )

        // a sink which drains the stream into an array
        Pull.collect((err, array) => {
            if (err) {
                console.log('[Pull.collect] error', err);
            }

            // flatten the incoming array
            if (Array.isArray(array)) {
                array = [].concat.apply([], array);
            }

            // flatten the outcome if there is only 1 value
            if (array.length === 1) {
                array = array[0];
            }

            // if( array instanceof Error ){
            //     if( options.debug ){
            //         console.log('[Pull.collect] error', array.message );
            //     }
            // }
            // if( options.debug ){
            //     console.log('[Pull.collect]', array );
            // }

            t.deepEqual(array, expected, msg);

            if (cb) {
                cb();
            }
        })
    );
}

/**
 * A through pull-stream which outputs data to console.log
 * @param {*} read 
 */
function logger(read) {
    //return a readable function!
    return function(end, cb) {
        read(end, function(end, data) {
            console.log('[logger]', !!end, data);
            cb(end, data);
        });
    };
}

/**
 * A through pull-stream which converts Error instances
 * into simple objects
 * 
 * @param {*} read 
 */
function errorToObject(read) {
    return function(end, cb) {
        read(end, function(end, data) {
            if (data != null && isError(data)) {
                data = { message: data.message, name: data.name };
            }
            cb(end, data);
        });
    };
}

/**
 * Returns true if the specified value is an Error
 * or an Error-a-like
 * 
 * @param {*} obj 
 */
function isError(obj) {
    return toString.call(obj) == '[object Error]' ||
        typeof obj.message == 'string' && typeof obj.name == 'string';
}
