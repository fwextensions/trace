Writing extensions for Fireworks is fun when everything works, but can be extremely painful when it doesn’t.  Unlike modern browsers, the JavaScript engine in Fireworks does not include a debugger.  So when an error occurs, Fireworks just displays a dialog saying “An error occurred”, with no information about what the error is or where it might be.  Thanks!

Another of my [Fireworks Cookbook articles](http://cookbooks.adobe.com/post_Enable_better_error_handling_for_Fireworks_command-16400.html) explains how to get better error reporting when you have exceptions caused by buggy JavaScript.  If your code is doing something like accessing an undeclared variable or trying to call a function that doesn’t exist, the exception thrown by the JS engine includes the path to the .jsf file containing the error and the line on which it occurred.  This information makes it a lot easier to find the bug.

But what if the problem is with how you’re using the Fireworks API itself?  Fireworks may tell you that “A parameter was incorrect”, but it doesn’t give you get the line number containing the incorrect parameter.  So you have to stick `alert()` calls at multiple points in your code to see how far your script gets.  If you have a lot of code (some of my extensions have a few thousand lines), this can be seriously tedious.  Using my [Fireworks Console](http://johndunning.com/fireworks/about/FWConsole) extension helps somewhat, since you can see messages getting dumped to the console instead of dismissing dozens of alerts.  But inserting all the log calls (and removing them when you’re done) is still a real pain.

The `trace()` library makes this whole process much easier.  


## Installing trace

You can download the `trace.js` file from here: 

You will also need to download and install my Fireworks Console: <http://johndunning.com/fireworks/about/FWConsole>  

The console provides a global `log()` function, which `trace()` uses to display strings in the console. 

You can install the trace.js file anywhere, but putting it at the top level of the Fireworks Commands directory is probably simplest: `C:\Program Files (x86)\Adobe\Adobe Fireworks CS5.1\Configuration\Commands`

Now imagine you’ve written the following (not very useful) script:

	function myBuggyFunc(count)
	{
		var dom = fw.getDocumentDOM();
		dom.selectAll();
		dom.clipCopy();
		dom.deleteSelection();
		
		for (var i = 0; i < count; i++) {
			dom.clipPaste();
			dom.moveSelectionTo({ x: i * 10, y: i * 10 });
		}
	}

	myBuggyFunc();

It’s supposed to select everything on the current state, copy it, delete it, then paste it multiple times, each time positioning the copy 10px away from the previous copy (like I said, not terribly useful).  When you run the code, Fireworks just says “Could not run the script. A parameter was incorrect”.  But which API call is wrong?

Instead of manually adding `log()` calls to the code, we’ll use the trace library to do it for us.  First, load the global `trace()` function by calling `runScript()` at the top of your .jsf file:

	fw.runScript(fw.appJsCommandsDir + "/trace.js");

Adjust the path if you’ve installed the trace.js file somewhere else.  

Then add `return trace();` at the top of the function you want to trace.  In our example, it would look like this:

	function myBuggyFunc(count)
	{
		return trace();
		
		var dom = fw.getDocumentDOM();
		dom.selectAll();
		dom.clipCopy();
		dom.deleteSelection();
		
		for (var i = 0; i < count; i++) {
			dom.clipPaste();
			dom.moveSelectionTo({ x: i * 10, y: i * 10 });
		}
	}

	myBuggyFunc();

I’ll explain how that line works later, but for now, just try running your script.  You should see the following lines in the console:

	>>> myBuggyFunc: ( count: undefined )
	>>> myBuggyFunc: var dom = fw.getDocumentDOM();
	>>> myBuggyFunc: dom.selectAll();
	>>> myBuggyFunc: dom.clipCopy();

Each line of the trace is prefixed with the name of the function you’re tracing.  The first line shows the function’s parameters and the values that were passed in.  The count parameter obviously shouldn’t be undefined, so that’s one problem we need to fix.  

After the parameter list, each line in the console displays one line of code from the function.  You can see that the last line that successfully executed was `dom.clipCopy()`.  That means there’s likely a problem with the next line, `dom.deleteSelection()`.  The [Extending Fireworks](http://help.adobe.com/en_US/fireworks/cs/extend/WS5b3ccc516d4fbf351e63e3d1183c94856c-7e3f.html) docs say that `deleteSelection()` has a `bFillDeletedArea` parameter which is ignored if Fireworks is not in bitmap editing mode.  Unfortunately, it’s still required, even if it’s being ignored.  (A lot of Fireworks API calls are like that.)

So let’s pass `false` to `deleteSelection()` and re-run the command.  The output should now look like this:

	>>> myBuggyFunc: ( count: undefined )
	>>> myBuggyFunc: var dom = fw.getDocumentDOM();
	>>> myBuggyFunc: dom.selectAll();
	>>> myBuggyFunc: dom.clipCopy();
	>>> myBuggyFunc: dom.deleteSelection(false);
	>>> myBuggyFunc: return undefined

So now we’re getting past the `deleteSelection()` line, but seem to be going right to the end of the function.  The `trace()` call shows that the function is returning `undefined`.  That just means it doesn’t have an explicit `return` statement, which is fine.

We need to pass something in the `count` parameter to get the for-loop started.  Let’s change the code to look like this:

	function myBuggyFunc(count)
	{
		return trace();
		
		var dom = fw.getDocumentDOM();
		dom.selectAll();
		dom.clipCopy();
		dom.deleteSelection(false);
		
		for (var i = 0; i < count; i++) {
			dom.clipPaste();
			dom.moveSelectionTo({ x: i * 10, y: i * 10 });
		}
	}
	
	myBuggyFunc(3);

Now the console should look like this:

	>>> myBuggyFunc: ( count: 3 )
	>>> myBuggyFunc: var dom = fw.getDocumentDOM();
	>>> myBuggyFunc: dom.selectAll();
	>>> myBuggyFunc: dom.clipCopy();
	>>> myBuggyFunc: dom.deleteSelection(false);
	>>> myBuggyFunc: for (var i = 0; i < count; i++) {
	>>> myBuggyFunc: dom.clipPaste();

At least we can sees that we’re stepping into the for-loop now, and that the `clipPaste()` call works.  But there seems to be a problem with `moveSelectionTo()`.  That function requires two additional parameters, besides the location to which you’re moving the selection.  So let’s pass `false` for those parameters:

	function myBuggyFunc(count)
	{
		return trace();
		
		var dom = fw.getDocumentDOM();
		dom.selectAll();
		dom.clipCopy();
		dom.deleteSelection(false);
		
		for (var i = 0; i < count; i++) {
			dom.clipPaste();
			dom.moveSelectionTo({ x: i * 10, y: i * 10 }, false, false);
		}
	}
	
	myBuggyFunc(3);

Now the console trace will show that every line is executing correctly:

	>>> myBuggyFunc: ( count: 3 )
	>>> myBuggyFunc: var dom = fw.getDocumentDOM();
	>>> myBuggyFunc: dom.selectAll();
	>>> myBuggyFunc: dom.clipCopy();
	>>> myBuggyFunc: dom.deleteSelection(false);
	>>> myBuggyFunc: for (var i = 0; i < count; i++) {
	>>> myBuggyFunc: dom.clipPaste();
	>>> myBuggyFunc: dom.moveSelectionTo({x:i * 10, y:i * 10}, false, false);
	>>> myBuggyFunc: for (var i = 0; i < count; i++) {
	>>> myBuggyFunc: dom.clipPaste();
	>>> myBuggyFunc: dom.moveSelectionTo({x:i * 10, y:i * 10}, false, false);
	>>> myBuggyFunc: for (var i = 0; i < count; i++) {
	>>> myBuggyFunc: dom.clipPaste();
	>>> myBuggyFunc: dom.moveSelectionTo({x:i * 10, y:i * 10}, false, false);
	>>> myBuggyFunc: return undefined

We can see that the loop executes 3 times, which corresponds to the count value that we passed in.

Once you’ve figured out where the bug is, you can remove the tracing by just deleting the line you added to the top of the function.  You should also remove the `runScript()` call that adds the trace library, since the users of your extension probably won’t have that .js file installed.  


## Watching variables and properties 

Besides tracing each line, you can also watch variables change as your code executes; just pass an array of strings to the `trace()` call.  Each string is evaluated after every line of code, and its current result is displayed indented under the line.  For instance, if you changed the `trace()` call in `myBuggyFunc()` to this:

	return trace(["i"]);

Then the trace output would look like this:

	>>> myBuggyFunc: ( count: 3 )
	>>> myBuggyFunc: var dom = fw.getDocumentDOM();
	>>> myBuggyFunc:     i: undefined
	>>> myBuggyFunc: dom.selectAll();
	>>> myBuggyFunc:     i: undefined
	>>> myBuggyFunc: dom.clipCopy();
	>>> myBuggyFunc:     i: undefined
	>>> myBuggyFunc: dom.deleteSelection(false);
	>>> myBuggyFunc:     i: undefined
	>>> myBuggyFunc: for (var i = 0; i < count; i++) {
	>>> myBuggyFunc:     i: 0
	>>> myBuggyFunc: dom.clipPaste();
	>>> myBuggyFunc:     i: 0
	>>> myBuggyFunc: dom.moveSelectionTo({x:i * 10, y:i * 10}, false, false);
	>>> myBuggyFunc:     i: 0
	>>> myBuggyFunc: for (var i = 0; i < count; i++) {
	>>> myBuggyFunc:     i: 1
	...

You can see that the variable `i` starts out undefined, then increments as the script iterates through the loop.

The watch strings can also contain references to object properties: 

	return trace(["fw.selection.length"]);

That will let you see the number of selected elements change as the code executes:

	>>> myBuggyFunc: ( count: 3 )
	>>> myBuggyFunc: var dom = fw.getDocumentDOM();
	>>> myBuggyFunc:     fw.selection.length: 0
	>>> myBuggyFunc: dom.selectAll();
	>>> myBuggyFunc:     fw.selection.length: 3
	>>> myBuggyFunc: dom.clipCopy();
	>>> myBuggyFunc:     fw.selection.length: 3
	>>> myBuggyFunc: dom.deleteSelection(false);
	>>> myBuggyFunc:     fw.selection.length: 0
	...

If the watch string contains an expression, it will be displayed only when it evaluates to true.  This can help cut down on the noise in the trace output by showing only when a variable hits a certain value:

	return trace(["fw.selection.length > 0"]);

This will display a message when there’s something selected on the canvas.  It shows up after the `selectAll()` call, but goes away when `deleteSelection()` removes the selected elements:

	>>> myBuggyFunc: ( count: 3 )
	>>> myBuggyFunc: var dom = fw.getDocumentDOM();
	>>> myBuggyFunc: dom.selectAll();
	>>> myBuggyFunc:     (fw.selection.length > 0) : true
	>>> myBuggyFunc: dom.clipCopy();
	>>> myBuggyFunc:     (fw.selection.length > 0) : true
	>>> myBuggyFunc: dom.deleteSelection(false);
	>>> myBuggyFunc: for (var i = 0; i < count; i++) {
	...


## Displaying the executing function’s name

The `trace()` call can figure out the calling function’s name only if it is declared with a name, like `function foo() {...}`.  If the function is assigned to an object property, however, it won’t have a name.  This code:

	var obj = {
		myBuggyFunc: function(count)
		{
			return trace();
			...
		}
	};
	
	obj.myBuggyFunc(3);

will output a trace like this: 

	>>> ( count: 3 )
	>>> var dom = fw.getDocumentDOM();
	>>> dom.selectAll();
	>>> dom.clipCopy();

If you’d like a function name to appear (maybe you’re tracing two different functions at once), you can pass a string to `trace()` that will be displayed at the beginning of each line:

	var obj = {
		myBuggyFunc: function(count)
		{
			return trace("my method");
 			...

This will show `my method` in the trace:

	>>> my method: ( count: 3 )
	>>> my method: var dom = fw.getDocumentDOM();
	>>> my method: dom.selectAll();
	>>> my method: dom.clipCopy();

The function name string should come after the array of watch expressions, if any.


## Limitations 

While the trace library can make debugging Fireworks code a lot less painful, it does have a number of limitations.  One is that the only statements it will trace are those that end with a semicolon followed by a newline.  So if you have a series of variable definitions separated by commas, the trace will appear only after the last one in the list.  (Note that even if you don’t have semicolons in your source code, the function’s `toString()` method will insert them automatically.)

Another limitation is that if your code contains property names that have to be quoted, adding the trace call will break your code.  For instance, if your function contains something like this:

	var o = {
		"foo bar": 42
	};

you’ll get an error like “missing : after property id”.  This is because `trace()` calls `toString()` on the function you pass to it, and the ancient JS engine in Fireworks doesn’t handle these property names correctly.  It returns `var o = {foo bar:42};` for that code, which is obviously wrong.  There’s no way to work around this, unfortunately, other than by commenting out such properties while you’re debugging.  


## How `trace()` works

It’s not necessary to know how `trace()` does its magic in order to use it, but if you’re interested in the arcane minutiae of the Fireworks JavaScript interpreter, read on.

Let’s take a look at that `return trace();` line we added to the function to enable tracing.  The `return` is needed to avoid executing your code twice.  Since `trace()` extracts your function’s code and executes it itself, the code would execute again if you didn’t immediately exit the function after `trace()` returns.  `trace()` will show an error dialog and exit if it can’t find the `return trace();` call in your code.

To get access to your function’s code, the trace function uses the little-known `arguments.callee.caller` property.  This refers to the current function’s caller.  Calling `.toString()` on this reference turns it back into source code.  Unfortunately, the translation in the Fireworks JS engine isn’t isomorphic with the original source.  Comments are removed, semicolons and braces are added, whitespace is sometimes stripped, and quoted property names are broken, as described above.  So there’s no way to map the traced lines directly back to the ones in your source code.  

Once it has the source string, `trace()` uses a pretty simple-minded regular expression to find lines that end in a semicolon and a newline.  The assumption is that it’s safe to insert a logging call after that newline.  Obviously, that’s not always true.  For instance, if you format a for loop with a newline after any of the semicolons in the loop header, then `trace()` will break your code.  It seems to work well enough most of the time, but feel free to fork the library on github and make improvements.  (A more rigorous solution would be to parse the code into a tree, walk the tree to insert log calls at the appropriate locations, then turn the abstract syntax tree back into code.  I might try tackling that at some point, but for now, regexes seemed better than nothing.)

`trace()` also looks for the opening braces of if and loop statements, and then inserts a log call after the brace.  This lets you see when the execution enters one of those blocks. 

To get your function’s return value, this code string containing the original statements and the log calls is wrapped in an anonymous function.  The return from that function is saved, logged to the console, and then returned from another function wrapped around the inner one.  Finally, this long string is passed to `eval()` to be executed. 

If you’ve ever used `eval()` to execute complicated code, you’ll know that the code is executed in the current function’s context, or sometimes in the global context, depending on how it’s called.  But `trace()` needs to evaluate the calling function’s code in the caller’s context, not its own.  For instance, if the trace call is watching a local variable, it needs to get that variable’s current value, which is normally accessible only to the function that declared it.  

Accomplishing this took some spelunking into the source code for the Fireworks JS engine, which is installed along with the app into `Adobe Fireworks\Configuration\Third Party Source Code\JavaScript Interpreter`.  Fireworks appears to be using version 1.5.0 of the Mozilla engine, which offers a number of interesting features, including getters/setters and access to function contexts via the `__call__` and `__parent__` objects.  Without these obscure features, the `trace()` function wouldn’t be possible in its current form.  

(In fact, an earlier version required that the body of the function to be traced was wrapped in an anonymous function, which was passed to `trace()`, which then returned the string of code, which the calling function then had to pass to `eval()`.  It required adding `return eval(trace(function() { ... }));` to your function, which was pretty ugly.)

To calculate the correct context in which to evaluate your function’s code, `trace()` follows the call chain back until it finds the start of the script.  Then, it walks back down the chain, examining each function call’s __parent__ context.  It adds every property in that context to a single “façade” object that represents your function’s context.  But it can’t simply copy the value to the façade.  Consider this code:

	(function() {
		var foo = 0;
		
		function bar(x)
		{
			return trace(["foo"]);
			
			foo += x;
		}
		
		bar(10);
		log(foo); // ==> 10
	})();

The `bar()` function that is being traced updates the `foo` variable, which is declared in its containing scope.  After `bar()` completes, `foo` should be `10`.  But if the value was only getting changed on the façade object, then the actual `foo` variable in the outer scope wouldn’t change.

To get around this, a getter and setter are created for each property on the façade.  The getter gets the underlying value from the original scope, and the setter sets the value back to that same scope.  The façade object is basically an invisible pass-through to all of the scopes in the call chain.  `trace()` walks down the call chain from the outer to the inner one so that variables in an inner scope will replace ones with the same name in an outer scope, which is normal JavaScript semantics.  

When the scope of the function that’s being traced is reached, that function’s `__call__` property is also added to the façade.  The `__call__` object contains all of the local variables and parameters of a particular function call, so it’s obviously a key part of the context needed to correctly evaluate your code.

(As an aside, it’s sort of mind-blogging that the `__call__` object is actually mutable.  Consider this code:

	(function() {
		function foo()
		{
			bar();
			log(baz);
		}
		
		function bar()
		{
			arguments.callee.caller.__call__.baz = "hello, foo";
		}
		
		foo(); // ==> hello, foo
	})();

Wheeeeee!)

Once the façade object contains the full context of the function that’s being traced, it’s used in a `with` block that consists of a call to `eval()`, which is what executes the code:

	with (getScopeFacade(callerFunc)) {
		return eval(body);
	}

That’s a whole lot of ugly right there.  `callerFunc` is the function that called `trace()`, and `body` is the string of statements and `log()` calls that’s been built up by examining `callerFunc.toString()`.

When the code from your function is executed by `eval` and tries to access a local variable, the façade object is checked first, since it provides the context for the `with` block.  And since the façade contains the complete context for the function, the correct value is returned.

So, to review, the nasty bits of JavaScript that make `trace()` possible include:

* `eval`
* `with`
* `__parent__`
* `__call__`

While there are many disadvantages to Macromedia and Adobe having seemingly never updated the Fireworks JS engine since 1998, one advantage is that even though Mozilla has removed `__parent__` and `__call__` from later versions of [SpiderMonkey](https://developer.mozilla.org/en/JavaScript/Reference/Deprecated_and_obsolete_features), they live on in Fireworks, which makes the lack of a proper debugger a little more bearable.   

Anyway, I hope you’ve found this investigation into the nether regions of JavaScript enlightening, and that `trace()` saves you some head-scratching when debugging your Fireworks extensions.
