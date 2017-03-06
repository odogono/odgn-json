const PullFile = require('pull-file');
const Pull = require('pull-stream');
const Path = require('path');
const inputFile = Path.resolve(__dirname, './fixtures/features.odgnjson');
const test = require('tape');
const PullLog = require('pull-stream/sinks/log')



const Parser = require('../lib/parser');


test.only('parser', t => {

    const tests = [
        [ [ '{', 'msg', 'hello', '}' ], 
            { msg:'hello'} , 'key value', {debug:false}],
        
        [ [ '{', 'msg', ':', 'hello', 'date', ':', 'today', '}'], 
            {msg:'hello', date:'today'}, 'multiple pair object', {debug:false}],
        
        [ [ '[', true, false, null, 25, 0.25, ']' ], 
            [ true, false, null, 25, 0.25, ],  'an array of values', {debug:false}],

        [ [ '{', 'msg', ':', 'hello', '}', '{', 'active', ':', true, '}' ], 
            [ {msg:'hello'}, {active:true} ], 'multiple objects', {debug:false}],

        [ [ '{', 'msg', 'hello', 'record', ':', '{', 'active', ':', false, '}', '}' ], 
            { msg: 'hello', record: { active: false } }, 
            'nested object', {debug:false}],
        
        [ [ '[', 'alpha', '[', 'beta', '[', 'gamma', ']', ']', ']' ], 
            [ 'alpha', [ 'beta', [ 'gamma' ] ] ], 
            'nested array', {debug:false}],

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
            if( !Array.isArray(expected) ){
                array = array.length ? array[0] : array;
            }
            
            if( Array.isArray(array) ){
                array = [].concat.apply([], array);
            }
            
            // console.log('[Pull.collect]', array );
            
            t.deepEqual( array, expected, msg );
            
            if( cb ){ cb(); }
        })
    );
}



function logger (read) {
  //return a readable function!
  return function (end, cb) {
    read(end, function (end, data) {
        console.log('[logger]', !!end, data);
        cb(end, data);
    })
  }
}