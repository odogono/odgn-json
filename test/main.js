const PullFile = require('pull-file');
const Pull = require('pull-stream');
const Path = require('path');
const inputFile = Path.resolve(__dirname, './fixtures/features.odgnjson');
const test = require('tape');
const PullLog = require('pull-stream/sinks/log');

const PullCollect = require('pull-stream/sinks/collect');
const PullOnce = require('pull-stream/sources/once');

const odgnJSON = require('../lib');

let debugLog = false;

// test('simple key pair', t => {
//     const inputFile = Path.resolve(__dirname, './fixtures/features.ojson');

//     Pull(
//         // a source which convert the input array into a stream of values
//         // Pull.values(input),
//         PullFile(inputFile, { bufferSize: 40 }),
//         odgnJSON(),
//         Pull.collect((err, array) => {
//             // console.log('[collect]', err, array);
//             t.end();
//         })
//     );
//     // applyParser( t, input, expected, () => t.end() );
// });

test('tldr', async t => {
    const src = `
    {
        # TL;DR
        human:   Hjson
        machine: JSON
    }`;

    const result = await parse(src);

    t.deepEqual(result, { human: 'Hjson', machine: 'JSON' });

    t.end();
});

test('comments', async t => {
    const src = `
    {
    # hash style comments
    # (because it's just one character)

    // line style comments
    // (because it's like C/JavaScript/...)

    /* block style comments because
        it allows you to comment out a block */

    # Everything you do in comments,
    # stays in comments ;-}
    }`;

    const result = await parse(src);

    t.deepEqual(result, {});

    t.end();
});

test('strings without quotes', async t => {
    const src = `
    {
    JSON: "a string"

    Hjson: a string

    # notice, no escape necessary:
    RegEx: \s+
    }`;

    const result = await parse(src);

    t.deepEqual(result, { Hjson: 'a string', JSON: 'a string', RegEx: '\\s+' });

    t.end();
});

test('multiline', async t => {
    const src = `
{
md:
    '''
    First line.
    Second line.
      This line is indented by two spaces.
    '''
}`;

    const result = await parse(src);

    t.deepEqual(result, {
        md: 'First line.\nSecond line.\n  This line is indented by two spaces.'
    });

    t.end();
});

test('Punctuators, Spaces and Escapes', async t => {
    const src = `
    {
        "key name": "{ sample }"
        "{}": " spaces at the start/end "
        this: is OK though: {}[],:
    }`;

    const result = await parse(src);

    t.deepEqual(result, {
        'key name': '{ sample }',
        '{}': ' spaces at the start/end ',
        this: 'is OK though: {}[],:'
    });

    t.end();
});

test('multi line', async t => {
    const src = `
        { "@uri":"/component/piece/rook" }
        { "@uri":"/component/colour", "colour":"white" }
        { "@uri":"/component/position", "file":"a", "rank":1 }
        exhaltant
        64
        true
    `;

    const result = await parse(src);

    t.deepEqual(result, [
        { '@uri': '/component/piece/rook' },
        { '@uri': '/component/colour', colour: 'white' },
        { '@uri': '/component/position', file: 'a', rank: 1 },
        'exhaltant',
        64,
        true
    ]);

    t.end();
});

function parse(str) {
    return new Promise((resolve, reject) => {
        Pull(
            // stringSource(str),
            PullOnce(str),
            odgnJSON({ debug: false }),
            // PullCollect( result => resolve(result) )
            stringSink(result => resolve(result))
        );
    });
}

//a stream of random numbers.
function stringSource(str) {
    return function(end, cb) {
        if (end) return cb(end);
        cb(end, str);
    };
}

function stringSink(completeCb) {
    // return new Promise( (resolve,reject) => {
    let result = [];
    return function(read) {
        read(null, function next(end, data) {
            // console.log('[stringSink]', end, data);
            if (end === true) {
                result = [].concat.apply([], result);
                return completeCb(result.length === 1 ? result[0] : result);
            }
            if (end) throw end;
            result.push(data);

            read(null, next);
        });
    };
    // });
}
