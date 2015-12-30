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

    const s3 = new aws.S3(s3opts);
    this.s3 = s3;

    this.verbose = config.verbose || false;
    this._marker = config.marker || '';
    this.encoding = config.encoding || 'utf8';

  }

  context(key) {
    return new Context(key);
  }

}
