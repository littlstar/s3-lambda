'use strict'

/**
 * A `Context` enables you to chain set conditions for batch functions. Contexts are reusable.
 */

class Context {

  /**
   * Creates a new `Context` to perform batch operations with. You can
   * either supply an s3 path s3://bucket/path/to/folder or a bucket and prefix
   *
   * @param {S3renity} s3renity - The s3renity instance used for internal requests
   * @param {String} bucket - The bucket to use
   * @param {String} prefix - The prefix (folder) to use
   * @param {String} [marker] - The key to start at when getting objects
   */

  constructor(s3renity, bucket, prefix, marker) {
    let context = s3renity.resolveKey(bucket);
    if (context.type == 's3') {
      this.bucket = context.bucket;
      this.prefix = context.prefix;
    } else {
      this.bucket = bucket;
      this.prefix = prefix;
    }
    this.marker = marker;
    this.s3 = s3renity;
  }

  /**
   * Sets the marker.
   *
   * @param {String} marker - The marker to start with for getting objects.
   * @returns {Context} `this`
   */

  marker(marker) {
    this.marker = marker;
    return this;
  }

  /**
   * Sets the encoding to use when getting s3 objects with
   * `object.Body.toString(encoding)`. If not set, 'utf8' is used.
   *
   * @param {String} encoding - The encoding
   * @returns {Context} `this`
   */

  encode(encoding) {
    this.encoding = encoding;
    return this;
  }

  /**
   * Sets a transformation function to be used when getting objects from s3. If
   * set, this takes precedence over using `this.encoding`.
   *
   * @param {Function} transformer - The function to use to transform the object.
   * @returns {Context} `this`
   */

  transform(transformer) {
    this.transformer = transformer;
    return this;
  }

  /**
   * Split each s3 object by `delimiter` when getting them for batch operations.
   * This effectively moves the working context to lines of text instead of s3
   * objects.
   *
   * @param {String} delimiter='\n' The character to split the document objects by
   * @returns {Context} `this`
   */

  split(delimiter) {
    this.delimiter = delimiter || '\n';
    return this;
  }

  /**
   * Sets the output directory for map or filter.  If a target is set, map and
   * filter write to that location instead of changing the original objects
   * themselves.
   *
   * @param {String} target - The location to send the output of map or filter
   * @return {Context} `this`
   */

  target(target) {
    this.target = this.s3.resolveKey(target);
    return this;
  }

}

module.exports = Context;
