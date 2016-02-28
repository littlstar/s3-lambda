/**
 * @author Wells Johnston <wells@littlstar.com>
 */

'use strict'

const Batch = require('batch');

/**
 * Self-contained batch request object, created by {@link S3renity#context}.
 * Once created, you can chain settings commands together before executing
 * a batch request.
 */

class BatchRequest {

  /**
   * Creates a new <code>Context</code> to perform batch operations with. You can
   * either supply an s3 path like <code>s3://<bucket>/path/to/folder</code>
   * or a bucket and prefix.
   *
   * @param {S3renity} s3 - The s3renity instance used for internal requests
   * @param {Promise} sources - The keys for the given context
   */

  constructor(s3, sources) {
    this.s3 = s3;
    this.resolveSources = sources;
    this.encoding = 'utf8';
    this.c = Infinity;
  }

  /**
   * Sets the encoding to use when getting s3 objects with
   * <code>object.Body.toString(encoding)</code>. If not set, <code>utf8</code>
   * is used.
   *
   * @param {String} encoding - The encoding
   * @returns {Context} <code>this</code>
   */

  encode(encoding) {
    this.encoding = encoding;
    return this;
  }

  /**
   * Sets a transformation function to be used when getting objects from s3.
   * Using <code>transform</code> takes precedence over <code>encode</code>.
   *
   * @param {Function} transformer - The function to use to transform the
   * object. The transforation function takes an s3 object as a parameter
   * and should return the file's contents as a string.
   * @returns {Context} <code>this</code>
   */

  transform(transformer) {
    this.transformer = transformer;
    return this;
  }

  /**
   * Sets the concurrency for batch requests
   *
   * @param {Integer} c The concurrency level.
   */

  concurrency(c) {
    this.c = c;
    return this;
  }

  /**
   * Sets the output directory for map or filter.  If a target is set, map and
   * filter write to that location instead of changing the original objects
   * themselves.
   *
   * @param {String} bucket - The target bucket.
   * @param {String} prefix - The target prefix (folder) where the output will go.
   * @return {Context} <code>this</code>
   */

  output(bucket, prefix) {
    this.target = {
      bucket: bucket,
      prefix: prefix
    };
    return this;
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

    let deferred = Promise.defer();
    let batch = new Batch;
    batch.concurrency(this.c);

    this.resolveSources.then(sources => {

      let last = sources[sources.length - 1];

      /* create functions array */
      sources.forEach(source => {

        batch.push(done => {

          this.s3.get(source.bucket, source.key, this.encoding, this.transformer).then(body => {
            if (isAsync) {
              func(body, source.key).then(() => {
                done();
              }).catch(e => {
                done(e);
              });
            } else {
              try {
                func(body, source.key);
                done();
              } catch (e) {
                done(e);
              }
            }
          });
        });
      });

      batch.on('progress', e => {
        //TODO if verbose show progress
      });

      batch.end(err => {
        if (err) {
          deferred.reject(err);
        }
        deferred.resolve(last);
      });

    }).catch(e => {
      deferred.reject(e);
    });

    return deferred.promise;
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

    let self = this;
    let deferred = Promise.defer();
    let batch = new Batch;
    batch.concurrency(this.c);

    this.resolveSources.then(keys => {

      let lastKey = keys[keys.length - 1];

      keys.forEach(source => {
        batch.push(done => {
          this.s3.get(source.bucket, source.key, this.encoding, this.transformer).then(body => {
            if (isAsync) {
              func(body, source.key).then(newBody => {
                output(source.bucket, source.key, newBody, done);
              }).catch(e => {
                deferred.reject(e);
              })
            } else {
              try {
                let newBody = func(body, source.key);
                output(source.bucket, source.key, newBody, done);
              } catch (e) {
                deferred.reject(e);
              }
            }
          });
        });
      });

      batch.on('progress', e => {
        //TODO if verbose show progress
      });

      batch.end(err => {
        if (err) {
          deferred.reject(err);
        }
        deferred.resolve(lastKey);
      });

    }).catch(e => {
      deferred.reject(e);
    });

    function output(bucket, key, body, done) {
      if (body == null) {
        throw new Error('mapper function must return a value');
      }
      if (self.target == null) {
        self.s3.put(bucket, key, body, self.encoding).then(() => {
          done();
        }).catch(e => {
          done(e);
        });
      } else {
        self.s3.put(self.target.bucket, self.target.prefix + key, body).then(() => {
          done();
        }).catch(e => {
          done(e);
        })
      }
    }

    return deferred.promise;
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
   * @param {string} value Optional.  Initial value to use as the first argument
   * @param {boolean} isAsync Optional, defaults to false. If set to true, this
   * indicates that func returns a promise.
   * @return {promise} Returns the reduced result.
   */

  reduce(func, initialValue, isAsync) {

    let self = this;
    let value = initialValue;
    let deferred = Promise.defer();
    isAsync = isAsync || false;

    this.resolveSources.then(sources => {
      recurse(sources, (err, result) => {
        if (err) {
          deferred.reject(err);
        } else {
          deferred.resolve(result);
        }
      });
    }).catch(e => {
      deferred.reject(e);
    });

    function recurse(sources, done) {
      if (sources.length == 0) {
        done(null, value);
        return;
      }
      let source = sources.shift();
      self.s3.get(source.bucket, source.key, self.encoding, self.transformer).then(body => {
        if (isAsync) {
          func(value, body, source.key).then(newValue => {
            value = newValue;
            recurse(sources, done);
          }).catch(e => done(e, null));
        } else {
          value = func(value, body, source.key);
          recurse(sources, done);
        }
      }).catch(e => done(e, null));
    }

    return deferred.promise;
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

    let self = this;
    let keep = [];
    let remove = [];
    let deferred = Promise.defer();
    let batch = new Batch;

    this.resolveSources.then(sources => {

      /**
       * loop over every key and run the filter function on each object. keep
       * track of files to keep and remove.
       */
      sources.forEach(source => {

        batch.push(done => {

          this.s3.get(source.bucket, source.key, self.encoding, self.transformer).then(body => {
            if (isAsync) {
              func(body, source).then(result => {
                check(result);
                if (result) {
                  keep.push(source);
                } else {
                  remove.push(source);
                }
                done();
              }).catch(e => {
                done(e);
              });
            } else {
              let result = null;
              try {
                result = func(body, source);
              } catch (e) {
                done(e);
                return;
              }
              check(result);
              if (result) {
                keep.push(source);
              } else {
                remove.push(source);
              }
              done();
            }
          }).catch(e => {
            done(e);
          });
        });
      });

      batch.end(err => {

        if (err) {
          deferred.reject(err);
        }

        if (this.target == null) {

          /* no output, so delete files that didn't pass the test */
          let b = new Batch;

          remove.forEach(source => {
            b.push(done => {
              this.s3.delete(source.bucket, source.key).then(() => {
                done();
              }).catch(e => {
                done(e);
              });
            });
          });

          b.end(err => {
            if (err) {
              deferred.reject(err);
            }
            deferred.resolve();
          });
        } else {

          /* output is specified, so copy all the files that did pass */
          let b = new Batch;

          keep.forEach(source => {
            b.push(done => {
              this.s3.copy(source.bucket, source.key, this.target.bucket, this.target.prefix + source.file).then(() => {
                done();
              }).catch(e => {
                done(e);
              });
            });
          });

          b.end(err => {
            if (err) {
              deferred.reject(err);
            }
            deferred.resolve();
          })
        }
      });

    }).catch(e => {
      deferred.reject(e);
    });

    function check(result) {
      if (typeof result != 'boolean') {
        throw new TypeError('filter function must return a boolean');
      }
    }

    return deferred.promise;
  }
}

module.exports = BatchRequest;
