'use strict'

const S3 = require('./S3');

class Context {

  /**
   * @constructor
   * @param {String} key A valid S3 key, which is used to generate the context
   * for the batch operations.
   */

  constructor(key) {
    let context = S3.resolveKey(key);
    if (context.type != 's3') {
      throw new Error('context must be valid s3 path');
    }
    this.bucket = context.bucket;
    this.prefix = context.prefix;
  }

  /**
   * Set the marker for the working context (file to start on)
   * @public
   * @param {String} marker The marker to start with for getting objects.
   * @return {Context} `this`
   */

  marker(marker) {
    this._marker = marker;
    return this;
  }

  /**
   * Set the working context based on an s3 key.
   *
   * @public
   * @param {String} key a key in the form: "s3://<your-bucket>/path/to/folder/"
   * @returns {S3renity} `this`
   */

  encode(encoding) {
    this.encoding = encoding;
    return this;
  }

  /**
   * Transforms the S3 object before proceeding.
   *
   * @param {Function} transform The function to use to transform the object.
   * @return {S3renity} `this`
   */

  transform(transformer) {
    this.transformer = transformer;
    return this;
  }

  /**
   * Move the context from s3 objects to objects split by a delimiter.
   *
   * @public
   * @param {string} delimiter The character to split the document objects by.
   * Default is "\n"
   * @return {S3renity} `this`
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
   * @public
   * @param {String} target The location to send the output of map or filter.
   * @return {S3renity} `this`
   */

  target(target) {
    this.target = S3.resolveKey(target);
    return this;
  }

  /**
   * Creates and returns a forEach batch request in the given context.
   *
   * @public
   * @param {Function} func This function takes an s3 object and performs a
   * synchronous function. If isAsync is true, func returns a promise.
   * @param {Boolean} isAsync Optional. Default is false. If set to true, this
   * indicates that func returns a promise that should be executed.
   * @returns {Promise} Fulfilled when the mapper functions are done. Returns a
   * list of keys that were operated over.
   */

  forEach(func, isAsync) {
    let batch = new BatchRequest(this);
    return batch.forEach(func, isAsync);
  }

  map(func, isAsync) {
    let batch = new BatchRequest(this);
    return batch.map(func, isAsync);
  }

  reduce(func, initialValue, isAsync) {
    let batch = new BatchRequest(this);
    return batch.reduce(func, initialValue, isAsync);
  }

  filter(func, isAsync) {
    let batch = new BatchRequest(this);
    return batch.filter(func, isAsync);
  }

  join(delimiter) {
    let batch = new BatchRequest(this);
    return batch.join(delimiter);
  }

}
