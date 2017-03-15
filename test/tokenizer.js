const PullFile = require('pull-file');
const Pull = require('pull-stream');
const Path = require('path');
const inputFile = Path.resolve(__dirname, './fixtures/features.odgnjson');
const test = require('tape');
const PullLog = require('pull-stream/sinks/log');
const PullMap = require('pull-stream/throughs/map');

const Tokenizer = require('../lib/tokenizer');

test('leftTrimMax', t => {
    t.equal(trimLeftMax('hello'), 'hello');
    t.equal(trimLeftMax('   hello'), 'hello');
    t.equal(trimLeftMax('   hello', 1), '  hello');
    t.equal(trimLeftMax('   hello', 3), 'hello');
    t.equal(
        trimLeftMax('                    I will fill your empty half.', 18),
        '  I will fill your empty half.'
    );
    t.end();
});

function trimLeftMax(str, offset = str.length) {
    let ws = /\s/, ii = 0;
    while (ii <= offset && ws.test(str.charAt((ii++)))) {
        // console.log('trimLeftMax', ii-1, offset, str.charAt(ii-1)+'F' );
    }
    // console.log('== trimLeftMax', 'finish', ii, offset, str.substring(ii-1) );
    return str.substring(ii - 1);
}

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
            // unquoted strings contain everything up to the next line!
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
            '{ so why hang around : " for the deed to be done "',
            [
                ['{', 0, 0],
                ['so why hang around', 2, 0],
                [':', 21, 0],
                [' for the deed to be done ', 23, 0]
            ],
            'spaces within value',
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
                ['first', 4, 1],
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
            '{favNumbers : [1,2,[ true, false ], {weather:raining heavily}], active:true }',
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
                ['raining heavily', 45, 0],
                ['}', 60, 0],
                [']', 61, 0],
                ['active', 64, 0],
                [':', 70, 0],
                [true, 71, 0],
                ['}', 76, 0]
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
            ['{\n /', '/ lets not go home', '\n  divided: by\n }'],
            [
                ['{', 0, 0],
                ['divided', 25, 2],
                [':', 32, 2],
                ['by', 34, 3],
                ['}', 38, 3]
            ],
            'single line comment',
            { debug: false }
        ],
        [
            ['{\n  unicorn: /', '*\n ❤\n *', '/ cake\n }'],
            [
                ['{', 0, 0],
                ['unicorn', 4, 1],
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
                ['firstName', 6, 1],
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
            ['{\n /', "/ we'll catch a plane to New York", '\n  run: away\n }'],
            [
                ['{', 0, 0],
                ['run', 40, 2],
                [':', 43, 2],
                ['away', 45, 3],
                ['}', 51, 3]
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
                ['these violent delights\nhave\nviolent ends', 12, 3],
                ['ok', 61, 4],
                [':', 63, 4],
                ['true', 64, 4],
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
        ],
        [
            [
                `// the following line contains trailing whitespace:
foo: 0 -- this string starts`,
                `at 0 and ends at 1, preceding and trailing whitespace is ignored -- 1 `
            ],
            [
                ['foo', 52, 1],
                [':', 55, 1],
                ['0 -- this string startsat 0 and ends at 1', 57, 1]
            ],
            'escaped values',
            { debug: false }
        ],
        [
            `{
                # TL;DR
                human:   Hjson
                machine: JSON
            }`,
            [
                ['{', 0, 0],
                ['human', 42, 2],
                [':', 47, 2],
                ['Hjson', 51, 3],
                ['machine', 73, 3],
                [':', 80, 3],
                ['JSON', 82, 4],
                ['}', 99, 4]
            ],
            'tldr',
            { debug: false }
        ],
        [
            // ''' defines the head, on the following lines all whitespace up to this column is ignored
            `haiku:
                '''
                My half empty glass,
                  I will fill your empty half.
                Now you are half full.
                '''`,
            [
                ['haiku', 0, 0],
                [':', 5, 0],
                [
                    'My half empty glass,\n  I will fill your empty half.\nNow you are half full.',
                    23,
                    5
                ]
            ],
            'haiku',
            { debug: false }
        ],
        [
            // NOTE: this behaviour diverges from Hjson
            // it tokenises, but will clearly fail on parsing
            'this: is OK though: {}[],:',
            [
                ['this', 0, 0],
                [':', 4, 0],
                ['is OK though', 6, 0],
                [':', 18, 0],
                ['{', 20, 0],
                ['}', 21, 0],
                ['[', 22, 0],
                [']', 23, 0],
                [':', 25, 0]
            ],
            'puncuators in a string',
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
