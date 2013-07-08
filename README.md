@(Strudel)
==========


Introduction
------------

Strudel is a framework-agnostic templating system designed to share
templates between front- and back-end code. It shares some philosophical
similarities with templating systems like
[Handlebars](http://handlebarsjs.com/) and
[Mustache](http://mustache.github.io), but uses at signs (they look like
strudel!) instead of curly braces to denote template directives.


Tags and Templates
------------------

A template is made up of literal text with embedded Strudel tags. The
template is compiled into a re-usable function, which renders a string by
interpolating values from an evaluation context.

Strudel tags always start with an at sign. There are two types of tags
used in Strudel templates: expression tags are stand-alone tags that are
simply replaced with a value when rendering, and block tags are multi-part
constructs that enclose a body that is evaluated based on the behavior of
the particular block. Anything that is valid in a stand-alone template may
appear inside a tag body.

The simplest expression tag is a simple key. For example, the tag
`@(architect)` would be replaced by looking for the `architect` key in the
execution context. If the given context were `{architect: "Mies van der
Rohe"}`, the tag would render simply as `Mies van der Rohe`. More complex
expression tags are discussed in the next section.

Block tags allow more complex behaviors like list iteration and
conditional statements. The block `@if(style) Modernism @end` would be
rendered as ` Modernism ` if the value associated with the `style` key is
truthy. (Generally, strudel considers values other than `null`,
`undefined`, `false`, `0`, and empty values (`''`, `[]`, and `{}`) as
truthy.) Block tags also allow a great deal of customization and
flexibility, the extent of which is discussed in depth later on.


Compilation and Rendering
-------------------------

Templates are compiled by calling `Strudel.compile` function. It expects a
template string argument and returns a function that renders the template.
Calling the template function with an execution context results in a
rendered string.

The code sample below demonstrates how a template may be compiled and
rendered using the JavaScript library.

	var template = '<h1>@(title)</h1><p>by @(author)</p>';
	var render = Strudel.compile(template);
	var output = render({
		title: "Delirious New York",
		author: "Rem Koolhaas"
	});

The value of `output` after the call to `render` is shown below.

	<h1>Delirious New York</h1><p>by Rem Koolhaas</p>


__Precompiling Templates__

There are two reasons to consider precompiling Strudel templates before
serving them to the browser: not loading the parser reduces page load time, and
loading precompiled templates avoids the computational overhead of parsing
templates.

Strudel's core footprint is approximately 9 KB when minified. The parser
is a separate module that is an additional minified 12 KB. Working with
precompiled templates doesn't require including the parser module, thus
lightening the initial page load.

Compiled templates have a `write` function that outputs the template as an
object graph. This graph may be serialized as JSON or XML for transport.

Revisiting the template code shown in the previous section, the code
sample below shows how to serialize and then load a template.

	var template_json = JSON.stringify(render.write());

The `Strudel.load` function is used to convert an object graph into a
template function.

	var renderAgain = Strudel.load(JSON.parse(template_json));
	var output = renderAgain({
		title: "Delirious New York",
		author: "Rem Koolhaas"
	});

The value of `output` will be identical to the example in the previous
section.


Expression Tags
---------------

In addition to the simple expression discussed in the previous section,
expression tags may include more complex search paths through the
evaluation context. This section shows how both simple expression tags
behave and how to traverse nested objects with a key path expression.


__Autoescaping__

Values in expression tags that are singly parenthesized are automatically
HTML escaped when rendering. Consider the following context:

	{architect: "<b>Rem Koolhaas</b>"}

When used in evaluating `@(architect)`, Strudel would render
`&lt;b&gt;Rem Koolhaas&lt;/b&gt;`.

When an expression is doubly parenthesized however, the value is rendered
as-is, without escaping HTML entities. So `@((architect))` is rendered as
`<b>Rem Koolhaas</b>`.


__Suppressed Values__

When evaluating an expression tag, if the value in the context is falsy or
if there is no key matching the key in the expression, Strudel will render
tag as the empty string.

This is in contrast to other templating utilities that complain loudly
when values for keys are not found.

Note: this behavior is subject to change in the future. A strict mode may
be added, and numeric zeros may be rendered.


__Key Paths__

A key path may be used to traverse nested objects and arrays in an
execution context. Dot notation is used to traverse keys in objects,
and bracket notation is used for array indexes.

In the example below, we see how square bracket notation is used to render
an item at a given index of the following array.

    {architects: ["Richard Rogers", "Renzo Piano", "Norman Foster"]}

The template `@(architects[1])` would render as `Renzo Piano`.

Similarly, the next example shows how to use dot notation to traverse
nested dictionaries.

	{
		architect: {
			name: "Philip Johnson",
			born: "July 8, 1906",
			died: "January 25, 2005",
		}
	}

The template `@(architect.name)` would render as `Philip Johnson`.

Key paths may combine both dot and bracket notation when traversing data
structures that combine both arrays and dictionaries.

	{
		buildings: [
			{
				name: "New York Times Building",
				architect: "Renzo Piano"
			}, 
			{
				name: "IAC Building",
				architect: "Frank Gehry"
			}
		]
	}

The template `@(buildings[1].architect)` would render as `Frank Gehry`.

However, key path expressions that attempt either array or dictionary
lookups on incompatible types will throw an error. In the above context,
an attempt to render `@(buildings.name)` will fail because key lookups are
invalid for list types.


Block Tags
----------

A block is a section of a template that falls between opening and closing
block tags. Opening block tags consist of an at sign, a block identifier,
and an optional expression. Blocks continue until the corresponding `@end`
tag. The behavior of a block depends on its identifier.

Pre-defined blocks include `with`, `each`, `if`, and `unless`. Let's look
at each of these in detail.


__The With Block__

The `with` block evaluates the expression in its opening tag and pushes
the corresponding object onto the context stack. (The `with` block behaves
like `let` in some functional languages.)

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


__The Each Block__

The `each` block repeatedly renders its contents with each element of an
array as its context.

Consider the following context and template:

	{
		name: "The New York Five",
		architects: [
			{firstName: "Peter", lastName: "Eisenman"},
			{firstName: "Michael", lastName: "Graves"},
			{firstName: "Charles", lastName: "Gwathmey"}
			{firstName: "John", lastName: "Hejduk"}
			{firstName: "Richard", lastName: "Meier"}
		]
	}

	<div>
		<h1>@(name)</h1>
		<ul>
			@each(architects)
				<li>@(firstName) @(lastName)</li>
			@end
		</ul>
	</div>

The output would be:

	<div>
		<h1>The New York Five</h1>
		<ul>
			<li>Peter Eisenman</li>
			<li>Michael Graves</li>
			<li>Charles Gwathmey</li>
			<li>John Hejduk</li>
			<li>Richard Meier</li>
		</ul>
	</div>


__The If Block__

The `if` block conditionally executes if its expression evaluates to
anything other than `false`, `undefined`, `null`, `[]`, or `""` (i.e. the
value of the expression must be "truthy").

	<div class="entry">
		@if(author)
			<h1>By @(firstName) @(lastName)</h1>
		@end
	</div>

When rendered with an empty context would result in the following:

	<div class="entry">
	</div>

Additionally, you may define an `@else` clause that renders if the `@if`
tag's expression returns a falsy value:

	<div class="entry">
		@if(author)
			<h1>By @(firstName) @(lastName)</h1>
		@else
			<h1>Anonymous</h1>
		@end
	</div>


__The Unless Block__

The `unless` block is the inverse of the `@if` block; it conditionally
executes if its expression is falsy.

	@unless(author)
		<p><blink>WARNING:</blink> This entry has no author!</p>
	@end

An `unless` block may also have an optional `@else` clause.


__Custom Blocks__

Custom blocks may be registered with the compiler to define custom
behavior for arbitrary identifiers. A block handler is a function that is
passed a context and an options object. The options object has an `fn`
property that represents the consequent body of the block, and `inverse`
property that represents the alternative body if the block was constructed
with an `@else` clause.

Let's revisit the `each` block example above. If we wanted a custom block
tag to render HTML lists, we could register the following helper:

	Strudel.registerHandler('list', function (context, options) {
		var html = '', i, l;
		
		for (i = 0, l = context.length; i < l; i++) {
			html += '<li>' + options.fn(context[i]) + '</li>';
		}
		
		return '<ul>' + html + '</ul>';
	});

After defining the helper function, you can invoke a context just like a
normal Strudel template.

	{
		architects: [
			{firstName: "Elizabeth", lastName: "Diller"},
			{firstName: "Ricardo", lastName: "Scofidio"},
			{firstName: "Charles", lastName: "Renfro"}
		]
	}

	@list(authors)@(firstName) @(lastName)@end

When executed, the template would render the following HTML:

	<ul>
		<li>Elizabeth Diller</li>
		<li>Ricardo Scofidio</li>
		<li>Charles Renfro</li>
	</ul>

