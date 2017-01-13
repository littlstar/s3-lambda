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
    this.encoding = config.encoding || 'utf8';
    this.verbose = config.verbose || false;
  }

  /**
   * Creates a new batch request
   *
   * @param {String} bucket The bucket to use, or a valid s3 path
   * @param {String} prefix The prefix (folder) to use. Leave null if you
   * gave an s3 path
   * @param {String} [marker] The key to start from
   * @param {Integer} [limit] Limit the # of items processed in the batch request.
   * @param {Boolean} [reverse] Reverse the order objects in context
   * @returns {BatchRequest} A new batch request instance.
   */

  context(bucket, prefix, marker, limit, reverse) {

    limit = limit || Infinity;
    let sources = null;
    let batch = new Batch;

    if (typeof bucket == 'object') {
      sources = bucket;
    } else {
      sources = [{
        bucket: bucket,
        prefix: prefix,
        marker: marker
      }];
    }

    if (this.verbose) {
      console.info('listing keys');
    }

    let keys = new Promise((success, fail) => {

      sources.forEach(source => {
        batch.push(done => {

          // list each source in parallel
          this.keys(source.bucket, source.prefix, source.marker).then(files => {

            // format sources and ignore empty files (directories)
            let sources = files.map(file => {
              return {
                bucket: source.bucket,
                prefix: source.prefix,
                file: file,
                key: `${source.prefix}${file}`
              };
            }).filter(source => source.file.length > 0);

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

    return new Request(keys, this);
  }
}

/**
 * Exports
 */

module.exports = S3renity;
