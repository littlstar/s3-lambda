/**
 * S3renity
 * @author Wells Johnston <wells@littlstar.com>
 */
'use strict'

const aws = require('aws-sdk');
const awsM = require('mock-aws-s3');
const fs = require('fs');
const TYPE_S3 = 's3';
const TYPE_FILE = 'file';
const BatchRequest = require('./BatchRequest');

/**
 * A S3renity instance allows you to create contexts for batch requests.  It
 * also gives you a promise-based wrapper around the S3 api.
 */

class S3renity {

  /**
   * @param {Object} [config] - Options to initialize s3renity with. If `access_key_id`
   * and `secret_access_key` are left out, the aws sdk will attempt
   * to use the computer's default credentials.
   * @param {String} config.access_key_id=null AWS Access Key
   * @param {String} config.secret_access_key=null AWS Secret Key
   * @param {Integer} config.timeout=120 Timeout allowed for aws api requests
   * @param {Integer} config.maxRetries=30 Max retries allowed for aws api requets
   * @param {Boolean} config.verbose=false Whether to use verbose mode when making requets
   */

  constructor(config) {
    config = config || {};
    this.verbose = config.verbose || false;

    if (config.local_path != null) {

      // use local files (using mock aws sdk)
      awsM.config.basePath = config.local_path;
      this.s3 = new awsM.S3();
    } else {

      // use the aws sdk. attempt to use aws credentials in config.  if they
      // are not present, the aws sdk could pick them up in ~/.aws/credentials
      // or elsewhere
      if (config.access_key_id && config.secret_access_key) {
        aws.config.update({
          accessKeyId: config.access_key_id,
          secretAccessKey: config.secret_access_key
        });
      }

      let s3opts = {};
      if (config.timeout) {
        s3opts.httpOptions = {
          timeout: config.timeout
        };
      }
      if (config.maxRetries) {
        s3opts.maxRetries = config.maxRetries;
      }
      this.s3 = new aws.S3(s3opts);
    }
  }

  /**
   * Creates a new `BatchRequest` to perform batch operations with. You can
   * either supply an s3 path s3://bucket/path/to/folder or a bucket and prefix
   *
   * @param {String} bucket - The bucket to use
   * @param {String} prefix - The prefix (folder) to use
   * @param {String} [marker] - The key to start at when getting objects
   */

  context(bucket, key, marker) {
    return new BatchRequest(this, bucket, key, marker);
  }

  /**
   * Resolves a key into a s3 file path. TODO(wells) used?
   *
   * @private
   * @param {String} key An s3 key or local file path
   * @return {Object} An object wity keys: bucket, prefix, file, and type
   */

  resolveKey(key) {
    var target = {};
    if (key.indexOf('s3://') == 0) {
      key = key.substr(5, key.length - 1);
      target.bucket = key.split('/')[0];
      target.prefix = key.substr(key.indexOf('/') + 1, key.length);
      target.file = null;
      target.type = TYPE_S3;
    } else {
      target.bucket = null;
      target.prefix = null;
      target.file = key;
      target.type = TYPE_FILE;
    }
    return target;
  }

  /**
   * Returns the filename (last part of the key) from an S3 key. TODO(wells) used?
   *
   * @private
   * @param {String} key - The S3 key to get the file name for
   * @return {String} - The filename from the S3 key
   */

  getFileName(key) {
    return key.substr(key.lastIndexOf('/') + 1, key.length);
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
    if (encoding == null) {
      encoding = 'utf8';
    }
    return new Promise((success, fail) => {
      this.s3.getObject({
        Bucket: bucket,
        Key: key
      }, (err, object) => {
        if (err) {
          fail(err);
        } else {
          try {
            if (transformer != null) {
              success(transformer(object));
            } else {
              success(object.Body.toString(encoding));
            }
            if (this.verbose) {
              console.info(`GET OBJECT s3://${bucket}/${key}`);
            }
          } catch (e) {
            fail(e);
          }
        }
      });
    });
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
    if (encoding == null) {
      encoding = 'utf8';
    }
    return new Promise((success, fail) => {
      this.s3.putObject({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentEncoding: encoding
      }, (err, res) => {
        if (err) {
          fail(err);
        } else {
          if (this.verbose) {
            console.info(`PUT OBJECT s3://${bucket}/${key}`);
          }
          success(res);
        }
      });
    });
  }

  /**
   * Copies an object in S3.
   *
   * @public
   * @param {String} bucket The source bucket.
   * @param {String} key The source key.
   * @param {String} targetBucket The target bucket.
   * @param {String} targetKey The target key.
   * @return {Promise}
   */

  copy(bucket, key, targetBucket, targetKey) {
    return new Promise((success, fail) => {
      this.s3.copyObject({
        Bucket: targetBucket,
        Key: targetKey,
        CopySource: `${bucket}/${key}`
      }, (err, res) => {
        if (err) {
          fail(err);
        } else {
          success(res);
        }
      });
    });
  }

  /**
   * Deletes an object or array of objects in S3.
   *
   * @public
   * @param {String} bucket - The bucket
   * @param {String|Array} key - The key to delete or an array of keys to delete
   * @returns {Promise}
   */

  delete(bucket, key) {
    if (typeof key == 'object') {
      return this.deleteObjects(bucket, key);
    }
    return new Promise((success, fail) => {
      this.s3.deleteObject({
        Bucket: bucket,
        Key: key
      }, (err, res) => {
        if (err) {
          fail(err);
        } else {
          success(res);
          if (this.verbose) {
            console.info(`DELETE OBJECT s3://${bucket}/${key}`);
          }
        }
      });
    });
  }

  /**
   * Deletes a list of objects in S3
   *
   * @private
   * @param {String} bucket The s3 bucket to use
   * @param {Array} keys The keys of the objects to delete
   * @returns {Promise} Fulfilled when objects are deleted. Returns response.
   */

  deleteObjects(bucket, keys) {
    return new Promise((success, fail) => {
      // creates input with format: { Key: key }
      let input = [];
      keys.forEach((key, i, arr) => {
        input.push({
          Key: key
        });
      });
      this.s3.deleteObjects({
        Bucket: bucket,
        Delete: {
          Objects: input
        }
      }, (err, res) => {
        if (err) {
          fail(err);
        } else {
          success(res);
          if (this.verbose) {
            console.info('DELETE OBJECTS');
            keys.forEach(key => {
              console.info(`s3://${bucket}/${key}`);
            });
          }
        }
      });
    });
  }

  /**
   * Lists all the keys in the given s3 folder.
   *
   * @param {String} bucket - The bucket
   * @param {String} prefix - The prefix for the folder to list keys for
   * @param {String} [marker] - The key to start listing from, alphabetically
   * @returns {Promise} Array containing all the keys in `s3://bucket/prefix`
   */

  list(bucket, prefix, marker) {

    let self = this;
    if (marker == null) {
      marker = '';
    }

    return new Promise((success, fail) => {
      listRecursive(marker, success, fail);
    });

    function listRecursive(marker, success, fail, allKeys) {
      if (allKeys == null) {
        allKeys = [];
      }
      self.listObjects(bucket, prefix, marker).then(keys => {
        if (keys.length == 0) {
          success(allKeys);
          return;
        }
        keys.forEach(key => {
          allKeys.push(key.Key);
          marker = key.Key;
        });
        listRecursive(marker, success, fail, allKeys);
      }).catch(fail);
    };
  }

  /**
   * Return a promise that gets keys from s3 given a bucket, prefix and marker.
   * TODO(wells) don't do the second lookup if # results < 1000
   *
   * @private
   * @param {String} bucket - The bucket to get the keys from.
   * @param {String} prefix - The prefix for the folder where the keys are.
   * @param {String} marker - Optional. The key to start listing from.
   * @returns {Promise}
   */

  listObjects(bucket, prefix, marker) {
    if (marker == null) {
      marker = '';
    }
    return new Promise((success, fail) => {
      if (prefix[prefix.length - 1] != '/') {
        prefix += '/';
      }
      this.s3.listObjects({
        Bucket: bucket,
        Prefix: prefix,
        Marker: marker
      }, (err, keys) => {
        if (err) {
          fail(err);
        } else {
          if (this.verbose) {
            console.info(`LIST OBJECTS s3://${bucket}/${marker == '' ? prefix : marker}`);
          }
          keys = keys.Contents;

          // s3 sometimes returns the folder as a key for some reason,
          // so shift it off
          if (keys.length && keys[0].Key == prefix) {
            keys.shift();
          }
          success(keys);
        }
      });
    });
  }

  /**
   * Splits an S3 object by a delimiter.
   *
   * @private
   * @param {String} bucket - The s3 bucket to use.
   * @param {String} key - The key to the object.
   * @param {String} delimiter - Optional, default is \n. The character to use in
   * the split over the object's body.
   * @param {String} encoding - Optional, default is utf8.
   * @returns {Promise} An array that is the split of the object.
   */

  splitObject(bucket, key, delimiter, encoding) {
    if (delimiter == null) {
      delimiter = '\n';
    }
    if (encoding == null) {
      encoding = 'utf8';
    }
    return new Promise((success, fail) => {
      this.get(bucket, key, encoding).then(body => {
        if (body == '') {
          success([]);
        } else {
          try {
            success(body.split(delimiter));
          } catch (err) {
            fail(err);
          }
        }
      }).catch(fail);
    });
  }

}

module.exports = S3renity;
