/**
 * Gives access to batch operations over s3 files, as well as a promised base
 * wrapper around the s3 api.
 *
 * @author Wells Johnston <wells@littlstar.com>
 * @exports S3renity
 */

'use strict'

const Context = require('./lib/Context');
const S3Wrapper = require('./lib/S3Wrapper');

class S3renity extends S3Wrapper {

  constructor(config) {
    super(config);
  }

  context(bucket, key, marker) {
    return new Context(bucket, key, marker, this);
  }

}

module.exports = S3renity;
