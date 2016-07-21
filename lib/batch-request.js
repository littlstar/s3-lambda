'use strict'

/**
 * dependencies
 */

const Batch = require('batch');
const ProgressBar = require('progress');

class request {

  /**
   * @constructor
   */

  constructor(keys, s3, encoding, showProgress) {
    this.keys = keys;
    this.s3 = s3;
    this.encoding = encoding;
    this._concurrency = Infinity;
    this.showProgress = showProgress;
  }

  /**
   * Retrieve the source keys from the context and perform necessary
   * modifications
   *
   * @returns {Promise<Array>}
   */

  resolveSources() {
    return new Promise((success, fail) => {
      this.keys.then(keys => {
        keys = this._reverse ? keys.reverse() : keys;
        keys = this._limit ? keys.slice(0, this._limit) : keys;
        success(keys);
      }).catch(e => fail(e));
    });
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
    let batch = new Batch().concurrency(this._concurrency);

    return new Promise((success, fail) => {
      this.resolveSources().then(sources => {

        let progress = new ProgressBar('each [:bar] :percent', {
          total: sources.length,
          width: 40
        });
        let last = sources[sources.length - 1];

        // create functions array
        sources.forEach(source => {

          batch.push(done => {

            let b = source.bucket;
            let k = source.key;
            let e = this.encoding;
            let t = this.transformer;

            this.s3.get(b, k, e, t).then(body => {
              if (isasync) {
                func(body, k).then(done).catch(done);
              } else {
                func(body, k);
                done();
              }
            }).catch(done);
          });
        });

        if (this.showProgress) {
          batch.on('progress', _ => progress.tick());
        }

        batch.end(err => {
          if (err) {
            fail(err);
          } else {
            success(last);
          }
        });

      }).catch(e => fail(e));
    });
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
    let batch = new Batch;
    batch.concurrency(this._concurrency);

    return new Promise((success, fail) => {
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
              if (isasync) {
                func(val, source.key).then(newval => {
                  output(b, k, newval, done);
                }).catch(done)
              } else {
                let newval = func(val, source.key);
                output(b, k, newval, done);
              }
            }).catch(done);
          });
        });

        if (this.showProgress) {
          batch.on('progress', _ => progress.tick());
        }

        batch.end(err => {
          if (err) {
            fail(err);
          }
          success(lastKey);
        });
      }).catch(e => fail(e));
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
    let batch = new Batch;
    batch.concurrency(1);

    return new Promise((success, fail) => {
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
              if (isasync) {
                func(val, body, k).then(newval => {
                  val = newval;
                  done();
                }).catch(done);
              } else {
                val = func(val, body, k);
                done();
              }
            }).catch(e => done(e));
          });
        });

        if (this.showProgress) {
          batch.on('progress', _ => progress.tick());
        }

        batch.end(err => {
          if (err) {
            fail(err);
          } else {
            success(val);
          }
        });
      }).catch(e => fail(e));
    });
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
    let batch = new Batch;

    return new Promise((success, fail) => {
      this.resolveSources().then(sources => {

        let progress = new ProgressBar('filter [:bar] :percent', {
          total: sources.length,
          width: 40
        });

        // loop over every key and run the filter function on each object. keep
        // track of files to keep and remove.
        sources.forEach(source => {

          batch.push(done => {

            let b = source.bucket;
            let k = source.key;
            let e = this.encoding;
            let t = this.transformer;

            this.s3.get(b, k, e, t).then(body => {
              if (isasync) {
                func(body, source).then(result => {
                  check(result);
                  if (result) {
                    keep(source).then(_ => done()).catch(e => done(e));
                  } else {
                    remove(source).then(_ => done()).catch(e => done(e));
                  }
                }).catch(done);
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
            }).catch(done);
          });
        });

        if (this.showProgress) {
          batch.on('progress', _ => progress.tick());
        }

        batch.end(err => {
          if (err) {
            fail(err);
          } else {
            success();
          }
        });
      }).catch(e => fail(e));
    });

    function keep(source) {
      return new Promise((success, fail) => {
        if (self.target != null) {
          let b = source.bucket;
          let k = source.key;
          let tb = self.target.bucket;
          let tk = self.target.prefix + source.file;
          self.s3.copy(b, k, tb, tk)
            .then(() => success())
            .catch(e => fail(e));
        } else {
          success();
        }
      });
    }

    function remove(source) {
      return new Promise((success, fail) => {
        if (self.target == null) {
          self.s3.delete(source.bucket, source.key)
            .then(() => success())
            .catch(e => fail(e));
        } else {
          success();
        }
      });
    }

    function check(result) {
      if (typeof result != 'boolean') {
        throw new TypeError('filter function must return a boolean');
      }
    }
  }

  /**
   * Join s3 objects together like Array.prototype.join
   *
   * @param {String} delimiter Delimiter to join objects by.
   * @return {String} the joined objects.
   */

  join(delimiter) {
    return new Promise((success, fail) => {
      this.resolveSources().then(sources => {

        let batch = new Batch;

        batch.push(done => {
          this.s3.get(source.bucket, source.key)
            .then(data => done(null, data))
            .catch(e => done(e));
        });

        if (this.showProgress) {
          batch.on('progress', status => {
            console.info(`${status.percent}%`);
          });
        }

        batch.end((err, data) => {
          if (err) {
            fail(err);
          } else {
            success(data.join(delimiter));
          }
        });

      });
    });
  }
}

/**
 * exports
 */

module.exports = request;
