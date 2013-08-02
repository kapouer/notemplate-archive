notemplate-archive
==================

Middleware for express-notemplate.

Archive an html page rendered by notemplate, along with its js, css, and
other configurable assets, in a tarball stream.
The resulting html page can be loaded locally.

Why ?
-----

Because sometimes we want an automated way to export a complete web page.


Express 3 Setup
---------------

	var notemplate = require('express-notemplate');
	// ...
	notemplate.on('render', require('notemplate-archive'));

This will set view.instance.output to a tar stream.


Usage
-----

	res.render('myview', {archive:true}, function(err, tarstream) {
		res.set('Content-Type', 'application/x-tar');
		res.set('Content-Disposition', 'attachment; filename="mytarball.tar"');
		tarstream.pipe(res);
	});


Parameters
----------

* archive  
  Boolean or String  
  If false, notemplate-archive just returns.  
  If true, defaults to "link, script, img".
* root  
  Root directory for the archive.  
  String. Defaults to current page basename.
* mangler
	function(uri, data) return falsey or string or object or array
	Allows one to change path and data of each new tar file,
	and to add files to tar stream by returning an array of
	{path:p, data:d} objects.
	If return value is falsey it becomes {path: uri.pathname}
	If return value is an object its path and data values can replace
	the original ones.
	If return value is an array, entries with index >= 1 will add new
	files to tar stream.
* match
  RegExp, defaults to /.*/
	Only matching url are processed, others are left untouched and not
	included in the archive.
