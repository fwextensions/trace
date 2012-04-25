/* ===========================================================================
	
	File: debug

	Author - John Dunning
	Copyright - 2012 John Dunning.  All rights reserved.
	Email - fw@johndunning.com
	Website - http://johndunning.com/fireworks

	Release - 0.1.0 ($Revision: 1.5 $)
	Last update - $Date: 2010/10/24 02:41:36 $

   ======================================================================== */


/*
	To do:
		- call it trace

		- capture the return value and display it
*/


try {(function(){
	debug = function(
		inWatches,
		inFunction)
	{
		function quote(
			inString)
		{
			return '"' + inString + '"';
		}
		
		if (typeof inWatches == "function") {
			inFunction = inWatches;
			inWatches = [];
		}
		
		if (!inFunction) {
			return;
		}
		
//log("caller", arguments.callee.caller.toString());
//log("caller", arguments.callee.caller + "");

		var code = inFunction.toString(),
			codeMatch = code.match(/function\s+([^(]+)?\(([^)]*)\)\s*\{([\s\S]*)\}/),
			body = codeMatch[3],
				// we can't call this "caller", because that creates a property
				// called "caller" on our function object, which then overwrites
				// the arguments.callee.caller property.  ffs.
			callingFunc = arguments.callee.caller.toString(),
			callerMatch = callingFunc.match(/function\s+([^(]+)?\(([^)]*)\)\s*\{[\s\S]*\}/),
			functionName = callerMatch[1] ? (callerMatch[1] + ": ") : "",
			params = callerMatch[2] ? callerMatch[2].split(/\s*,\s*/) : [],
				// slice off the : from the functionName, if any
			paramLog = [quote(functionName.slice(0, -1)), quote("(")];

		for (var i = 0; i < params.length; i++) {
			var param = params[i];
			
			paramLog.push(quote(param + ":"), param);
		}
		
			// create a log statement for the function's parameters
		paramLog.push(quote(")"));
		paramLog = 'log(' + paramLog.join(", ") + ')\n';

		body = body.replace(/^\s*([^\/\n]{2}[^\n]+);\s*\n/mg, 
			function(
				inWholeLine,
				inStatement)
			{
				return inWholeLine + 'log("' + functionName + inStatement + '");\n';
			}
		);

//		body = 'log("calling ' + functionName + '");\n + body';
		
		var wrapper = "(function(){" + paramLog + body + "})();";
//		var wrapper = "(function(" + params.join(", ") + "){" + body + "}).apply(this, arguments);";
//		var wrapper = "Function('" + params.join("', '") + "').apply(this, arguments);";
log(wrapper);

		return wrapper;
		
		
//		return "eval(" + wrapper + ")";
		
		return function()
		{
//			with (this) {
//				var result = eval(wrapper);
//			};
//			return result;
			return eval(wrapper);
//			return arguments.callee.caller.eval(wrapper);
		};
		
//log(params);
		return Function.constructor.apply(Function, params);
	}
})();} catch (exception) {
	if (exception.lineNumber) {
		alert([exception, exception.lineNumber, exception.fileName].join("\n"));
	} else {
		throw exception;
	}
}
