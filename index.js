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

const request = require('./lib/Request');
const S3 = require('./lib/S3');

const TYPE_S3 = 's3';
const TYPE_FILE = 'file';
const S3_PATH_ERROR = 'Context needs to be a valid s3 path. Ex: "s3://<bucket>/path/to/folder[/object]."';
const INPUT_FUNCTION_ERROR = '"func" must be a function.';

module.exports = S3renity;

/**
 * S3renity access to files in S3.
 *
 * @class S3renity
 * @constructor
 * @param {object} aws your aws credentials. this object contains two keys
 * access_key_id and secret_access_key
 */

function S3renity(conf) {

  if (!(this instanceof S3renity)) {
    return new S3renity();
  }

  if (!conf) conf = {};

  if (conf.key) {
    this.context(conf.key);
  }

  if (conf.access_key_id && conf.secret_access_key) {
    aws.config.update({
      accessKeyId: conf.access_key_id,
      secretAccessKey: conf.secret_access_key
    });
  }

  let s3opts = {};

  if (conf.timeout) {
    s3opts.httpOptions = { timeout: conf.timeout };
  }

  if (conf.maxRetries) {
    s3opts.maxRetries = conf.maxRetries;
  }

  const s3 = new aws.S3(s3opts);
  this.s3 = s3;

  this.verbose = conf.verbose || false;
  this._marker = conf.marker || '';
  this.encoding = conf.encoding || 'utf8';
  this.hasTarget = false;
}

/**
 * Set the working context based on an s3 key.
 *
 * @public
 * @param {string} key a key in the form: "s3://<your-bucket>/path/to/folder/"
 * @returns {S3renity} `this`
 */

S3renity.prototype.context = function(key) {
  const target = S3.resolveKey(key);
  if (target.type != TYPE_S3) {
    throw new Error(S3_PATH_ERROR);
  }
  this.bucket = target.bucket;
  this.prefix = target.prefix;
  return this;
};

/**
 * Set the marker for the working context (file to start on)
 *
 * @public
 * @param {string} marker The marker to start with for getting objects.
 * @return {S3renity} `this`
 */

S3renity.prototype.marker = function(marker) {
  this._marker = marker;
  return this;
}

/**
 * Sets the working context encoding.
 *
 * @public
 * @param {string} encoding The type of encoding to use with S3 objects. Default is "utf8".
 * @return {S3renity} `this`
 */

S3renity.prototype.encode = function(encoding) {
  this.encoding = encoding;
  return this;
};

/**
 * Transforms the S3 object before proceeding.
 *
 * @param {function} transform The function to use to transform the object.
 * @return {S3renity} `this`
 */

S3renity.prototype.transform = function(transformer) {
  this.transformer = transformer;
  return this;
};

/**
 * Move the context from s3 objects to objects split by a delimiter.
 *
 * @public
 * @param {string} delimiter The character to split the document objects by.
 * Default is "\n"
 * @return {S3renity} `this`
 */

S3renity.prototype.split = function(delimiter) {
  this.delimiter = delimiter || '\n';
  return this;
};

/**
 * Sets the output directory for map or filter.  If a target is set, map and
 * filter write to that location instead of changing the original objects
 * themselves.
 *
 * @public
 * @param {string} target The location to send the output of map or filter.
 * @return {S3renity} `this`
 */

S3renity.prototype.target = function(target) {
  const output = S3.resolveKey(target);
  if (output.type != TYPE_S3) {
    throw new Error(S3_PATH_ERROR);
  }
  this.targetBucket = output.bucket;
  this.targetPrefix = output.prefix;
  this.hasTarget = true;
  return this;
};

S3renity
