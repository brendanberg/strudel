var Strudel = require('../src');
var assert = require('assert');

function buildAssertion(assertion, test) {
	assertion(Strudel.compile(test['source'])(test['context']), test['output']);
}

describe('Strudel', function() {
	
	describe('Literal evaluation', function() {
		it('should render literal text as-is', function () {
			buildAssertion(assert.equal, {
				source: '<a href="http://foo.example.org/">Hello</a>',
				context: {},
				output: '<a href="http://foo.example.org/">Hello</a>'
			});
		});
		
		it('should render escaped strudels properly', function () {
			buildAssertion(assert.equal, {
				source: '@@', context: {}, output: '@'
			});
		});
	});
	
	describe('Expression lookup', function() {
		it('should resolve well-formed dot notation', function () {
			buildAssertion(assert.equal, {
				source: '@(author.name) is @(author.age) years old.',
				context: {author: {name: 'Brendan', age: 28}},
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
		
		it('should render raw strings when using double parens', function () {
			buildAssertion(assert.equal, {
				source: '@with(author)@((name))@end',
				context: {author: {name: '<b>Brendan</b>'}},
				output: '<b>Brendan</b>'
			});
		});
	});
	
	describe('"Each" block', function() {
		it('should execute the block body with each item in a list', function () {
			buildAssertion(assert.equal, {
				source: '@each(person)[@(name)]@end',
				context: {person: [{name: 'Brendan'}, {name: 'Matthew'}, {name: 'Joe'}]},
				output: '[Brendan][Matthew][Joe]'
			});
		});
	});
	
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
	});
	
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
	
	describe('Custom block helpers', function () {
		Strudel.registerHelper('list', function (context, options) {
			var html = '', i, l;

			for (i = 0, l = context.length; i < l; i++) {
				html = html + '<li>' + options.consequent(context[i]) + '</li>';
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
	});
	
	describe('Degenerate templates', function () {
		it('should fail when list indexes are not numeric', function () {
			try {
				Strudel.compile('@(foo[bar])');
				assert.fail();
			} catch (e) {
				assert.equal(e.message, 'Expected [0-9] but "b" found.');
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
	});
});