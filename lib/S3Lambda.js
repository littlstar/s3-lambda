/**
 * Create new contexts for batch requests, or access the s3 wrapper.
 */

'use strict'

const S3 = require('./S3')
const Request = require('./Request')
const Batch = require('batch')

/**
 * S3Lambda allows you to run batch requests, as well as interact with s3
 * objects directly through a promise-based api.
 */

class S3Lambda extends S3 {

  /**
   * @constructor
   * @param {Object} config - Options to initialize S3Lambda with.
   * @param {String} [config.encoding='utf8'] Encoding of the objects
   * @param {Boolean} [config.showProgress=false] Show progress bar for S3 operations
   */

  constructor(config) {
    config = config || {}
    super(config)
    this.showProgress = config.showProgress || false
    this.verbose = config.verbose || false
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

    limit = limit || Infinity
    let contexts = null

    if (typeof bucket === 'object') {
      contexts = bucket
    } else {
      contexts = [{
        bucket,
        prefix,
        marker,
        endPrefix
      }]
    }

    if (this.verbose) {
      console.info('finding objects')
    }

    return new Request(this.findObjects(contexts, reverse, limit), this)
  }

  /**
   * Find all objects based on the context provided
   *
   * @param {Object} contexts A list of s3 contexts to find objects in
   */

  findObjects(contexts, reverse, limit) {
    const batch = new Batch()

    return new Promise((success, fail) => {

      contexts.forEach((context) => {
        batch.push((done) => {

          const bucket = context.bucket
          const prefix = context.prefix
          const endPrefix = context.endPrefix
          const marker = context.marker

          this.keys(bucket, prefix, endPrefix, marker).then((keys) => {

            // Format keys
            const sources = keys.map(key => ({
              bucket: context.bucket,
              prefix: context.prefix,
              key
            }))

            done(null, sources)
          }).catch((e) => {
            done(e)
          })
        })
      })

      batch.end((err, sources) => {
        if (err) {
          fail(err)
        } else {

          // flatten the array (of array) of sources and impose limit
          sources = sources.reduce((prev, cur) => prev.concat(cur), []).slice(0, limit)
          if (reverse) {
            sources = sources.reverse()
          }
          success(sources)
        }
      })
    })
  }
}

/**
 * Exports
 */

module.exports = S3Lambda
