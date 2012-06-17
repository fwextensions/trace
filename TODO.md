# To do:

- should probably pass log in as a parameter to the module 
	would also need a string to supply the name for the function 
	or possibly store a reference to it, then add it to the scope facade
	if a function has a local log var, this will break

- maybe possible to pass the function to trace and have it be wrapped
	then wouldn't need to call return trace(this) from inside it
	could have untrace() to remove wrapping
	maybe add trace to console and don't have a global?
	or do one-off tracing
		function foo(a) { ... }
		trace(foo)(10);
	lets you do on-demand tracing when certain condition is met
	would probably need to fix up arguments so callee points to the wrapped func
- else if branches aren't handled well
	toString puts a brace between the else and if
- provide way for caller to give trace a different name, in case the local context
	already has something called "trace"
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


# Done:

- add try/catch around eval and alert the error?

- make sure recursing via arguments.callee works 

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
