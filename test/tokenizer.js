const PullFile = require('pull-file');
const Pull = require('pull-stream');
const Path = require('path');
const inputFile = Path.resolve(__dirname, './fixtures/features.odgnjson');
const test = require('tape');
const PullLog = require('pull-stream/sinks/log');
const PullMap = require('pull-stream/throughs/map');

const Tokenizer = require('../lib/tokenizer');

// test('readAhead', t => {
//     const tests = [
//         [ 'this is a key : this is the value', ":", "this is a key " ],
//         [ '"this: is a key" : this is the value', ":", '"this: is a key" ', {debug:false} ],
//         [ "this is the value\nthis is the key", "\n", "this is the value", {debug:true} ],
//     ];

//     tests.forEach( tcase => {
//         const [input,terminators,expected,options] = tcase;
//         debugLog = options && !!options.debug;
//         let context = {input,pos:0,len:input.length,buffer:''};

//         const finishOn = readAhead(context,terminators);

//         Log('test', input, 'context:', context, 'finishOn', finishOn);

//         t.equals(context.buffer, expected);
//     } )

//     t.end();
// });

test.only('tokenizer', t => {
    const tests = [
        [
            '{ msg : hello }',
            [
                ['{', 0, 0],
                ['msg', 2, 0],
                [':', 6, 0],
                ['hello', 8, 0],
                ['}', 14, 0]
            ],
            'unquoted object pair',
            { debug: false }
        ],
        [
            ['{"msg" : "hello', ' world"}'],
            [
                ['{', 0, 0],
                ['msg', 1, 0],
                [':', 7, 0],
                ['hello world', 9, 0],
                ['}', 22, 0]
            ],
            'quoted object pair',
            { debug: false }
        ],
        [
            '{msg : hello, date: today }',
            [
                ['{', 0, 0],
                ['msg', 1, 0],
                [':', 5, 0],
                ['hello', 7, 0],
                ['date', 14, 0],
                [':', 18, 0],
                ['today', 20, 0],
                ['}', 26, 0]
            ],
            'multiple pair object',
            { debug: false }
        ],
        [
            ['{\n  first: 1\n  second: 2\n}'],
            [
                ['{', 0, 0],
                ['first', 1, 1],
                [':', 9, 1],
                [1, 11, 2],
                ['second', 15, 2],
                [':', 21, 2],
                [2, 23, 3],
                ['}', 25, 3]
            ],
            'comma-less multiline object',
            { debug: false }
        ],
        [
            '{favNumbers : [1,2,[ true, false ], {weather:raining}], active:true }',
            [
                ['{', 0, 0],
                ['favNumbers', 1, 0],
                [':', 12, 0],
                ['[', 14, 0],
                [1, 15, 0],
                [2, 17, 0],
                ['[', 19, 0],
                [true, 21, 0],
                [false, 27, 0],
                [']', 33, 0],
                ['{', 36, 0],
                ['weather', 37, 0],
                [':', 44, 0],
                ['raining', 45, 0],
                ['}', 52, 0],
                [']', 53, 0],
                ['active', 56, 0],
                [':', 62, 0],
                [true, 63, 0],
                ['}', 68, 0]
            ],
            'array value',
            { debug: false }
        ],
        [
            '{ value : true }',
            [
                ['{', 0, 0],
                ['value', 2, 0],
                [':', 8, 0],
                [true, 10, 0],
                ['}', 15, 0]
            ],
            'true value',
            { debug: false }
        ],
        [
            '[ true, false, null, 25, 0.25 ]',
            [
                ['[', 0, 0],
                [true, 2, 0],
                [false, 8, 0],
                [null, 15, 0],
                [25, 21, 0],
                [0.25, 25, 0],
                [']', 30, 0]
            ],
            'an array of values',
            { debug: false }
        ],
        [
            '{msg : hello} {active: true}',
            [
                ['{', 0, 0],
                ['msg', 1, 0],
                [':', 5, 0],
                ['hello', 7, 0],
                ['}', 12, 0],
                ['{', 14, 0],
                ['active', 15, 0],
                [':', 21, 0],
                [true, 23, 0],
                ['}', 27, 0]
            ],
            'multiple objects',
            { debug: false }
        ],
        [
            '{ "foo": "bar", }',
            [
                ['{', 0, 0],
                ['foo', 2, 0],
                [':', 7, 0],
                ['bar', 9, 0],
                ['}', 16, 0]
            ],
            'object trailing comma',
            { debug: false }
        ],
        [
            '[ 1, 2, 3, ]',
            [['[', 0, 0], [1, 2, 0], [2, 5, 0], [3, 8, 0], [']', 11, 0]],
            'array trailing comma',
            { debug: false }
        ],
        [
            '[ , , , ]',
            [['[', 0, 0], [']', 8, 0]],
            'empty array',
            { debug: false }
        ],
        [
            '[ 0, 0.1, 0.1e1, 0.2e+2, 0.2e-2, 2E20, 2E-2, 2E+2, 10, 12345, 67890, 123455.123445]',
            [
                ['[', 0, 0],
                [0, 2, 0],
                [0.1, 5, 0],
                [1, 10, 0],
                [20, 17, 0],
                [0.002, 25, 0],
                [200000000000000000000, 33, 0],
                [0.02, 39, 0],
                [200, 45, 0],
                [10, 51, 0],
                [12345, 55, 0],
                [67890, 62, 0],
                [123455.123445, 69, 0],
                [']', 82, 0]
            ],
            'good numbers',
            { debug: false }
        ],
        [
            ['{\n /', '/ this is the comment', '\n  lie: cake\n }'],
            [
                ['{', 0, 0],
                ['lie', 24, 2],
                [':', 31, 2],
                ['cake', 33, 3],
                ['}', 39, 3]
            ],
            'single line comment',
            { debug: false }
        ],
        [
            ['{\n  unicorn: /', '*\n ❤\n *', '/ cake\n }'],
            [
                ['{', 0, 0],
                ['unicorn', 1, 1],
                [':', 11, 1],
                ['cake', 23, 4],
                ['}', 29, 4]
            ],
            'multiline comment',
            { debug: false }
        ],
        [
            '[\n "first", # "second"\n "third", "#fourth"]',
            [
                ['[', 0, 0],
                ['first', 3, 1],
                ['third', 24, 2],
                ['#fourth', 33, 2],
                [']', 42, 2]
            ],
            'hash comments',
            { debug: false }
        ],
        [
            ['{\n    "firstName": "John"}'],
            [
                ['{', 0, 0],
                ['firstName', 1, 1],
                [':', 17, 1],
                ['John', 19, 1],
                ['}', 25, 1]
            ],
            'tab/space object',
            { debug: false }
        ],
        [
            ['[   goodness   ', ' , me ]'],
            [['[', 0, 0], ['goodness', 4, 0], ['me', 18, 0], [']', 21, 0]],
            'included positions',
            { debug: false }
        ],
        [
            ['{\n /', '/ this is the comment', '\n  lie: cake\n }'],
            [
                ['{', 0, 0],
                ['lie', 24, 2],
                [':', 31, 2],
                ['cake', 33, 3],
                ['}', 39, 3]
            ],
            'single line comment',
            { debug: false }
        ],
        [
            [
                "{ message:  '",
                "''\nthese violent delights\nhave\nviolent ends'''\n ok:\"true\" err:null }"
                // "''\nthese violent delights\nhave\nviolent ends'''}"
            ],
            [
                ['{', 0, 0],
                ['message', 2, 0],
                [':', 9, 0],
                ['\nthese violent delights\nhave\nviolent ends', 17, 3],
                ['ok', 59, 4],
                [':', 63, 4],
                [true, 65, 4],
                ['err', 71, 4],
                [':', 74, 4],
                [null, 75, 4],
                ['}', 80, 4]
            ],
            'multiline values',
            { debug: false }
        ],
        [
            'msg  :  hello\n',
            [['msg', 0, 0], [':', 5, 0], ['hello', 8, 1]],
            'naked key value',
            { debug: false }
        ]
    ];

    t.plan(tests.length);

    tests.forEach(testCase => applyTokenizer(t, ...testCase));

    t.end();
});

function applyTokenizer(t, input, expected, msg, options = {}, cb) {
    input = Array.isArray(input) ? input : [input];
    Pull(
        Pull.values(input),
        options.debug &&
            PullMap(val => {
                console.log('[map]', val);
                return val;
            }),
        Tokenizer(options),
        // PullMap(val => { console.log('[map] b', val); return val; }),
        Pull.collect((err, array) => {
            // console.log('[Pull.collect]', [].concat.apply([], array) );
            // if( !Array.isArray(expected) ){
            //     array = array.length ? array[0] : array;
            // }

            // array = [].concat.apply([], array);

            t.deepEqual(array, expected, msg);

            if (cb) {
                cb();
            }
        })
    );
}

function logger(read) {
    //return a readable function!
    return function(end, cb) {
        read(end, function(end, data) {
            Log('logger', end, data);
            cb(end, data);
        });
    };
}
