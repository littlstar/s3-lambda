'use strict'

const TYPE_S3 = 's3';
const TYPE_FILE = 'file';

class S3 {

  /**
   * @constructor
   * @param {Object} aws The aws sdk instance.
   * @param {Boolean} verbose Whether to use verbose mode with s3.
   */
  constructor(aws, verbose) {
    this.aws = aws;
    this.verbose = verbose;
  }

  /**
   * Take a path or s3 key and resolve it.
   *
   * @private
   * @param {String} key an s3 key or local file path
   * @return {Object} An object wity keys: bucket, prefix, file, and type.
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
   * Returns the filename (last part of the key) from an S3 key.
   *
   * @param {string} key The S3 key to get the file name for.
   * @return {string} The filename from the S3 key.
   */

  getFileName(key) {
    return key.substr(key.lastIndexOf('/') + 1, key.length);
  }

  /**
   * @param {String} bucket The bucket to get from.
   * @param {String} key The key of the object to get.
   * @param {String} encoding Optional. Default is 'utf8'
   * @param {Function} transformer Optional. If supplied, this function will be
   * run on Object.Body before returning. Useful for dealing with compressed
   * files or weird formats.
   * @return {Promise} Fulfilled when object is retrieved.
   */

  get(bucket, key, encoding, transformer) {
    if (encoding == null) {
      encoding = 'utf8';
    }
    return new Promise((success, fail) => {
      this.aws.getObject({
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
   * @param {String} bucket The s3 bucket to use.
   * @param {String} key The key path where the object will be placed.
   * @param {String} body The object body.
   * @param {String} encoding Optional. Default is 'utf8'.
   * @return {Promise} Fulfilled when the object is written to s3. Returns
   * response from s3.
   */

  put(bucket, key, body, encoding) {
    if (encoding == null) {
      encoding = 'utf8';
    }
    return new Promise((success, fail) => {
      this.aws.putObject({
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
   * @param {String} sourceBucket The s3 bucket to use.
   * @param {String} sourceKey The source of the object to copy.
   * @param {String} targetBucket The target bucket to copy to.
   * @param {String} targetKey The target to copy the object to in s3.
   * @return {Promise}
   */

  copy(sourceBucket, sourceKey, targetBucket, targetKey) {
    return new Promise((success, fail) => {
      this.aws.copyObject({
        Bucket: targetBucket,
        Key: targetKey,
        CopySource: `${sourceBucket}/${sourceKey}`
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
   * Returns a promise that deletes an object in S3.
   *
   * @public
   * @param {String} bucket The s3 bucket to use.
   * @param {String} key The key of the object to delete
   * @return {Promise} Fulfilled when the object deleted. Returns `this`.
   */

  delete(bucket, key) {
    return new Promise((success, fail) => {
      this.aws.deleteObject({
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
   * Deletes a list of objects in S3.
   *
   * @public
   * @param {string} bucket The s3 bucket to use.
   * @param {array} keys The keys of the objects to delete.
   * @return {promise} Fulfilled when objects are deleted. Returns response.
   */

  deleteObjects(bucket, keys) {
    return new Promise((success, fail) => {
      keys.map((key, i, arr) => {
        arr[i] = {
          Key: key
        };
      });
      //TODO(wells) this can't really work
      this.aws.deleteObjects({
        Bucket: bucket,
        Delete: {
          Objects: keys
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
   * Returns all the keys in the working context.
   *
   * @return {promise} Fulfilled when all the keys are retrieved from s3.
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
   * @public
   * @param {String} bucket The bucket to get the keys from.
   * @param {String} prefix The prefix for the folder where the keys are.
   * @param {String} marker Optional. The key to start listing from.
   * @return {Promise} Fulfilled when the keys are retrieved from s3.
   */

  listObjects(bucket, prefix, marker) {
    if (marker == null) {
      marker = '';
    }
    return new Promise((success, fail) => {
      if (prefix[prefix.length - 1] != '/') {
        prefix += '/';
      }
      this.aws.listObjects({
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

          // aws sometimes returns the folder as a key for some reason,
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
   * Output the working context to a file or location in s3.
   *
   * @public
   * @param {String} target Either a valid s3 path 's3://' or local file path.
   * @param {String} body
   * @param {String} encoding
   * @return {Promise} Fulfilled when the file is finished saving. Returns the
   * response either from `fs` or s3.
   */

  write(target, body, encoding) {
    if (encoding == null) {
      encoding = 'utf8'
    }
    target = this.resolveKey(target);
    if (target.type == TYPE_S3) {
      return this.put(target.bucket, target.prefix, body, encoding);
    } else if (target.type == TYPE_FILE) {
      return new Promise((success, fail) => {
        fs.writeFile(target.file, body, (err, res) => {
          if (err) {
            fail(err);
          } else {
            success();
            if (this.verbose) {
              console.info(`WRITE FILE ${target.file}`);
            }
          }
        });
      });
    }
  }

  /**
   * Splits an object in s3 by a delimiter and returns.
   *
   * @param {string} bucket The s3 bucket to use.
   * @param {string} key The key to the object.
   * @param {string} delimiter Optional, default is \n. The character to use in
   * the split over the object's body.
   * @param {string} encoding Optional, default is utf8.
   * @return {promise} Returns an array that is the split of the object.
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

module.exports = S3;
