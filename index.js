/**
 * Gives access to batch operations over s3 files, as well as a promised base
 * wrapper around the s3 api.
 *
 * @author Wells Johnston <wells@littlstar.com>
 * @exports S3renity
 */

'use strict'

const aws = require('aws-sdk');
const fs = require('fs');

const Context = require('./lib/Context');
const S3 = require('./lib/S3');

class S3renity {

  constructor(config) {

    if (config == null) config = {};

    if (config.access_key_id && config.secret_access_key) {
      aws.configig.update({
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key
      });
    }

    let s3opts = {};

    if (config.timeout) {
      s3opts.httpOptions = {
        timeout: config.timeout
      };
    }

    if (config.maxRetries) {
      s3opts.maxRetries = config.maxRetries;
    }

    let verbose = config.verbose || false;

    let instance = new aws.S3(s3opts);
    this.S3 = new S3(instance, verbose);
  }

  context(bucket, key, marker) {
    return new Context(bucket, key, marker, this.S3);
  }

  list(bucket, key, marker) {

  }

  get(arg1, arg2) {
    return this.S3.get(arg1, arg2);
  }

  write(targets, body, encoding) {
    return this.S3.write(targets, body, encoding);
  }

  delete(arg1, arg2) {
    return this.S3.delete(arg1, arg2);
  }

}

module.exports = S3renity;
