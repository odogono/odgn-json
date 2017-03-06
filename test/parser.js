const PullFile = require('pull-file');
const Pull = require('pull-stream');
const Path = require('path');
const inputFile = Path.resolve(__dirname, './fixtures/features.odgnjson');
const test = require('tape');
const PullLog = require('pull-stream/sinks/log')



const Parser = require('../lib/parser');


test.only('parser', t => {

    const tests = [
        [ [ '{', 'msg', ':', 'hello', '}' ], 
            { msg:'hello'} , 'key value', {debug:true}],
        
        // [ [ '{', 'msg', ':', 'hello', 'date', ':', 'today', '}'], 
        //     {msg:'hello', date:'today'}, 'multiple pair object', {debug:false}],
        
        // [ [ '[', true, false, null, 25, 0.25, ']' ], 
        //     [ true, false, null, 25, 0.25, ],  'an array of values', {debug:false}],

        // [ [ '{', 'msg', ':', 'hello', '}', '{', 'active', ':', true, '}' ], 
        //     [ {msg:'hello'}, {active:true} ], 'multiple objects', {debug:false}],
        
        // [
        //     [ '[', 0, 0.1, 1, 20, 0.002, 200000000000000000000, 0.02, 200, 10, 12345, 67890, 123455.123445, ']' ], 
        //     [ 0, 0.1, 1, 20, 0.002, 200000000000000000000, 0.02, 200, 10, 12345, 67890, 123455.123445 ],

        //     'good numbers',  {debug:false} 
        // ],

    ];

    t.plan(tests.length);

    tests.forEach( testCase => applyParser(t, ...testCase) )

    t.end();

});



function applyParser( t, input, expected, msg, options={}, cb ){
    input = Array.isArray(input) ? input : [input];
    
    Pull( 
        Pull.values(input),
        // logger,
        Parser(options),
        
        Pull.collect( (err, array) => {
            console.log('[Pull.collect]', [].concat.apply([], array) );
            if( !Array.isArray(expected) ){
                array = array.length ? array[0] : array;
            }
            array = [].concat.apply([], array);

            t.deepEqual( array, expected, msg );
            
            if( cb ){ cb(); }
        })
    );
}