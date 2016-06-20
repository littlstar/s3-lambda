/**
 * Batch requests in self-contained context
 *
 * @author Wells Johnston <wells@littlstar.com>
 */

'use strict'

const Batch = require('batch');
const ProgressBar = require('progress');
const UserFunctionError = new Error('supplied function failed');

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
    this.show_progress = s3.show_progress;
    this.sources = sources;
    this.encoding = 'utf8';
    this._concurrency = Infinity;
  }

  /**
   * Retrieve the source keys being operated on
   *
   * @returns {Promise}
   */

  resolveSources() {
    let deferred = Promise.defer();
    this.sources.then(sources => {
      sources = this._reverse ? sources.reverse() : sources;
      sources = this._limit ? sources.slice(0, this._limit) : sources;
      deferred.resolve(sources);
    }).catch(e => deferred.reject(e));
    return deferred.promise;
  }

  /**
   * Sets the encoding to use when getting s3 objects with
   * <code>object.Body.toString(encoding)</code>. If not set, <code>utf8</code>
   * is used.
   *
   * @param {String} encoding - The encoding
   * @returns {Context} <code>this</code>
   */

  encode(e) {
    this.encoding = e;
    return this;
  }

  /**
   * Sets a transformation function to be used when getting objects from s3.
   * Using <code>transform</code> takes precedence over <code>encode</code>.
   *
   * @param {Function} transformer - The function to use to transform the
   * object. The transforation function takes an s3 object as a parameter
   * and should return the file's contents as a string.
   * @returns {BatchRequest} <code>this</code>
   */

  transform(t) {
    this.transformer = t;
    return this;
  }

  /**
   * Set the concurrency for requests.  Default is Infinity (as many as
   * the computer can handle). Has no effect with reduce.
   *
   * @param {Integer} concurrency The concurrency level to use in the request.
   * @returns {BatchRequest}
   */

  concurrency(c) {
    this._concurrency = c;
    return this;
  }

  /**
   * Limits the number of sources being operated on
   */

  limit(l) {
    this._limit = l;
    return this;
  }

  /**
   * Reverse the sources being operated on
   */

  reverse() {
    this._reverse = true;
    return this
  }

  /**
   * Sets the output directory for map or filter.  If a target is set, map and
   * filter write to that location instead of changing the original objects
   * themselves.
   *
   * @param {String} bucket - The target bucket.
   * @param {String} prefix - The target prefix (folder) where the output will go.
   * @return {BatchRequest} <code>this</code>
   */

  output(bucket, prefix) {
    this.target = {
      bucket: bucket,
      prefix: prefix
    };
    return this;
  }

  /**
   * Run a function over s3 objects in series. This is just a wrapper around each
   * with concurrency 1.
   *
   * @param {Function} func The function to perform over the working context
   * @param {Boolean} [isasync=false] Set to true if `func` is async (returns a
   * Promise).
   * @returns {Promise<string>} The last key iterated over.
   */

  forEach(func, isasync) {
    this.concurrency(1);
    return this.each(func, isasync);
  }

  /**
   * Run a function over s3 objects in parallel.
   *
   * @param {Function} func The function to perform over the working context
   * @param {Boolean} [isasync=false] Set to true if `func` is async (returns a
   * Promise).
   * @returns {Promise<string>} The last key iterated over.
   */

  each(func, isasync) {

    isasync = isasync || false;
    let deferred = Promise.defer();
    let batch = new Batch().concurrency(this._concurrency);

    this.resolveSources().then(sources => {

      let progress = new ProgressBar('each [:bar] :percent', {
        total: sources.length,
        width: 40
      });
      let last = sources[sources.length - 1];

      /* create functions array */
      sources.forEach(source => {

        batch.push(done => {

          let b = source.bucket;
          let k = source.key;
          let e = this.encoding;
          let t = this.transformer;

          this.s3.get(b, k, e, t).then(body => {
            try {
              if (isasync) {
                func(body, k).then(done).catch(done);
              } else {
                func(body, k);
                done();
              }
            } catch (e) {
              done(UserFunctionError);
            }
          })
          .catch(e => done(e));
        });
      });

      if (this.show_progress) {
        batch.on('progress', _ => progress.tick());
      }

      batch.end(err => {
        if (err) {
          deferred.reject(err);
        } else {
          deferred.resolve(last);
        }
      });

    }).catch(e => {
      deferred.reject(e);
    });

    return deferred.promise;
  }

  /**
   * Maps a function over the objects in the working context in parallel, replaceing each
   * object with the return value.  If an output is specified, the objects will not be
   * overwritten, but rather copied to the target location.
   *
   * @public
   * @param {Function} func The function to map over each object in the working
   * context. <code>func</code> takes a string as a parameter and should return a
   * string that will replace the given s3 object.
   * @param {Boolean} [isasync=false] If set to true, this indicates that func is async and returns a promise.
   * @return {Promise}
   */

  map(func, isasync) {

    isasync = isasync || false;

    let self = this;
    let deferred = Promise.defer();
    let batch = new Batch;
    batch.concurrency(this._concurrency);

    this.resolveSources().then(sources => {

      let progress = new ProgressBar('map [:bar] :percent', {
        total: sources.length,
        width: 40
      });
      let lastKey = sources[sources.length - 1];

      sources.forEach(source => {
        batch.push(done => {

          let b = source.bucket;
          let k = source.key;
          let e = this.encoding;
          let t = this.transformer;

          this.s3.get(b, k, e, t).then(val => {
            try {
              if (isasync) {
                func(val, source.key).then(newval => {
                  output(b, k, newval, done);
                }).catch(done)
              } else {
                let newval = func(val, source.key);
                output(b, k, newval, done);
              }
            } catch (e) {
              done(UserFunctionError);
            }
          })
          .catch(done);
        });
      });

      if (this.show_progress) {
        batch.on('progress', _ => progress.tick());
      }

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
        }).catch(done);
      } else {

        let b = self.target.bucket;
        let k = self.target.prefix + key;

        self.s3.put(b, k, body).then(() => {
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
   * @param {Function} func Function to execute on each value in the array, taking
   * three arguments:
   *   previousValue - The value previously returned in the last invocation of
   *   func
   *   currentValue  - The current entry being processed
   *   key           - The key of the current object being processed
   *   func either returns the updated value, or a promise that resolves to the
   *   updated value.
   * @param {String} value Optional.  Initial value to use as the first argument
   * @param {Boolean} isasync Optional, defaults to false. If set to true, this
   * indicates that func returns a promise.
   * @return {Promise} Returns the reduced result.
   */

  reduce(func, val, isasync) {

    isasync = isasync || false;
    let deferred = Promise.defer();
    let batch = new Batch;
    batch.concurrency(1);

    this.resolveSources().then(sources => {

      let progress = new ProgressBar('reduce [:bar] :percent', {
        total: sources.length,
        width: 40
      });

      sources.forEach(source => {
        batch.push(done => {

          let b = source.bucket;
          let k = source.key;
          let e = this.encoding;
          let t = this.transformer;

          this.s3.get(b, k, e, t).then(body => {
            try {
              if (isasync) {
                func(val, body, k).then(newval => {
                  val = newval;
                  done();
                }).catch(done);
              } else {
                val = func(val, body, k);
                done();
              }
            } catch (e) {
              done(UserFunctionError);
            }
          })
          .catch(e => done(e));
        });
      });

      if (this.show_progress) {
        batch.on('progress', _ => progress.tick());
      }

      batch.end(err => {
        if (err) {
          deferred.reject(err);
        }
        deferred.resolve(val);
      });

    }).catch(e => {
      deferred.reject(e);
    });

    return deferred.promise;
  }

  /**
   * Filter the objects in the working context.
   *
   * @public
   * @param {Function} func The function to filter objects by, returning true for
   * objects that should not be filtered and false for those that should. If
   * isasync is set to true, func returns a promise that resolves to true or
   * false.
   * @param {Boolean} isasync Optional, defaults to false. If set to true, this
   * indicates that func returns a promise.
   */

  filter(func, isasync) {

    isasync = isasync || false;
    let self = this;
    let deferred = Promise.defer();
    let batch = new Batch;

    this.resolveSources().then(sources => {

      let progress = new ProgressBar('filter [:bar] :percent', {
        total: sources.length,
        width: 40
      });

      /**
       * loop over every key and run the filter function on each object. keep
       * track of files to keep and remove.
       */
      sources.forEach(source => {

        batch.push(done => {

          let b = source.bucket;
          let k = source.key;
          let e = this.encoding;
          let t = this.transformer;

          this.s3.get(b, k, e, t).then(body => {
              if (isasync) {
                try {
                  func(body, source).then(result => {
                    check(result);
                    if (result) {
                      keep(source).then(_ => done()).catch(e => done(e));
                    } else {
                      remove(source).then(_ => done()).catch(e => done(e));
                    }
                  }).catch(e => {
                    done(e);
                  });
                } catch (e) {
                  done(UserFunctionError);
                }
              } else {
                let result = null;
                result = func(body, source);
                check(result);
                if (result) {
                  keep(source).then(_ => done()).catch(e => done(e));
                } else {
                  remove(source).then(_ => done()).catch(e => done(e));
                }
              }
            })
            .catch(e => done(e));
        });
      });

      if (this.show_progress) {
        batch.on('progress', _ => progress.tick());
      }

      batch.end(err => {
        if (err) {
          deferred.reject(err);
        } else {
          deferred.resolve();
        }
      });
    }).catch(e => {
      deferred.reject(e);
    });

    function keep(source) {
      let deferred = Promise.defer();
      if (self.target != null) {
        let b = source.bucket;
        let k = source.key;
        let tb = self.target.bucket;
        let tk = self.target.prefix + source.file;
        self.s3.copy(b, k, tb, tk).then(() => {
          deferred.resolve();
        }).catch(e => {
          deferred.reject(e);
        });
      } else {
        deferred.resolve();
      }
      return deferred.promise;
    }

    function remove(source) {
      let deferred = Promise.defer();
      if (self.target == null) {
        self.s3.delete(source.bucket, source.key).then(() => {
          deferred.resolve();
        }).catch(e => {
          deferred.reject(e);
        });
      } else {
        deferred.resolve();
      }
      return deferred.promise;
    }

    function check(result) {
      if (typeof result != 'boolean') {
        throw new TypeError('filter function must return a boolean');
      }
    }

    return deferred.promise;
  }

  /**
   * Join s3 objects together like Array.prototype.join
   *
   * @param {String} delimiter Delimiter to join objects by.
   * @return {String} the joined objects.
   */

  join(delimiter) {

    let deferred = Promise.defer();

    this.resolveSources().then(sources => {

      let batch = new Batch;

      batch.push(done => {
        this.s3.get(source.bucket, source.key)
          .then(data => done(null, data))
          .catch(e => done(e));
      });

      if (this.show_progress) {
        batch.on('progress', status => {
          console.info(`${status.percent}%`);
        });
      }

      batch.end((err, data) => {
        if (err) {
          deferred.reject(err);
        } else {
          deferred.resolve(data.join(delimiter));
        }
      });

    });

    return deferred.promise;
  }
}

module.exports = BatchRequest;
