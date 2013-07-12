var stream = require('stream');
var tar = require('tar');
var mkdirp = require('mkdirp');
var URL = require('url');
var Path = require('path');
var http = require('http');

module.exports = function(view, opts) {
	if (!opts.archive) return;
	var sel = typeof opts.archive == "string" ? opts.archive : 'link,script,img';
	var win = view.instance.window;
	var basehref = win.location.href;
	var root = opts.root || Path.basename(basehref, Path.extname(basehref));
	var tarStream = tar.Pack({ noProprietary: true });
	var sourceStream = new stream.PassThrough();
	sourceStream.props = {type: 'Directory'};
	sourceStream.path = root;
	sourceStream.pipe(tarStream, {end: false});
	
	view.instance.output = tarStream;

	var items = win.$(sel).toArray();
	var dirs = {};
	var mangler = opts.mangler || defaultMangler;
	
	(function processItem() {
		var item = items.shift();
		if (!item) return finish();
		archive(item, mangler, root, tarStream, processItem);
	})();

	function finish() {
		tarStream.add(CreateEntry(view.instance.toString(), "index.html", root));
		tarStream.end();
	}
};

function defaultMangler(uri) {
	var pathname = URL.parse(uri).pathname;
	if (pathname && pathname[0] == '/') pathname = pathname.substring(1);
	return pathname;
}


function archive(elem, mangler, root, tarStream, done) {
	var src = elem.getAttribute('src');
	var href = elem.getAttribute('href');
	var uri = src || href; // jsdom has window.location, so it should build the absolute url
	if (!uri) return;
	uri = elem._ownerDocument.parentWindow.resourceLoader.resolve(elem._ownerDocument, uri);
	// the file must be recorded in a local directory
	
	var pathname = mangler(uri);
	if (!pathname && mangler != defaultMangler) pathname = defaultMangler(uri);
	
	if (src) elem.setAttribute('src', pathname);
	else if (href) elem.setAttribute('href', pathname);

	tarStream.pause();
	http.get(uri, function(res) {
		if (res.statusCode < 200 || res.statusCode > 400) return done(res.statusCode);
		var chunks = [];
    var bufLen = 0;
    res.on('data', function(chunk) {
			chunks.push(chunk);
			bufLen += chunk.length;
    });
    res.on('end', function() {
			var buf;
			if (chunks.length) {
				if (Buffer.isBuffer(chunks[0])) {
					buf = new Buffer(bufLen);
          var curLen = 0;
          chunks.forEach(function(chunk) {
            chunk.copy(buf, curLen, 0, chunk.length);
            curLen += chunk.length;
          });
				} else {
					buf = chunks.join('');
				}
			}
			tarStream.add(CreateEntry(buf, pathname, root));
			tarStream.resume();
			done();
		});
	}).on('error', function(err) {
		console.error(err);
		done(err);
	});
}


function CreateEntry(data, path, root) {
	var entry = new stream.Readable();
	var allpushed = false;
	entry._read = function(s) {
		if (allpushed) {
			this.push(null);
		} else {
			this.push(data);
			allpushed = true;
		}
	};
	entry.props = {
		type: "File",
		mode: 0644,
		mtime: Date.now() / 1000,
		size: data.length
	};
	entry.path = Path.join(root, path);
	entry.root = root;
	return entry;
}
