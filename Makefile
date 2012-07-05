pattern = /\/\/ BEGIN\(BROWSER\)/,/\/\/ END\(BROWSER\)/
cleanup = /^\/\/ BEGIN\(BROWSER\)/d

build:
	@echo 'Concatenating scripts...'
	@awk '$(pattern)' src/base.js > /tmp/strudel.js
	@awk '$(pattern)' src/ast.js >> /tmp/strudel.js
	@awk '$(pattern)' src/parser.js >> /tmp/strudel.js
	@sed '/\/\/ BEGIN(BROWSER)/d' /tmp/strudel.js | sed '/\/\/ END(BROWSER)/d' > strudel.js
	@echo 'Minifying script...'
	@uglifyjs strudel.js > strudel.min.js
	@echo 'Build succeeded'

parser:
	@echo 'Generating parser...'
	@pegjs -e 'Strudel.Parser' src/grammar/strudel.pegjs src/parser.js
	@echo "var Strudel = require('./base');\n\n// BEGIN(BROWSER)" > /tmp/parser.js
	@unexpand -t 2 src/parser.js >> /tmp/parser.js
	@echo '\n// END(BROWSER)' >> /tmp/parser.js
	@mv /tmp/parser.js src/parser.js
	@echo 'Successfully generated parser'

test:
	@mocha -u bdd -R list test/tests.js

clean:
	@rm -f strudel.js strudel.min.js src/parser.js

.PHONY: parser test clean