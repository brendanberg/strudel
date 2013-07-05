var Strudel = require('./base');

// BEGIN(BROWSER)

(function() {
	Strudel.AST = {};
	
	Strudel.AST.Template = function(list) {
		this.type = "Template";
		this.expressionList = list;
	};

	Strudel.AST.Template.load = function (obj) {
		var i, l, list = [];
		for (i = 0, l = obj.expressionList.length; i < l; i++) {
			list.push(Strudel.AST.load(obj.expressionList[i]));
		}
		return new Strudel.AST.Template(list);
	};

	Strudel.AST.Template.prototype = {
		write: function() {
			var i, l, node = {type: this.type, expressionList: []};
			for (i = 0, l = this.expressionList.length; i < l; i++) {
				node.expressionList.push(this.expressionList[i].write());
			}
			return node;
		},
		stringWithContext: function(context) {
			var i, l, result = '';
			for (i = 0, l = this.expressionList.length; i < l; i++) {
				result = result + Strudel.Utils.escapeExpression(this.expressionList[i].stringWithContext(context));
			}
			return new Strudel.SafeString(result);
		}
	};
	
	
	
	Strudel.AST.Block = function(name, expr, consq, alt) {
		this.type = "Block";
		this.name = name;
		this.expression = expr;
		this.consequent = consq;
		this.alternative = alt;
	};


	Strudel.AST.Block.load = function(obj) {
		var name = Strudel.AST.load(obj.name),
			expr = Strudel.AST.load(obj.expression),
			consq, alt;
		
		if (obj.consequent) {
			consq = Strudel.AST.load(obj.consequent);
		}

		if (obj.alternative) {
			alt = Strudel.AST.load(obj.alternative);
		}

		return new Strudel.AST.Block(name, expr, consq, alt);
	};

	Strudel.AST.Block.prototype = {
		write: function() {
			var node = {
				type: this.type,
				name: this.name.write(),
				expression: this.expression.write()
			};

			if (this.consequent) {
				node.consequent = this.consequent.write();
			}
			
			if (this.alternative) {
				node.alternative = this.alternative.write();
			}

			return node;
		},
		stringWithContext: function(context) {
			var self = this, key, val;
			var helper = Strudel.helpers[this.name.name || 'helperMissing'];
			var options = {
				fn: function(context) {
					if (self.consequent) {
						return Strudel.Utils.escapeExpression(self.consequent.stringWithContext(context));
					} else {
						return '';
					}
				},
				inverse: function(context) {
					if (self.alternative) {
						return Strudel.Utils.escapeExpression(self.alternative.stringWithContext(context));
					} else {
						return '';
					}
				},
				consequent: function(context) {
					if (self.consequent) {
						return Strudel.Utils.escapeExpression(self.consequent.stringWithContext(context));
					} else {
						return '';
					}
				},
				alternative: function(context) {
					if (self.alternative) {
						return Strudel.Utils.escapeExpression(self.alternative.stringWithContext(context));
					} else {
						return '';
					}
				}
			};
			if (this.expression.attributes) {
				options['hash'] = {};
				for (key in this.expression.attributes) {
					if (this.expression.attributes.hasOwnProperty(key)) {
						val = this.expression.attributes[key];
						if (val instanceof Strudel.AST.Expression) {
							val = val.stringWithContext(context);
						}
						options['hash'][key] = val;
					}
				}
			}
			var innerContext = this.expression.valueAtPath(context);
			return new Strudel.SafeString(helper.call(context, innerContext, options));
		}
	};
	
	
	
	Strudel.AST.Expression = function(list) {
		this.type = "Expression";
		this.helper = null;
		this.attributes = {};
		this.searchPath = list;
	};

	Strudel.AST.Expression.load = function(obj) {
		var searchPath = [], exp, i, l, k;

		for (i = 0, l = obj.searchPath.length; i < l; i++) {
			searchPath.push(Strudel.AST.load(obj.searchPath[i]));
		}

		exp = new Strudel.AST.Expression(searchPath);

		if (obj.helper) {
			exp.helper = Strudel.AST.load(obj.helper);
		}

		if (obj.attributes) {
			for (k in obj.attributes) {
				if (typeof obj.attributes[k] === 'string' || typeof obj.attributes[k] === 'number') {
					exp.attributes[k] = obj.attributes[k];
				} else {
					exp.attributes[k] = Strudel.AST.load(obj.attributes[k]);
				}
			}
		}

		return exp;
	};
	
	Strudel.AST.Expression.prototype = {
		write: function() {
			var i, l, k, node = {
				type: this.type,
				searchPath: []
			};

			if (this.helper) {
				node.helper = this.helper.write()
			}

			for (i = 0, l = this.searchPath.length; i < l; i++) {
				node.searchPath.push(this.searchPath[i].write());
			}

			if (this.attributes.length > 0) {
				node.attributes = {};

				for (k in this.attributes) {
					if (typeof this.attributes[k] === 'string' || typeof this.attributes[k] === 'number') {
						node.attributes[k] = this.attributes[k];
					} else {
						node.attributes[k] = this.attributes[k].write();
					}
				}
			}

			return node;
		},
		valueAtPath: function(context) {
			var i, l, pathComponent, value = context;
			
			for (i = 0, l = this.searchPath.length; i < l; i++) {
				pathComponent = this.searchPath[i];
				if (pathComponent instanceof Strudel.AST.Name && Strudel.Utils.typeOf(value) === 'object') {
					value = value[pathComponent.name];
				} else if (pathComponent instanceof Strudel.AST.Index && Strudel.Utils.typeOf(value) === 'array') {
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
			if (this.helper) {
				var helper = Strudel.helpers[this.helper.name || 'helperMissing'];
				var options = {}, key, val;
				
				if (this.attributes) {
					options['hash'] = {};
					for (key in this.attributes) {
						if (this.attributes.hasOwnProperty(key)) {
							val = this.attributes[key];
							if (val instanceof Strudel.AST.Expression) {
								val = val.stringWithContext(context);
							}
							options['hash'][key] = val;
						}
					}
				}
				
				var innerContext = this.valueAtPath(context);
				return new Strudel.SafeString(helper.call(context, innerContext, options));
			}
			
			var value = this.valueAtPath(context);
			
			if (!Strudel.Utils.isTruthy(value)) {
				return '';
			} else {
				return String(value);
			}
		}
	};
	
	Strudel.AST.Name = function(name) {
		this.type = "Name";
		this.name = name;
	};

	Strudel.AST.Name.load = function(obj) {
		return new Strudel.AST.Name(obj.name);
	};

	Strudel.AST.Name.prototype = {
		write: function() {
			return {type: this.type, name: this.name};
		}
	};
	
	Strudel.AST.Index = function(index) {
		this.type = "Index";
		this.index = index;
	};

	Strudel.AST.Index.load = function(obj) {
		return new Strudel.AST.Index(obj.index);
	};

	Strudel.AST.Index.prototype = {
		write: function() {
			return {type: this.type, index: this.index};
		}
	};
	
	Strudel.AST.Literal = function(str) {
		this.type = "Literal";
		this.string = str;
	};

	Strudel.AST.Literal.load = function(obj) {
		return new Strudel.AST.Literal(obj.string);
	};

	Strudel.AST.Literal.prototype = {
		write: function() {
			return {type: this.type, string: this.string};
		},
		stringWithContext: function() {
			return new Strudel.SafeString(this.string);
		}
	};
	
	Strudel.AST.load =  function(dict) {
		return Strudel.AST[dict.type].load(dict);
	};
}());

// END(BROWSER)
