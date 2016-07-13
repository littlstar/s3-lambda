'use strict'

const aws = require('aws-sdk');
const s3Mock = require('mock-aws-s3');

class S3 {

  /**
   * @constructor
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
    this.verbose = config.verbose || false;
    if (config.local_path) {

      // use local files (using mock aws sdk)
      s3Mock.config.basePath = config.local_path;
      this.s3 = new s3Mock.S3();
    } else {

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
    }
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

    // default transform is to assume a utf8 encoded text file
    if (transformer == null) {
      transformer = obj => {
        return obj.Body.toString(encoding);
      };
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
            success(transformer(object));
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

    encoding = encoding || 'utf8';

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
      this.copy(bucket, key, targetBucket, targetKey).then(_ => {
        this.delete(bucket, key).then(_ => success()).catch(e => fail(e));
      }).catch(e => fail(e));
    });
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

    // creates input with format: { Key: key } required by s3
    let input = keys.map(key => {
      return {
        Key: key
      };
    });

    return new Promise((success, fail) => {
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
   * Lists all the s3 objects in the given folder.
   *
   * @param {String} bucket - The bucket
   * @param {String} prefix - The prefix for the folder to list keys for
   * @param {String} [marker] - The key to start listing from, alphabetically
   * @returns {Promise} An array containing all the keys in <code>s3://bucket/prefix</code>.
   */

  list(bucket, prefix, marker) {

    let self = this;
    let allKeys = [];
    marker = marker || '';

    return new Promise((success, fail) => {
      recurse(bucket, prefix, marker, err => {
        if (err) {
          fail(err);
        } else {
          allKeys = allKeys.filter(key => key.Key != prefix);
          success(allKeys)
        }
      });
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
    marker = marker || '';

    return new Promise((success, fail) => {
      recurse(bucket, prefix, marker, err => {
        if (err) {
          fail(err);
        } else {
          allKeys = allKeys.filter(key => key.length > 0);
          success(allKeys)
        }
      });
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
  }
}

module.exports = S3;
