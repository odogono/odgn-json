/**
 * Functionality
 * 
 * - parse input to stdout
 * - load file, parse, and write to stdout
 * 
 */


const Pull = require('pull-stream');
const Utf8 = require('pull-utf8-decoder');
const ToPull = require('stream-to-pull-stream');
const OdgnJson = require('../lib');
const Stringify = require('pull-stringify');
const File = require('pull-file');

const parseArgs = require('minimist');



if( process.stdin.isTTY === true ){

    const argv = parseArgs(process.argv.slice(2));

    // console.log('args',argv);

    if( argv.file ){
        let filePath = argv.file;

        // load file to stdout
        Pull(
            File(filePath, { bufferSize: 40 }),
            Utf8(),
            OdgnJson({}),
            Stringify.lines(),
            ToPull.sink(process.stdout, function (err) {
                if(err) throw err;
            })
        );
    }

} else {
    // stream stdin through to stdout
    Pull(
        ToPull.source(process.stdin),
        Utf8(),
        OdgnJson({}),
        Stringify.ldjson(),
        ToPull.sink(process.stdout, function (err) {
            if(err) throw err;
        })
    );
}