start
	= items:template *
		{
			return function(ctx) {
				var s = '';
				for (var i = 0, l = items.length; i < l; i++) {
					s += items[i](ctx);
				}
				return s;
			};
		}
			

template
	= item:literal { return item; }
	/ item:block { return item; }

block
	= "@@" { return function() { return '@'; }; }
	/ "@(" expr:expression ")"
		{
			return function(context) {
				var prop = expr(context);
				if (prop && typeof prop === 'function') {
					prop = prop();
				}
				if (prop) {
					prop = String(prop);
				} else {
					prop = '';
				}
				return Strudel.escape(prop);
			}
		}
	/ "@((" expr:expression "))"
		{
			return function(context) {
				var prop = expr(context);
				if (prop && typeof prop === 'function') {
					prop = prop();
				}
				if (!prop || typeof prop !== 'string') {
					prop = '';
				}
				return prop;
			}
		}
	/ "@" n:name "(" expr:expression ")" body:start "@end"
		{
			return function(context) {
				return Strudel.blocks[n](context, expr, body);
			}
		}
	/ "@" n:name "(" expr:expression ")" consequent:start "@else" alternative:start "@end"
		{
			return function(context) {
				return Strudel.blocks[n](context, expr, consequent, alternative);
			}
		}

expression
	= helper:(first:name " " {return first;}) p:path
		{
			return function(ctx) {
				return Strudel.helpers[helper](p(ctx));
			}
		}
	/ p:path
		{
			return function(ctx) {
				return p(ctx);
			}
		}

path
	= first:name rest:("." part:name {return part;}) +
		{
			return function(list) {
				return function(ctx) {
					var c = ctx;
					for (var i = 0, l = list.length; i < l; i++) { c = c[list[i]]; }
					return c;
				}
			}(Array(first).concat(rest));
		}
	/ first:name
		{ 
			return function(ident) {
				return function(ctx) {
					return ctx[ident];
				}
			}(first);
		}

name
	= first:[a-zA-Z] rest:[a-zA-Z0-9_]* { return first + rest.join(''); }

literal
	= chars:[^@]+ { return function() { return chars.join(''); }; }