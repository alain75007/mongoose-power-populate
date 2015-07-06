var get = require('get-object-path');
var set = require('object-path-set');

module.exports = MongoosePlugin;

function MongoosePlugin(mongoose) {
  var Query = mongoose.Query;
  var _exec = Query.prototype.exec;
  var MongoosePromise = mongoose.Promise;

  if (!mongoose._patchedByMongoosePopulate) {
    mongoose._patchedByMongoosePopulate = true;

    Query.prototype.populate = function (paths, opts) {
      this._populate = {
        model: this.model,
        paths: paths,
        opts: opts || {}
      };
      return this;
    };

    Query.prototype.exec = function (op, cb) {
      var opts = this._populate;

      if (!opts) {
        return _exec.call(this, op, cb);
      }

      var promise = new MongoosePromise();

      if (typeof op === 'function') {
        cb = op;
        op = null;
      }

      if (cb) {
        promise.onResolve(cb);
      }

      _exec.call(this, op, function (err, docs) {
        var resolve = promise.resolve.bind(promise);

        if (err || !docs) {
          promise.resolve(err, docs);
        } else {
          populatePaths(opts.paths.split(' '), opts, docs, resolve);
        }
      });

      return promise;
    };
  }

  return function populatePlugin(schema, defaultOpts) {
    defaultOpts = defaultOpts || {};
    schema._defaultPopulateOpts = extend(schema._defaultPopulateOpts || {}, defaultOpts);

    schema.statics.populate = function (docs, paths, options, cb) {
      populatePaths(paths.split(' '), options, docs, cb);
    };
  };
}

function populatePaths(paths, opts, docs, cb) {
  var path = paths.pop();
  var toPopulate = getPathsToPopulate([], path, opts.model, opts);

  populate(toPopulate, docs, function (err) {
    if (err) {
      cb(err);
    }
    else if (paths.length) {
      populatePaths(paths, opts, docs, cb);
    } else {
      cb(err, docs);
    }
  });
}

function getPathsToPopulate(toPopulate, path, model, opts) {
  var db = model.db;
  var defaultOpts = model.schema._defaultPopulateOpts || {};
  var currentPath;
  var previousPath;
  var pathRemainder;

  path.split('.').forEach(function (subpath, i) {
    currentPath = (currentPath ? (currentPath + '.') : '') + subpath;
    previousPath = (previousPath ? (previousPath + '.') : '') + subpath;
    var populateOpts = extend(defaultOpts[currentPath], opts.opts[previousPath]);

    if (populateOpts && populateOpts.ref) {
      populateOpts.ref = db.model(populateOpts.ref);
      populateOpts.model = model;
      populateOpts.path = currentPath;

      toPopulate.push(populateOpts);

      pathRemainder = path.split('.').slice(i + 1).join('.');
      currentPath = '';

      getPathsToPopulate(toPopulate, pathRemainder, populateOpts.ref, opts);
    }
  });

  return toPopulate;
};

function populate(toPopulate, docs, cb) {
  var opts = toPopulate.shift();
  var schema = opts.model.schema;
  var localKey = schema.paths[opts.foreignKey] ? opts.foreignKey : '_id';
  var foreignKey = schema.paths[opts.foreignKey] ? '_id' : opts.foreignKey;
  var modelIndex = {};

  docs.forEach(function (doc) {
    var key = get(doc, localKey);

    if (key) {
      modelIndex[key] = doc;
    }
  });

  var query = {};
  query[foreignKey] = { $in: Object.keys(modelIndex) };

  if (opts.query) {
    Object.keys(opts.query).forEach(function (key) {
      query[key] = opts.query[key];
    });
  }

  var cursor = opts.ref.find(query);

  if (opts.select) {
    cursor.select(opts.select);
  }

  cursor.exec(function (err, subdocs) {
    if (err) return cb(err);

    modelIndex = {};

    subdocs.forEach(function (subdoc) {
      if (!modelIndex[subdoc[foreignKey]]) {
        modelIndex[subdoc[foreignKey]] = [];
      }
      modelIndex[subdoc[foreignKey]].push(subdoc);
    });

    docs.forEach(function (doc) {
      var subdocs = modelIndex[doc[localKey]];
      set(doc, opts.path, subdocs ? (opts.singular ? subdocs[0] : subdocs) : null);
    });

    if (toPopulate.length) {
      populate(toPopulate, subdocs, cb);
    } else {
      cb();
    }
  });
}

function extend(a, b) {
  a = a || {};
  b = b || {};

  Object.keys(b).forEach(function (key) {
    if (typeof b[key] === 'object') {
      a[key] = extend(a[key] || {}, b[key]);
    } else {
      a[key] = b[key];
    }
  });

  return a;
}
