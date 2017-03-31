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
   * @param {Object|Array} context An object representing an S3 context.
   * Alternatively, you can supply an array of context objects.
   * @param {String} context.bucket The S3 bucket
   * @param {String} context.prefix The prefix key to use to find objects
   * @param {String} [context.endPrefix] Optional. The prefix to stop at
   * @param {String} [context.marker] Optional. The marker to use for listing
   * @param {Boolean} [context.reverse] Optional. Reverse the order of the
   * files in the context
   * @param {Number} [context.limit] Optional. Limit the number of files in the
   * context
   */

  context(context) {

    let contexts = null

    if (Array.isArray(context)) {
      contexts = context
    } else if (typeof context === 'object') {
      contexts = [context]
    } else {
      throw Error('`context` expects an options object, or an array of options objects.')
    }
    if (this.verbose) {
      console.info('finding objects')
    }

    return new Request(this.findObjects(contexts), this)
  }

  /**
   * Find all objects based on the context provided
   *
   * @param {Array<Object>} contexts[context] An array of objects representing s3 contexts to find keys
   * @param {Object} context An object representing an S3 context
   * @param {String} context.bucket The S3 bucket
   * @param {String} context.prefix The prefix key to use to find objects
   * @param {String} context.match A string or regex for the key to match
   * @param {String} [context.endPrefix] Optional. The prefix to stop at (alphabetically)
   * @param {String} [context.marker] Optional. The marker to use to start listing keys at
   */

  findObjects(contexts) {
    const batch = new Batch()

    return new Promise((success, fail) => {

      contexts.forEach((context) => {
        batch.push((done) => {

          const bucket = context.bucket
          const prefix = context.prefix
          const endPrefix = context.endPrefix
          const match = context.match
          const marker = context.marker
          const reverse = context.reverse
          const limit = context.limit

          this.keys(bucket, prefix, endPrefix, marker).then((keys) => {

            // Format keys
            let sources = keys.map(key => ({
              bucket: context.bucket,
              prefix: context.prefix,
              key
            }))
            if (match) {
              sources = sources.filter(object => object.key.match(match))
            }
            if (reverse) {
              sources = sources.reverse()
            }
            if (limit) {
              sources = sources.slice(0, limit)
            }
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

          // Flatten the array (of array) of sources and impose limit
          sources = sources.reduce((prev, cur) => prev.concat(cur), [])
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
