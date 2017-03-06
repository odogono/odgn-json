const PullFile = require('pull-file');
const Pull = require('pull-stream');
const Path = require('path');
const inputFile = Path.resolve(__dirname, './fixtures/features.odgnjson');
const test = require('tape');
const PullLog = require('pull-stream/sinks/log')



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
        ['{ msg : hello }', [ '{', 'msg', ':', 'hello', '}' ], 'unquoted object pair', {debug:false}],
        [ ['{"msg" : "hello',' world"}'], [ '{', 'msg', ':', 'hello world', '}' ], 'quoted object pair', {debug:false}],

        ['{msg : hello, date: today }', ['{', 'msg', ':', 'hello', 'date', ':', 'today', '}'], 'multiple pair object', {debug:false}],
        [ ["{\n  first: 1\n  second: 2\n}"], [ '{', 'first', ':', 1, 'second', ':', 2, '}' ] , 'comma-less multiline object', {debug:false} ],

        [
            '{favNumbers : [1,2,[ true, false ], {weather:raining}], active:true }', 
            [ '{', 'favNumbers', ':', '[', 1, 2, '[', true, false, ']', '{', 'weather', ':', 'raining', '}', ']', 'active', ':', true, '}' ],
            'array value', 
            {debug:false}
        ],

        ['{ value : true }', [ '{', 'value', ':', true, '}' ], 'true value', {debug:false}],

        ['[ true, false, null, 25, 0.25 ]', [ '[', true, false, null, 25, 0.25, ']' ], 'an array of values', {debug:false}],

        ['{msg : hello} {active: true}', [ '{', 'msg', ':', 'hello', '}', '{', 'active', ':', true, '}' ], 'multiple objects', {debug:false}],

        ['{ "foo": "bar", }', [ '{', 'foo', ':', 'bar', '}' ], 'object trailing comma', {debug:false}],

        ['[ 1, 2, 3, ]', [ '[', 1, 2, 3, ']' ], 'array trailing comma', {debug:false}],

        [
            '[ 0, 0.1, 0.1e1, 0.2e+2, 0.2e-2, 2E20, 2E-2, 2E+2, 10, 12345, 67890, 123455.123445]', 
            [ '[', 0, 0.1, 1, 20, 0.002, 200000000000000000000, 0.02, 200, 10, 12345, 67890, 123455.123445, ']' ], 
            'good numbers',  {debug:false} 
        ],

        [ ["{\n /","/ this is the comment","\n  lie: cake\n }"], [ '{', 'lie', ':', 'cake', '}' ], 'single line comment', {debug:false}],

        [ ['{\n    "firstName": "John"}'], [ '{', 'firstName', ':', 'John', '}' ], 'tab/space object', {debug:false}],

        [ ["{\n  unicorn: /","*\n ❤\n *", "/ cake\n }"], [ '{', 'unicorn', ':', 'cake', '}' ], 'multiline comment', {debug:false}],
    ];

    t.plan(tests.length);

    tests.forEach( testCase => applyTokenizer(t, ...testCase) )

    t.end();
});

function applyTokenizer( t, input, expected, msg, options={}, cb ){
    input = Array.isArray(input) ? input : [input];
    Pull( 
        Pull.values(input),
        // logger,
        Tokenizer(options),
        
        Pull.collect( (err, array) => {
            // console.log('[Pull.collect]', [].concat.apply([], array) );
            if( !Array.isArray(expected) ){
                array = array.length ? array[0] : array;
            }
            array = [].concat.apply([], array);

            t.deepEqual( array, expected, msg );
            
            if( cb ){ cb(); }
        })
    );
}



function logger (read) {
  //return a readable function!
  return function (end, cb) {
    read(end, function (end, data) {
        Log('logger', end, data);
        cb(end, data);
    })
  }
}
