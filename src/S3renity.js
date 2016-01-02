/**
 * Gives access to batch operations over s3 files, as well as a promised base
 * wrapper around the s3 api.
 *
 * @author Wells Johnston <wells@littlstar.com>
 */

'use strict'

const Context = require('./Context');
const S3Wrapper = require('./S3Wrapper');

/**
 * @class S3renity
 */

class S3renity extends S3Wrapper {

  constructor(config) {
    super(config);
  }

  /**
   * Returns a new context, which can be used to perform batch operations.
   * @param {String} bucket The S3 bucket.
   * @param {String} prefix The folder prefix for where the files are.
   * @param {String} marker Optional. A marker to start at.
   * @return {Context}
   */

  context(bucket, key, marker) {
    return new Context(bucket, key, marker, this);
  }

}

module.exports = S3renity;
