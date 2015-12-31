'use strict'

const TYPE_S3 = 's3';
const TYPE_FILE = 'file';

class S3 {

  constructor(s3, verbose) {
    this.s3 = s3;
    this.verbose = verbose;
  }

  /**
   * Take a path or s3 key and resolve it.
   *
   * @private
   * @param {string} key an s3 key or local file path
   * @return {object} An object wity keys: bucket, prefix, file, and type.
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
   * @private
   * @param {string} key The S3 key to get the file name for.
   * @return {string} The filename from the S3 key.
   */

  getFileName(key) {
    return key.substr(key.lastIndexOf('/') + 1, key.length);
  }

  /**
   * Returns a promise that gets an object from s3.
   *
   * @public
   * @param {String} bucket The bucket to get from.
   * @param {String} key The key of the object to get.
   * @param {String} encoding Optional. Encodnig to use when calling toString()
   * on the object body. Default is 'utf8'.
   * @return {Promise} Fulfilled when object is retrieved.
   */

  get(bucket, key, transformer) {
    var useEncoding = false;
    if (transformer == null) {
      transformer = 'utf8';
    }
    if (typeof transformer == 'string') {
      useEncoding = true;
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
            if (useEncoding) {
              success(object.Body.toString(transformer));
            } else {
              success(transformer(object.Body));
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
   * Returns a promise that puts an object in s3.
   *
   * @public
   * @param {String} bucket The s3 bucket to use.
   * @param {String} key The key path where the object will be placed.
   * @param {String} body The object body.
   * @param {String} encoding The encoding of the object text.
   * @return {Promise} Fulfilled when the object is written to s3. Returns
   * response from s3.
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
   * Copies an object in S3 from sourceKey to targetKey
   *
   * @public
   * @param {string} bucket The s3 bucket to use.
   * @param {string} sourceKey The source of the object to copy.
   * @param {string} targetKey The target to copy the object to in s3.
   */

  copy(sourceBucket, sourceKey, targetBucket, targetKey) {
    return new Promise((success, fail) => {
      this.s3.copyObject({
        Bucket: targetBucket,
        Key: targetKey,
        CopySource: `${sourceBucket}/${sourceKey}`
      }, (err, res) => {
        console.log(err, res);
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
   * @param {String|Array} key The key of the object to delete
   * @return {promise} Fulfilled when the object deleted. Returns `this`.
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

  //TODO(wells) make this better
  deleteObjects(bucket, keys) {
    return new Promise((success, fail) => {
      keys.map((key, i, arr) => {
        arr[i] = {
          Key: key
        };
      });
      this.s3.deleteObjects({
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
            keys.forEach(key => {
              console.info(`DELETE OBJECT s3://${bucket}/${key}`);
            });
          }
        }
      });
    });
  }

  /**
   * Returns all the keys in the working context.
   *
   * @public
   * @return {promise} Fulfilled when all the keys are retrieved from s3.
   */

  list(bucket, prefix, marker) {

    return new Promise((success, fail) => {
      listRecursive([], marker, success, fail);
    });

    function listRecursive(allKeys, marker, success, fail) {
      S3.listObjects(bucket, prefix, marker).then(keys => {
        if (keys.length == 0) {
          success(allKeys);
          return;
        }
        keys.forEach(key => {
          allKeys.push(key.Key);
          marker = key.Key;
        });
        listRecursive(allKeys, marker, success, fail);
        return;
      }).catch(fail);
    };
  }

  /**
   * Return a promise that gets keys from s3 given a bucket, prefix and marker.
   *
   * @public
   * @param {string} bucket The bucket to get the keys from.
   * @param {string} prefix The prefix for the folder where the keys are.
   * @param {string} [marker] The marker to start from (optional).
   * @return {promise} Fulfilled when the keys are retrieved from s3.
   */

  listObjects(bucket, prefix, marker) {
    return new Promise((success, fail) => {
      if (prefix[prefix.length - 1] != '/') prefix += '/';
      this.s3.listObjects({
        Bucket: bucket,
        Prefix: prefix,
        Marker: marker
      }, (err, keys) => {
        if (err) {
          fail(err);
        } else {
          keys = keys.Contents;
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
   * @param {String} body The body to write.
   * @param {String|Object} targets Either a single s3 target or an array of
   * targets.
   * @return {promise} Fulfilled when the file is finished saving. Returns the
   * response either from `fs` or s3.
   */

  write(targets, body, encoding) {
    if (encoding == null) {
      encoding = 'utf8'
    }
    if (typeof targets == 'string') {
      targets = [targets];
    }
    return new Promise((success, fail) => {
      var outputPromises = [];
      targets.forEach(target => {
        target = this.resolveKey(target);
        outputPromises.push(new Promise((_success, _fail) => {
          if (target.type == TYPE_S3) {
            this
              .put(target.bucket, target.prefix, body)
              .then(_success).catch(_fail);
          } else if (target.type == TYPE_FILE) {
            fs.writeFile(target.file, body, (err, res) => {
              if (err) {
                _fail(err);
              } else {
                _success();
              }
            });
          }
        }));
      });
      Promise.all(outputPromises).then(success).catch(fail);
    });
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
    return new Promise((success, fail) => {
      if (delimiter == null) delimiter = '\n';
      if (encoding == null) encoding = 'utf8';
      this.get(bucket, key).then(body => {
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
