'use strict'

/** class representing a batch request */
class BatchRequest {

  /**
   * Create a batch request.
   * @param {Context} context - The working context for the batch operation.
   */

  constructor(context) {
    this.S3 = context.s3;
    this.bucket = context.bucket;
    this.prefix = context.prefix;
    this.marker = context.marker;
    this.encoding = context.encoding;
    this.transformer = context.transformer;
    this.delimiter = context.delimiter;
    this.target = context.target;
  }

  /**
   * Run a function over s3 objects in a for-each construct.
   *
   * @private
   * @param {Function} func The function to perform over the working context.
   * @param {Boolean} isAsync Optional, default is false. True if `func` is async (returns a
   * Promise).
   * @return {Promise}
   */

  forEach(func, isAsync) {

    if (typeof func != 'function') {
      throw new TypeError('first parameter `func` must be a Function.');
    }

    if (isAsync == null) {
      isAsync = false;
    }

    const _eachObject = (keys, callback) => {
      if (keys.length == 0) {
        callback(null);
        return;
      }
      const key = keys.shift();
      this.S3.get(this.bucket, key).then(body => {
        if (isAsync) {
          func(body).then(_ => {
            _eachObject(keys, callback);
          }).catch(callback);
        } else {
          try {
            func(body);
          } catch (e) {
            callback(e);
            return;
          }
          _eachObject(keys, callback);
        }
      }).catch(callback);
    };

    const _splitObjects = (keys, callback) => {
      if (keys.length == 0) {
        callback(null);
        return;
      }
      const key = keys.shift();
      this.S3.splitObject(this.bucket, key, this.delimiter, this.encoding)
        .then(entries => {
          _eachSplit(entries).then(_ => {
            _splitObjects(keys, callback);
          }).catch(callback);
        }).catch(callback);
    };

    const _eachSplit = entries => {
      return new Promise((success, fail) => {
        if (isAsync) {
          let updates = [];
          entries.forEach(entry => {
            updates.push(func(entry));
          });
          Promise.all(updates).then(success).catch(fail);
        } else {
          try {
            entries.forEach(func);
            success();
          } catch (err) {
            fail(err);
          }
        }
      });
    };

    return new Promise((success, fail) => {
      this.S3.list(this.bucket, this.prefix, this.marker).then(keys => {
        var lastKey = keys[keys.length - 1];
        if (this.delimiter == null) {
          _eachObject(keys, err => {
            if (err) {
              fail(err);
            } else {
              success(lastKey);
            }
          });
        } else {
          _splitObjects(keys, err => {
            if (err) {
              fail(err);
            } else {
              success(lastKey);
            }
          });
        }
      }).catch(fail);
    });
  }

  /**
   * Maps a function over the objects in the working context, replaceing each
   * with the return value.  If an output is specified, the objects will not be
   * overwritten, but rather copied to the target location.
   *
   * @public
   * @param {function} func The function to map over each object in the working
   * context. Func takes the object as a parameter and returns the value that
   * should replace it.
   * @param {boolean} isAsync Optional, default is false. If set to true, this
   * indicates that func returns a promise.
   * @return {promise} Fulfilled when map is complete.
   */

  map(func, isAsync) {

    if (typeof func != 'function') {
      throw new TypeError(INPUT_FUNCTION_ERROR);
    }

    if (isAsync == null) {
      isAsync = false;
    }

    const isSplit = this.delimiter != null;

    const _mapObject = (keys, callback) => {
      if (keys.length == 0) {
        callback(null);
        return;
      }
      let key = keys.shift();
      this.S3.get(this.bucket, key).then(body => {
        if (isAsync) {
          func(body)
            .then(newBody => _output(key, newBody, keys, callback))
            .catch(callback);
        } else {
          try {
            let newBody = func(body);
            _output(key, newBody, keys, callback);
          } catch (e) {
            callback(e);
            return;
          }
        }
      }).catch(callback);
    };

    const _splitObjects = (keys, callback) => {
      if (keys.length == 0) {
        callback(null);
        return;
      }
      let key = keys.shift();
      this.S3.splitObject(this.bucket, key, this.delimiter, this.encoding).then(
        entries => {
          _mapSplit(entries).then(newEntries => {
            let newBody = newEntries.join(this.delimiter);
            _output(key, newBody, keys, callback);
          }).catch(callback);
        }).catch(callback);
    };

    const _mapSplit = entries => {
      return new Promise((success, fail) => {
        if (isAsync) {
          let entryUpdates = [];
          entries.forEach(entry => {
            entryUpdates.push(func(entry));
          });
          Promise.all(entryUpdates).then(success).catch(fail);
        } else {
          try {
            success(entries.map(func));
          } catch (err) {
            fail(err);
          }
        }
      });
    };

    const _output = (key, body, keys, callback) => {
      if (this.target != null) {
        this
          .put(this.target.bucket, this.target.prefix + this.S3.getFileName(key), body)
          .then(_ => _continue(keys, callback))
          .catch(callback);
      } else {
        this.put(this.bucket, key, body)
          .then(_ => _continue(keys, callback))
          .catch(callback);
      }
    };

    const _continue = (keys, callback) => {
      if (isSplit) {
        _splitObjects(keys, callback);
      } else {
        _mapObject(keys, callback);
      }
    };

    return new Promise((success, fail) => {
      this.list().then(keys => {
        var lastKey = keys[keys.length - 1];
        if (isSplit) {
          _mapObject(keys, err => {
            if (err) {
              fail(err);
            } else {
              success(lastKey);
            }
          });
        } else {
          _splitObjects(keys, err => {
            if (err) {
              fail(err)
            } else {
              success(lastKey);
            }
          });
        }
      }).catch(fail);
    });
  }

  /**
   * Reduce the objects in the working context to a single value.
   *
   * @param {function} func Function to execute on each value in the array, taking
   * three arguments:
   *   previousValue - The value previously returned in the last invocation of
   *   func
   *   currentValue  - The current entry being processed
   *   key           - The key of the current object being processed
   *   func either returns the updated value, or a promise that resolves to the
   *   updated value.
   * @param {string} initialValue Optional.  Value to use as the first argument to
   * the first call of func.
   * @param {boolean} isAsync Optional, defaults to false. If set to true, this
   * indicates that func returns a promise.
   * @return {promise} Returns the reduced result.
   */

  reduce(func, initialValue, isAsync) {

    if (typeof func != 'function') {
      throw new TypeError(INPUT_FUNCTION_ERROR);
    }

    if (isAsync == null) {
      isAsync = false;
    }

    var value = initialValue;

    const _reduceObjects = (keys, callback) => {
      if (keys.length == 0) {
        callback(null, value);
        return;
      }
      let key = keys.shift();
      this.get(this.bucket, key).then(body => {
        if (isAsync) {
          func(value, body, key).then(newValue => {
            value = newValue;
            _reduceObjects(keys, callback);
          }).catch(e => callback(e, null));
        } else {
          value = func(value, body, key);
          _reduceObjects(keys, callback);
        }
      }).catch(e => callback(e, null));
    };

    const _splitAndReduceObjects = (keys, callback) => {
      if (keys.length == 0) {
        callback(null, value);
        return;
      }
      key = keys.shift();
      this.splitObject(this.bucket, key, this.delimiter, this.encoding).then(
        entries => {
          _reduceSplitEntries(key, entries, err => {
            if (err) {
              callback(err, null);
              return;
            }
            _splitAndReduceObjects(keys, callback);
          });
        }).catch(e => callback(e, null));
    };

    const _reduceSplitEntries = (key, entries, done) => {
      if (entries.length == 0) {
        done();
        return;
      }
      let entry = entries.shift();
      if (isAsync) {
        func(value, entry, key).then(newValue => {
          value = newValue;
          _reduceSplitEntries(key, entries, done);
        }).catch(done);
      } else {
        try {
          value = func(value, entry, key);
          _reduceSplitEntries(key, entries, done);
        } catch (e) {
          done(e);
        }
      }
    };

    return new Promise((success, fail) => {
      this.list().then(keys => {
        if (this.delimiter == null) {
          _reduceObjects(keys, (err, result) => {
            if (err) {
              fail(err);
            } else {
              success(result);
            }
          });
        } else {
          _splitAndReduceObjects(keys, (err, result) => {
            if (err) {
              fail(err);
            } else {
              success(result);
            }
          });
        }
      }).catch(fail);
    });
  }

  /**
   * Filter the objects in the working context.
   *
   * @public
   * @param {function} func The function to filter objects by, returning true for
   * objects that should not be filtered and false for those that should. If
   * isAsync is set to true, func returns a promise that resolves to true or
   * false.
   * @param {boolean} isAsync Optional, defaults to false. If set to true, this
   * indicates that func returns a promise.
   */

  filter(func, isAsync) {

    if (typeof func != 'function') {
      throw new TypeError(INPUT_FUNCTION_ERROR);
    }

    if (isAsync == null) {
      isAsync = false;
    }

    var removeObjects = [];
    var keepObjects = [];

    // recursively get all objects and run filter function
    const _filterObjects = (keys, callback) => {
      if (keys.length == 0) {
        _finish(callback);
        return;
      }
      let key = keys.shift();
      this.get(this.bucket, key).then(body => {
        if (isAsync) {
          func(body).then(result => {
            checkResult(result);
            if (result) {
              keepObjects.push(key);
            } else {
              removeObjects.push(key);
            }
            _filterObjects(keys, callback);
          }).catch(callback);
        } else {
          try {
            var result = func(body);
          } catch (e) {
            callback(e);
            return;
          }
          checkResult(result);
          if (result) {
            keepObjects.push(key);
          } else {
            removeObjects.push(key);
          }
          _filterObjects(keys, callback);
        }
      }).catch(callback);
    };

    const _finish = callback => {
      if (this.hasTarget) {
        let promises = [];
        keepObjects.forEach(key => {
          let fileName = this.S3.getFileName(key);
          promises.push(this.copy(this.bucket, key, this.targetBucket, this.targetPrefix + fileName));
        });
        Promise.all(promises).then(_ => {
          callback();
        }).catch(callback);
      } else {
        this.delete(this.bucket, removeObjects).then(_ => {
          callback(null);
        }).catch(callback);
      }
    };

    const _splitObjects = (keys, callback) => {
      if (keys.length == 0) {
        callback(null);
        return;
      }
      let key = keys.shift();
      this.splitObject(this.bucket, key, this.delimiter, this.encoding)
        .then(entries => {
          _filterSplitObject(entries).then(newEntries => {
            var targetBucket, targetKey;
            let newBody = newEntries.join(this.delimiter);
            if (this.hasTarget) {
              targetBucket = this.targetBucket;
              targetKey = this.targetPrefix + this.S3.getFileName(key);
            } else {
              targetBucket = this.bucket;
              targetKey = key;
            }
            this.put(targetBucket, targetKey, newBody).then(_ => {
              _splitObjects(keys, callback);
            }).catch(callback);
          }).catch(callback);
        }).catch(callback);
    };

    // runs the filter function on a split (containing entries)
    const _filterSplitObject = entries => new Promise((success, fail) => {
      if (isAsync) {
        promises = [];
        entries.forEach(entry => {
          promises.push(func(entry));
        });
        Promise.all(promises).then(results => {
          let newSplitEntries = [];
          results.forEach((pass, i) => {
            if (pass) {
              newSplitEntries.push(entries[i]);
            }
            success(newSplitEntries);
          });
        }).catch(fail);
      } else {
        try {
          success(entries.filter(func));
        } catch (err) {
          fail(err);
        }
      }
    });

    const checkResult = result => {
      if (typeof result != 'boolean') {
        throw new TypeError('Filter function must return a boolean');
      }
    };

    return new Promise((success, fail) => {
      this.list().then(keys => {
        if (this.delimiter == null) {
          _filterObjects(keys, err => {
            if (err) {
              fail(err);
            } else {
              success();
            }
          });
        } else {
          _splitObjects(keys, err => {
            if (err) {
              fail(err);
            } else {
              success();
            }
          });
        }
      }).catch(fail);
    });
  }

  /**
   * Join the objects in the working context by the given delimiter and return the
   * result.
   *
   * @public
   * @param {string} delimiter The character used to join the documents by.
   * Default is "\n"
   * @return {promise} Returns the body and `this` on success.
   */

  join(delimiter) {
    if (delimiter == null) delimiter = '\n';
    return new Promise((success, fail) => {
      this.list().then(keys => {
        let getPromises = [];
        keys.forEach(key => {
          getPromises.push(this.get(this.bucket, key));
        });
        Promise.all(getPromises).then(objects => {
          success(objects.join(delimiter));
        }).catch(fail);
      }).catch(fail);
    });
  }

}

module.exports = BatchRequest;
