'use strict'

/**
 * A <code>Context</code> enables you to chain set conditions for batch functions. Contexts are reusable.
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
    this.bucket = bucket;
    this.prefix = prefix;
    this._marker = marker || '';
    this.encoding = 'utf8';
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
   * Getter for marker
   * @ignore
   * @returns {String} The marker
   */

  get marker() {
    return this._marker;
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
   * Sets a transformation function to be used when getting objects from s3.
   * Using <code>transform</code> takes precedence over <code>encode</code>.
   *
   * @param {Function} transformer - The function to use to transform the
   * object. The transforation function takes an s3 object as a parameter
   * and should return the file's contents as a string.
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
   * @param {String} bucket - The target bucket.
   * @param {String} prefix - The target prefix (folder) where the output will go.
   * @return {Context} <code>this</code>
   */

  output(bucket, prefix) {
    this.target = {};
    this.target.bucket = bucket;
    this.target.prefix = prefix;
    return this;
  }
}

module.exports = Context;
