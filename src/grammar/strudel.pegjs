start
	= items:template * { return new Strudel.AST.Template(items); }
			

template
	= item:literal { return item; }
	/ item:block { return item; }

block
	= "@@" { return new Strudel.AST.Literal('@'); }
	/ "@(" expr:expression ")" { expr.wrap(Strudel.Utils.escapeExpression); return expr; }
	/ "@((" expr:expression "))" { return expr; }
	/ "@" n:name "(" expr:expression ")" body:start "@end"
		{ return new Strudel.AST.Block(n, expr, body); }
	/ "@" n:name "(" expr:expression ")" consequent:start "@else" alternative:start "@end"
		{ return new Strudel.AST.Block(n, expr, consequent, alternative); }

expression
	= helper:(first:name " " { return first; }) p:path
		{ p.helper = helper; return p; }
	/ p:path
		{ return p; }

path
	= first:name rest:("." part:name { return part; } / "[" part:index "]" { return part; }) +
		{ return new Strudel.AST.Expression(Array(first).concat(rest)); }
	/ first:name { return new Strudel.AST.Expression([first]); }

name
	= first:[a-zA-Z] rest:[a-zA-Z0-9_]* { return new Strudel.AST.Name(first + rest.join('')); }

index
	= digits:[0-9]+ { return new Strudel.AST.Index(digits.join('')); }

literal
	= chars:[^@]+ { return new Strudel.AST.Literal(chars.join('')); }