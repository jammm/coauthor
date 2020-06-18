// Generated by CoffeeScript 1.12.7
var dicer, express, fs, grid, gridLocks, mongodb, path,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

import share from './share.js';

mongodb = Npm.require('mongodb');

grid = Npm.require('gridfs-locking-stream');

gridLocks = Npm.require('gridfs-locks');

fs = Npm.require('fs');

path = Npm.require('path');

dicer = Npm.require('dicer');

express = Npm.require('express');

FileCollection = (function(superClass) {
  extend(FileCollection, superClass);

  function FileCollection(root, options) {
    var indexOptions, ref, ref1, ref2, ref3, ref4, ref5, ref6, ref7, ref8, self;
    this.root = root != null ? root : share.defaultRoot;
    if (options == null) {
      options = {};
    }
    if (!(this instanceof FileCollection)) {
      return new FileCollection(this.root, options);
    }
    if (!(this instanceof Mongo.Collection)) {
      throw new Meteor.Error('The global definition of Mongo.Collection has changed since the file-collection package was loaded. Please ensure that any packages that redefine Mongo.Collection are loaded before file-collection.');
    }
    if (Mongo.Collection !== Mongo.Collection.prototype.constructor) {
      throw new Meteor.Error('The global definition of Mongo.Collection has been patched by another package, and the prototype constructor has been left in an inconsistent state. Please see this link for a workaround: https://github.com/vsivsi/meteor-file-sample-app/issues/2#issuecomment-120780592');
    }
    if (typeof this.root === 'object') {
      options = this.root;
      this.root = share.defaultRoot;
    }
    this.chunkSize = (ref = options.chunkSize) != null ? ref : share.defaultChunkSize;
    this.db = Meteor.wrapAsync(mongodb.MongoClient.connect)(process.env.MONGO_URL, {}).db();
    this.lockOptions = {
      timeOut: (ref1 = (ref2 = options.locks) != null ? ref2.timeOut : void 0) != null ? ref1 : 360,
      lockExpiration: (ref3 = (ref4 = options.locks) != null ? ref4.lockExpiration : void 0) != null ? ref3 : 90,
      pollingInterval: (ref5 = (ref6 = options.locks) != null ? ref6.pollingInterval : void 0) != null ? ref5 : 5
    };
    this.locks = gridLocks.LockCollection(this.db, {
      root: this.root,
      timeOut: this.lockOptions.timeOut,
      lockExpiration: this.lockOptions.lockExpiration,
      pollingInterval: this.lockOptions.pollingInterval
    });
    this.gfs = new grid(this.db, mongodb, this.root);
    this.baseURL = (ref7 = options.baseURL) != null ? ref7 : "/gridfs/" + this.root;
    if (options.resumable || options.http) {
      share.setupHttpAccess.bind(this)(options);
    }
    this.allows = {
      read: [],
      insert: [],
      write: [],
      remove: []
    };
    this.denys = {
      read: [],
      insert: [],
      write: [],
      remove: []
    };
    FileCollection.__super__.constructor.call(this, this.root + '.files', {
      idGeneration: 'MONGO'
    });
    if (options.resumable) {
      indexOptions = {};
      if (typeof options.resumableIndexName === 'string') {
        indexOptions.name = options.resumableIndexName;
      }
      this.db.collection(this.root + ".files").ensureIndex({
        'metadata._Resumable.resumableIdentifier': 1,
        'metadata._Resumable.resumableChunkNumber': 1,
        length: 1
      }, indexOptions);
    }
    this.maxUploadSize = (ref8 = options.maxUploadSize) != null ? ref8 : -1;
    FileCollection.__super__.allow.bind(this)({
      insert: (function(_this) {
        return function(userId, file) {
          return true;
        };
      })(this),
      remove: (function(_this) {
        return function(userId, file) {
          return true;
        };
      })(this)
    });
    FileCollection.__super__.deny.bind(this)({
      insert: (function(_this) {
        return function(userId, file) {
          check(file, {
            _id: Mongo.ObjectID,
            length: Match.Where(function(x) {
              check(x, Match.Integer);
              return x === 0;
            }),
            md5: Match.Where(function(x) {
              check(x, String);
              return x === 'd41d8cd98f00b204e9800998ecf8427e';
            }),
            uploadDate: Date,
            chunkSize: Match.Where(function(x) {
              check(x, Match.Integer);
              return x === _this.chunkSize;
            }),
            filename: String,
            contentType: String,
            aliases: [String],
            metadata: Object
          });
          if (file.chunkSize !== _this.chunkSize) {
            console.warn("Invalid chunksize");
            return true;
          }
          if (share.check_allow_deny.bind(_this)('insert', userId, file)) {
            return false;
          }
          return true;
        };
      })(this),
      update: (function(_this) {
        return function(userId, file, fields) {
          return true;
        };
      })(this),
      remove: (function(_this) {
        return function(userId, file) {
          return true;
        };
      })(this)
    });
    self = this;
    Meteor.server.method_handlers[this._prefix + "remove"] = function(selector) {
      var cursor, file;
      check(selector, Object);
      if (!LocalCollection._selectorIsIdPerhapsAsObject(selector)) {
        throw new Meteor.Error(403, "Not permitted. Untrusted code may only remove documents by ID.");
      }
      cursor = self.find(selector);
      if (cursor.count() > 1) {
        throw new Meteor.Error(500, "Remote remove selector targets multiple files.\nSee https://github.com/vsivsi/meteor-file-collection/issues/152#issuecomment-278824127");
      }
      file = cursor.fetch()[0];
      if (file) {
        if (share.check_allow_deny.bind(self)('remove', this.userId, file)) {
          return self.remove(file);
        } else {
          throw new Meteor.Error(403, "Access denied");
        }
      } else {
        return 0;
      }
    };
  }

  FileCollection.prototype.allow = function(allowOptions) {
    var func, results, type;
    results = [];
    for (type in allowOptions) {
      func = allowOptions[type];
      if (!(type in this.allows)) {
        throw new Meteor.Error("Unrecognized allow rule type '" + type + "'.");
      }
      if (typeof func !== 'function') {
        throw new Meteor.Error("Allow rule " + type + " must be a valid function.");
      }
      results.push(this.allows[type].push(func));
    }
    return results;
  };

  FileCollection.prototype.deny = function(denyOptions) {
    var func, results, type;
    results = [];
    for (type in denyOptions) {
      func = denyOptions[type];
      if (!(type in this.denys)) {
        throw new Meteor.Error("Unrecognized deny rule type '" + type + "'.");
      }
      if (typeof func !== 'function') {
        throw new Meteor.Error("Deny rule " + type + " must be a valid function.");
      }
      results.push(this.denys[type].push(func));
    }
    return results;
  };

  FileCollection.prototype.insert = function(file, callback) {
    if (file == null) {
      file = {};
    }
    if (callback == null) {
      callback = void 0;
    }
    file = share.insert_func(file, this.chunkSize);
    return FileCollection.__super__.insert.call(this, file, callback);
  };

  FileCollection.prototype.update = function(selector, modifier, options, callback) {
    var err;
    if (options == null) {
      options = {};
    }
    if (callback == null) {
      callback = void 0;
    }
    if ((callback == null) && typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (options.upsert != null) {
      err = new Meteor.Error("Update does not support the upsert option");
      if (callback != null) {
        return callback(err);
      } else {
        throw err;
      }
    }
    if (share.reject_file_modifier(modifier) && !options.force) {
      err = new Meteor.Error("Modifying gridFS read-only document elements is a very bad idea!");
      if (callback != null) {
        return callback(err);
      } else {
        throw err;
      }
    } else {
      return FileCollection.__super__.update.call(this, selector, modifier, options, callback);
    }
  };

  FileCollection.prototype.upsert = function(selector, modifier, options, callback) {
    var err;
    if (options == null) {
      options = {};
    }
    if (callback == null) {
      callback = void 0;
    }
    if ((callback == null) && typeof options === 'function') {
      callback = options;
    }
    err = new Meteor.Error("File Collections do not support 'upsert'");
    if (callback != null) {
      return callback(err);
    } else {
      throw err;
    }
  };

  FileCollection.prototype.upsertStream = function(file, options, callback) {
    var cbCalled, found, mods, writeStream;
    if (options == null) {
      options = {};
    }
    if (callback == null) {
      callback = void 0;
    }
    if ((callback == null) && typeof options === 'function') {
      callback = options;
      options = {};
    }
    callback = share.bind_env(callback);
    cbCalled = false;
    mods = {};
    if (file.filename != null) {
      mods.filename = file.filename;
    }
    if (file.aliases != null) {
      mods.aliases = file.aliases;
    }
    if (file.contentType != null) {
      mods.contentType = file.contentType;
    }
    if (file.metadata != null) {
      mods.metadata = file.metadata;
    }
    if (options.autoRenewLock == null) {
      options.autoRenewLock = true;
    }
    if (options.mode === 'w+') {
      throw new Meteor.Error("The ability to append file data in upsertStream() was removed in version 1.0.0");
    }
    if (file._id) {
      found = this.findOne({
        _id: file._id
      });
    }
    if (!(file._id && found)) {
      file._id = this.insert(mods);
    } else if (Object.keys(mods).length > 0) {
      this.update({
        _id: file._id
      }, {
        $set: mods
      });
    }
    writeStream = Meteor.wrapAsync(this.gfs.createWriteStream.bind(this.gfs))({
      root: this.root,
      _id: mongodb.ObjectID("" + file._id),
      mode: 'w',
      timeOut: this.lockOptions.timeOut,
      lockExpiration: this.lockOptions.lockExpiration,
      pollingInterval: this.lockOptions.pollingInterval
    });
    if (writeStream) {
      if (options.autoRenewLock) {
        writeStream.on('expires-soon', (function(_this) {
          return function() {
            return writeStream.renewLock(function(e, d) {
              if (e || !d) {
                return console.warn("Automatic Write Lock Renewal Failed: " + file._id, e);
              }
            });
          };
        })(this));
      }
      if (callback != null) {
        writeStream.on('close', function(retFile) {
          if (retFile) {
            retFile._id = new Mongo.ObjectID(retFile._id.toHexString());
            return callback(null, retFile);
          }
        });
        writeStream.on('error', function(err) {
          return callback(err);
        });
      }
      return writeStream;
    }
    return null;
  };

  FileCollection.prototype.findOneStream = function(selector, options, callback) {
    var file, opts, range, readStream, ref, ref1, ref2, ref3;
    if (options == null) {
      options = {};
    }
    if (callback == null) {
      callback = void 0;
    }
    if ((callback == null) && typeof options === 'function') {
      callback = options;
      options = {};
    }
    callback = share.bind_env(callback);
    opts = {};
    if (options.sort != null) {
      opts.sort = options.sort;
    }
    if (options.skip != null) {
      opts.skip = options.skip;
    }
    file = this.findOne(selector, opts);
    if (file) {
      if (options.autoRenewLock == null) {
        options.autoRenewLock = true;
      }
      range = {
        start: (ref = (ref1 = options.range) != null ? ref1.start : void 0) != null ? ref : 0,
        end: (ref2 = (ref3 = options.range) != null ? ref3.end : void 0) != null ? ref2 : file.length - 1
      };
      readStream = Meteor.wrapAsync(this.gfs.createReadStream.bind(this.gfs))({
        root: this.root,
        _id: mongodb.ObjectID("" + file._id),
        timeOut: this.lockOptions.timeOut,
        lockExpiration: this.lockOptions.lockExpiration,
        pollingInterval: this.lockOptions.pollingInterval,
        range: {
          startPos: range.start,
          endPos: range.end
        }
      });
      if (readStream) {
        if (options.autoRenewLock) {
          readStream.on('expires-soon', (function(_this) {
            return function() {
              return readStream.renewLock(function(e, d) {
                if (e || !d) {
                  return console.warn("Automatic Read Lock Renewal Failed: " + file._id, e);
                }
              });
            };
          })(this));
        }
        if (callback != null) {
          readStream.on('close', function() {
            return callback(null, file);
          });
          readStream.on('error', function(err) {
            return callback(err);
          });
        }
        return readStream;
      }
    }
    return null;
  };

  FileCollection.prototype.remove = function(selector, callback) {
    var err, ret;
    if (callback == null) {
      callback = void 0;
    }
    callback = share.bind_env(callback);
    if (selector != null) {
      ret = 0;
      this.find(selector).forEach((function(_this) {
        return function(file) {
          var res;
          res = Meteor.wrapAsync(_this.gfs.remove.bind(_this.gfs))({
            _id: mongodb.ObjectID("" + file._id),
            root: _this.root,
            timeOut: _this.lockOptions.timeOut,
            lockExpiration: _this.lockOptions.lockExpiration,
            pollingInterval: _this.lockOptions.pollingInterval
          });
          return ret += res ? 1 : 0;
        };
      })(this));
      (callback != null) && callback(null, ret);
      return ret;
    } else {
      err = new Meteor.Error("Remove with an empty selector is not supported");
      if (callback != null) {
        callback(err);
      } else {
        throw err;
      }
    }
  };

  FileCollection.prototype.importFile = function(filePath, file, callback) {
    var readStream, writeStream;
    callback = share.bind_env(callback);
    filePath = path.normalize(filePath);
    if (file == null) {
      file = {};
    }
    if (file.filename == null) {
      file.filename = path.basename(filePath);
    }
    readStream = fs.createReadStream(filePath);
    readStream.on('error', share.bind_env(callback));
    writeStream = this.upsertStream(file);
    return readStream.pipe(share.streamChunker(this.chunkSize)).pipe(writeStream).on('close', share.bind_env(function(d) {
      return callback(null, d);
    })).on('error', share.bind_env(callback));
  };

  FileCollection.prototype.exportFile = function(selector, filePath, callback) {
    var readStream, writeStream;
    callback = share.bind_env(callback);
    filePath = path.normalize(filePath);
    readStream = this.findOneStream(selector);
    writeStream = fs.createWriteStream(filePath);
    return readStream.pipe(writeStream).on('finish', share.bind_env(callback)).on('error', share.bind_env(callback));
  };

  return FileCollection;

})(Mongo.Collection);