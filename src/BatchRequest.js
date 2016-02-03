'use strict'

const Context = require('./Context');

/**
 * Self-contained batch request object, created by {@link S3renity#context}.
 * Once created, you can chain settings commands together before executing
 * a batch request.
 */

class BatchRequest extends Context {

  /**
   * A {@link BatchRequest} can only be created by calling
   * {@link S3renity#context}.
   *
   * @extends Context
   * @private
   * @param {S3renity} s3 - The S3renity instance to use for making s3 requests
   * @param {String} bucket The bucket
   * @param {String} key The key
   * @param {String} [marker] The key to start from
   */

  constructor(s3, bucket, key, marker) {
    super(s3, bucket, key, marker);
  }

  /**
   * Run a function over s3 objects in a for-each construct.
   *
   * @param {Function} func The function to perform over the working context
   * @param {Boolean} [isAsync=false] Set to true if `func` is async (returns a
   * Promise).
   * @returns {Promise<string>} The last key iterated over.
   */

  forEach(func, isAsync) {

    isAsync = isAsync || false;
    let self = this;
    let index = 0;

    return new Promise((success, fail) => {
      this.s3.list(this.bucket, this.prefix, this.marker).then(keys => {
        let lastKey = keys[keys.length - 1];
        iterateObjectsRecurvive(keys, err => {
          if (err) {
            fail(err);
          } else {
            success(lastKey);
          }
        });
      }).catch(fail);
    });

    function iterateObjectsRecurvive(keys, callback) {
      if (keys.length == 0) {
        callback(null);
        return;
      }
      const key = keys.shift();
      self.s3.get(self.bucket, key).then(body => {
        if (isAsync) {
          func(body, index++).then(() => {
            iterateObjectsRecurvive(keys, callback);
          }).catch(callback);
        } else {
          try {
            func(body);
          } catch (e) {
            callback(e);
            return;
          }
          iterateObjectsRecurvive(keys, callback);
        }
      }).catch(callback);
    }
  }

  /**
   * Maps a function over the objects in the working context, replaceing each
   * with the return value.  If an output is specified, the objects will not be
   * overwritten, but rather copied to the target location.
   *
   * @public
   * @param {Function} func The function to map over each object in the working
   * context. <code>func</code> takes a string as a parameter and should return a
   * string that will replace the given s3 object.
   * @param {Boolean} [isAsync=false] If set to true, this indicates that func is async and returns a promise.
   * @return {Promise}
   */

  map(func, isAsync) {

    isAsync = isAsync || false;
    let index = 0;
    let self = this;

    return new Promise((success, fail) => {
      this.s3.list(this.bucket, this.prefix, this.marker).then(keys => {
        let lastKey = keys[keys.length - 1];
        mapObjects(keys, err => {
          if (err) {
            fail(err);
          } else {
            success(lastKey);
          }
        });
      }).catch(fail);
    });

    function mapObjects(keys, callback) {
      if (keys.length == 0) {
        callback(null);
        return;
      }
      let key = keys.shift();
      self.s3.get(self.bucket, key).then(body => {
        if (isAsync) {
          func(body, index++)
            .then(newBody => {
              outputMapResult(key, newBody, keys, callback);
            })
            .catch(callback);
        } else {
          let newBody = null;
          try {
            newBody = func(body, index++);
          } catch (e) {
            callback(e);
            return;
          }
          outputMapResult(key, newBody, keys, callback);
        }
      }).catch(callback);
    }

    function outputMapResult(key, body, keys, callback) {
      if (body == null) {
        throw new Error('your mapper function must return a string to use for the s3 object body');
      }
      if (self.target != null) {
        let filename = self.s3.getFileName(key);
        let targetKey = `${self.target.prefix}${filename}`;
        self.s3
          .put(self.target.bucket, targetKey, body, self.encoding)
          .then(() => mapObjects(keys, callback))
          .catch(callback);
      } else {
        self.s3
          .put(self.bucket, key, body, self.encoding)
          .then(() => mapObjects(keys, callback))
          .catch(callback);
      }
    }
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

    isAsync = isAsync || false;
    let value = initialValue;
    let self = this;

    return new Promise((success, fail) => {
      this.s3.list(this.bucket, this.prefix, this.marker).then(keys => {
        reduceObjects(keys, (err, result) => {
          if (err) {
            fail(err);
          } else {
            success(result);
          }
        });
      }).catch(fail);
    });

    function reduceObjects(keys, callback) {
      if (keys.length == 0) {
        callback(null, value);
        return;
      }
      let key = keys.shift();
      self.s3.get(self.bucket, key).then(body => {
        if (isAsync) {
          func(value, body, key).then(newValue => {
            value = newValue;
            reduceObjects(keys, callback);
          }).catch(e => callback(e, null));
        } else {
          value = func(value, body, key);
          reduceObjects(keys, callback);
        }
      }).catch(e => callback(e, null));
    }
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

    isAsync = isAsync || false;
    let removeObjects = [];
    let keepObjects = [];
    let index = 0;
    let self = this;

    return new Promise((success, fail) => {
      this.s3.list(this.bucket, this.prefix, this.marker).then(keys => {
        filterObjects(keys, err => {
          if (err) {
            fail(err);
          } else {
            success();
          }
        });
      }).catch(fail);
    });

    // recursively get all objects and run filter function
    function filterObjects(keys, callback) {
      if (keys.length == 0) {
        finish(callback);
        return;
      }
      let key = keys.shift();
      self.s3.get(self.bucket, key).then(body => {
        if (isAsync) {
          func(body, index++).then(result => {
            checkResult(result);
            if (result) {
              keepObjects.push(key);
            } else {
              removeObjects.push(key);
            }
            filterObjects(keys, callback);
          }).catch(callback);
        } else {
          let result = null;
          try {
            result = func(body, index++);
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
          filterObjects(keys, callback);
        }
      }).catch(callback);
    }

    // output result to `target` or filter results destructively
    function finish(callback) {
      if (self.target != null) {
        let promises = [];
        keepObjects.forEach(key => {
          let fileName = self.s3.getFileName(key);
          promises.push(self.s3.copy(self.bucket, key, self.target.bucket, self.target.prefix + fileName));
        });
        Promise.all(promises).then(_ => {
          callback(null);
        }).catch(callback);
      } else {
        self.s3.delete(self.bucket, removeObjects).then(_ => {
          callback(null);
        }).catch(callback);
      }
    }

    function checkResult(result) {
      if (typeof result != 'boolean') {
        throw new TypeError('Filter function must return a boolean');
      }
    }
  }

  /**
   * Join the objects in the working context by the given delimiter and return the
   * result.
   *
   * @public
   * @param {String} delimiter='\n' The character used to join the s3 objects
   * @returns {Promise} The joined body.
   */

  join(delimiter) {
    delimiter = delimiter || '\n';
    return new Promise((success, fail) => {
      this.s3.list(this.bucket, this.prefix, this.marker).then(keys => {
        let getPromises = [];
        keys.forEach(key => {
          getPromises.push(this.s3.get(this.bucket, key));
        });
        Promise.all(getPromises).then(objects => {
          success(objects.join(delimiter));
        }).catch(fail);
      }).catch(fail);
    });
  }
}

module.exports = BatchRequest;
