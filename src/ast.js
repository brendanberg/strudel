var Strudel = require('./base');

(function() {
	Strudel.AST = {};
	
	Strudel.AST.Template = function(list) {
		this.type = "template";
		this.safeString = '';
		this.expressionList = list;
	};
	
	Strudel.AST.Template.prototype = {
		stringWithContext: function(context) {
			var i, l, result = '';
			for (i = 0, l = this.expressionList.length; i < l; i++) {
				result = result + this.expressionList[i].stringWithContext(context);
			}
			return result;
		}
	};
	
	
	
	Strudel.AST.Block = function(name, expr, consq, alt) {
		this.type = "block";
		this.name = name;
		this.expression = expr;
		this.consequent = consq;
		this.alternative = alt;
	};
	
	Strudel.AST.Block.prototype = {
		stringWithContext: function(context) {
			var helper = Strudel.helpers[this.name.name || 'helperMissing'];
			var options = {
				fn: this.consequent,
				inverse: this.alternative
			};
			var innerContext = this.expression.valueAtPath(context);
			return helper.call(context, innerContext, options);
		}
	};
	
	
	
	Strudel.AST.Expression = function(list) {
		this.type = "expression";
		this.helper = function(x) { return x; };
		this.searchPath = list;
	};
	
	Strudel.AST.Expression.prototype = {
		valueAtPath: function(context) {
			var i, l, pathComponent, value = context;
			
			for (i = 0, l = this.searchPath.length; i < l; i++) {
				pathComponent = this.searchPath[i];
				if (pathComponent.type === "name" && Strudel.Utils.typeOf(value) === 'object') {
					value = value[pathComponent.name];
				} else if (pathComponent.type === "index" && Strudel.Utils.typeOf(value) === 'array') {
					value = value[pathComponent.index];
				} else {
					throw new Strudel.EvaluationError('Could not traverse specified path in given context.');
				}
			}
			return value;
		},
		
		wrap: function (wrapper) {
			var wrapped = this.stringWithContext;
			this.stringWithContext = function(context) {
				return wrapper(wrapped.call(this, context));
			};
		},
		
		stringWithContext: function(context) {
			var value = this.valueAtPath(context);
			
			if (Strudel.Utils.isEmpty(value)) {
				return '';
			} else {
				return String(value);
			}
		}
	};
	
	Strudel.AST.Name = function(name) {
		this.type = "name";
		this.name = name;
	};
	
	Strudel.AST.Index = function(index) {
		this.type = "index";
		this.index = index;
	};
	
	Strudel.AST.Literal = function(str) {
		this.type = "literal";
		this.safeString = str;
	};
	
	Strudel.AST.Literal.prototype = {
		stringWithContext: function() {
			return this.safeString;
		}
	};
		
}());