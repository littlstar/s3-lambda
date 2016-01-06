'use strict'

/**
 * A `Context` enables you to chain set conditions for batch functions. Contexts are reusable.
 */

class Context {

  /**
   * Creates a new <code>Context</code> to perform batch operations with. You can
   * either supply an s3 path like <code>s3://<bucket>/path/to/folder</code>
   * or a bucket and prefix.
   *
   * @param {S3renity} s3 - The s3renity instance used for internal requests
   * @param {String} bucket - The bucket to use
   * @param {String} prefix - The prefix (folder) to use
   * @param {String} [marker] - The key to start at when getting objects
   */

  constructor(s3, bucket, prefix, marker) {
    let context = s3.resolveKey(bucket);
    if (context.type == 's3') {
      this.bucket = context.bucket;
      this.prefix = context.prefix;
    } else {
      this.bucket = bucket;
      this.prefix = prefix;
    }
    this._marker = marker;
    this.s3 = s3;
  }

  /**
   * Sets the marker.
   *
   * @param {String} marker - The marker to start with for getting objects
   * @returns {Context} <code>this</code>
   */

  marker(marker) {
    this._marker = marker;
    return this;
  }

  /**
   * Sets the encoding to use when getting s3 objects with
   * <code>object.Body.toString(encoding)</code>. If not set, <code>utf8</code>
   * is used.
   *
   * @param {String} encoding - The encoding
   * @returns {Context} <code>this</code>
   */

  encode(encoding) {
    this.encoding = encoding;
    return this;
  }

  /**
   * Sets a transformation function to be used when getting objects from s3. If
   * set, this takes precedence over using <code>this.encoding</code>.
   *
   * @param {Function} transformer - The function to use to transform the object
   * @returns {Context} <code>this</code>
   */

  transform(transformer) {
    this.transformer = transformer;
    return this;
  }

  /**
   * Sets the output directory for map or filter.  If a target is set, map and
   * filter write to that location instead of changing the original objects
   * themselves.
   *
   * @param {String} target - The location to send the output of map or filter
   * @return {Context} <code>this</code>
   */

  target(target) {
    this._target = this.s3.resolveKey(target);
    return this;
  }
}

module.exports = Context;
