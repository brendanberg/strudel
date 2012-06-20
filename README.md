Introduction
============

Strudel is a framework-agnostic templating system inspired by [Handlebars][1] and the like.


Tag Types
=========

Tags are indicated by an at sign (@) followed by some other junk. `@(person)` is a tag, and so are `@with(person)` and `@end`. The following sections describe the different kinds of tags.

Variables
---------

A variable can be referenced within a context simply by enclosing the variable name in parentheses preceded by an at sign. For example, if the current context is `{'name': 'Brendan', 'location': 'New York'}`, the template `@(name) is currently in @(location)` would evaluate to "Brendan is currently in New York". If there is no property with the variable name in the current context, nothing will be rendered.

Variable tags automatically escape HTML. To override this behavior and render an unescaped string, use double parentheses.

Here's a context and a template string so we can see variable tags in action.

	{
		'name': 'Brendan',
		'location': 'New York',
		'company': '<b>Wurk Happy</b>'
	}

	<div class="person">
		<h1>@(name)</h1>
		<p>@(address)</p>
		<p>@(company)</p>
		<p>@((company))</p>
	</div>

The template shown above would render the following output:

	<div class="person">
		<h1>Brendan</h1>
		<p></p>
		<p>&lt;b&gt;Wurk Happy&lt;/b&gt;</p>
		<p><b>Wurk Happy</b></p>
	</div>

A variable tag may use dot notation to specify a path through an object graph. Additionally, array lookups can use square bracket notation. Consider the following context and template.

	{
		person: {
			name: 'Brendan',
			interests: ['puppies', 'Python', 'parrots']
		}
	}

	<p><b>@(person.name)</b> likes @(person.interests[1])</p>

The template and context shown above would render the following output:

	<p><b>Brendan</b> likes Python.</p>

Blocks
------

A block is a section of a template that falls between opening and closing block tags. Opening block tags consist of an at sign, a block identifier, and an optional expression. Blocks continue until the corresponding `@end` tag. The behavior of a block depends on its identifier.

Pre-defined blocks include `with`, `each`, `if`, and `unless`. Let's look at each of these in detail.

__The `with` Block__

The `with` block evaluates the expression in its opening tag and pushes the corresponding object onto the context stack. (The `with` block behaves like `let` in some functional languages.)

Assume the template we're about to look at uses this context:

	{
		name: "Strudel",
		author: {
			firstName: "Brendan",
			lastName: "Berg"
		}
	}

Consider the following template.

	<div class="project">
		<h1>@(name)</h1>
		@with(author)
			<h2>By @(firstName) @(lastName)</h2>
		@end
	</div>

Compiling the template would result in the following:

	<div class="project">
		<h1>Strudel</h1>
		<h2>By Brendan Berg</h2>
	</div>


__The `each` Block__

The `each` block repeatedly renders its contents with each element of an array as its context.

Consider the following context and template:

	{
		title: "Introduction to Tornado",
		authors: [
			{firstName: "Brendan", lastName: "Berg"},
			{firstName: "Mike", lastName: "Dory"},
			{firstName: "Adam", lastName: "Parrish"}
		]
	}

	<div class="book">
		<h1>@(title)</h1>
		<ul>
			@each(authors)
				<li>@(firstName) @(lastName)</li>
			@end
		</ul>
	</div>

The output would be:

	<div class="book">
		<h1>Introduction to Tornado</h1>
		<ul>
			<li>Brendan Berg</li>
			<li>Mike Dory</li>
			<li>Adam Parrish</li>
		</ul>
	</div>


__The `if` Block__

The `if` block conditionally executes if its expression evaluates to anything other than `false`, `undefined`, `null`, `[]`, or `""` (i.e. the value of the expression must be "truthy").

	<div class="entry">
		@if(author)
			<h1>By @(firstName) @(lastName)</h1>
		@end
	</div>

When rendered with an empty context would result in the following:

	<div class="entry">
	</div>

Additionally, you may define an `@else` clause that renders if the `@if` tag's expression returns a falsy value:

	<div class="entry">
		@if(author)
			<h1>By @(firstName) @(lastName)</h1>
		@else
			<h1>Anonymous</h1>
		@end
	</div>


__The `unless` Block__

The `unless` block is the inverse of the `@if` block; it conditionally executes if its expression is falsy.

	@unless(author)
		<p><blink>WARNING:</blink> This entry has no author!</p>
	@end

An `unless` block may also have an optional `@else` clause.


Custom Blocks
-------------

Custom blocks may be registered with the compiler to define custom behavior for arbitrary identifiers. A block handler is a function that is passed a context, an expression, and a body. Additionally, if the handler supports an `@else` block, it receives an alternative body.

Let's revisit the `each` block example above. If we wanted to create a custom block handler for lists, we could define the following function:

	Strudel.blocks['list'] = function (context, expr, body) {
		var html = '<ul>', ctx = expr(context);
		
		for (var i = 0, l = ctx.length; i < l; i++) {
			html = html + '<li>' + body(ctx[i]) + '</li>';
		}
		
		return html + '</ul>';
	};

After defining the helper function, you can invoke a context just like a normal Strudel template.

	{
		authors: [
			{firstName: "Brendan", lastName: "Berg"},
			{firstName: "Mike", lastName: "Dory"},
			{firstName: "Adam", lastName: "Parrish"}
		]
	}

	@list(authors)@(firstName) @(lastName)@end

When executed, the template would render the following HTML:

	<ul>
		<li>Brendan Berg</li>
		<li>Mike Dory</li>
		<li>Adam Parrish</li>
	</ul>


Helpers
-------

This functionality is not yet supported.

