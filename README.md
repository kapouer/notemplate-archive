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
	function(uri, cb) return falsey or string or object or array
	cb.request is a facility for downloading buffered data.
	Allows one to change path and data of each new tar file,
	and to add files to tar stream by returning an array of
	{uri:uri} objects. Those objects can optionally have:
	- path : the path of the file in the tarball, defaults to uri.pathname
	  without leading slash,
	- href : the href set on the node attribute, defaults to path,
	- data : the data is fetched using the uri if data has no value.
	If return value is an object or an array, it will add each entry
	in the tarball.
	The first object of that array is bound to the actual DOM node.
	If this first object is null or its uri, path, and href are falsey,
	the DOM node is removed.
* match
  RegExp, defaults to /.*/
	Only matching url are processed, others are left untouched and not
	included in the archive.
