/**
 * Create new contexts for batch requests, or access the s3 wrapper.
 */

'use strict'

const S3 = require('./S3');
const Request = require('./Request');
const Batch = require('batch');

/**
 * S3renity allows you to run batch requests, as well as interact with s3
 * objects directly through a promise-based api.
 */

class S3renity extends S3 {

  /**
   * @constructor
   * @param {Object} config - Options to initialize s3renity with.
   * @param {String} [config.encoding='utf8'] Encoding of the objects
   */

  constructor(config) {
    config = config || {};
    super(config);
    this.showProgress = config.showProgress || config.show_progress || false;
    this.verbose = config.verbose || false;
  }

  /**
   * Creates a new batch request
   *
   * @param {String} bucket The bucket to use, or a valid s3 path
   * @param {String} prefix The prefix (folder) to use. Leave null if you
   * gave an s3 path
   * @param {String} [marker] The key to start from
   * @param {String} [endPrefix] Process all files up to this file
   * @param {Integer} [limit] Limit the # of items processed in the batch request.
   * @param {Boolean} [reverse] Reverse the order objects in context
   * @returns {BatchRequest} A new batch request instance.
   */

  context(bucket, prefix, marker, endPrefix, limit, reverse) {

    limit = limit || Infinity;
    let contexts = null;

    if (typeof bucket == 'object') {
      contexts = bucket;
    } else {
      contexts = [{
        bucket: bucket,
        prefix: prefix,
        marker: marker,
        endPrefix: endPrefix
      }];
    }

    if (this.verbose) {
      console.info('finding objects');
    }

    return new Request(this.findObjects(contexts, reverse, limit), this);
  }

  /**
   * Find all objects based on the context provided
   *
   * @param {Object} contexts A list of s3 contexts to find objects in
   */

  findObjects(contexts, reverse, limit) {
    let batch = new Batch;

    return new Promise((success, fail) => {

      contexts.forEach(context => {
        batch.push(done => {

          this.keys(context.bucket, context.prefix, context.endPrefix, context.marker).then(keys => {

            // Format keys
            let sources = keys.map(key => {
              return {
                bucket: context.bucket,
                prefix: context.prefix,
                key: key
              }
            })

            done(null, sources);
          }).catch(e => {
            done(e);
          });
        });
      });

      batch.end((err, sources) => {
        if (err) {
          fail(err);
        } else {

          // flatten the array (of array) of sources and impose limit
          sources = sources.reduce((prev, cur) => prev.concat(cur), []).slice(0, limit);
          if (reverse) {
            sources = sources.reverse();
          }
          success(sources);
        }
      })
    });
  }
}

/**
 * Exports
 */

module.exports = S3renity;
