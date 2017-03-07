// const Pull = require('pull-stream/pull');
const Tokenizer = require('./tokenizer');
const Parser = require('./parser');



module.exports = function(options){
    const p = Parser(options);
    const t = Tokenizer(options);
    
    // return Pull(t,p);
    return function(read){
        return p( t( read ) );
    };
} 