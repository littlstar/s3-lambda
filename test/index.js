'use strict'

// Dependencies
const S3Lambda = require(`${__dirname}/..`)
const mkdirp = require('mkdirp').sync
const rimraf = require('rimraf').sync
const test = require('tape')
const path = require('path')
const fs = require('fs')

// Path variables
const folder = 'buckets'
const bucket = 'S3Lambda'
const prefix = 'files'
const outputPrefix = 'output-files'
const files = ['file1', 'file2', 'file3', 'file4']
const localPath = path.resolve(__dirname, folder)
const bucketPath = path.resolve(__dirname, folder, bucket)
const prefixPath = path.resolve(__dirname, folder, bucket, prefix)
const outputPrefixPath = path.resolve(__dirname, folder, bucket, outputPrefix)
const filePaths = files.map(f => `${prefixPath}/${f}`)

// s3-lambda object
const lambda = new S3Lambda({
  localPath,
  showProgress: false,
  verbose: false
})

resetSandbox()

function resetSandbox() {
  rimraf(path.resolve(__dirname, 'buckets'))
  mkdirp(prefixPath)
  files.forEach((file) => {
    const filePath = path.resolve(__dirname, folder, bucketPath, prefixPath, file)
    fs.writeFileSync(filePath, file)
  })
}

/**
 * Returns the contents of a file
 */

function readFile(path) {
  return fs.readFileSync(path).toString().trim()
}

/**
 * Returns an array of the contents of each file in a directory
 */

function readFiles(files) {
  return files.map(readFile)
}

/**
 * Returns true if all the files in an array exist
 */

function filesExist(paths) {
  return paths.map(fileExists).every(f => f)
}

/**
 * Returns true if file exists
 */

function fileExists(path) {
  return fs.existsSync(path)
}

/**
 * List files in a directory
 */

function readDir(dir) {
  return fs.readdirSync(dir)
}

/**
 * Test key listing function
 * TODO test with endPrefix and marker
 */

test('S3Lambda.keys', (t) => {
  t.plan(1)
  const answer = files.map(f => `${prefix}/${f}`)
  lambda
    .keys(bucket, prefix)
    .then((keys) => {
      t.deepEqual(keys, answer, 'keys length matches')
    })
    .catch(e => console.error(e.stack))
})

/**
 * Test S3 methods get, put, and delete
 */

test('S3Lambda.put, S3Lambda.get, S3Lambda.delete', (t) => {

  resetSandbox()
  t.plan(3)

  const file = files[0]
  const key = `${prefix}/${file}`
  const body = 'hello world'
  const name = 'test'

  lambda
    .put(bucket, key, body)
    .then(() => {
      const fileContents = readFile(`${prefixPath}/${file}`)
      t.equal(fileContents, body, 'put object')
      lambda.get(bucket, key).then((obj) => {
        t.equal(obj, body, 'get object')
        lambda.delete(bucket, key).then(() => {
          t.notOk(fs.existsSync(`${key}`), 'delete object')
        }).catch(console.error)
      })
        .catch(console.error)
    })
    .catch(console.error)
})

test('S3Lambda.delete (batch)', (t) => {

  t.plan(1)

  const files = ['file2', 'file3', 'file4']
  const keys = files.map(file => `${prefix}/${file}`)

  lambda.deleteObjects(bucket, keys).then(() => {
    t.notOk(filesExist(keys), 'delete multiple objects')
  }).catch(console.error)
})

test('S3Lambda.context.forEach (sync)', (t) => {

  resetSandbox()
  t.plan(1)

  const objects = []
  const answer = [{ object: 'file1', key: 'files/file1' },
    { object: 'file2', key: 'files/file2' },
    { object: 'file3', key: 'files/file3' },
    { object: 'file4', key: 'files/file4' }]

  const context = {
    bucket: bucket,
    prefix: prefix
  }

  lambda
    .context(context).forEach((obj, key) => {
      objects.push({
        object: obj,
        key
      })
    })
    .then(() => {
      t.deepEqual(objects, answer, 'forEach sync')
    })
    .catch(e => console.error(e.stack))
})

test('S3Lambda.context.forEach (async)', (t) => {

  resetSandbox()
  t.plan(10)

  const objects = []
  const answer = [
    { object: 'file1', key: 'files/file1' },
    { object: 'file2', key: 'files/file2' },
    { object: 'file3', key: 'files/file3' },
    { object: 'file4', key: 'files/file4' }
  ]

  const opts = {
    bucket: bucket,
    prefix: prefix
  }

  let concurrentOperations = 0

  const context = lambda
    .context(opts)
    .concurrency(4)

  context.forEach((obj, key) => new Promise((success) => {
    t.equal(concurrentOperations, 0, 'forEach concurrency <= 1')
    concurrentOperations++
    setTimeout(() => {
      t.equal(concurrentOperations, 1, 'forEach concurrency <= 1')
      objects.push({
        object: obj,
        key
      })
      concurrentOperations--
      success()
    }, 10)
  }), true).then(() => {
    t.equal(context.opts.concurrency, 4)
    t.deepEqual(objects, answer, 'forEach async')
  })
})

test('S3Lambda.context.exclude and S3Lambda.context.forEach (async)', (t) => {

  resetSandbox()
  t.plan(1)

  const objects = []
  const answer = [
    { object: 'file1', key: 'files/file1' },
    { object: 'file3', key: 'files/file3' },
    { object: 'file4', key: 'files/file4' }
  ]

  const context = {
    bucket: bucket,
    prefix: prefix
  }

  lambda
    .context(context)
    .exclude(key => /file2/.test(key))
    .forEach((obj, key) => new Promise((success, fail) => {
      objects.push({
        object: obj,
        key
      })
      success()
    }), true).then(() => {
      t.deepEqual(objects, answer, 'forEach async with exclude')
    })
})

test('S3Lambda.context.transform and S3Lambda.context.forEach (async)', (t) => {

  resetSandbox()
  t.plan(1)

  const objects = []
  const answer = [
    { object: 'FILE1 files/file1', key: 'files/file1' },
    { object: 'FILE2 files/file2', key: 'files/file2' },
    { object: 'FILE3 files/file3', key: 'files/file3' },
    { object: 'FILE4 files/file4', key: 'files/file4' }
  ]

  const context = {
    bucket: bucket,
    prefix: prefix
  }

  lambda
    .context(context)
    .transform((obj, key) => obj.Body.toString('utf8').toUpperCase() + ' ' + key)
    .forEach((obj, key) => new Promise((success, fail) => {
      objects.push({
        object: obj,
        key
      })
      success()
    }), true).then(() => {
      t.deepEqual(objects, answer, 'forEach async with transform')
    })
})

test('S3Lambda.context.map (sync)', (t) => {

  resetSandbox()
  t.plan(1)

  const answer = [
    'files/file1file1',
    'files/file2file2',
    'files/file3file3',
    'files/file4file4'
  ]

  const context = {
    bucket: bucket,
    prefix: prefix
  }

  lambda
    .context(context)
    .inplace()
    .map((obj, key) =>

      // update each object with the key prefixed
      key + obj).then(() => {
        t.deepEqual(answer, readFiles(filePaths), 'map sync')
      }).catch(console.error)
})

test('S3Lambda.context.map (async)', (t) => {

  resetSandbox()
  t.plan(1)

  // Tests rename function
  const outputPaths = files.map(f => `${outputPrefixPath}/${f}ab`)

  const answer = [
    'files/file1file1',
    'files/file2file2',
    'files/file3file3',
    'files/file4file4'
  ]

  const context = {
    bucket: bucket,
    prefix: prefix
  }

  lambda
    .context(context)
    .inplace()
    .map((obj, key) => new Promise((success, fail) => {
      success(key + obj)
    }), true).then(() => {
      t.deepEqual(answer, readFiles(filePaths), 'map async over 3 objects')
    }).catch(console.error)
})

test('S3Lambda.context.output.map (sync)', (t) => {

  resetSandbox()
  t.plan(1)

  const outputPaths = files.map(f => `${outputPrefixPath}/${f}ab`)

  const answer = [
    'files/file1file1',
    'files/file2file2',
    'files/file3file3',
    'files/file4file4'
  ]

  const context = {
    bucket: bucket,
    prefix: prefix
  }

  lambda
    .context(context)
    .output(bucket, outputPrefix, (key) => key.concat('ab'))
    .map((obj, key) => key + obj).then(() => {
      t.deepEqual(answer, readFiles(outputPaths), 'map sync over')
    }).catch(console.error)
})

test('S3Lambda.context.output.map (async)', (t) => {

  resetSandbox()
  t.plan(1)

  const answer = [
    'files/file1file1',
    'files/file2file2',
    'files/file3file3',
    'files/file4file4'
  ]

  const context = {
    bucket: bucket,
    prefix: prefix
  }

  lambda
    .context(context)
    .output(bucket, outputPrefix, (key) => key.concat('ab'))
    .map((obj, key) => new Promise((success, fail) => {
      success(key + obj)
    }), true).then(() => {
      t.deepEqual(answer, readFiles(outputPaths), 'map async')
    }).catch(console.error)
})

test('S3Lambda.context.reduce (sync)', (t) => {

  resetSandbox()
  t.plan(1)

  const answer = 20

  const context = {
    bucket: bucket,
    prefix: prefix
  }

  // Add the length of the contents of each file, starting at 0
  lambda
    .context(context)
    .reduce((acc, cur, key) => acc + cur.length , 0)
    .then((result) => {
      t.equal(result, answer, 'reduce sync')
    }).catch(e => console.error(e.stack))
})

test('S3Lambda.context.reduce (async)', (t) => {

  resetSandbox()
  t.plan(1)

  const answer = 20

  const context = {
    bucket: bucket,
    prefix: prefix
  }

  // Add the length of the contents of each file, starting at 0
  lambda
    .context(context)
    .reduce((prev, cur, key) => new Promise((success, fail) => {
      success(prev + cur.length)
    }), 0, true)
    .then((result) => {
      t.equal(result, answer, 'reduce async')
    }).catch(e => console.error(e.stack))
})

test('S3Lambda.context.filter (sync)', (t) => {

  resetSandbox()
  t.plan(1)

  const answer = ['file1']
  const context = {
    bucket: bucket,
    prefix: prefix
  }

  lambda
    .context(context)
    .inplace()
    .filter(obj => obj == 'file1')
    .then(() => {
      t.deepEqual(answer, readDir(prefixPath), 'filter inplace (sync)')
    })
    .catch(e => console.error(e))
})

test('S3Lambda.context.filter (async)', (t) => {

  resetSandbox()
  t.plan(1)

  // Tests rename output
  const answer = ['file1ab']

  const context = {
    bucket: bucket,
    prefix: prefix
  }

  lambda
    .context(context)
    .inplace()
    .filter(obj => new Promise((success, fail) => {
      success(obj == 'file1')
    }), true)
    .then(() => {
      t.deepEqual(fs.readdirSync(prefixPath), answer, 'filter 3 inplace (async)')
    })
    .catch(e => console.error(e.stack))
})

test('S3Lambda.context.output.filter (sync)', (t) => {

  resetSandbox()
  t.plan(1)

  const answer = ['file1ab']

  const context = {
    bucket: bucket,
    prefix: prefix
  }

  lambda
    .context(context)
    .output(bucket, outputPrefix, (key) => key.concat('ab'))
    .filter(obj => obj == 'file1')
    .then(() => {
      t.deepEqual(readDir(outputPrefixPath), answer, 'filter to output (sync)')
    })
    .catch(e => console.error(e.stack))
})

test('S3Lambda.context.output.filter (async)', (t) => {

  resetSandbox()
  t.plan(1)

  const answer = ['file1']

  const context = {
    bucket: bucket,
    prefix: prefix
  }

  lambda.context(context)
    .output(bucket, outputPrefix, (key) => key.concat('ab'))
    .filter(obj => new Promise((success, fail) => {
      success(obj == 'file1')
    }), true)
    .then(() => {
      t.deepEqual(readDir(outputPrefixPath), answer, 'filter to output (async)')
    })
    .catch(e => console.error(e.stack))
})

test('end', (t) => {
  rimraf(path.resolve(__dirname, 'buckets'))
  t.end()
})
