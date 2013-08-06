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
	var match = opts.match || /.*/;
	var tarStream = tar.Pack({ noProprietary: true });
	var sourceStream = new stream.PassThrough();
	sourceStream.props = {type: 'Directory'};
	sourceStream.path = root;
	sourceStream.pipe(tarStream, {end: false});
	
	view.instance.output = tarStream;

	var items = win.$(sel).toArray();
	var dirs = {};
	var mangler = opts.mangler || defaultUriMangler;
	
	(function processItem(err) {
		if (err) console.error(err);
		var item = items.shift();
		if (!item) return finish();
		archive(item, match, mangler, root, tarStream, processItem);
	})();

	function finish() {
		tarStream.add(CreateEntry(view.instance.toString(), "index.html", root));
		tarStream.end();
	}
};

function defaultUriMangler(uri, cb) {
	cb(null, uri);
}

function getPathname(uri) {
	var pathname = URL.parse(uri).pathname;
	if (pathname && pathname[0] == '/') pathname = pathname.substring(1);
	return pathname;
}

function request(uri, cb) {
	http.get(uri, function(res) {
		if (res.statusCode < 200 || res.statusCode > 400) return cb(res.statusCode);
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
			cb(null, buf);
		});
	}).on('error', function(err) {
		console.error(err);
		cb(err);
	});
}

function ensureData(obj, cb) {
	if (obj.data) return cb(null, obj);
	if (!obj.uri) return cb(null, obj);
	request(obj.uri, function(err, buf) {
		if (!err && buf) obj.data = buf;
		cb(err, obj);
	});
}


function archive(elem, match, mangler, root, tarStream, done) {
	var src = elem.getAttribute('src');
	var href = elem.getAttribute('href');
	var uri = src || href; // jsdom has window.location, so it should build the absolute url
	if (!uri || !match.test(uri)) return done();
	uri = elem._ownerDocument.parentWindow.resourceLoader.resolve(elem._ownerDocument, uri);

	tarStream.pause();
	function finish(err) {
		tarStream.resume();
		done(err);
	}
	function mcb(err, mangled) {
		if (err) return finish(err);
		if (!Array.isArray(mangled)) mangled = [mangled];
		var count = mangled.length;
		mangled.forEach(function(val, i) {
			if (!val || typeof val == "string") val = {uri: val};
			if (val.uri && !val.path) val.path = getPathname(val.uri);
			if (i == 0) {
				if (!val.uri && !val.href && !val.path) {
					elem.parentNode.removeChild(elem);
				} else {
					if (!val.href) val.href = val.path;
					if (src) elem.setAttribute('src', val.href);
					else if (href) elem.setAttribute('href', val.href);
				}
			}
			ensureData(val, function(err, obj) {
				if (obj.path != null && obj.data != null) tarStream.add(CreateEntry(obj.data, obj.path, root));
				if (--count == 0) finish(err);
			});
		});
	}
	mcb.request = request;
	mangler(uri, mcb);
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
