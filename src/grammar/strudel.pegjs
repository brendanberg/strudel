start
	= items:template * { return new Strudel.AST.Template(items); }
			

template
	= item:literal { return item; }
	/ item:block { return item; }

block 
	= "@@" { return new Strudel.AST.Literal('@'); }
	/ "@(" expr:expression ")" { return expr; }
	/ "@((" expr:expression "))" { expr.wrap(function(s) { return new Strudel.SafeString(s); }); return expr; }
	/ "@" n:name "(" expr:expression ")" body:start "@end"
		{ return new Strudel.AST.Block(n, expr, body); }
	/ "@" n:name "(" expr:expression ")" consequent:start "@else" alternative:start "@end"
		{ return new Strudel.AST.Block(n, expr, consequent, alternative); }

expression
	= a:attributes { var exp = new Strudel.AST.Expression([]); exp.attributes = a; return exp; }
	/ helper:(n:name " " { return n; })? exp:path a:(" " a:attributes { return a; })?
		{ exp.helper = helper || null; exp.attributes = a || {}; return exp; }

attributes
	= first:keyValuePair rest:(" " obj:keyValuePair { return obj; }) *
		{
			var attributes = {};
			attributes[first[0]] = first[1];
			for (var i = 0, l = rest.length; i < l; i++) {
				var pair = rest[i], key = pair[0], value = pair[1];
				attributes[key] = value;
			}
			return attributes;
		}

keyValuePair
	= name:key " "? "=" " "? value:value { return [name, value]; }

key
	= first:[a-zA-Z] rest:[a-zA-Z0-9_]* { return first + rest.join(''); }

value
	= "\"" chars:[^"]* "\"" { return chars.join(''); }
	/ i:integer f:fraction? e:exponent? { return Number(i + f + e); }
	/ p:path { return p; }

integer
	= sign:[+-]? digits:[0-9]+ { return sign + digits.join(''); }

fraction
	= "." digits:[0-9]* { return '.' + digits.join(''); }

exponent
	= [eE] sign:[+-]? digits:[0-9]+ { return 'e' + sign + digits.join(''); }

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

