/**
 * S3renity
 * @author Wells Johnston <wells@littlstar.com>
 */

'use strict'

const Batch = require('batch');
const ProgressBar = require('progress');
const aws = require('aws-sdk');
const s3Mock = require('mock-aws-s3');

/**
 * S3renity allows you to run batch requests, as well as interact with s3
 * objects directly through a promise-based api.
 */

class S3renity {

  /**
   * @param {Object} config - Options to initialize s3renity with. If <code>access_key_id</code>
   * and <code>secret_access_key</code> are left out, the aws sdk will attempt
   * to use the computer's default credentials.
   * @param {String} [config.access_key_id=null] AWS Access Key
   * @param {String} [config.secret_access_key=null] AWS Secret Key
   * @param {Integer} [config.max_retries=30] Max retries allowed for aws api requets
   * @param {Integer} [config.timeout=120] Timeout allowed for aws api requests
   * @param {Boolean} [config.verbose=false] Whether to use verbose mode when making requets
   * @param {String} [config.encoding='utf8'] Encoding of the objects
   */

  constructor(config) {
    config = config || {};
    this.verbose = config.verbose || false;
    this.show_progress = config.show_progress || false;
    this._concurrency = Infinity;
    this.encoding = config.encoding || 'utf8';

    if (config.local_path == null) {

      // use the aws sdk. attempt to use aws credentials in config.  if they
      // are not present, the aws sdk could pick them up in ~/.aws/credentials
      if (config.access_key_id && config.secret_access_key) {
        aws.config.update({
          accessKeyId: config.access_key_id,
          secretAccessKey: config.secret_access_key
        });
      }

      let s3opts = {
        maxRetries: config.max_retries || 10,
        httpOptions: {
          timeout: config.timeout || 10000
        }
      };

      this.s3 = new aws.S3(s3opts);
    } else {

      // use local files (using mock aws sdk)
      s3Mock.config.basePath = config.local_path;
      this.s3 = new s3Mock.S3();
    }
  }

  /**
   * Retrieve the source keys from the context and perform necessary
   * modifications
   *
   * @returns {Promise<Array>}
   */

  resolveSources() {
    return new Promise((success, fail) => {
      this.sources.then(sources => {
        sources = this._reverse ? sources.reverse() : sources;
        sources = this._limit ? sources.slice(0, this._limit) : sources;
        success(sources);
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
   * Creates a new {@link BatchRequest} context.
   *
   * @param {String} bucket The bucket to use, or a valid s3 path
   * @param {String} prefix The prefix (folder) to use. Leave null if you
   * gave an s3 path
   * @param {String} [marker] The key to start from
   * @param {Integer} [limit] Limit the # of items processed in the batch request.
   * @param {Boolean} [reverse] Reverse the order objects in context
   * @returns {BatchRequest} A new batch request instance.
   */

  context(bucket, prefix, marker, limit, reverse) {

    limit = limit || Infinity;
    let sources = null;
    let batch = new Batch;

    if (typeof bucket == 'object') {
      sources = bucket;
    } else {
      sources = [{
        bucket: bucket,
        prefix: prefix,
        marker: marker
      }];
    }

    if (this.show_progress) {
      console.info('listing keys');
    }

    this.sources = new Promise((success, fail) => {

      sources.forEach(source => {
        batch.push(done => {

          // list each source in parallel
          this.keys(source.bucket, source.prefix, source.marker).then(files => {

            // format sources and ignore empty files (directories)
            let sources = files.map(file => {
              return {
                bucket: source.bucket,
                prefix: source.prefix,
                file: file,
                key: `${source.prefix}${file}`
              };
            }).filter(source => source.file.length > 0);

            done(null, sources);
          }).catch(e => {
            done(e);
          });
        });
      });

      batch.end((err, sources) => {
        if (err) {
          fail(err);
        } else {

          /* flatten the array (of array) of sources and impose limit */
          sources = sources.reduce((prev, cur) => prev.concat(cur), []).slice(0, limit);
          if (reverse) {
            sources = sources.reverse();
          }
          success(sources);
        }
      })
    });

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

            this.get(b, k, e, t).then(body => {
              if (isasync) {
                func(body, k).then(done).catch(done);
              } else {
                func(body, k);
                done();
              }
            }).catch(done);
          });
        });

        if (this.show_progress) {
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

            this.get(b, k, e, t).then(val => {
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

        if (this.show_progress) {
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

          this.get(b, k, e, t).then(body => {
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

          this.get(b, k, e, t).then(body => {
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
        this.get(source.bucket, source.key)
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

  /**
   * Gets an object in s3.
   *
   * @param {String} bucket - The bucket to get from
   * @param {String} key - The key of the object to get
   * @param {String} [encoding=utf8] - The encoding
   * @param {Function} [transformer] - If supplied, this function will be
   * run on Object.Body before returning. Useful for dealing with compressed
   * files or weird formats
   * @returns {Promise} The s3 text object.
   */

  get(bucket, key, encoding, transformer) {

    encoding = encoding || 'utf8';
    let deferred = Promise.defer();

    /* default transform is to assume a utf8 encoded text file */
    if (transformer == null) {
      transformer = obj => {
        return obj.Body.toString(encoding);
      };
    }

    this.s3.getObject({
      Bucket: bucket,
      Key: key
    }, (err, object) => {
      if (err) {
        deferred.reject(err);
      } else {
        try {
          deferred.resolve(transformer(object));
          if (this.verbose) {
            console.info(`GET OBJECT s3://${bucket}/${key}`);
          }
        } catch (e) {
          deferred.reject(e);
        }
      }
    });

    return deferred.promise;
  }

  /**
   * Puts a text object in S3.
   *
   * @param {String} bucket - The s3 bucket to use
   * @param {String} key - The key path where the object will be placed
   * @param {String} body - The object body
   * @param {String} [encoding=utf8] - The encoding
   * @return {Promise} Promise that resolves when the object is written to s3
   */

  put(bucket, key, body, encoding) {

    encoding = encoding || 'utf8';
    let deferred = Promise.defer();

    this.s3.putObject({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentEncoding: encoding
    }, (err, res) => {
      if (err) {
        deferred.reject(err);
      } else {
        if (this.verbose) {
          console.info(`PUT OBJECT s3://${bucket}/${key}`);
        }
        deferred.resolve(res);
      }
    });

    return deferred.promise;
  }

  /**
   * Copies an object in S3.
   *
   * @public
   * @param {String} bucket The source bucket
   * @param {String} key The source key
   * @param {String} targetBucket The target bucket
   * @param {String} targetKey The target key
   * @return {Promise}
   */

  copy(bucket, key, targetBucket, targetKey) {

    let deferred = Promise.defer();

    this.s3.copyObject({
      Bucket: targetBucket,
      Key: targetKey,
      CopySource: `${bucket}/${key}`
    }, (err, res) => {
      if (err) {
        deferred.reject(err);
      } else {
        if (this.verbose) {
          console.info(`COPY OBJECT s3://${bucket}/${key} --> s3://${targetBucket}/${targetKey}`);
        }
        deferred.resolve();
      }
    });

    return deferred.promise;
  }

  /**
   * Moves an object in S3 (copy then delete).
   *
   * @public
   * @param {String} bucket The source bucket
   * @param {String} key The source key
   * @param {String} targetBucket The target bucket
   * @param {String} targetKey The target key
   * @return {Promise}
   */

  move(bucket, key, targetBucket, targetKey) {

    let deferred = Promise.defer();

    this.copy(bucket, key, targetBucket, targetKey).then(() => {
      this.delete(bucket, key).then(() => {
        deferred.resolve();
      }).catch(e => {
        deferred.reject(e);
      });
    }).catch(e => {
      deferred.reject(e);
    });

    return deferred.promise;
  }

  /**
   * Deletes an object or array of objects in S3.
   *
   * @public
   * @param {String} bucket - The bucket
   * @param {String|Array} key - The key to delete
   * @returns {Promise} The key (or array of keys) that was deleted.
   */

  delete(bucket, key) {

    let deferred = Promise.defer();

    this.s3.deleteObject({
      Bucket: bucket,
      Key: key
    }, (err, res) => {
      if (err) {
        deferred.reject(err);
      } else {
        deferred.resolve();
        if (this.verbose) {
          console.info(`DELETE OBJECT s3://${bucket}/${key}`);
        }
      }
    });

    return deferred.promise;
  }

  /**
   * Deletes a list of objects in S3.
   *
   * @private
   * @param {String} bucket - The s3 bucket to use
   * @param {Array} keys - The keys of the objects to delete
   * @returns {Promise}
   */

  deleteObjects(bucket, keys) {

    let deferred = Promise.defer();

    /* creates input with format: { Key: key } required by s3 */
    let input = keys.map(key => {
      return {
        Key: key
      };
    });

    this.s3.deleteObjects({
      Bucket: bucket,
      Delete: {
        Objects: input
      }
    }, (err, res) => {
      if (err) {
        deferred.reject(err);
      } else {
        deferred.resolve(res);
        if (this.verbose) {
          keys.forEach(key => {
            console.info(`DELETE OBJECT s3://${bucket}/${key}`);
          });
        }
      }
    });

    return deferred.promise;
  }

  /**
   * Lists all the s3 objects in the given folder.
   *
   * @param {String} bucket - The bucket
   * @param {String} prefix - The prefix for the folder to list keys for
   * @param {String} [marker] - The key to start listing from, alphabetically
   * @returns {Promise} An array containing all the keys in <code>s3://bucket/prefix</code>.
   */

  list(bucket, prefix, marker) {

    let deferred = Promise.defer();
    let self = this;
    let allKeys = [];
    marker = marker || '';

    recurse(bucket, prefix, marker, err => {
      if (err) {
        deferred.reject(err);
      } else {
        allKeys = allKeys.filter(key => key.Key != prefix);
        deferred.resolve(allKeys)
      }
    });

    function recurse(bucket, prefix, marker, done) {
      self.s3.listObjects({
        Bucket: bucket,
        Prefix: prefix,
        Marker: marker
      }, (err, keys) => {
        if (err) {
          done(err);
        } else {
          if (self.verbose) {
            console.info(`LIST OBJECTS s3://${bucket}/${marker == '' ? prefix : marker}`);
          }
          if (keys.Contents.length == 0) {
            done();
          } else {
            marker = keys.Contents[keys.Contents.length - 1].Key;
            allKeys = allKeys.concat(keys.Contents);
            if (keys.length < 1000) {
              done();
            } else {
              recurse(bucket, prefix, marker, done);
            }
          }
        }
      });
    };

    return deferred.promise;
  }

  /**
   * Lists all the keys in the given s3 folder.
   *
   * @param {String} bucket - The bucket
   * @param {String} prefix - The prefix for the folder to list keys for
   * @param {String} [marker] - The key to start listing from, alphabetically
   * @returns {Promise} An array containing all the keys in <code>s3://bucket/prefix</code>.
   */

  keys(bucket, prefix, marker) {

    let self = this;
    let allKeys = [];
    let deferred = Promise.defer();
    marker = marker || '';

    recurse(bucket, prefix, marker, err => {
      if (err) {
        deferred.reject(err);
      } else {
        allKeys = allKeys.filter(key => key.length > 0);
        deferred.resolve(allKeys)
      }
    });

    function recurse(bucket, prefix, marker, done) {
      self.s3.listObjects({
        Bucket: bucket,
        Prefix: prefix,
        Marker: marker
      }, (err, keys) => {
        if (err) {
          done(err);
        } else {
          if (self.verbose) {
            console.info(`LIST OBJECTS s3://${bucket}/${marker == '' ? prefix : marker}`);
          }
          if (keys.Contents.length == 0) {
            done();
          } else {
            marker = keys.Contents[keys.Contents.length - 1].Key;
            keys = keys.Contents.map(key => key.Key.replace(prefix, ''));
            allKeys = allKeys.concat(keys);
            if (keys.length < 1000) {
              done();
            } else {
              recurse(bucket, prefix, marker, done);
            }
          }

        }
      });
    };

    return deferred.promise;
  }
}

module.exports = S3renity;
