
var Strudel = {};

(function() {

	Strudel.VERSION = "0.2 alpha";

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
		if (!context || Strudel.Utils.isEmpty(context)) {
			return options.alternative(this);
		} else {
			return options.consequent(context);
		}
	});

	Strudel.registerHelper('each', function (context, options) {
		var consequent = options.consequent;
		var str = '', i, l;
	
		if (context && context.length > 0) {
			for (i = 0, l = context.length; i < l; i++) {
				str = str + consequent(context[i]);
			}
		} else {
			str = options.alternative(this);
		}
	
		return str;
	});

	Strudel.registerHelper('if', function (context, options) {
		if (!context || Strudel.Utils.isEmpty(context)) {
			return options.alternative(this);
		} else {
			return options.consequent(this);
		}
	});

	Strudel.registerHelper('unless', function (context, options) {
		var alt = options.alternative;
		options.alternative = options.consequent;
		options.consequent = alt;
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
		return String(ast.stringWithContext(context));
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
			if (string instanceof Strudel.SafeString) {
				return String(string);
			} else if (string == null || string === false) {
				return '';
			}
			
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


(function() {
	Strudel.AST = {};
	
	Strudel.AST.Template = function(list) {
		this.type = "template";
		this.expressionList = list;
	};
	
	Strudel.AST.Template.prototype = {
		stringWithContext: function(context) {
			var i, l, result = '';
			for (i = 0, l = this.expressionList.length; i < l; i++) {
				result = result + Strudel.Utils.escapeExpression(this.expressionList[i].stringWithContext(context));
			}
			return new Strudel.SafeString(result);
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
			var self = this, key, val;
			var helper = Strudel.helpers[this.name.name || 'helperMissing'];
			var options = {
				fn: function(context) {
					return Strudel.Utils.escapeExpression(self.consequent.stringWithContext(context)); 
				},
				inverse: function(context) {
					return Strudel.Utils.escapeExpression(self.alternative.stringWithContext(context));
				},
				consequent: function(context) {
					return Strudel.Utils.escapeExpression(self.consequent.stringWithContext(context));
				},
				alternative: function(context) {
					return Strudel.Utils.escapeExpression(self.alternative.stringWithContext(context));
				}
			};
			if (this.expression.attributes) {
				options['hash'] = {};
				for (key in this.expression.attributes) {
					if (this.expression.atttributes.hasOwnProperty(key)) {
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
		this.string = str;
	};
	
	Strudel.AST.Literal.prototype = {
		stringWithContext: function() {
			return new Strudel.SafeString(this.string);
		}
	};
		
}());

Strudel.Parser = (function(){
	/*
	 * Generated by PEG.js 0.7.0.
	 *
	 * http://pegjs.majda.cz/
	 */
	
	function quote(s) {
		/*
		 * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a
		 * string literal except for the closing quote character, backslash,
		 * carriage return, line separator, paragraph separator, and line feed.
		 * Any character may appear in the form of an escape sequence.
		 *
		 * For portability, we also escape escape all control and non-ASCII
		 * characters. Note that "\0" and "\v" escape sequences are not used
		 * because JSHint does not like the first and IE the second.
		 */
		 return '"' + s
			.replace(/\\/g, '\\\\')	 // backslash
			.replace(/"/g, '\\"')		 // closing quote character
			.replace(/\x08/g, '\\b') // backspace
			.replace(/\t/g, '\\t')	 // horizontal tab
			.replace(/\n/g, '\\n')	 // line feed
			.replace(/\f/g, '\\f')	 // form feed
			.replace(/\r/g, '\\r')	 // carriage return
			.replace(/[\x00-\x07\x0B\x0E-\x1F\x80-\uFFFF]/g, escape)
			+ '"';
	}
	
	var result = {
		/*
		 * Parses the input with a generated parser. If the parsing is successfull,
		 * returns a value explicitly or implicitly specified by the grammar from
		 * which the parser was generated (see |PEG.buildParser|). If the parsing is
		 * unsuccessful, throws |PEG.parser.SyntaxError| describing the error.
		 */
		parse: function(input, startRule) {
			var parseFunctions = {
				"start": parse_start,
				"template": parse_template,
				"block": parse_block,
				"expression": parse_expression,
				"attributes": parse_attributes,
				"keyValuePair": parse_keyValuePair,
				"key": parse_key,
				"value": parse_value,
				"integer": parse_integer,
				"fraction": parse_fraction,
				"exponent": parse_exponent,
				"path": parse_path,
				"name": parse_name,
				"index": parse_index,
				"literal": parse_literal
			};
			
			if (startRule !== undefined) {
				if (parseFunctions[startRule] === undefined) {
					throw new Error("Invalid rule name: " + quote(startRule) + ".");
				}
			} else {
				startRule = "start";
			}
			
			var pos = 0;
			var reportFailures = 0;
			var rightmostFailuresPos = 0;
			var rightmostFailuresExpected = [];
			
			function padLeft(input, padding, length) {
				var result = input;
				
				var padLength = length - input.length;
				for (var i = 0; i < padLength; i++) {
					result = padding + result;
				}
				
				return result;
			}
			
			function escape(ch) {
				var charCode = ch.charCodeAt(0);
				var escapeChar;
				var length;
				
				if (charCode <= 0xFF) {
					escapeChar = 'x';
					length = 2;
				} else {
					escapeChar = 'u';
					length = 4;
				}
				
				return '\\' + escapeChar + padLeft(charCode.toString(16).toUpperCase(), '0', length);
			}
			
			function matchFailed(failure) {
				if (pos < rightmostFailuresPos) {
					return;
				}
				
				if (pos > rightmostFailuresPos) {
					rightmostFailuresPos = pos;
					rightmostFailuresExpected = [];
				}
				
				rightmostFailuresExpected.push(failure);
			}
			
			function parse_start() {
				var result0, result1;
				var pos0;
				
				pos0 = pos;
				result0 = [];
				result1 = parse_template();
				while (result1 !== null) {
					result0.push(result1);
					result1 = parse_template();
				}
				if (result0 !== null) {
					result0 = (function(offset, items) { return new Strudel.AST.Template(items); })(pos0, result0);
				}
				if (result0 === null) {
					pos = pos0;
				}
				return result0;
			}
			
			function parse_template() {
				var result0;
				var pos0;
				
				pos0 = pos;
				result0 = parse_literal();
				if (result0 !== null) {
					result0 = (function(offset, item) { return item; })(pos0, result0);
				}
				if (result0 === null) {
					pos = pos0;
				}
				if (result0 === null) {
					pos0 = pos;
					result0 = parse_block();
					if (result0 !== null) {
						result0 = (function(offset, item) { return item; })(pos0, result0);
					}
					if (result0 === null) {
						pos = pos0;
					}
				}
				return result0;
			}
			
			function parse_block() {
				var result0, result1, result2, result3, result4, result5, result6, result7, result8;
				var pos0, pos1;
				
				pos0 = pos;
				if (input.substr(pos, 2) === "@@") {
					result0 = "@@";
					pos += 2;
				} else {
					result0 = null;
					if (reportFailures === 0) {
						matchFailed("\"@@\"");
					}
				}
				if (result0 !== null) {
					result0 = (function(offset) { return new Strudel.AST.Literal('@'); })(pos0);
				}
				if (result0 === null) {
					pos = pos0;
				}
				if (result0 === null) {
					pos0 = pos;
					pos1 = pos;
					if (input.substr(pos, 2) === "@(") {
						result0 = "@(";
						pos += 2;
					} else {
						result0 = null;
						if (reportFailures === 0) {
							matchFailed("\"@(\"");
						}
					}
					if (result0 !== null) {
						result1 = parse_expression();
						if (result1 !== null) {
							if (input.charCodeAt(pos) === 41) {
								result2 = ")";
								pos++;
							} else {
								result2 = null;
								if (reportFailures === 0) {
									matchFailed("\")\"");
								}
							}
							if (result2 !== null) {
								result0 = [result0, result1, result2];
							} else {
								result0 = null;
								pos = pos1;
							}
						} else {
							result0 = null;
							pos = pos1;
						}
					} else {
						result0 = null;
						pos = pos1;
					}
					if (result0 !== null) {
						result0 = (function(offset, expr) { return expr; })(pos0, result0[1]);
					}
					if (result0 === null) {
						pos = pos0;
					}
					if (result0 === null) {
						pos0 = pos;
						pos1 = pos;
						if (input.substr(pos, 3) === "@((") {
							result0 = "@((";
							pos += 3;
						} else {
							result0 = null;
							if (reportFailures === 0) {
								matchFailed("\"@((\"");
							}
						}
						if (result0 !== null) {
							result1 = parse_expression();
							if (result1 !== null) {
								if (input.substr(pos, 2) === "))") {
									result2 = "))";
									pos += 2;
								} else {
									result2 = null;
									if (reportFailures === 0) {
										matchFailed("\"))\"");
									}
								}
								if (result2 !== null) {
									result0 = [result0, result1, result2];
								} else {
									result0 = null;
									pos = pos1;
								}
							} else {
								result0 = null;
								pos = pos1;
							}
						} else {
							result0 = null;
							pos = pos1;
						}
						if (result0 !== null) {
							result0 = (function(offset, expr) { expr.wrap(function(s) { return new Strudel.SafeString(s); }); return expr; })(pos0, result0[1]);
						}
						if (result0 === null) {
							pos = pos0;
						}
						if (result0 === null) {
							pos0 = pos;
							pos1 = pos;
							if (input.charCodeAt(pos) === 64) {
								result0 = "@";
								pos++;
							} else {
								result0 = null;
								if (reportFailures === 0) {
									matchFailed("\"@\"");
								}
							}
							if (result0 !== null) {
								result1 = parse_name();
								if (result1 !== null) {
									if (input.charCodeAt(pos) === 40) {
										result2 = "(";
										pos++;
									} else {
										result2 = null;
										if (reportFailures === 0) {
											matchFailed("\"(\"");
										}
									}
									if (result2 !== null) {
										result3 = parse_expression();
										if (result3 !== null) {
											if (input.charCodeAt(pos) === 41) {
												result4 = ")";
												pos++;
											} else {
												result4 = null;
												if (reportFailures === 0) {
													matchFailed("\")\"");
												}
											}
											if (result4 !== null) {
												result5 = parse_start();
												if (result5 !== null) {
													if (input.substr(pos, 4) === "@end") {
														result6 = "@end";
														pos += 4;
													} else {
														result6 = null;
														if (reportFailures === 0) {
															matchFailed("\"@end\"");
														}
													}
													if (result6 !== null) {
														result0 = [result0, result1, result2, result3, result4, result5, result6];
													} else {
														result0 = null;
														pos = pos1;
													}
												} else {
													result0 = null;
													pos = pos1;
												}
											} else {
												result0 = null;
												pos = pos1;
											}
										} else {
											result0 = null;
											pos = pos1;
										}
									} else {
										result0 = null;
										pos = pos1;
									}
								} else {
									result0 = null;
									pos = pos1;
								}
							} else {
								result0 = null;
								pos = pos1;
							}
							if (result0 !== null) {
								result0 = (function(offset, n, expr, body) { return new Strudel.AST.Block(n, expr, body); })(pos0, result0[1], result0[3], result0[5]);
							}
							if (result0 === null) {
								pos = pos0;
							}
							if (result0 === null) {
								pos0 = pos;
								pos1 = pos;
								if (input.charCodeAt(pos) === 64) {
									result0 = "@";
									pos++;
								} else {
									result0 = null;
									if (reportFailures === 0) {
										matchFailed("\"@\"");
									}
								}
								if (result0 !== null) {
									result1 = parse_name();
									if (result1 !== null) {
										if (input.charCodeAt(pos) === 40) {
											result2 = "(";
											pos++;
										} else {
											result2 = null;
											if (reportFailures === 0) {
												matchFailed("\"(\"");
											}
										}
										if (result2 !== null) {
											result3 = parse_expression();
											if (result3 !== null) {
												if (input.charCodeAt(pos) === 41) {
													result4 = ")";
													pos++;
												} else {
													result4 = null;
													if (reportFailures === 0) {
														matchFailed("\")\"");
													}
												}
												if (result4 !== null) {
													result5 = parse_start();
													if (result5 !== null) {
														if (input.substr(pos, 5) === "@else") {
															result6 = "@else";
															pos += 5;
														} else {
															result6 = null;
															if (reportFailures === 0) {
																matchFailed("\"@else\"");
															}
														}
														if (result6 !== null) {
															result7 = parse_start();
															if (result7 !== null) {
																if (input.substr(pos, 4) === "@end") {
																	result8 = "@end";
																	pos += 4;
																} else {
																	result8 = null;
																	if (reportFailures === 0) {
																		matchFailed("\"@end\"");
																	}
																}
																if (result8 !== null) {
																	result0 = [result0, result1, result2, result3, result4, result5, result6, result7, result8];
																} else {
																	result0 = null;
																	pos = pos1;
																}
															} else {
																result0 = null;
																pos = pos1;
															}
														} else {
															result0 = null;
															pos = pos1;
														}
													} else {
														result0 = null;
														pos = pos1;
													}
												} else {
													result0 = null;
													pos = pos1;
												}
											} else {
												result0 = null;
												pos = pos1;
											}
										} else {
											result0 = null;
											pos = pos1;
										}
									} else {
										result0 = null;
										pos = pos1;
									}
								} else {
									result0 = null;
									pos = pos1;
								}
								if (result0 !== null) {
									result0 = (function(offset, n, expr, consequent, alternative) { return new Strudel.AST.Block(n, expr, consequent, alternative); })(pos0, result0[1], result0[3], result0[5], result0[7]);
								}
								if (result0 === null) {
									pos = pos0;
								}
							}
						}
					}
				}
				return result0;
			}
			
			function parse_expression() {
				var result0, result1, result2, result3;
				var pos0, pos1, pos2, pos3;
				
				pos0 = pos;
				result0 = parse_attributes();
				if (result0 !== null) {
					result0 = (function(offset, a) { var exp = new Strudel.AST.Expression([]); exp.attributes = a; return exp; })(pos0, result0);
				}
				if (result0 === null) {
					pos = pos0;
				}
				if (result0 === null) {
					pos0 = pos;
					pos1 = pos;
					pos2 = pos;
					pos3 = pos;
					result0 = parse_name();
					if (result0 !== null) {
						if (input.charCodeAt(pos) === 32) {
							result1 = " ";
							pos++;
						} else {
							result1 = null;
							if (reportFailures === 0) {
								matchFailed("\" \"");
							}
						}
						if (result1 !== null) {
							result0 = [result0, result1];
						} else {
							result0 = null;
							pos = pos3;
						}
					} else {
						result0 = null;
						pos = pos3;
					}
					if (result0 !== null) {
						result0 = (function(offset, n) { return n; })(pos2, result0[0]);
					}
					if (result0 === null) {
						pos = pos2;
					}
					result0 = result0 !== null ? result0 : "";
					if (result0 !== null) {
						result1 = parse_path();
						if (result1 !== null) {
							pos2 = pos;
							pos3 = pos;
							if (input.charCodeAt(pos) === 32) {
								result2 = " ";
								pos++;
							} else {
								result2 = null;
								if (reportFailures === 0) {
									matchFailed("\" \"");
								}
							}
							if (result2 !== null) {
								result3 = parse_attributes();
								if (result3 !== null) {
									result2 = [result2, result3];
								} else {
									result2 = null;
									pos = pos3;
								}
							} else {
								result2 = null;
								pos = pos3;
							}
							if (result2 !== null) {
								result2 = (function(offset, a) { return a; })(pos2, result2[1]);
							}
							if (result2 === null) {
								pos = pos2;
							}
							result2 = result2 !== null ? result2 : "";
							if (result2 !== null) {
								result0 = [result0, result1, result2];
							} else {
								result0 = null;
								pos = pos1;
							}
						} else {
							result0 = null;
							pos = pos1;
						}
					} else {
						result0 = null;
						pos = pos1;
					}
					if (result0 !== null) {
						result0 = (function(offset, helper, exp, a) { exp.helper = helper; exp.attributes = a; return exp; })(pos0, result0[0], result0[1], result0[2]);
					}
					if (result0 === null) {
						pos = pos0;
					}
				}
				return result0;
			}
			
			function parse_attributes() {
				var result0, result1, result2, result3;
				var pos0, pos1, pos2, pos3;
				
				pos0 = pos;
				pos1 = pos;
				result0 = parse_keyValuePair();
				if (result0 !== null) {
					pos2 = pos;
					pos3 = pos;
					if (input.charCodeAt(pos) === 32) {
						result2 = " ";
						pos++;
					} else {
						result2 = null;
						if (reportFailures === 0) {
							matchFailed("\" \"");
						}
					}
					if (result2 !== null) {
						result3 = parse_keyValuePair();
						if (result3 !== null) {
							result2 = [result2, result3];
						} else {
							result2 = null;
							pos = pos3;
						}
					} else {
						result2 = null;
						pos = pos3;
					}
					if (result2 !== null) {
						result2 = (function(offset, obj) { return obj; })(pos2, result2[1]);
					}
					if (result2 === null) {
						pos = pos2;
					}
					if (result2 !== null) {
						result1 = [];
						while (result2 !== null) {
							result1.push(result2);
							pos2 = pos;
							pos3 = pos;
							if (input.charCodeAt(pos) === 32) {
								result2 = " ";
								pos++;
							} else {
								result2 = null;
								if (reportFailures === 0) {
									matchFailed("\" \"");
								}
							}
							if (result2 !== null) {
								result3 = parse_keyValuePair();
								if (result3 !== null) {
									result2 = [result2, result3];
								} else {
									result2 = null;
									pos = pos3;
								}
							} else {
								result2 = null;
								pos = pos3;
							}
							if (result2 !== null) {
								result2 = (function(offset, obj) { return obj; })(pos2, result2[1]);
							}
							if (result2 === null) {
								pos = pos2;
							}
						}
					} else {
						result1 = null;
					}
					if (result1 !== null) {
						result0 = [result0, result1];
					} else {
						result0 = null;
						pos = pos1;
					}
				} else {
					result0 = null;
					pos = pos1;
				}
				if (result0 !== null) {
					result0 = (function(offset, first, rest) {
							var attributes = {};
							attributes[first[0]] = first[1];
							for (var i = 0, l = rest.length; i < l; i++) {
								var pair = rest[i], key = pair[0], value = pair[1];
								attributes[key] = value;
							}
							return attributes;
						})(pos0, result0[0], result0[1]);
				}
				if (result0 === null) {
					pos = pos0;
				}
				return result0;
			}
			
			function parse_keyValuePair() {
				var result0, result1, result2, result3, result4;
				var pos0, pos1;
				
				pos0 = pos;
				pos1 = pos;
				result0 = parse_key();
				if (result0 !== null) {
					if (input.charCodeAt(pos) === 32) {
						result1 = " ";
						pos++;
					} else {
						result1 = null;
						if (reportFailures === 0) {
							matchFailed("\" \"");
						}
					}
					result1 = result1 !== null ? result1 : "";
					if (result1 !== null) {
						if (input.charCodeAt(pos) === 61) {
							result2 = "=";
							pos++;
						} else {
							result2 = null;
							if (reportFailures === 0) {
								matchFailed("\"=\"");
							}
						}
						if (result2 !== null) {
							if (input.charCodeAt(pos) === 32) {
								result3 = " ";
								pos++;
							} else {
								result3 = null;
								if (reportFailures === 0) {
									matchFailed("\" \"");
								}
							}
							result3 = result3 !== null ? result3 : "";
							if (result3 !== null) {
								result4 = parse_value();
								if (result4 !== null) {
									result0 = [result0, result1, result2, result3, result4];
								} else {
									result0 = null;
									pos = pos1;
								}
							} else {
								result0 = null;
								pos = pos1;
							}
						} else {
							result0 = null;
							pos = pos1;
						}
					} else {
						result0 = null;
						pos = pos1;
					}
				} else {
					result0 = null;
					pos = pos1;
				}
				if (result0 !== null) {
					result0 = (function(offset, name, value) { return [name, value]; })(pos0, result0[0], result0[4]);
				}
				if (result0 === null) {
					pos = pos0;
				}
				return result0;
			}
			
			function parse_key() {
				var result0, result1, result2;
				var pos0, pos1;
				
				pos0 = pos;
				pos1 = pos;
				if (/^[a-zA-Z]/.test(input.charAt(pos))) {
					result0 = input.charAt(pos);
					pos++;
				} else {
					result0 = null;
					if (reportFailures === 0) {
						matchFailed("[a-zA-Z]");
					}
				}
				if (result0 !== null) {
					result1 = [];
					if (/^[a-zA-Z0-9_]/.test(input.charAt(pos))) {
						result2 = input.charAt(pos);
						pos++;
					} else {
						result2 = null;
						if (reportFailures === 0) {
							matchFailed("[a-zA-Z0-9_]");
						}
					}
					while (result2 !== null) {
						result1.push(result2);
						if (/^[a-zA-Z0-9_]/.test(input.charAt(pos))) {
							result2 = input.charAt(pos);
							pos++;
						} else {
							result2 = null;
							if (reportFailures === 0) {
								matchFailed("[a-zA-Z0-9_]");
							}
						}
					}
					if (result1 !== null) {
						result0 = [result0, result1];
					} else {
						result0 = null;
						pos = pos1;
					}
				} else {
					result0 = null;
					pos = pos1;
				}
				if (result0 !== null) {
					result0 = (function(offset, first, rest) { return first + rest.join(''); })(pos0, result0[0], result0[1]);
				}
				if (result0 === null) {
					pos = pos0;
				}
				return result0;
			}
			
			function parse_value() {
				var result0, result1, result2;
				var pos0, pos1;
				
				pos0 = pos;
				pos1 = pos;
				if (input.charCodeAt(pos) === 34) {
					result0 = "\"";
					pos++;
				} else {
					result0 = null;
					if (reportFailures === 0) {
						matchFailed("\"\\\"\"");
					}
				}
				if (result0 !== null) {
					result1 = [];
					if (/^[^"]/.test(input.charAt(pos))) {
						result2 = input.charAt(pos);
						pos++;
					} else {
						result2 = null;
						if (reportFailures === 0) {
							matchFailed("[^\"]");
						}
					}
					while (result2 !== null) {
						result1.push(result2);
						if (/^[^"]/.test(input.charAt(pos))) {
							result2 = input.charAt(pos);
							pos++;
						} else {
							result2 = null;
							if (reportFailures === 0) {
								matchFailed("[^\"]");
							}
						}
					}
					if (result1 !== null) {
						if (input.charCodeAt(pos) === 34) {
							result2 = "\"";
							pos++;
						} else {
							result2 = null;
							if (reportFailures === 0) {
								matchFailed("\"\\\"\"");
							}
						}
						if (result2 !== null) {
							result0 = [result0, result1, result2];
						} else {
							result0 = null;
							pos = pos1;
						}
					} else {
						result0 = null;
						pos = pos1;
					}
				} else {
					result0 = null;
					pos = pos1;
				}
				if (result0 !== null) {
					result0 = (function(offset, chars) { return chars.join(''); })(pos0, result0[1]);
				}
				if (result0 === null) {
					pos = pos0;
				}
				if (result0 === null) {
					pos0 = pos;
					pos1 = pos;
					result0 = parse_integer();
					if (result0 !== null) {
						result1 = parse_fraction();
						result1 = result1 !== null ? result1 : "";
						if (result1 !== null) {
							result2 = parse_exponent();
							result2 = result2 !== null ? result2 : "";
							if (result2 !== null) {
								result0 = [result0, result1, result2];
							} else {
								result0 = null;
								pos = pos1;
							}
						} else {
							result0 = null;
							pos = pos1;
						}
					} else {
						result0 = null;
						pos = pos1;
					}
					if (result0 !== null) {
						result0 = (function(offset, i, f, e) { return Number(i + f + e); })(pos0, result0[0], result0[1], result0[2]);
					}
					if (result0 === null) {
						pos = pos0;
					}
					if (result0 === null) {
						pos0 = pos;
						result0 = parse_path();
						if (result0 !== null) {
							result0 = (function(offset, p) { return p; })(pos0, result0);
						}
						if (result0 === null) {
							pos = pos0;
						}
					}
				}
				return result0;
			}
			
			function parse_integer() {
				var result0, result1, result2;
				var pos0, pos1;
				
				pos0 = pos;
				pos1 = pos;
				if (/^[+\-]/.test(input.charAt(pos))) {
					result0 = input.charAt(pos);
					pos++;
				} else {
					result0 = null;
					if (reportFailures === 0) {
						matchFailed("[+\\-]");
					}
				}
				result0 = result0 !== null ? result0 : "";
				if (result0 !== null) {
					if (/^[0-9]/.test(input.charAt(pos))) {
						result2 = input.charAt(pos);
						pos++;
					} else {
						result2 = null;
						if (reportFailures === 0) {
							matchFailed("[0-9]");
						}
					}
					if (result2 !== null) {
						result1 = [];
						while (result2 !== null) {
							result1.push(result2);
							if (/^[0-9]/.test(input.charAt(pos))) {
								result2 = input.charAt(pos);
								pos++;
							} else {
								result2 = null;
								if (reportFailures === 0) {
									matchFailed("[0-9]");
								}
							}
						}
					} else {
						result1 = null;
					}
					if (result1 !== null) {
						result0 = [result0, result1];
					} else {
						result0 = null;
						pos = pos1;
					}
				} else {
					result0 = null;
					pos = pos1;
				}
				if (result0 !== null) {
					result0 = (function(offset, sign, digits) { return sign + digits.join(''); })(pos0, result0[0], result0[1]);
				}
				if (result0 === null) {
					pos = pos0;
				}
				return result0;
			}
			
			function parse_fraction() {
				var result0, result1, result2;
				var pos0, pos1;
				
				pos0 = pos;
				pos1 = pos;
				if (input.charCodeAt(pos) === 46) {
					result0 = ".";
					pos++;
				} else {
					result0 = null;
					if (reportFailures === 0) {
						matchFailed("\".\"");
					}
				}
				if (result0 !== null) {
					result1 = [];
					if (/^[0-9]/.test(input.charAt(pos))) {
						result2 = input.charAt(pos);
						pos++;
					} else {
						result2 = null;
						if (reportFailures === 0) {
							matchFailed("[0-9]");
						}
					}
					while (result2 !== null) {
						result1.push(result2);
						if (/^[0-9]/.test(input.charAt(pos))) {
							result2 = input.charAt(pos);
							pos++;
						} else {
							result2 = null;
							if (reportFailures === 0) {
								matchFailed("[0-9]");
							}
						}
					}
					if (result1 !== null) {
						result0 = [result0, result1];
					} else {
						result0 = null;
						pos = pos1;
					}
				} else {
					result0 = null;
					pos = pos1;
				}
				if (result0 !== null) {
					result0 = (function(offset, digits) { return '.' + digits.join(''); })(pos0, result0[1]);
				}
				if (result0 === null) {
					pos = pos0;
				}
				return result0;
			}
			
			function parse_exponent() {
				var result0, result1, result2, result3;
				var pos0, pos1;
				
				pos0 = pos;
				pos1 = pos;
				if (/^[eE]/.test(input.charAt(pos))) {
					result0 = input.charAt(pos);
					pos++;
				} else {
					result0 = null;
					if (reportFailures === 0) {
						matchFailed("[eE]");
					}
				}
				if (result0 !== null) {
					if (/^[+\-]/.test(input.charAt(pos))) {
						result1 = input.charAt(pos);
						pos++;
					} else {
						result1 = null;
						if (reportFailures === 0) {
							matchFailed("[+\\-]");
						}
					}
					result1 = result1 !== null ? result1 : "";
					if (result1 !== null) {
						if (/^[0-9]/.test(input.charAt(pos))) {
							result3 = input.charAt(pos);
							pos++;
						} else {
							result3 = null;
							if (reportFailures === 0) {
								matchFailed("[0-9]");
							}
						}
						if (result3 !== null) {
							result2 = [];
							while (result3 !== null) {
								result2.push(result3);
								if (/^[0-9]/.test(input.charAt(pos))) {
									result3 = input.charAt(pos);
									pos++;
								} else {
									result3 = null;
									if (reportFailures === 0) {
										matchFailed("[0-9]");
									}
								}
							}
						} else {
							result2 = null;
						}
						if (result2 !== null) {
							result0 = [result0, result1, result2];
						} else {
							result0 = null;
							pos = pos1;
						}
					} else {
						result0 = null;
						pos = pos1;
					}
				} else {
					result0 = null;
					pos = pos1;
				}
				if (result0 !== null) {
					result0 = (function(offset, sign, digits) { return 'e' + sign + digits.join(''); })(pos0, result0[1], result0[2]);
				}
				if (result0 === null) {
					pos = pos0;
				}
				return result0;
			}
			
			function parse_path() {
				var result0, result1, result2, result3, result4;
				var pos0, pos1, pos2, pos3;
				
				pos0 = pos;
				pos1 = pos;
				result0 = parse_name();
				if (result0 !== null) {
					pos2 = pos;
					pos3 = pos;
					if (input.charCodeAt(pos) === 46) {
						result2 = ".";
						pos++;
					} else {
						result2 = null;
						if (reportFailures === 0) {
							matchFailed("\".\"");
						}
					}
					if (result2 !== null) {
						result3 = parse_name();
						if (result3 !== null) {
							result2 = [result2, result3];
						} else {
							result2 = null;
							pos = pos3;
						}
					} else {
						result2 = null;
						pos = pos3;
					}
					if (result2 !== null) {
						result2 = (function(offset, part) { return part; })(pos2, result2[1]);
					}
					if (result2 === null) {
						pos = pos2;
					}
					if (result2 === null) {
						pos2 = pos;
						pos3 = pos;
						if (input.charCodeAt(pos) === 91) {
							result2 = "[";
							pos++;
						} else {
							result2 = null;
							if (reportFailures === 0) {
								matchFailed("\"[\"");
							}
						}
						if (result2 !== null) {
							result3 = parse_index();
							if (result3 !== null) {
								if (input.charCodeAt(pos) === 93) {
									result4 = "]";
									pos++;
								} else {
									result4 = null;
									if (reportFailures === 0) {
										matchFailed("\"]\"");
									}
								}
								if (result4 !== null) {
									result2 = [result2, result3, result4];
								} else {
									result2 = null;
									pos = pos3;
								}
							} else {
								result2 = null;
								pos = pos3;
							}
						} else {
							result2 = null;
							pos = pos3;
						}
						if (result2 !== null) {
							result2 = (function(offset, part) { return part; })(pos2, result2[1]);
						}
						if (result2 === null) {
							pos = pos2;
						}
					}
					if (result2 !== null) {
						result1 = [];
						while (result2 !== null) {
							result1.push(result2);
							pos2 = pos;
							pos3 = pos;
							if (input.charCodeAt(pos) === 46) {
								result2 = ".";
								pos++;
							} else {
								result2 = null;
								if (reportFailures === 0) {
									matchFailed("\".\"");
								}
							}
							if (result2 !== null) {
								result3 = parse_name();
								if (result3 !== null) {
									result2 = [result2, result3];
								} else {
									result2 = null;
									pos = pos3;
								}
							} else {
								result2 = null;
								pos = pos3;
							}
							if (result2 !== null) {
								result2 = (function(offset, part) { return part; })(pos2, result2[1]);
							}
							if (result2 === null) {
								pos = pos2;
							}
							if (result2 === null) {
								pos2 = pos;
								pos3 = pos;
								if (input.charCodeAt(pos) === 91) {
									result2 = "[";
									pos++;
								} else {
									result2 = null;
									if (reportFailures === 0) {
										matchFailed("\"[\"");
									}
								}
								if (result2 !== null) {
									result3 = parse_index();
									if (result3 !== null) {
										if (input.charCodeAt(pos) === 93) {
											result4 = "]";
											pos++;
										} else {
											result4 = null;
											if (reportFailures === 0) {
												matchFailed("\"]\"");
											}
										}
										if (result4 !== null) {
											result2 = [result2, result3, result4];
										} else {
											result2 = null;
											pos = pos3;
										}
									} else {
										result2 = null;
										pos = pos3;
									}
								} else {
									result2 = null;
									pos = pos3;
								}
								if (result2 !== null) {
									result2 = (function(offset, part) { return part; })(pos2, result2[1]);
								}
								if (result2 === null) {
									pos = pos2;
								}
							}
						}
					} else {
						result1 = null;
					}
					if (result1 !== null) {
						result0 = [result0, result1];
					} else {
						result0 = null;
						pos = pos1;
					}
				} else {
					result0 = null;
					pos = pos1;
				}
				if (result0 !== null) {
					result0 = (function(offset, first, rest) { return new Strudel.AST.Expression(Array(first).concat(rest)); })(pos0, result0[0], result0[1]);
				}
				if (result0 === null) {
					pos = pos0;
				}
				if (result0 === null) {
					pos0 = pos;
					result0 = parse_name();
					if (result0 !== null) {
						result0 = (function(offset, first) { return new Strudel.AST.Expression([first]); })(pos0, result0);
					}
					if (result0 === null) {
						pos = pos0;
					}
				}
				return result0;
			}
			
			function parse_name() {
				var result0, result1, result2;
				var pos0, pos1;
				
				pos0 = pos;
				pos1 = pos;
				if (/^[a-zA-Z]/.test(input.charAt(pos))) {
					result0 = input.charAt(pos);
					pos++;
				} else {
					result0 = null;
					if (reportFailures === 0) {
						matchFailed("[a-zA-Z]");
					}
				}
				if (result0 !== null) {
					result1 = [];
					if (/^[a-zA-Z0-9_]/.test(input.charAt(pos))) {
						result2 = input.charAt(pos);
						pos++;
					} else {
						result2 = null;
						if (reportFailures === 0) {
							matchFailed("[a-zA-Z0-9_]");
						}
					}
					while (result2 !== null) {
						result1.push(result2);
						if (/^[a-zA-Z0-9_]/.test(input.charAt(pos))) {
							result2 = input.charAt(pos);
							pos++;
						} else {
							result2 = null;
							if (reportFailures === 0) {
								matchFailed("[a-zA-Z0-9_]");
							}
						}
					}
					if (result1 !== null) {
						result0 = [result0, result1];
					} else {
						result0 = null;
						pos = pos1;
					}
				} else {
					result0 = null;
					pos = pos1;
				}
				if (result0 !== null) {
					result0 = (function(offset, first, rest) { return new Strudel.AST.Name(first + rest.join('')); })(pos0, result0[0], result0[1]);
				}
				if (result0 === null) {
					pos = pos0;
				}
				return result0;
			}
			
			function parse_index() {
				var result0, result1;
				var pos0;
				
				pos0 = pos;
				if (/^[0-9]/.test(input.charAt(pos))) {
					result1 = input.charAt(pos);
					pos++;
				} else {
					result1 = null;
					if (reportFailures === 0) {
						matchFailed("[0-9]");
					}
				}
				if (result1 !== null) {
					result0 = [];
					while (result1 !== null) {
						result0.push(result1);
						if (/^[0-9]/.test(input.charAt(pos))) {
							result1 = input.charAt(pos);
							pos++;
						} else {
							result1 = null;
							if (reportFailures === 0) {
								matchFailed("[0-9]");
							}
						}
					}
				} else {
					result0 = null;
				}
				if (result0 !== null) {
					result0 = (function(offset, digits) { return new Strudel.AST.Index(digits.join('')); })(pos0, result0);
				}
				if (result0 === null) {
					pos = pos0;
				}
				return result0;
			}
			
			function parse_literal() {
				var result0, result1;
				var pos0;
				
				pos0 = pos;
				if (/^[^@]/.test(input.charAt(pos))) {
					result1 = input.charAt(pos);
					pos++;
				} else {
					result1 = null;
					if (reportFailures === 0) {
						matchFailed("[^@]");
					}
				}
				if (result1 !== null) {
					result0 = [];
					while (result1 !== null) {
						result0.push(result1);
						if (/^[^@]/.test(input.charAt(pos))) {
							result1 = input.charAt(pos);
							pos++;
						} else {
							result1 = null;
							if (reportFailures === 0) {
								matchFailed("[^@]");
							}
						}
					}
				} else {
					result0 = null;
				}
				if (result0 !== null) {
					result0 = (function(offset, chars) { return new Strudel.AST.Literal(chars.join('')); })(pos0, result0);
				}
				if (result0 === null) {
					pos = pos0;
				}
				return result0;
			}
			
			
			function cleanupExpected(expected) {
				expected.sort();
				
				var lastExpected = null;
				var cleanExpected = [];
				for (var i = 0; i < expected.length; i++) {
					if (expected[i] !== lastExpected) {
						cleanExpected.push(expected[i]);
						lastExpected = expected[i];
					}
				}
				return cleanExpected;
			}
			
			function computeErrorPosition() {
				/*
				 * The first idea was to use |String.split| to break the input up to the
				 * error position along newlines and derive the line and column from
				 * there. However IE's |split| implementation is so broken that it was
				 * enough to prevent it.
				 */
				
				var line = 1;
				var column = 1;
				var seenCR = false;
				
				for (var i = 0; i < Math.max(pos, rightmostFailuresPos); i++) {
					var ch = input.charAt(i);
					if (ch === "\n") {
						if (!seenCR) { line++; }
						column = 1;
						seenCR = false;
					} else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
						line++;
						column = 1;
						seenCR = true;
					} else {
						column++;
						seenCR = false;
					}
				}
				
				return { line: line, column: column };
			}
			
			
			var result = parseFunctions[startRule]();
			
			/*
			 * The parser is now in one of the following three states:
			 *
			 * 1. The parser successfully parsed the whole input.
			 *
			 *		- |result !== null|
			 *		- |pos === input.length|
			 *		- |rightmostFailuresExpected| may or may not contain something
			 *
			 * 2. The parser successfully parsed only a part of the input.
			 *
			 *		- |result !== null|
			 *		- |pos < input.length|
			 *		- |rightmostFailuresExpected| may or may not contain something
			 *
			 * 3. The parser did not successfully parse any part of the input.
			 *
			 *	 - |result === null|
			 *	 - |pos === 0|
			 *	 - |rightmostFailuresExpected| contains at least one failure
			 *
			 * All code following this comment (including called functions) must
			 * handle these states.
			 */
			if (result === null || pos !== input.length) {
				var offset = Math.max(pos, rightmostFailuresPos);
				var found = offset < input.length ? input.charAt(offset) : null;
				var errorPosition = computeErrorPosition();
				
				throw new this.SyntaxError(
					cleanupExpected(rightmostFailuresExpected),
					found,
					offset,
					errorPosition.line,
					errorPosition.column
				);
			}
			
			return result;
		},
		
		/* Returns the parser source code. */
		toSource: function() { return this._source; }
	};
	
	/* Thrown when a parser encounters a syntax error. */
	
	result.SyntaxError = function(expected, found, offset, line, column) {
		function buildMessage(expected, found) {
			var expectedHumanized, foundHumanized;
			
			switch (expected.length) {
				case 0:
					expectedHumanized = "end of input";
					break;
				case 1:
					expectedHumanized = expected[0];
					break;
				default:
					expectedHumanized = expected.slice(0, expected.length - 1).join(", ")
						+ " or "
						+ expected[expected.length - 1];
			}
			
			foundHumanized = found ? quote(found) : "end of input";
			
			return "Expected " + expectedHumanized + " but " + foundHumanized + " found.";
		}
		
		this.name = "SyntaxError";
		this.expected = expected;
		this.found = found;
		this.message = buildMessage(expected, found);
		this.offset = offset;
		this.line = line;
		this.column = column;
	};
	
	result.SyntaxError.prototype = Error.prototype;
	
	return result;
})();

