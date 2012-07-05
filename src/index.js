var Strudel = require('./base.js');
module.exports = Strudel;

require('./ast.js');
require('./parser.js'); // generated via pegjs -e "var Strudel = require('./base'); Strudel.Parser" src/grammar/strudel.pegjs src/parser.js