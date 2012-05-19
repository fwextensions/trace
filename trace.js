/* ===========================================================================
	
	trace.js

	Copyright 2012 John Dunning.  
	fw@johndunning.com
	http://johndunning.com/fireworks

	trace.js is released under the MIT license.  See the LICENSE file 
	for details.

   ======================================================================== */


/*
	First, install the Fireworks Console extension from here:
	http://johndunning.com/fireworks/about/FWConsole

	Then restart Fireworks and open the console panel.  Add `return trace(this);` 
	to the functions whose execution you want to trace:

		function myBuggyFunc(count)
		{
			return trace(this);

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
		- add try/catch around eval and alert the error?

		- make sure recursing via arguments.callee works 

		- should probably pass log in as a parameter to the module 
			would also need a string to supply the name for the function 
			or possibly store a reference to it, then add it to the scope facade
			if a function has a local log var, this will break

		- make sure nested calls and calls to a function from one scope that
			calls a function in another work

		- dump the call stack when entering the function being traced?

		- maybe use watch() to track the watched variables and log only when
			they change
			would calling watch() on the facade object work?

		- maybe have an option to wrap everything in a try/catch and only log
			on exceptions
			return 'try {' + inWholeLine + '} catch (e) { log("' + functionName + 
				'ERROR: ' + inStatement + '"); throw(e); }\n' + logCall;
			problem is, we'd have to understand the block structure of the code
			to not wrap try/catch around just the opening of a for loop, say

		- make it work with module calls
			function.toString sometimes puts all the statements on one line, 
			so the regex doesn't match anything 
		
		- put watched vars on one line? 
			gets tricky when you have tests and don't want to show anything
			if the test doesn't match 

	Done:
		- arguments.callee doesn't work, as it's pointing at the anonymous
			function in the eval, not the original caller
			also wouldn't work to set a property on callee, or to recurse

		- treat watch expressions as assertions, show only when false

		- a property on a function shadows a var in the parent scope of the same name
			that's because we were calling walkScopeChain starting from the 
				calling function itself, which added the properties on the 
				function to the facade
			need to start from caller.__parent__

		- accessing the arguments var doesn't work

		- show the whitespace of the statements in the log calls?
			could make the code look more like the original function

		- handle this correctly
			may have to pass it to trace
			return trace(this);
			may need to pass this into anonymous functions in the eval

		- try tracing a recursive function

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
				if (iterator.call(context, obj[key], key, obj) === false) { return; }
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
			prefix = " ";
		
		if (/[<>=]+/.test(test)) {
			return '((' + test + ') ? "" : log("' + inFunctionName + prefix + 
				'ASSERTION FAILED:", ' + test.quote() + '));';
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
				
					// this crazy syntax is valid in the FW JS engine, though it
					// was removed from later versions of the Mozilla engine.
					// it seems to be the only way to make the g/setters
					// enumerable, which is sometimes useful for debugging.  but
					// since this looks like a syntax error to NetBeans, leave
					// it commented out when not needed. 
//				inFacade[name] getter = createGetter(name, inScope);
//				inFacade[name] setter = createSetter(name, inScope);
			}
		}


		function walkScopeChain(
			inScope,
			inFacade)
		{
			if (inScope instanceof Facade) {
					// we've hit a scope that was created by an earlier call to
					// trace().  if we tried to add that scope to our facade,
					// we'd get in an endless loop, so flee!  
				return inFacade;
			} else if (inScope.__parent__ && inScope.__parent__.__parent__) {
					// add the variables from the scope's parent scope first, 
					// in case the scope shadows some vars that are also defined 
					// in the parent scope, but only if the parent isn't the
					// global scope, which should always be accessible
				inFacade = arguments.callee(inScope.__parent__, inFacade);
			}

				// add this scope to the facade
			addScope(inScope, inFacade);
			
			return inFacade;
		}


			// we use an empty Facade object to store the scope values so that
			// we can tell we created it, using instanceof.  that way, if the 
			// function we're tracing calls another function that is also
			// traced, we won't get into an infinite loop.  
		var facade = new Facade();

			// first add all the parent scopes from the caller's scope chain
		walkScopeChain(inCaller.__parent__, facade);

			// then add the local variables from the caller, so that they can 
			// shadow ones in the parent scopes, if needed
		addScope(inCaller.__call__, facade);

		return facade; 
	}

		
	// =======================================================================
	trace = function(
		__CALLER_THIS__,
		inWatched,
		inFunctionName)
	{
		function logStatement(
			inWholeLine,
			inWhitespace,
			inStatement)
		{
				// convert tabs to 2 spaces and get rid of newlines
			inWhitespace = (inWhitespace || "").replace(/\n/g, "").replace(/\t/g, "  ");
			
				// display the function name and statement in the console
			var logCall = 'log(' + (functionName + inWhitespace + inStatement).quote() + ');\n';

				// put the log call before the statement, so that we can see a
				// function call before the code steps into the function.  doing 
				// this would normally break a block of var definitions separated 
				// by commas and a new line, since the regexp would match the
				// last line in the block and stick the log call before it, which
				// breaks the syntax.  but toString on a function puts all var
				// definitions on a single line, as well as a mutli-line object
				// definitions, like var foo = { bar: 42 }.  we want to add the
				// watchedVars after the statement, so that it shows the value
				// of the watched vars after the statement is executed.
			return logCall + inWholeLine + watchedVars;
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
			__CALLER_ARGS__ = callerFunc.arguments,			
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

			// add a log call before each ;\n to display the statement
		body = body.replace(/^(\s*)([^\n]+;)\s*\n/mg, 
			logStatement);

			// add a log call after the opening brace of an if/for/while block.
			// but do so only if there's a space in front of the if, to avoid
			// sticking log calls in the middle of another log call, which can
			// happen with a nested function definition.  FW returns the body of
			// the nested function all on one line when doing toString, so the
			// replace call above will log the whole line.  but then this `if`
			// replace will see if statements inside the log string and replace
			// them, breaking the code.  requiring a space before the keyword
			// won't match in the nested function case, since FW removes all 
			// the whitespace from the function body.
		body = body.replace(/^(\s*)((?:if|for|while)\s*\([^{]+\)\s*\{)/mg, 
			logStatement);

			// override the arguments var with the caller's arguments so that
			// things like arguments.callee correctly point to the caller.  we
			// do this at the very beginning of the function, but after all the
			// statements have been logged, so that this doesn't get logged.
		body = 'arguments = __CALLER_ARGS__;\n' + body;

			// wrap the body in an anonymous function so our caller can execute
			// it in the caller's scope, and apply it to the caller's this value 
			// and arguments.  we have to pass the caller's this and arguments 
			// into the function so that if code in the caller does something 
			// like `arguments.length`, it'll have the appropriate value.  then 
			// capture that function's return value, log it, and return it from 
			// another anonymous function.  we use slightly obscure var names for 
			// this and args so that hopefully, the caller doesn't have anything
			// with the same names in its scope. 
		body = '(function(){ var returnValue = (function(){' + 
			paramLog + body + '}).apply(__CALLER_THIS__, __CALLER_ARGS__); log("' + 
			functionName + 'returns:", returnValue); return returnValue; })();';

			// create a facade object that maps all of the identifiers in the
			// our caller's scope chain to the owning scope, and then eval the 
			// caller's code within that fake scope.  this is where all the 
			// magic happens.
		with (getScopeFacade(callerFunc)) {
			try {
				return eval(body);
			} catch (exception) { 
				if (exception.lineNumber) {
					alert([exception, exception.lineNumber, exception.fileName].join("\n"));
				} else {
						// this is an internal error with a useless error number,
						// so throw it to let FW handle it and show a better message
					throw exception;
				}
			}
		}
	}
})(); } catch (exception) {
	if (exception.lineNumber) {
		alert([exception, exception.lineNumber, exception.fileName].join("\n"));
	} else {
		throw exception;
	}
}
