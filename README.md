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

