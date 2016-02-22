/**
 * S3renity
 * @author Wells Johnston <wells@littlstar.com>
 */
'use strict'

const aws = require('aws-sdk');
const awsM = require('mock-aws-s3');
const fs = require('fs');
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

      let s3opts = {
        maxRetries: config.max_retries || 10,
        httpOptions: {
          timeout: config.timeout || 1000
        }
      };

      this.s3 = new aws.S3(s3opts);
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
    marker = marker || '';
    prefix = prefix[prefix.length-1] == '/' ? prefix : prefix + '/';
    return new BatchRequest(this, bucket, prefix, marker);
  }

  /**
   * @ignore
   * @typedef Target
   * @type Object
   * @property {String} bucket The target bucket
   * @property {String} prefix The target prefix
   * @property {String} file The local file, if any
   * @property {String} type 's3' or 'file'
   */

  /**
   * Returns the filename (last part of the key) from an S3 key.
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
   * @param {String} bucket The source bucket
   * @param {String} key The source key
   * @param {String} targetBucket The target bucket
   * @param {String} targetKey The target key
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
          if (this.verbose) {
            console.info(`COPY OBJECT s3://${bucket}/${key} --> s3://${targetBucket}/${targetKey}`);
          }
          success();
        }
      });
    });
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
    return new Promise((success, fail) => {
      this.copy(bucket, key, targetBucket, targetKey).then(() => {
        this.delete(bucket, key).catch(fail);
      }).catch(fail);
    });
  }

  /**
   * Deletes an object or array of objects in S3.
   *
   * @public
   * @param {String} bucket - The bucket
   * @param {String|Array} key - The key to delete or an array of keys to delete
   * @returns {Promise} The key (or array of keys) that was deleted.
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
          success();
          if (this.verbose) {
            console.info(`DELETE OBJECT s3://${bucket}/${key}`);
          }
        }
      });
    });
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
    return new Promise((success, fail) => {
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
          fail(err);
        } else {
          success(res);
          if (this.verbose) {
            keys.forEach(key => {
              console.info(`DELETE OBJECT s3://${bucket}/${key}`);
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
   * @returns {Promise} An array containing all the keys in <code>s3://bucket/prefix</code>.
   */

  list(bucket, prefix, marker) {

    let self = this;
    marker = marker || '';

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
   * @param {String} bucket - The bucket to get the keys from
   * @param {String} prefix - The prefix for the folder where the keys are
   * @param {String} [marker] - The key to start listing from
   * @returns {Promise}
   */

  listObjects(bucket, prefix, marker) {
    marker = marker || '';
    return new Promise((success, fail) => {
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
   * @param {String} bucket - The s3 bucket to use
   * @param {String} key - The key to the object
   * @param {String} delimiter - Optional, default is \n. The character to use in
   * the split over the object's body
   * @param {String} encoding - Optional, default is utf8
   * @returns {Promise} An array that is the split object.
   */

  split(bucket, key, delimiter, encoding) {
    delimiter = delimiter || '\n';
    encoding = encoding || 'utf8'
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
