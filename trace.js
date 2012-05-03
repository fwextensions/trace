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
	To use:
	
	fw.runScript(fw.appJsCommandsDir + "/trace.js");

	function myBuggyFunc(foo, bar, baz)
	{
		return eval(trace(function() {
		
		var dom = fw.getDocumentDOM();
		dom.selectAll();
		dom.deleteSelection();

		}));
	}

	watch variables 
	pass in a name for the function
	if you see an if statement logged, means that branch was entered
	don't pass in the dom
	
	To do:
		- maybe have an option to wrap everything in a try/catch and only log
			on exceptions
			return 'try {' + inWholeLine + '} catch (e) { log("' + functionName + 'ERROR: ' + inStatement + '"); throw(e); }\n' + logCall;
			problem is, we'd have to understand the block structure of the code
			to not wrap try/catch around just the opening of a for loop, say

		- make it work with module calls
			toString sometimes puts all the statements on one line, so the
			regex doesn't match anything 
		
		- put watched vars on one line? 
			gets tricky when you have tests and don't want to show anything
			if the test doesn't match 

	Done:
		- escape quotation marks 

		- put logs after if and for/while loops

		- capture the return value and display it

		- call it trace

*/


try { (function() {
	if (typeof log != "function") {
		alert("Before using the trace() library, the Fireworks Console extension must be installed.  It can be downloaded from here:\n\n" + 
			"http://johndunning.com/fireworks/about/FWConsole");
		return;
	}
	
	
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
	function getScopeChain(
		inCaller)
	{
		function createGetter(
			inName,
			inScope)
		{
			return function()
			{
					// get the value from the scope that contains this variable 
				return inScope[inName];
			}
		}
		
		
		function createSetter(
			inName,
			inScope)
		{
			return function(
				inValue)
			{
					// set the value on the scope that contains this variable 
				inScope[inName] = inValue;
			}
		}


		function addScope(
			inCaller,
			inScope)
		{
			if (inCaller.caller) {
					// add the variables from our caller's scope first, in case
					// we shadow some vars that are also defined in the caller
					// scope
				inScope = addScope(inCaller.caller, inScope);
			}
			
			var callerScope = inCaller.__call__;
			
			for (var name in callerScope) {
				inScope.__defineGetter__(name, createGetter(name, callerScope));
				inScope.__defineSetter__(name, createSetter(name, callerScope));
			}
			
			return inScope;
		}
		
		
		return addScope(inCaller, {});
	}


	// =======================================================================
	function logWatched(
		inExpression,
		inFunctionName)
	{
		inFunctionName = inFunctionName.slice(0, -1);
		
		var test = inExpression,
			prefix = "     ";
		
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
		inFunctionName)
	{
		function logStatement(
			inWholeLine,
			inStatement)
		{
				// display the function name and statement in the console
			var logCall = 'log(' + (functionName + inStatement).quote() + ');\n' + 
				watchedVars;
			
			if (/^(return|continue|break)[\s;]/.test(inStatement)) {
					// since putting a log call after return, continue or break 
					// is pointless, put it before the statement
				return logCall + inWholeLine;
			} else {
					// put the log call after the statement, so that it won't
					// be logged if the statement throws an exception
				return inWholeLine + logCall;
			}
		}


			// adjust the optional parameters 
		if (typeof inWatched == "function") {
			inFunctionName = "";
			inWatched = [];
		}

		if (typeof inWatched == "string") {
			inFunctionName = inWatched;
			inWatched = [];
		}

		if (typeof inFunctionName == "function") {
			inFunctionName = "";
		}
		
				// we can't call this "caller", because that creates a property
				// called "caller" on our function object, which then overwrites
				// the arguments.callee.caller property.  ffs.
		var callerFunc = arguments.callee.caller,
			callerCode = arguments.callee.caller.toString(),
				// pull out the body and params of the function
			codeMatch = callerCode.match(/function\s+([^(]+)?\(([^)]*)\)\s*\{([\s\S]*)\}/),
			body = codeMatch[3],
			params = codeMatch[2] ? codeMatch[2].split(/\s*,\s*/) : [],
				// ignore the calling function's name if one was passed in
			functionName = inFunctionName || callerFunc.name,
				// include the function name as the first string in the log call
				// that lists the params
			paramLog = [functionName.quote(), "(".quote()],
			watchedVars = "",
			wrapper;
			
			// add a colon after the function name, if there is one
		functionName = functionName ? functionName + ": " : "";

			// create a log statement to display the function's parameters
		paramLog = paramLog.concat(map(params, function(param) {
			return [(param + ":").quote(), param];
		}));
		
		paramLog.push(")".quote());
		paramLog = 'log(' + paramLog.join(", ") + ');\n';
		
		if (inWatched) {
			watchedVars = map(inWatched, function(watched) {
					// argh, there's some global native function called "watch"?
					// and we can't shadow it with a local var?  wtf?  ah, it's
					// actually an incredibly useful watch() function to get 
					// callbacks when a property changes.  booyah.
				return logWatched(watched, functionName);
			});
			watchedVars = watchedVars.join("\n") + "\n";
		}
		
// look for return trace and take the body after that call
// so could have some statements that aren't traced before trace()

		body = body.replace(/(return\s+)?trace\(\s*\)\s*;/g, "");

			// add a log call after each ;\n to display the previous statement
		body = body.replace(/^\s*([^\n]+;)\s*\n/mg, 
			logStatement);

			// add a log call after the opening brace of an if/for/while block.
			// but do so only if there's a space in front of the if, to avoid
			// sticking log calls in the middle of another log call, which can
			// happen with a nested function definition.  FW returns the body of
			// the nested function all on one line when doing toString, so the
			// replace call above will log the whole line.  but then this if
			// replace will see if statements inside the log string and replace
			// them, breaking the code.  requiring a space before the keyword
			// won't match in the nested function case, since FW removes all 
			// the whitespace from the function body.
		body = body.replace(/\s((?:if|for|while)\s*\([^{]+\)\s*\{)/g, 
			logStatement);
			
			// wrap the body in an anonymous function so our caller can execute
			// it in the caller's context.  then capture that function's return
			// value, log it, and return it from another anonymous function.
		wrapper = '(function(){ var returnValue = (function(){' + 
			paramLog + body + 
			'})(); log("' + functionName + 'return", returnValue); return returnValue; })();';

		with (getScopeChain(callerFunc)) {
			return eval(wrapper);
		}
	}
})(); } catch (exception) {
	if (exception.lineNumber) {
		alert([exception, exception.lineNumber, exception.fileName].join("\n"));
	} else {
		throw exception;
	}
}
