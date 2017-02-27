## s3-lambda

`s3-lambda` enables you to run lambda functions over a context of [S3](https://aws.amazon.com/s3/) objects. It has a stateless architecture with concurrency control, allowing you to process a large number of files very quickly. This is useful for quickly prototyping complex data jobs without an infrastructure like Hadoop or Spark.

At Littlstar, we use `s3-lambda` for all sorts of data pipelining and analytics.

## Install
```bash
npm install s3-lambda --save
```

## Quick Example
```javascript
const S3Lambda = require('s3-lambda')

// example options
const lambda = new S3Lambda({
  accessKeyId: 'aws-access-key',       // Optional. (falls back on local AWS credentials)
  secretAccessKey: 'aws-secret-key',   // Optional. (falls back on local AWS credentials)
  showProgress: true,                  // Optional. Show progress bar in stdout
  verbose: true,                       // Optional. Show all S3 operations in stdout (GET, PUT, DELETE)
  maxRetries: 10,                      // Optional. Maximum request retries on an S3 object. Defaults to 10.
  timeout: 10000                       // Optional. Amount of time for request to timeout. Defaults to 10000 (10s)
})

const context = {
  bucket: 'my-bucket',
  prefix: 'path/to/files/'
}

lambda
  .context(context)
  .forEach(object => {
    // do something with object
  })
  .then(_ => console.log('done!'))
  .catch(console.error)
```

## Setting Context
Before initiating a lambda expression, you must tell `s3-lambda` what files to operate over by calling `context`. A context is defined with an options object with the following properties: **bucket**, **prefix**, **marker**, **limit**, and **reverse**.

```javascript
lambda.context({
  bucket: 'my-bucket',       // The S3 bucket to use
  prefix: 'prefix/',         // The prefix of the files to use - s3-lambda will operate over every file with this prefix.
  marker: 'prefix/file1',    // Optional. Start at the first file with this prefix. If it is a full file path, starts with next file. Defaults to null.
  endPrefix: 'prefix/file3', // Optional. Process files up to (not including) this prefix. Defaults to null.
  limit: 1000,               // Optional. Limit the # of files operated over. Default is Infinity.
  reverse: false             // Optional. If true, operate over all files in reverse. Defaults to false.
})
```
You can also provide an array of context options, which will tell `ls-lambda` to operate over all the files in each.
```javascript
const ctx1 = {
  bucket: 'my-bucket',
  prefix: 'path/to/files/',
  marker: 'path/to/logs/2017'
}
const ctx2 = {
  bucket: 'my-other-bucket',
  prefix: 'path/to/other/logs/',
  limit: 100
}

lambda.context([ctx1, ctx2])
```

## Modifiers
After setting context, you can chain several other functions that modify the operation. Each returns a `Request` object, so they can be chained. All of these are optional.
### .concurrency(c)
{Number} Set the request concurrency level (default is `Infinity`).

### .transform(f)
{Function} Sets the transformation function to use when getting objects. This transformer will be called with the raw object that is returned by the [`S3#getObject()`](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getObject-property) method in the AWS SDK, and should return the transformed object.  When a transformer function is provided, objects are not automatically converted to strings, and the `encoding` parameter is ignored.  
**Example:** unzipping compressed S3 files before each operation
```javascript
const zlib = require('zlib')

lambda
  .context(context)
  .transform((object) => {
    return zlib.gunzipSync(object.Body).toString('utf8')
  })
  .each(...)
```
### .encode(e)
{String} Sets the string encoding to use when getting objects.  This setting is ignored if a transformer function is used.
### limit(l)
{Number} Limit the number of files operated over.
### reverse(r)
{Boolean} Reverse the order of files operated over.
### async()
Lets the resolver know that your function is async (returns a Promise).

## Lambda Functions
Perform synchronous or asynchronous functions over each file in the set context.
- each
- forEach
- map
- reduce
- filter

### each
each(fn[, isasync])  

Performs `fn` on each S3 object in parallel. You can set the concurrency level (defaults to `Infinity`).
If `isasync` is true, `fn` should return a Promise.
```javascript
lambda
  .context(bucket, prefix)
  .concurrency(5) // operates on 5 objects at a time
  .each(object => console.log(object))
  .then(_ => console.log('done!'))
  .catch(console.error)
```

### forEach
forEach(fn[, isasync])  

Same as `each`, but operates sequentially, one file at a time. Setting concurrency for this function is superfluous.
```javascript
lambda
  .context(bucket, prefix)
  .forEach(object => { /* do something with object */ })
  .then(_ => console.log('done!'))
  .catch(console.error)
```
### map
map(fn[, isasync])  

**Destructive**. Maps `fn` over each file in an S3 directory, replacing each file with what is returned
from the mapper function. If `isasync` is true, `fn` should return a Promise.
```javascript
const addSmiley = object => object + ':)'

lambda
  .context(bucket, prefix)
  .map(addSmiley)
  .then(console.log('done!'))
  .catch(console.error)
```
You can make this *non-destructive* by specifying an `output` directory.
```javascript
const outputBucket = 'my-bucket'
const outputPrefix = 'path/to/output/'

lambda
  .context(bucket, prefix)
  .output(outputBucket, outputPrefix)
  .map(addSmiley)
  .then(console.log('done!'))
  .catch(console.error)
```
### reduce
reduce(func[, isasync])  

Reduces the objects in the working context to a single value.
```javascript
// concatonates all the files
const reducer = (previousValue, currentValue, key) => {
  return previousValue + currentValue
}

lambda
  .context(bucket, prefix)
  .reduce(reducer)
  .then(result => { /* do something with result */ })
  .catch(console.error)
```
### filter
filter(func[, isasync])  

**Destructive**.  Filters (deletes) files in S3. `func` should return `true` to keep the object, and `false` to delete it. If `isasync` is true, `func` returns a Promise.
```javascript
// filters empty files
const fn = object => object.length > 0

lambda
  .context(bucket, prefix)
  .filter(fn)
  .then(_ => console.log('done!'))
  .catch(console.error)
```
Just like in `map`, you can make this *non-destructive* by specifying an `output` directory.
```javascript
lambda
  .context(bucket, prefix)
  .output(outputBucket, outputPrefix)
  .filter(filter)
  .then(console.log('done!'))
  .catch(console.error()
```
## S3 Functions
Promise-based wrapper around common S3 methods.
- list
- keys
- get
- put
- copy
- delete

### list
list(bucket, prefix[, marker])  

List all keys in `s3://bucket/prefix`.  If you use a marker, `s3-lambda` will start listing alphabetically from there.
```javascript
lambda
  .list(bucket, prefix)
  .then(list => console.log(list))
  .catch(console.error)
```
### keys
keys(bucket, prefix[, marker])  

Returns an array of keys for the given `bucket` and `prefix`.
```javascript
lambda
  .keys(bucket, prefix)
  .then(keys => console.log(keys))
  .catch(console.error)
```
### get
get(bucket, key[, encoding[, transformer]])  

Gets an object in S3, calling `toString(encoding` on objects.
```javascript
lambda
  .get(bucket, key)
  .then(object => { /* do something with object */ })
  .catch(console.error)
```

Optionally you can supply your own transformer function to use when retrieving objects.  This transformer will be called with the raw object that is returned by the [`S3#getObject()`](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getObject-property) method in the AWS SDK, and should return the transformed object.  When a transformer function is provided, objects are not automatically converted to strings, and the `encoding` parameter is ignored.

```javascript
const zlib = require('zlib')

const transformer = object => {
  return zlib.gunzipSync(object.Body).toString('utf8')
}

lambda
  .get(bucket, key, null, transformer)
  .then(object => { /* do something with object */ })
  .catch(console.error)
```

### put
put(bucket, key, object[, encoding])  

Puts an object in S3.  Default encoding is `utf8`.
```javascript
lambda
  .put(bucket, key, 'hello world!')
  .then(console.log('done!')).catch(console.error)
```
### copy
copy(bucket, key, targetBucket, targetKey)  

Copies an object in S3 from `s3://sourceBucket/sourceKey` to `s3://targetBucket/targetKey`.
```javascript
lambda
  .copy(sourceBucket, sourceKey, targetBucket, targetKey)
  .then(console.log('done!')).catch(console.error)
```
### delete
delete(bucket, key)  

Deletes an object in S3 (`s3://bucket/key`).
```javascript
lambda
  .delete(bucket, key)
  .then(console.log('done!')).catch(console.error)
```
