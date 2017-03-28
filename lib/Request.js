/**
 * Set and run a batch request
 */

'use strict'

/**
 * dependencies
 */

const ProgressBar = require('progress')
const Batch = require('batch')

class Request {

  /**
   * @constructor
   *
   * @param {Promise} getObjects A promise that resolves to the target objects
   * @param {S3} The S3 instance used to interact with remote files
   */

  constructor(getObjects, s3) {
    this.showProgress = s3.showProgress
    this.getObjects = getObjects
    this.s3 = s3
    this.opts = {
      concurrency: Infinity,
      transformer: null,
      encoding: s3.encoding,
      reverse: null,
      exclude: null,
      async: false,
      limit: null
    }
    this.target = null
  }

  /**
   * Renames the output key when used in map or filter.
   *
   * @param {String} key The string to rename
   * @return {String} key The resulting string
   */

  rename(key) {
    const newFileName = this.target.rename(key.slice(this.target.prefix.length))
    return `${this.target.prefix}${newFileName}`
  }

  /**
   * Enable modifications to the initial context.
   *
   * @return {Promise}
   */

  resolveSources() {
    return new Promise((success, fail) => {
      this.getObjects.then((objects) => {
        objects = this.opts.reverse ? objects.reverse() : objects
        objects = this.opts.limit ? objects.slice(0, this.opts.limit) : objects
        objects = this.opts.exclude ? objects.filter(obj => !this.opts.exclude(obj.key)) : objects
        success(objects)
      }).catch(fail)
    })
  }

  /**
   * Creates a progress bar for the request.
   *
   * @param {Batch} batch The Batch instance used for the request.
   * @param {Number} numSources The number of files being processed.
   */

  handleProgress(batch, numSources) {
    if (this.showProgress) {
      const progress = new ProgressBar('[:bar] :percent', {
        total: numSources,
        width: 40
      })
      batch.on('progress', () => progress.tick())
    }
  }

  /**
   * Sets an exclude function to be used before getting objects from s3.
   *
   * @param {Function} e The function to use to exclude objects. The exclude
   * functions takes an s3 key as a parameter and should return true if the
   * object should be excluded.
   * @return {Request} The instance on which this method was called.
   */

  exclude(e) {
    this.opts.exclude = e
    return this
  }

  /**
   * Sets the encoding to use when getting s3 objects with
   * object.Body.toString(encoding). If not set, utf8 is used.
   *
   * @param {String} encoding The encoding.
   * @return {Request} The instance on which this method was called.
   */

  encode(encoding) {
    this.opts.encoding = encoding
    return this
  }

  /**
   * Sets a transformation function to be used when getting objects from s3.
   * Using transform takes precedence over encode.
   *
   * @param {Function} transformer The function to use to transform the
   * object. The transformation function takes an s3 object and a key as
   * parameters and should return the file's contents as a string.
   * @return {Request} The instance on which this method was called.
   */

  transform(transformer) {
    this.opts.transformer = transformer
    return this
  }

  /**
   * Set the concurrency for requests.  Default is Infinity (as many as
   * the computer can handle). Has no effect with reduce.
   *
   * @param {Integer} concurrency The concurrency level to use in the request.
   * @return {Request} The instance on which this method was called.
   */

  concurrency(concurrency) {
    this.opts.concurrency = concurrency
    return this
  }

  /**
   * Limits the number of sources being operated on.
   *
   * @param {Integer} limit
   * @return {Request} The instance on which this method was called.
   */

  limit(limit) {
    this.opts.limit = limit
    return this
  }

  /**
   * Reverse the sources being operated on.
   *
   * @return {Request} The instance on which this method was called.
   */

  reverse() {
    this.opts.reverse = true
    return this
  }

  /**
   * Enables destructive actions (map, filter) to occur inplace.
   *
   * @return {Request} The instance on which this method was called.
   */

  inplace() {
    this.destructive = true
    return this
  }

  /**
   * Sets the output directory for map or filter.  If a target is set, map and
   * filter write to that location instead of changing the original objects
   * themselves.
   *
   * @param {String} bucket The target bucket.
   * @param {String} prefix The target prefix (folder) where the output will go.
   * @param {Function} rename Optional. A function to rename the output file
   * names (after the prefix). Takes the file name as an argument, and should
   * return the new file name. Defaults to `null`.
   * @return {Request} The instance on which this method was called.
   */

  output(bucket, prefix, rename) {
    rename = rename || null
    this.target = {
      bucket,
      prefix,
      rename
    }
    return this
  }

  /**
   * Run a function over s3 objects in series. This is just a wrapper around each
   * with concurrency 1.
   *
   * @param {Function} func The function to perform over the working context.
   * @param {Boolean} [isasync=false] Set to true if `func` is async (returns a
   * Promise).
   * @return {Promise<Object>} Resolves after processing has completed,
   * returning an object that contains the bucket, prefix, and key of the last
   * S3 object that was processed.
   */

  forEach(func, isasync) {
    return this.each(func, isasync, 1)
  }

  /**
   * Run a function over s3 objects in parallel.
   *
   * @param {Function} func The function to perform over the working context.
   * @param {Boolean} [isAsync=false] Set to true if `func` is async (returns a
   * Promise).
   * @return {Promise<Object>} Resolves after processing has completed,
   * returning an object that contains the bucket, prefix, and key of the last
   * S3 object that was processed.
   */

  each(func, isAsync, concurrency) {

    isAsync = isAsync || this.opts.async
    const batch = new Batch().concurrency(concurrency || this.opts.concurrency)

    return new Promise((success, fail) => {
      this.resolveSources().then((sources) => {

        this.handleProgress(batch, sources.length)
        const lastKey = sources[sources.length - 1]

        // Loop over sources, apply function to each
        sources.forEach((source) => {
          const bucket = source.bucket
          const key = source.key
          const encoding = this.opts.encoding
          const transformer = this.opts.transformer
          batch.push((done) => {
            this.s3.get(bucket, key, encoding, transformer).then((body) => {
              if (isAsync) {
                func(body, key).then(done).catch(done)
              } else {
                func(body, key)
                done()
              }
            }).catch(done)
          })
        })

        // Resolve error or last key processed.
        batch.end((err) => {
          if (err) {
            fail(err)
          } else {
            success(lastKey)
          }
        })
      }).catch(fail)
    })
  }

  /**
   * Maps a function over the objects in the working context in parallel, replacing each
   * object with the return value.  If an output is specified, the objects will not be
   * overwritten, but rather copied to the target location.
   *
   * @param {Function} func The function to map over each object in the working
   * context. <code>func</code> takes a string as a parameter and should return a
   * string that will replace the given s3 object.
   * @param {Boolean} [isAsync=false] If set to true, this indicates that func
   * is async and returns a promise.
   * @return {Promise<Object>} Resolves after processing has completed,
   * returning an object that contains the bucket, prefix, and key of the last
   * S3 object that was processed.
   */

  map(func, isAsync) {
    if (this.target == null && this.destructive !== true) {
      throw new Error('must use target() or inplace() for destructive operations (map, filter)')
    }

    isAsync = isAsync || this.opts.async

    // Used to output from the map function (S3Lambda.context.output.map)
    const mapOutput = (bucket, key, prefix, body, done) => {
      if (body == null) {
        throw new Error('mapper function must return a value')
      }
      if (this.target == null) {
        this.s3.put(bucket, key, body, this.opts.encoding).then(() => {
          done()
        }).catch(done)
      } else {

        const outputBucket = this.target.bucket
        let outputKey = key.replace(prefix, this.target.prefix)

        // Rename output key (if necessary)
        outputKey = this.target.rename ? this.rename(outputKey) : outputKey

        this.s3.put(outputBucket, outputKey, body, this.opts.encoding).then(() => {
          done()
        }).catch((e) => {
          done(e)
        })
      }
    }

    const batch = new Batch()
    batch.concurrency(this.opts.concurrency)

    return new Promise((success, fail) => {
      this.resolveSources().then((sources) => {

        this.handleProgress(batch, sources.length)
        const lastKey = sources[sources.length - 1]

        // Loop over sources, apply mapper function to each
        sources.forEach((source) => {
          const bucket = source.bucket
          const key = source.key
          const encoding = this.opts.encoding
          const transformer = this.opts.transformer
          batch.push((done) => {
            this.s3.get(bucket, key, encoding, transformer).then((val) => {
              if (isAsync) {
                func(val, source.key).then((newval) => {
                  mapOutput(bucket, key, source.prefix, newval, done)
                }).catch(done)
              } else {
                const newval = func(val, source.key)
                mapOutput(bucket, key, source.prefix, newval, done)
              }
            }).catch(done)
          })
        })

        // Resolve error or last key processed
        batch.end((err) => {
          if (err) {
            fail(err)
          }
          success(lastKey)
        })
      }).catch(fail)
    })
  }

  /**
   * Reduce the objects in the working context to a single value.
   *
   * @param {Function} func Function to execute on each value in the array, taking
   * three arguments:
   *   `accumulator`: The accumulated value previously returned from the last
   *   invocation of func
   *   `currentValue`: The current entry being processed
   *   `key`: The key of the current object being processed
   *   func either returns the updated value, or a promise that resolves to the
   *   updated value.
   * @param {String} initialValue Optional. Initial value to use as the first
   * `previousValue` in `func`. Defaults to `null`.
   * @param {Boolean} isAsync Optional, defaults to false. If set to true, this
   * indicates that func returns a promise.
   * @return {Promise<Object>} Resolves after processing has completed,
   * returning the result of the reducer.
   */

  reduce(func, initialValue, isAsync) {

    isAsync = isAsync || this.opts.async
    initialValue = initialValue || null
    const batch = new Batch()
    batch.concurrency(this.opts.concurrency)

    return new Promise((success, fail) => {
      this.resolveSources().then((sources) => {

        this.handleProgress(batch, sources.length)
        let accumulator = initialValue

        // Loop over sources, update `accumulator`
        sources.forEach((source) => {
          const bucket = source.bucket
          const key = source.key
          const encoding = this.opts.encoding
          const transformer = this.opts.transformer
          batch.push((done) => {
            this.s3.get(bucket, key, encoding, transformer).then((body) => {
              if (isAsync) {
                func(accumulator, body, key).then((newval) => {
                  accumulator = newval
                  done()
                }).catch(done)
              } else {
                accumulator = func(accumulator, body, key)
                done()
              }
            }).catch(done)
          })
        })

        // Resolve error or reducer result `accumulator`
        batch.end((err) => {
          if (err) {
            fail(err)
          } else {
            success(accumulator)
          }
        })
      }).catch(fail)
    })
  }

  /**
   * Filter the objects in the working context.
   *
   * @param {Function} func The function to filter objects by, returning true for
   * objects that should not be filtered and false for those that should. If
   * isAsync is set to true, func returns a promise that resolves to true or
   * false.
   * @param {Boolean} isAsync Optional, defaults to false. If set to true, this
   * indicates that func returns a promise.
   * @return {Promise<Object>} Resolves after processing has completed,
   * returning an object that contains the bucket, prefix, and key of the last
   * S3 object that was processed.
   */

  filter(func, isAsync) {
    if (this.target == null && this.destructive !== true) {
      throw new Error('must use target() or inplace() for destructive operations (map, filter)')
    }

    isAsync = isAsync || this.opts.async
    const batch = new Batch()

    // Keep a file when filtering
    const keep = source => new Promise((success, fail) => {
      if (this.target == null) {

        // Since we are keeping the file and there is no output, there is
        // nothing else to do
        success()
      } else {
        const bucket = source.bucket
        const key = source.key
        const targetBucket = this.target.bucket
        let targetKey = key.replace(source.prefix, this.target.prefix)

        // Rename output key (if necessary)
        targetKey = this.target.rename ? this.rename(targetKey) : targetKey

        this.s3.copy(bucket, key, targetBucket, targetKey)
          .then(() => success())
          .catch(fail)
      }
    })

    // Remove a file when filtering
    const remove = source => new Promise((success, fail) => {
      if (this.target == null) {

        // For inplace filtering, we remove the actual file
        this.s3.delete(source.bucket, source.key)
          .then(() => success())
          .catch(fail)
      } else {

        // If output is specified, there is nothing else to do, since we are
        // simply not copying the file anywhere
        success()
      }
    })

    // Ensure the filter function returns a boolean
    const check = (result) => {
      if (typeof result !== 'boolean') {
        throw new TypeError('filter function must return a boolean')
      }
    }

    return new Promise((success, fail) => {
      this.resolveSources().then((sources) => {

        this.handleProgress(batch, sources.length)
        const lastKey = sources[sources.length - 1]

        // Loop over every key and run the filter function on each object. keep
        // track of files to keep and remove.
        sources.forEach((source) => {
          const bucket = source.bucket
          const key = source.key
          const encoding = this.opts.encoding
          const transformer = this.opts.transformer
          batch.push((done) => {
            this.s3.get(bucket, key, encoding, transformer).then((body) => {
              if (isAsync) {
                func(body, source).then((result) => {
                  check(result)
                  if (result) {
                    keep(source).then(() => done()).catch(done)
                  } else {
                    remove(source).then(() => done()).catch(done)
                  }
                }).catch(done)
              } else {
                let result = null
                result = func(body, source)
                check(result)
                if (result) {
                  keep(source).then(() => done()).catch(done)
                } else {
                  remove(source).then(() => done()).catch(done)
                }
              }
            }).catch(done)
          })
        })

        // Resolve error or last source processed
        batch.end((err) => {
          if (err) {
            fail(err)
          } else {
            success(lastKey)
          }
        })
      }).catch(fail)
    })
  }
}

/**
 * Exports
 */

module.exports = Request
