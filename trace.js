/* ===========================================================================
	
	trace.js

	Copyright 2012 John Dunning.  
	fw@johndunning.com
	http://johndunning.com/fireworks

	trace.js is released under the MIT license.

   ======================================================================== */


/*
	First, install the Fireworks Console extension from here:
	http://johndunning.com/fireworks/about/FWConsole

	Then restart Fireworks and open the console panel.

	Install trace.js in a known location, like in the Fireworks/Configuration/Commands 
	folder.  In your script, call runScript to load the trace command:
	
		fw.runScript(fw.appJsCommandsDir + "/trace.js");

	Then add `return trace();` to the functions whose execution you want to trace:

		function myBuggyFunc(count)
		{
			return trace();

			var dom = fw.getDocumentDOM();
			dom.selectAll();
			dom.deleteSelection();

			for (var i = 0; i < count; i++) {
				dom.clipPaste();
				dom.moveSelectionTo({ x: i * 10, y: i * 10 });
			}
		}

		myBuggyFunc();

	See the readme for more information about the parameters that can be
	passed to trace().

	
	To do:
		- maybe have an option to wrap everything in a try/catch and only log
			on exceptions
			return 'try {' + inWholeLine + '} catch (e) { log("' + functionName + 
				'ERROR: ' + inStatement + '"); throw(e); }\n' + logCall;
			problem is, we'd have to understand the block structure of the code
			to not wrap try/catch around just the opening of a for loop, say

		- try tracing a recursive function

		- maybe use watch() to track the watched variables and log only when
			they change

		- should probably pass log in as a parameter to the module 
			would also need a string to supply the name for the function 
			or possibly store a reference to it, then add it to the scope facade

		- make it work with module calls
			function.toString sometimes puts all the statements on one line, 
			so the regex doesn't match anything 
		
		- put watched vars on one line? 
			gets tricky when you have tests and don't want to show anything
			if the test doesn't match 

	Done:
		- make sure returning a function from a function and then tracing the
			returned one has the right scope 

		- escape quotation marks 

		- put logs after if and for/while loops

		- capture the return value and display it

		- call it trace

*/


try { (function() {
	if (typeof log != "function") {
		alert("Before trace() can be called, the Fireworks Console extension must be installed and the panel must be open.  The extension can be downloaded from here:\n\n" + 
			"http://johndunning.com/fireworks/about/FWConsole");
		return;
	}
	
	
	// =======================================================================
	function forEach(obj, iterator, context) {
		if (obj == null) { return; }
		if (obj.length === +obj.length) {
			for (var i = 0, l = obj.length; i < l; i++) {
					// i in obj seems to be false when it's an array extracted
					// from customData
				if (iterator.call(context, obj[i], i, obj) === false) { return; }
			}
		} else {
			for (var key in obj) {
				if (hasOwnProperty.call(obj, key)) {
					if (iterator.call(context, obj[key], key, obj) === false) { return; }
				}
			}
		}
	}


	// =======================================================================
	function map(obj, iterator, context) {
		var	results	= [];
		if (obj	== null) { return results; }

		forEach(obj, function(value, index, list) {
			results[results.length] = iterator.call(context, value, index, list);
		});
		
		return results;
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
	function getScopeFacade(
		inCaller)
	{
		function Facade()
		{
			// this is an empty class that we use just to check whether a scope
			// we encounter is actually a Facade
		}


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
			inScope,
			inFacade)
		{
				// add a getter and setter for every variable in this scope.
				// these functions will get/set the values from/in the scope
				// the var is originally from, rather than the inFacade object.
			for (var name in inScope) {
				inFacade.__defineGetter__(name, createGetter(name, inScope));
				inFacade.__defineSetter__(name, createSetter(name, inScope));
			}
		}


		function walkCallerChain(
			inCaller,
			inFacade)
		{
			var callerScope = inCaller.__parent__;
			
			if (callerScope instanceof Facade) {
					// we've hit a scope that was created by an earlier call to
					// trace().  if we tried to add that scope to our facade,
					// we'd get in an endless loop, so flee!  
				return inFacade;
			} else if (inCaller.caller) {
					// add the variables from the caller's caller's scope first, 
					// in case we shadow some vars that are also defined in the 
					// parent scope
				inFacade = arguments.callee(inCaller.caller, inFacade);
			}
			
				// add the caller's scope to the facade
			addScope(callerScope, inFacade);
			
			return inFacade;
		}


			// we use an empty Facade object to store the scope values so that
			// we can tell we created it, using instanceof.  that way, if the 
			// function we're tracing calls another function that is also
			// traced, we won't get into an infinite loop.  
		var facade = new Facade();

			// first add all the parent scopes from our call chain
		walkCallerChain(inCaller, facade);
		
			// then add the local variables from our call, so that they can 
			// shadow ones in the parent scope, if needed
		addScope(inCaller.__call__, facade);
			
		return facade; 
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
		if (typeof inWatched == "string") {
			inFunctionName = inWatched;
			inWatched = [];
		}

				// we can't call this "caller", because that creates a property
				// called "caller" on our function object, which then overwrites
				// the arguments.callee.caller property.  ffs.
		var callerFunc = arguments.callee.caller,
			callerSource = arguments.callee.caller.toString(),
				// ignore the calling function's name if one was passed in
			functionName = inFunctionName || callerFunc.name,
				// pull out the body and params of the function
			codeMatch = callerSource.match(/function\s+([^(]+)?\(([^)]*)\)\s*\{([\s\S]*)\}/),
			params = codeMatch[2] ? codeMatch[2].split(/\s*,\s*/) : [],
			body = codeMatch[3],
			paramLog,
			watchedVars = "",
			traceMatch;
			
			// add a colon after the function name, if there is one
		functionName = functionName ? functionName + ": " : "";
		
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

			// create a log statement to display the function's parameters.
			// include the function name as the first string in the log call.
		paramLog = [(functionName + "(").quote()].concat(map(params, function(param) {
			return [(param + ":").quote(), param];
		}));
		
			// add the log calls for the watched variables to the end of the
			// param log call, so that the current state of the watched vars is
			// shown as soon as the function is entered
		paramLog.push(")".quote());
		paramLog = 'log(' + paramLog.join(", ") + ');\n' + watchedVars;

		traceMatch = body.match(/return\s+trace\s*\([^)]*\)\s*;/);
		
		if (!traceMatch) {
				// the caller must have set a var to trace and then called us 
				// through that var.  but we can't trace if we can't find the
				// trace call and strip it out.
			alert('A "return trace();" statement could not be found in the calling function. The trace function must be called directly, not through a reference.');
			return;
		}
		
			// start tracing from the statement after the trace() call, and 
			// remove any other calls to trace that happen to be in the function.
			// also, the array returned by match() doesn't have a lastIndex
			// property on it.  ffs.
		body = body.slice(traceMatch.index + traceMatch[0].length);
		body = body.replace(/return\s+trace\s*\([^)]*\)\s*;/g, "");

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
			// it in the caller's scope.  then capture that function's return
			// value, log it, and return it from another anonymous function.
		body = '(function(){ var returnValue = (function(){' + 
			paramLog + body + 
			'})(); log("' + functionName + 'return", returnValue); return returnValue; })();';

			// create a facade object that maps all of the identifiers in the
			// our caller's scope chain to the owning scope, and then eval the 
			// caller's code within that fake scope.  this is where all the 
			// magic happens.
		with (getScopeFacade(callerFunc)) {
			return eval(body);
		}
	}
})(); } catch (exception) {
	if (exception.lineNumber) {
		alert([exception, exception.lineNumber, exception.fileName].join("\n"));
	} else {
		throw exception;
	}
}
