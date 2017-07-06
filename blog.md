
pull-streams - a streams implementation without the baggage and overhead of nodes streams.

streams in js/node have always been kind of a mess; ocassionally i will dip in, only to
later hop back out due to things like browser/nodejs incompatibility, errors, backpressure.



the module is split into two parts, the tokenizer and the parser. 

the tokenizer breaks the incoming strings down into a series of tokens. 

the parser assembles tokens into JSON fragments and emits them.



both the tokenizer and the parser utilise /through/ pull-streams. this means that they sit
inbetween a source and a sink, transforming the data passing through.

both pull-streams also buffer data. tokens are only emitted when they are complete - for
example a multi-line string may arrive in several chunks. the tokenizer holds these chunks
and emits one or many of them when a complete token is formed.


originally, both tokenizer and parser were implemented using a through stream pattern which
enabled tokens to be held.
after some thought, i replaced the stream code with the through module 

interesting, pull-through uses this.queue(null) to end the stream and one of the tokens we
can emit is null! so this is a good reason to emit tuples of [token,position,lineNumber]