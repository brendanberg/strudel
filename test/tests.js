var Strudel = require('../src');
var assert = require('assert');

function buildAssertion(assertion, test) {
	assertion(Strudel.compile(test['source'])(test['context']), test['output']);
}

describe('Strudel', function() {

// ------------------------------------------------------------------
// LITERALS
// Tests for basic literals, including escaped @'s (@@)
// ------------------------------------------------------------------

	describe('Literal evaluation', function() {
		it('should render literal text as-is', function () {
			buildAssertion(assert.equal, {
				source: '<a href="http://foo.example.org/">Hello</a>',
				context: {},
				output: '<a href="http://foo.example.org/">Hello</a>'
			});
		});
		
		it('should render escaped strudels properly', function () {
			buildAssertion(assert.equal, {source: '@@', context: {}, output: '@'});
		});
	});

// ------------------------------------------------------------------
// EXPRESSION LOOKUP
// Tests for ...
// ------------------------------------------------------------------

	describe('Expression lookup', function() {
		it('should resolve well-formed dot notation', function () {
			buildAssertion(assert.equal, {
				source: '@(author.name) is @(author.age.years) years old.',
				context: {author: {name: 'Brendan', age: {years: 28}}},
				output: 'Brendan is 28 years old.'
			});
		});
		
		it('should resolve well-formed index notation', function () {
			buildAssertion(assert.equal, {
				source: '@(people[1].friends[0].name)',
				context: {people: [{}, {friends: [{name: 'Elena'}]}]},
				output: 'Elena'
			});
		});
		
		it('should escape bad characters in rendered output', function () {
			buildAssertion(assert.equal, {
				source: '<p>@(evil)</p>',
				context: {evil: '<script type="text/javascript">alert(\'hi\');</script>'},
				output: '<p>&lt;script type=&quot;text/javascript&quot;&gt;alert(&#39;hi&#39;);&lt;/script&gt;</p>'
			});
		});
		
		it('should render raw strings when using double parens', function () {
			buildAssertion(assert.equal, {
				source: '<p>@((good))</p>',
				context: {good: '<b>Brendan</b>'},
				output: '<p><b>Brendan</b></p>'
			});
		});
		// Test for double escaping
		it('should render empty or falsy values as the empty string', function () {
			buildAssertion(assert.equal, {
				source: '<p>@(age)</p>',
				context: {},
				output: '<p></p>'
			});
			buildAssertion(assert.equal, {
				source: '<p>@(spiders)</p>',
				context: {spiders: false},
				output: '<p></p>'
			});
			buildAssertion(assert.equal, {
				source: '<p>@(pizza)</p>',
				context: {pizza: null},
				output: '<p></p>'
			});
			buildAssertion(assert.equal, {
				source: '<p>@(list)</p>',
				context: {list: []},
				output: '<p></p>'
			});
			buildAssertion(assert.equal, {
				source: '@(object)',
				context: {object: {}},
				output: ''
			});
			buildAssertion(assert.equal, {
				source: '@(empty)',
				context: {empty: ''},
				output: ''
			});
			buildAssertion(assert.equal, {
				source: '@(zero)',
				context: {zero: 0},
				output: ''
			});
			
			// Do something about this?
			buildAssertion(assert.equal, {
				source: '@(fun)',
				context: {fun: function(){}},
				output: 'function (){}'
			});
		});
		
		it('should coerce non-string types to strings', function () {
			buildAssertion(assert.equal, {
				source: '<p>@(age)</p>',
				context: {age: 28},
				output: '<p>28</p>'
			});
			buildAssertion(assert.equal, {
				source: '<p>@(list)</p>',
				context: {list: [1, 2, 3, 4]},
				output: '<p>1,2,3,4</p>'
			});
		});
	});

// ------------------------------------------------------------------
// EXPRESSION HELPERS
// Tests for expression helpers like @(helper path.to.value)
// ------------------------------------------------------------------

	describe('Expression helpers', function () {
		it('should find registered helpers', function () {
			Strudel.registerHelper('person', function(person, options) {
				var age = '';
				if (options.hash) {
					age = ', age ' + options.hash.age;
				}
				return person.firstName + ' ' + person.lastName + age;
			});
			
			buildAssertion(assert.equal, {
				source: '@(person foo age=24)',
				context: {foo: {firstName: 'Joe', lastName: 'Foo'}},
				output: 'Joe Foo, age 24'
			});
		});
	});

// ------------------------------------------------------------------
// WITH BLOCK
// Tests for @with(foo) ... @end
// ------------------------------------------------------------------

	describe('"With" block', function() {
		it('should execute the block body with the inner scope', function () {
			buildAssertion(assert.equal, {
				source: '@with(author)@(name) is @(age) years old.@end',
				context: {author: {name: 'Brendan', age: 28}},
				output: 'Brendan is 28 years old.'
			});
		});
		
		it('should execute the alternative body with the outer context if the expression is empty', function () {
			buildAssertion(assert.equal, {
				source: '@with(author)@(name)@else@(anonymous)@end',
				context: {anonymous: 'Anonymous'},
				output: 'Anonymous'
			});
		});
		
		it('should return the empty string if the condition is falsy and there is no alternative', function () {
			buildAssertion(assert.equal, {
				source: '@with(author)@(name)@end',
				context: {},
				output: ''
			});
		});
		
		it('should render raw strings when using double parens', function () {
			buildAssertion(assert.equal, {
				source: '@with(author)@((name))@end',
				context: {author: {name: '<b>Brendan</b>'}},
				output: '<b>Brendan</b>'
			});
		});
	});

// ------------------------------------------------------------------
// EACH BLOCK
// Tests for @each(foo) ... @end
// ------------------------------------------------------------------

	describe('"Each" block', function() {
		it('should execute the block body with each item in a list', function () {
			buildAssertion(assert.equal, {
				source: '@each(person)[@(name)]@end',
				context: {person: [{name: 'Brendan'}, {name: 'Matthew'}, {name: 'Joe'}]},
				output: '[Brendan][Matthew][Joe]'
			});
		});
	});

// ------------------------------------------------------------------
// IF BLOCK
// Tests for @if(foo) ... @end
// ------------------------------------------------------------------

	describe('"If" block', function() {
		it('should execute the consequent body if the condition is truthy', function () {
			buildAssertion(assert.equal, {
				source: '@if(author)@(author.name)@end',
				context: {author: {name: 'Brendan'}},
				output: 'Brendan'
			});
		});
		
		it('should execute the consequent and ignore the alternative if the condition is truthy', function () {
			buildAssertion(assert.equal, {
				source: '@if(author)@(author.name)@elseAnonymous@end',
				context: {author: {name: 'Brendan'}},
				output: 'Brendan'
			});
		});

		it('should return the empty string if the condition is falsy and there is no alternative', function () {
			buildAssertion(assert.equal, {
				source: '@if(author)@(author.name)@end',
				context: {},
				output: ''
			});
		});
		
		it('should execute the alternative body if the condition is falsy', function () {
			buildAssertion(assert.equal, {
				source: '@if(author)@(author.name)@elseAnonymous@end',
				context: {},
				output: 'Anonymous'
			});
			
			buildAssertion(assert.equal, {
				source: '@if(author)@(author.name)@else@(anonymous)@end',
				context: {anonymous: 'Anonymous'},
				output: 'Anonymous'
			});
		});

		it('should render empty or falsy values as the empty string', function () {
			buildAssertion(assert.equal, {
				source: '@if(spiders)AAUGH!@else@end',
				context: {},
				output: ''
			});
			buildAssertion(assert.equal, {
				source: '@if(spiders)AAUGH!@else@end',
				context: {spiders: null},
				output: ''
			});
			buildAssertion(assert.equal, {
				source: '@if(spiders)AAUGH!@else@end',
				context: {spiders: false},
				output: ''
			});
			buildAssertion(assert.equal, {
				source: '@if(spiders)AAUGH!@else@end',
				context: {spiders: []},
				output: ''
			});
			buildAssertion(assert.equal, {
				source: '@if(spiders)AAUGH!@else@end',
				context: {spiders: {}},
				output: ''
			});
			buildAssertion(assert.equal, {
				source: '@if(spiders)AAUGH!@else@end',
				context: {spiders: ''},
				output: ''
			});
			buildAssertion(assert.equal, {
				source: '@if(spiders)AAUGH!@else@end',
				context: {spiders: 0},
				output: ''
			});
		});
	});

// ------------------------------------------------------------------
// UNLESS BLOCK
// Tests for @unless(foo) ... @end
// ------------------------------------------------------------------

	describe('"Unless" block', function () {
		it('should execute the consequent body if the condition is falsy', function () {
			buildAssertion(assert.equal, {
				source: '@unless(author)Anonymous@end',
				context: {},
				output: 'Anonymous'
			});
		});
		
		it('should execute the alternative body if the condition is truthy', function () {
			buildAssertion(assert.equal, {
				source: '@unless(author)Anonymous@else@(author)@end',
				context: {author: 'Brendan'},
				output: 'Brendan'
			});
		});
	});

// ------------------------------------------------------------------
// CUSTOM BLOCK HELPERS
// Tests for custom block helpers
// ------------------------------------------------------------------

	describe('Custom block helpers', function () {
		Strudel.registerHelper('list', function (context, options) {
			var html = '', i, l;

			for (i = 0, l = context.length; i < l; i++) {
				html += '<li>' + options.consequent(context[i]) + '</li>';
			}

			return '<ul>' + html + '</ul>';
		});
		
		it('should escape template vars but preserve literal text in the helper', function () {
			buildAssertion(assert.equal, {
				source: '@list(people)@(name)@end',
				context: {people: [{name: '<b>Brendan</b>'}, {name: 'Frank'}, {name: 'Marcus'}]},
				output: '<ul><li>&lt;b&gt;Brendan&lt;/b&gt;</li><li>Frank</li><li>Marcus</li></ul>'
			});
		});
		
		it('should render raw text when using double parens', function () {
			buildAssertion(assert.equal, {
				source: '@list(people)@((name))@end',
				context: {people: [{name: '<b>Brendan</b>'}]},
				output: '<ul><li><b>Brendan</b></li></ul>'
			});
		});
		
		Strudel.registerHelper('a', function(context, options) {
			var attribs = [];
			for (var k in options.hash) {
				var safeKey = Strudel.Utils.escapeExpression(k);
				var safeVal = Strudel.Utils.escapeExpression(options.hash[k]);
				attribs.push(safeKey + '="' + safeVal + '"');
			}
			var attribStr = attribs.join(' ');
			return '<a ' + attribStr + '>' + options.fn(this) + '</a>';
		});
		
		it('should populate the options.hash object when key value pairs are used', function () {
			buildAssertion(assert.equal, {
				source: '@a(href="http://bom.bs/" target="new" class=class)@(name)@end',
				context: {name: 'Brendan', class: 'awesome'},
				output: '<a href="http://bom.bs/" target="new" class="awesome">Brendan</a>'
			});
		});
	});
	
// ------------------------------------------------------------------
// DEGENERATE TEMPLATES
// Tests for templates that shouldn't compile or shouldn't execute
// ------------------------------------------------------------------

	describe('Degenerate templates', function () {
		it('should fail when list indexes are not numeric', function () {
			try {
				Strudel.compile('@(foo[bar])');
				assert.fail();
			} catch (e) {
				assert.equal(e.message, 'Expected [0-9] but "b" found.');
			}
		});
		
		it('should fail when path compnents don\'t start with an alphabetic character', function () {
			try {
				Strudel.compile('@(foo.9bar)');
				assert.fail();
			} catch (e) {
				assert.equal(e.message, 'Expected [a-zA-Z] but "9" found.');
			}
		});
		
		it('should fail when a block tag isn\'t closed', function () {
			try {
				Strudel.compile('@if(foo)...@@');
				assert.fail();
			} catch (e) {
				assert.equal(e.message, 'Expected "@", "@(", "@((", "@@", "@else", "@end" or [^@] but end of input found.');
			}
		});
		
		it('should fail when encountering a lonesome at', function () {
			try {
				Strudel.compile('<p>@ </p>');
				assert.fail();
			} catch (e) {
				assert.equal(e.message, 'Expected [a-zA-Z] but " " found.');
			}
		});
		
		it('should fail when a path does not exist in a given context', function () {
			try {
				Strudel.compile('@(foo.bar)')({foo: null});
				assert.fail();
			} catch (e) {
				assert.equal(e.message, 'Could not traverse specified path in given context.');
			}
		});
	});
});

// ----------------------------------------------------------------------
// Writing and loading AST data
// ----------------------------------------------------------------------

describe('Reading and writing', function() {
	var genString = function(template, context) {
			return String(template.stringWithContext(context));
		},
		buildTest = function(name, str, tree, ctx) {
			describe(name, function() {
				var template = Strudel.Parser.parse(str),
					outputTree = template.write(),
					context = ctx,
					newTemplate;

				if (tree) {
					it('should produce a tree that matches the expected output', function() {
						assert.deepEqual(outputTree, tree);
					});
				}

				newTemplate = Strudel.AST.load(outputTree);

				it('should load a matching AST', function() {
					assert.deepEqual(template, newTemplate);
				});

				it('should render identically to the original template', function() {
					assert.equal(genString(template, context), genString(newTemplate, context));
				});
			});
		};
	
	buildTest('a trivial template', 'foo',
		{
			type: 'Template',
			expressionList: [
				{type: 'Literal', string: 'foo'}
			]
		}
	);

	buildTest('a simple template', '@(foo)',
		{
			type: 'Template',
			expressionList: [{
				type: 'Expression',
				searchPath: [{type: 'Name', name: 'foo'}]
			}]
		},
		{foo: 'bar'}
	);

	buildTest('a more complex template', '@with(author)@(firstName) @(lastName)@end',
		{
			type: 'Template',
			expressionList: [
				{
					type: 'Block',
					name: {type: 'Name', name: 'with'},
					expression: {
						type: 'Expression',
						searchPath: [{type: 'Name', name: 'author'}]
					},
					consequent: {
						type: 'Template',
						expressionList: [{
							type: 'Expression',
							searchPath: [{type: 'Name', name: 'firstName'}]
						}, {
							type: 'Literal',
							string: ' '
						}, {
							type: 'Expression',
							searchPath: [{type: 'Name', name: 'lastName'}]
						}]
					}
				}
			]
		},
		{author: {firstName: "Brendan", lastName: "Berg"}}
	);

	buildTest('a template using a complex search path', '@(book.authors[1].name)', null, {
		book: {authors: [{name: 'Joe'}, {name: 'Brendan'}]}
	});

	buildTest('a template using an if statement and search path', '@if(author)@(author.name)@elseAnonymous@end', null, {
		author: {name: 'Brendan'}
	});

	buildTest('a template using a with statement', '@with(object)@(property)@end', null, {
		object: {property: 'foo'}
	});

	buildTest('a template with an each block', '@each(items)@(name)@end', null, {
		items: [{name: 'A'}, {name: 'B'}, {name: 'C'}]
	});
});

