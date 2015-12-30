'use strict'

const TYPE_S3 = 's3';
const TYPE_FILE = 'file';

class S3 {

  constructor(s3instance) {
    this.s3 = s3instance;
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
   * @param {string} arg1 Can either be a valid s3 path or a bucket.
   * @param {string} arg2 Optional. If arg1 is a bucket, arg2 is the key.
   * @return {promise} Fulfilled when object is retrieved.
   */

  get(arg1, arg2) {
    var target = S3.resolveKey(arg1),
      bucket, key;
    if (target.type == TYPE_S3) {
      bucket = target.bucket;
      key = target.prefix;
    } else {
      bucket = arg1;
      key = arg2;
    }
    if (this.verbose) {
      console.info('get object', bucket, key);
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
            if (this.transformer == null) {
              success(object.Body.toString(this.encoding));
            } else {
              success(this.transformer(object.Body));
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
   * @param {string} bucket The s3 bucket to use.
   * @param {string} key The key path where the object will be placed.
   * @param {string} body The object body.
   * @return {promise} Fulfilled when the object is written to s3. Returns
   * response from s3.
   */

  put(bucket, key, body) {
    if (this.verbose) {
      console.info('put object', bucket, key);
    }
    return new Promise((success, fail) => {
      this.s3.putObject({
        Bucket: bucket,
        Key: key,
        Body: body
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
   * @param {string} bucket The s3 bucket to use.
   * @param {string|array} keys The key of the object to delete, or an array of
   * keys.
   * @return {promise} Fulfilled when the object deleted. Returns `this`.
   */

  delete(bucket, key) {
    if (typeof key == 'object') {
      return this.deleteObjects(bucket, key);
    }
    if (this.verbose) {
      console.info('delete object', bucket, key);
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
    if (this.verbose) {
      console.info('delete objects', bucket, keys);
    }
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
   * @param {string} target The location to write to.  Can be a local file,
   * s3 path like: s3://<bucket>/path/to/file, or an array of paths.
   * @return {promise} Fulfilled when the file is finished saving. Returns the
   * response either from `fs` or s3.
   */

  write(body, targets) {
    return new Promise((success, fail) => {
      if (typeof targets == 'string') {
        targets = [targets];
      }
      var outputPromises = [];
      targets.forEach(target => {
        target = S3.resolveKey(target);
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
