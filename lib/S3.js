/**
 * Promise wrapper around aws s3 sdk
 */

'use strict'

/**
 * Dependencies
 */

const s3Mock = require('mock-aws-s3')
const aws = require('aws-sdk')

class S3 {

  /**
   * @constructor
   *
   * @param {Object} config - Options to initialize s3renity with. If <code>access_key_id</code>
   * and <code>secret_access_key</code> are left out, the aws sdk will attempt
   * to use the computer's default credentials.
   * @param {String} [config.access_key_id=null] AWS Access Key
   * @param {String} [config.secret_access_key=null] AWS Secret Key
   * @param {Integer} [config.max_retries=30] Max retries allowed for aws api requets
   * @param {Integer} [config.timeout=120] Timeout allowed for aws api requests
   * @param {Boolean} [config.verbose=false] Whether to use verbose mode when making requets
   */

  constructor(config) {
    this.verbose = config.verbose || false
    this.encoding = config.encoding || 'utf8'
    if (config.localPath || config.local_path) {

      // use local files (using mock aws sdk)
      s3Mock.config.basePath = config.localPath || config.local_path
      this.s3Instance = new s3Mock.S3()
    } else {

      // use the aws sdk. attempt to use aws credentials in config.  if they
      // are not present, the aws sdk could pick them up in ~/.aws/credentials
      if ((config.accessKeyId && config.secretAccessKey)
        || (config.access_key_id && config.secret_access_key)) {
        aws.config.update({
          accessKeyId: config.accessKeyId || config.access_key_id,
          secretAccessKey: config.secretAccessKey || config.secret_access_key
        })
      }

      // Create AWS S3 object
      this.s3Instance = new aws.S3({
        maxRetries: config.maxRetries || config.max_retries || 10,
        httpOptions: {
          timeout: config.timeout || 10000
        },
        apiVersion: '2006-03-01'
      })
    }
  }

  /**
   * Gets an object in s3.
   *
   * @param {String} bucket - The bucket to get from
   * @param {String} key - The key of the object to get
   * @param {Function} [transformer] - If supplied, this function will be
   * run on Object.Body before returning. Useful for dealing with compressed
   * files or weird formats
   * @returns {Promise} The s3 text object.
   */

  get(bucket, key, transformer) {

    // Default transform is to assume a text file, and call toString()
    // with the set encoding
    if (typeof transformer === 'undefined') {
      transformer = obj => obj.Body.toString(this.encoding)
    }

    return new Promise((success, fail) => {
      this.s3Instance.getObject({
        Bucket: bucket,
        Key: key
      }, (err, object) => {
        if (err) {
          fail(err)
        } else {
          try {
            success(transformer(object))
            if (this.verbose) {
              console.info(`GET OBJECT s3://${bucket}/${key}`)
            }
          } catch (e) {
            fail(e)
          }
        }
      })
    })
  }

  /**
   * Puts a text object in S3.
   *
   * @param {String} bucket - The s3 bucket to use
   * @param {String} key - The key path where the object will be placed
   * @param {String} body - The object body
   * @return {Promise} Promise that resolves when the object is written to s3
   */

  put(bucket, key, body) {
    return new Promise((success, fail) => {
      this.s3Instance.putObject({
        ContentEncoding: this.encoding,
        Bucket: bucket,
        Body: body,
        Key: key
      }, (err, res) => {
        if (err) {
          fail(err)
        } else {
          if (this.verbose) {
            console.info(`PUT OBJECT s3://${bucket}/${key}`)
          }
          success(res)
        }
      })
    })
  }

  /**
   * Copies an object in S3.
   *
   * @public
   * @param {String} bucket The source bucket
   * @param {String} key The source key
   * @param {String} targetBucket The target bucket
   * @param {String} targetKey The target key
   * @return {Promise}
   */

  copy(bucket, key, targetBucket, targetKey) {
    return new Promise((success, fail) => {
      this.s3Instance.copyObject({
        Bucket: targetBucket,
        Key: targetKey,
        CopySource: `${bucket}/${key}`
      }, (err) => {
        if (err) {
          fail(err)
        } else {
          if (this.verbose) {
            console.info(`COPY OBJECT s3://${bucket}/${key} --> s3://${targetBucket}/${targetKey}`)
          }
          success()
        }
      })
    })
  }

  /**
   * Deletes an object or array of objects in S3.
   *
   * @public
   * @param {String} bucket - The bucket
   * @param {String|Array} key - The key to delete
   * @returns {Promise} The key (or array of keys) that was deleted.
   */

  delete(bucket, key) {
    return new Promise((success, fail) => {
      this.s3Instance.deleteObject({
        Bucket: bucket,
        Key: key
      }, (err) => {
        if (err) {
          fail(err)
        } else {
          success()
          if (this.verbose) {
            console.info(`DELETE OBJECT s3://${bucket}/${key}`)
          }
        }
      })
    })
  }

  /**
   * Deletes a list of objects in S3.
   *
   * @private
   * @param {String} bucket - The s3 bucket to use
   * @param {Array} keys - The keys of the objects to delete
   * @returns {Promise}
   */

  deleteObjects(bucket, keys) {

    // creates input with format: { Key: key } required by s3
    const input = keys.map(key => ({
      Key: key
    }))

    return new Promise((success, fail) => {
      this.s3Instance.deleteObjects({
        Bucket: bucket,
        Delete: {
          Objects: input
        }
      }, (err, res) => {
        if (err) {
          fail(err)
        } else {
          success(res)
          if (this.verbose) {
            keys.forEach((key) => {
              console.info(`DELETE OBJECT s3://${bucket}/${key}`)
            })
          }
        }
      })
    })
  }

  /**
   * Lists all the keys in the given S3 folder.
   *
   * @param {String} bucket - The bucket
   * @param {String} prefix - The prefix for the folder to list keys for
   * @param {String} [endPrefix] Process all files up to this key prefix
   * @param {String} [marker] - The key to start listing from, alphabetically
   * @returns {Promise} An array containing all the keys in <code>s3://bucket/prefix</code>
   */

  keys(bucket, prefix, endPrefix, marker) {

    endPrefix = endPrefix || ''
    marker = marker || ''

    return new Promise((success, fail) => {
      this.listRecursive(bucket, prefix, endPrefix, marker, [], (err, allKeys) => {
        if (err) {
          fail(err)
        } else {
          allKeys = allKeys.filter(key => key.length > 0)
          success(allKeys)
        }
      })
    })
  }

  /**
   * Recursively list all S3 objects, circumventing AWS's 1000 limit
   *
   * @param {String} bucket - The bucket
   * @param {String} prefix - The prefix for the folder to list keys for
   * @param {String} [endPrefix] Process all files up to this key prefix
   * @param {String} [marker] - The key to start listing from, alphabetically
   */

  listRecursive(bucket, prefix, endPrefix, marker, allKeys, done) {
    allKeys = allKeys || []

    this.s3Instance.listObjects({
      Bucket: bucket,
      Prefix: prefix,
      Marker: marker
    }, (err, keys) => {
      if (err) {
        done(err)
      } else {
        if (this.verbose) {
          console.info(`LIST OBJECTS s3://${bucket}/${marker === '' ? prefix : marker}`)
        }
        if (keys.Contents.length === 0) {
          done()
        } else {

          // Update key values, removing the prefix
          let keyValues = keys.Contents.map(key => key.Key)

          // If the stop prefix is reached, ignore the rest of the keys
          let stopPrefixReached = false

          if (endPrefix.length > 0) {
            for (let i = 0; i < keyValues.length; i++) {
              if (keyValues[i].indexOf(endPrefix) > -1) {
                keyValues = keyValues.slice(0, i)
                stopPrefixReached = true
                break
              }
            }
          }

          allKeys = allKeys.concat(keyValues)

          // `keys.IsTruncated` indicates whether there are more keys to list
          // if so, we continue with `marker`
          if (keys.IsTruncated && !stopPrefixReached) {
            marker = keys.Contents[keys.Contents.length - 1].Key
            this.listRecursive(bucket, prefix, endPrefix, marker, allKeys, done)
          } else {
            done(null, allKeys)
          }
        }
      }
    })
  }
}

/**
 * Exports
 */

module.exports = S3
