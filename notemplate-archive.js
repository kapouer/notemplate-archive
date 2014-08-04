var stream = require('stream');
var tar = require('tar');
var mkdirp = require('mkdirp');
var URL = require('url');
var Path = require('path');

module.exports = function(notemplate) {
	notemplate.on('ready', function(view, opts) {
		view.archiveCache = {};
	});
	notemplate.on('request', function(view, method, url, status, response) {
		// cache request and response to be able to quickly tar a file
		if (method != "GET") return;
		view.archiveCache[url] = {status: status, response: response};
	});
	notemplate.on('render', function(view, opts) {
		if (!opts.archive) return;
		var sel = (typeof opts.archive == "string" ? opts.archive : 'link,script,img,xhr')
			.split(',').map(Function.prototype.call, String.prototype.trim);
		var xhr = sel.indexOf('xhr');
		if (xhr >= 0) {
			sel.splice(xhr, 1);
			sel = sel.join(',');
			xhr = true;
		}

		var win = view.instance.window;
		var root = opts.root || Path.dirname(win.location.pathname);
		if (root[0] == '/') root = root.substring(1);
		var index = Path.basename(win.location.pathname);
		var match = opts.match || /.*/;
		var tarStream = opts.archiveStream || tar.Pack({ noProprietary: true });

		view.instance.output = tarStream;

		var items = win.$(sel).toArray();
		if (xhr) {
			for (var url in view.archiveCache) {
				// these elements are not added to the document
				var link = win.document.createElement('link');
				link.setAttribute('href', url);
				items.push(link);
			}
		}
		var dirs = {};
		var mangler = opts.mangler || defaultUriMangler;
		mangler.request = function(uri, cb) {
			var cached = view.archiveCache[uri];
			if (cached) {
				if (cached.status < 200 || cached.status >= 300) {
					cb(cached.status);
				} else {
					cb(null, {uri:uri, data:cached.response});
				}
			}	else {
				request(uri, win, function cbReq(err, data) {
					if (!err) {
						view.archiveCache[uri] = {status: 200, response: data};
					} else {
						if (err) console.error(err);
						var status = parseInt(err);
						if (isNaN(status)) status = 404;
						view.archiveCache[uri] = {status: status, response: data};
					}
					cb(err, data);
				});
			}
		};

		(function processItem(err) {
			if (err) console.error(err);
			var item = items.shift();
			if (!item) return finish();
			archive(item, match, mangler, root, tarStream, processItem);
		})();

		function finish() {
			tarStream.pause();
			appendToStream(tarStream, view.instance.toString(), index, root);
			setImmediate(function() {
				tarStream.resume();
				tarStream.end();
			});
			view.archiveCache = null;
		}
	});
};

function defaultUriMangler(uri, cb) {
	cb(null, uri);
}

function getPathname(uri) {
	var pathname = URL.parse(uri).pathname;
	if (pathname && pathname[0] == '/') pathname = pathname.substring(1);
	return pathname;
}

function request(uri, win, cb) {
	var xhr = new win.XMLHttpRequest();
	xhr.addEventListener('readystatechange', function(e) {
		if (this.readyState == this.DONE) {
			if (this.status < 200 || this.status > 400) return cb(this.status);
			cb(null, new Buffer(new Uint8Array(this.response)));
		}
	});
	try {
		xhr.open("GET", uri);
		xhr.responseType = 'arraybuffer';
		xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
		xhr.send();
	} catch(e) {
		cb(e);
	}
}

function ensureData(obj, requester, cb) {
	if (obj.data) return cb(null, obj);
	if (!obj.uri) return cb(null, obj);
	requester(obj.uri, function(err, buf) {
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
		if (count > 0) mangled.forEach(function(val, i) {
			if (!val || typeof val == "string") val = {uri: val};
			if (val.uri && !val.path) val.path = getPathname(val.uri);
			if (i == 0) {
				if (!val.uri && !val.href && !val.path) {
					if (elem.parentNode) elem.parentNode.removeChild(elem);
				} else {
					if (!val.href) val.href = val.path;
					if (src) elem.setAttribute('src', val.href);
					else if (href) elem.setAttribute('href', val.href);
				}
			}
			ensureData(val, mangler.request, function(err, obj) {
				if (obj.path != null && obj.data != null) appendToStream(tarStream, obj.data, obj.path, root);
				if (i == count - 1) finish(err);
			});
		}); else finish();
	}
	mcb.request = mangler.request;
	mangler(uri, mcb);
}

function appendToStream(wStream, data, path, root) {
	if (typeof wStream.add != "function") {
		wStream.write(data);
		return;
	}
	if (typeof data == "string") {
		// tar only understands buffer.length
		data = new Buffer(data);
	}
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
	wStream.add(entry);
}
