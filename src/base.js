// BEGIN(BROWSER)

var Strudel = {};

(function() {

	Strudel.VERSION = "0.1 alpha";

	Strudel.helpers = {};

	Strudel.registerHelper = function(name, fn, inverse) {
		if (inverse) { fn.not = inverse; }
		this.helpers[name] = fn;
	};

	Strudel.registerHelper('helperMissing', function(arg) {
		if (arguments.length == 2) {
			return undefined;
		} else {
			throw new Error("Could not find property '" + arg + "'");
		}
	});

	var toString = Object.prototype.toString, functionType = "[object Function]";

	Strudel.registerHelper('blockHelperMissing', function() {});

	Strudel.registerHelper('with', function (context, options) {
		var cond = options.fn, inverse = options.inverse;
		
		if (!context || Strudel.Utils.isEmpty(context)) {
			return inverse.stringWithContext(this);
		} else {
			return cond.stringWithContext(context);
		}
	});

	Strudel.registerHelper('each', function (context, options) {
		var cond = options.fn, inverse = options.inverse;
		var str = '', i, l;
	
		if (context && context.length > 0) {
			for (i = 0, l = context.length; i < l; i++) {
				str = str + cond.stringWithContext(context[i]);
			}
		} else {
			str = inverse.stringWithContext(this);
		}
	
		return str;
	});

	Strudel.registerHelper('if', function (context, options) {
		var cond = options.fn, inverse = options.inverse;
	
		if (!context || Strudel.Utils.isEmpty(context)) {
			return inverse.stringWithContext(this);
		} else {
			return cond.stringWithContext(this);
		}
	});

	Strudel.registerHelper('unless', function (context, options) {
		var inverse = options.inverse;
		options.inverse = options.fn;
		options.fn = inverse;
		return Strudel.helpers['if'].call(this, context, options);
	});

	Strudel.registerHelper('log', function (context, options) {
		Strudel.log(context);
	});

}());

// Function call to generate a template
Strudel.compile = function(source) {
	var ast = Strudel.Parser.parse(source);
	return function(context) {
		return ast.stringWithContext(context);
	};
};

Strudel.Exception = function (message) {
	this.message = message;
};

Strudel.EvaluationError = function (message) {
	this.message = message;
};

Strudel.SafeString = function(string) {
	this.string = string;
};
Strudel.SafeString.prototype.toString = function() {
	return this.string.toString();
};

(function() {
	var replacements = {
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
		'`': '&#96;',
	};
	
	var badChars = /&(?!\w+;)|[<>"'\`]/g;
	var possible = /[&<>"'`]/;
	
	var escapeChar = function(char) {
		return replacements[char] || '&amp;';
	};
	
	Strudel.Utils = {
		escapeExpression: function(string) {
			if (!possible.test(string)) {
				return string;
			}
			return string.replace(badChars, escapeChar);
		},
		typeOf: function (value) {
			var s = typeof(value);
			if (s === 'object') {
				if (value) {
					if (Object.prototype.toString.call(value) === '[object Array]') {
						s = 'array';
					}
				} else {
					s = 'null';
				}
			}
			return s;
		},
		isEmpty: function (value) {
			if (typeof value === 'undefined') {
				return true;
			} else if (value === null) {
				return true;
			} else if (value === false) {
				return true;
			} else if (Object.prototype.toString.call(value) === '[object Array]' && value.length === 0) {
				return true;
			} else if (Object.prototype.toString.call(value) === '[object Object]' && Object.keys(value).length === 0) {
				return true;
			} else {
				return false;
			}
		}
	}
}());

// END(BROWSER)

module.exports = Strudel;