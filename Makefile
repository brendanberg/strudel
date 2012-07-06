pattern = /\/\/ BEGIN\(BROWSER\)/,/\/\/ END\(BROWSER\)/
begin = /\/\/ BEGIN(BROWSER)/d
end = /\/\/ END(BROWSER)/d

build: src/base.js src/ast.js src/parser.js
	@echo 'Concatenating scripts...'
	@awk '$(pattern)' src/base.js > /tmp/strudel.js
	@awk '$(pattern)' src/ast.js >> /tmp/strudel.js
	@awk '$(pattern)' src/parser.js >> /tmp/strudel.js
	@sed '$(begin)' /tmp/strudel.js | sed '$(end)' > strudel.js
	@echo 'Minifying script...'
	@uglifyjs strudel.js > strudel.min.js
	@echo 'Build succeeded'

src/parser.js: src/grammar/strudel.pegjs
	@echo 'Generating parser...'
	@pegjs -e 'Strudel.Parser' src/grammar/strudel.pegjs src/parser.js
	@echo "var Strudel = require('./base');\n\n// BEGIN(BROWSER)" > /tmp/parser.js
	@unexpand -t 2 src/parser.js >> /tmp/parser.js
	@echo '\n// END(BROWSER)' >> /tmp/parser.js
	@mv /tmp/parser.js src/parser.js
	@echo 'Parser generation succeeded'

parser: src/parser.js
	@:

test: src/base.js src/ast.js src/parser.js
	@mocha -u bdd -R list test/tests.js

clean:
	@rm -f strudel.js strudel.min.js src/parser.js

.PHONY: parser test clean