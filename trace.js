/* ===========================================================================
	
	File: trace

	Author - John Dunning
	Copyright - 2012 John Dunning.  All rights reserved.
	Email - fw@johndunning.com
	Website - http://johndunning.com/fireworks

	Release - 0.1.0 ($Revision: 1.5 $)
	Last update - $Date: 2010/10/24 02:41:36 $

   ======================================================================== */


/*
	To do:
		- escape quotation marks 

		- put logs after if and for/while loops

		- put watched vars on one line? 
			gets tricky when you have tests and don't want to show anything
			if the test doesn't match 

	Done:
		- capture the return value and display it

		- call it trace

*/


try {(function(){
	// =======================================================================
	function forEach(obj, iterator, context) {
		if (obj == null) return;
		if (obj.length === +obj.length) {
			for (var i = 0, l = obj.length; i < l; i++) {
					// i in obj seems to be false when it's an array extracted
					// from customData
				if (iterator.call(context, obj[i], i, obj) === false) return;
			}
		} else {
			for (var key in obj) {
				if (hasOwnProperty.call(obj, key)) {
					if (iterator.call(context, obj[key], key, obj) === false) return;
				}
			}
		}
	}


	// =======================================================================
	function map(obj, iterator, context) {
		var	results	= [];
		if (obj	== null) return	results;

		forEach(obj, function(value, index, list) {
			results[results.length] = iterator.call(context, value, index, list);
		});
		return results;
	}


	// =======================================================================
	function quote(
		inString)
	{
		return '"' + inString + '"';
	}


	// =======================================================================
	function logWatched(
		inExpression,
		inFunctionName)
	{
		inFunctionName = inFunctionName.slice(0, -1);
		
		var test = inExpression,
			prefix = "     ";
//			prefix = " >>> ";
		
		if (/[<>=]+/.test(test)) {
			test = '(' + test + ')';
			return '(' + test + ' ? log("' + inFunctionName + prefix + test + 
				' :", ' + test + ') : "");';
		} else {
			return 'log("' + inFunctionName + prefix + test + ':", ' + test + ');';
		}
	}

		
	// =======================================================================
	trace = function(
		inWatched,
		inFunctionName,
		inFunction)
	{
		if (typeof inWatched == "function") {
			inFunction = inWatched;
			inFunctionName = "";
			inWatched = [];
		}

		if (typeof inWatched == "string") {
			inFunction = inFunctionName;
			inFunctionName = inWatched;
			inWatched = [];
		}

		if (typeof inFunctionName == "function") {
			inFunction = inFunctionName;
			inFunctionName = "";
		}
		
		if (inFunctionName) {
			inFunctionName += ": ";
		}

		if (!inFunction) {
			return "";
		}

		var code = inFunction.toString(),
			codeMatch = code.match(/function\s+([^(]+)?\(([^)]*)\)\s*\{([\s\S]*)\}/),
			body = codeMatch[3],
				// we can't call this "caller", because that creates a property
				// called "caller" on our function object, which then overwrites
				// the arguments.callee.caller property.  ffs.
			callingFunc = arguments.callee.caller.toString(),
			callerMatch = callingFunc.match(/function\s+([^(]+)?\(([^)]*)\)\s*\{[\s\S]*\}/),
			functionName = inFunctionName || 
				(callerMatch[1] ? (callerMatch[1] + ": ") : ""),
			params = callerMatch[2] ? callerMatch[2].split(/\s*,\s*/) : [],
				// slice off the : from the functionName, if any
			paramLog = [quote(functionName.slice(0, -1)), quote("(")],
			watchedVars = "";

			// create a log statement to display the function's parameters
		paramLog = paramLog.concat(map(params, function(param) {
			return [quote(param + ":"), param];
		}));
		
		paramLog.push(quote(")"));
		paramLog = 'log(' + paramLog.join(", ") + ')\n';
		
		if (inWatched) {
			watchedVars = map(inWatched, function(watched) {
					// argh, there's some global native function called "watch"?
					// and we can't shadow it with a local var?  wtf?
				return logWatched(watched, functionName);
			});
			watchedVars = watchedVars.join("\n") + "\n";
		}

			// add a log statement after each ;\n to display the previous line
		body = body.replace(/^\s*([^\/\n]{2}[^\n]+;)\s*\n/mg, 
			function(
				inWholeLine,
				inStatement)
			{
					// escape all the double quotes in the string
				inStatement = inStatement.replace(/"/g, '\\"');
				
				return inWholeLine + 'log("' + functionName + inStatement + '");\n' + 
					watchedVars;
			}
		);

			// wrap the body in an anonymous function so our caller can execute
			// it in the caller's context
		var wrapper = 'log("' + functionName + 'return", (function(){' + paramLog + body + '})());';
//log("wrapper", wrapper);

		return wrapper;
	}
})();} catch (exception) {
	if (exception.lineNumber) {
		alert([exception, exception.lineNumber, exception.fileName].join("\n"));
	} else {
		throw exception;
	}
}
