/**
 * S3renity
 * @author Wells Johnston <wells@littlstar.com>
 */

'use strict'

const Batch = require('batch');
const aws = require('aws-sdk');
const awsM = require('mock-aws-s3');
const BatchRequest = require('./BatchRequest');

/**
 * S3renity allows you to run {@link BatchRequest}, as well as interact with s3
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
   */

  constructor(config) {

    config = config || {};
    this.verbose = config.verbose || false;

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
          timeout: config.timeout || 1000
        }
      };

      this.s3 = new aws.S3(s3opts);
    } else {

      /* use local files (using mock aws sdk) */
      awsM.config.basePath = config.local_path;
      this.s3 = new awsM.S3();
    }
  }

  /**
   * Creates a new {@link BatchRequest} context.
   *
   * @param {String} bucket - The bucket to use, or a valid s3 path
   * @param {String} prefix - The prefix (folder) to use. Leave null if you
   * gave an s3 path
   * @param {String} [marker] - The key to start from
   * @returns {BatchRequest} A new batch request instance.
   */

  context(bucket, prefix, marker) {

    let sources = null;
    let getKeys = [];
    let batch = new Batch;
    let deferred = Promise.defer();

    if (typeof bucket == 'object') {
      sources = bucket;
    } else {
      sources = [{
        bucket: bucket,
        prefix: prefix,
        marker: marker
      }];
    }

    sources.forEach(source => {
      batch.push(done => {

        /* list each source in parallel */
        this.keys(source.bucket, source.prefix, source.marker).then(files => {

          /* format sources and ignore empty files (directories) */
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

    if (this.verbose) {
      batch.on('progress', status => {
        console.info('listing keys in context...');
      });
    }

    batch.end((err, sources) => {
      if (err) {
        deferred.reject(err);
      }

      /* flatten the array (of array) of sources */
      sources = sources.reduce((prev, cur) => prev.concat(cur), []);
      deferred.resolve(sources);
    })

    /* create a new batch request context with a s3renity instance */
    return new BatchRequest(this, deferred.promise);
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

          keys = keys.Contents;
          marker = keys[keys.length - 1].Key.replace(prefix, '');
          allKeys = allKeys.concat(keys);

          if (keys.length < 1000) {
            done();
          } else {
            recurse(bucket, prefix, marker, done);
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

          keys = keys.Contents.map(key => {
            return key.Key.replace(prefix, '');
          });

          marker = keys[keys.length - 1];
          allKeys = allKeys.concat(keys);

          if (keys.length < 1000) {
            done();
          } else {
            recurse(bucket, prefix, marker, done);
          }
        }
      });
    };

    return deferred.promise;
  }
}

module.exports = S3renity;
