## S3renity

WARNING: The s3renity package is being deprecated and moving to s3-lambda.

S3renity enables you to run batch functions on [S3](https://aws.amazon.com/s3/) objects with concurrency control. Set the context to a directory or key prefix, then run familiar functions such as `forEach`, `map`, `reduce`, or `filter` on all those objects. S3renity is promise-based, so you can chain operations together, as well as interact with the base api with promises instead of callbacks.

At Littlstar, we use S3renity for data cleaning, exploration, and pipelining.

## Install
```bash
npm install s3renity --save
```

## Quick Example
```javascript
const S3renity = require('s3renity');

// example options
const s3renity = new S3renity({
  access_key_id: 'aws-access-key',
  secret_access_key: 'aws-secret-key',
  show_progress: true,
  verbose: true,
  max_retries: 10,
  timeout: 1000
});

const bucket = 'my-bucket';
const prefix = 'path/to/files/';

s3renity
  .context(bucket, prefix)
  .forEach(object => {
    // do something with object
  })
  .then(_ => console.log('done!'))
  .catch(console.error);
```

## Batch Functions
Perform sync or async functions over each file in a directory.
- forEach
- each
- map
- reduce
- filter

**First Step: Setting Context**  
Before calling a batch function, you must tell s3renity what files to operate over. You do this by calling `context`, which returns a promise, so you can chain it with the batch request. The context function takes four arguments: **bucket**, **prefix**, **marker**, **limit**, and **reverse**.

```javascript
s3renity.context(
  bucket, // the s3 bucket to use
  prefix, // the prefix of the files to use - s3renity will operate over every file with this prefix
  marker, // (optional, default null) start at this file/prefix
  limit,  // (optional, default Infinity) limit the # of files operated over
  reverse // (optional, default false) if true, operate over all files in reverse
) // .forEach()...chain a batch function here

// you can also provide an array of contexts like this
const ctx1 = {
  bucket: 'my-bucket',
  prefix: 'path/to/files/1/'
  // marker: 'path/to/files/1/somefile'
};
const ctx2 = {
  bucket: 'my-bucket',
  prefix: 'path/to/files/2/'
  // marker: 'path/to/files/2/somefile'
};
s3renity.context([ctx1, ctx2]) // .forEach()...
```


### forEach
forEach(fn[, isasync])  

Iterates over each file in a s3 directory and performs `func`.  If `isasync` is true, `func` should return a Promise.
```javascript
s3renity
  .context(bucket, prefix)
  .forEach(object => { /* do something with object */ })
  .then(_ => console.log('done!')
  .catch(console.error);
```
### each
each(fn[, isasync])  

Performs `fn` on each S3 object in parallel. You can set the concurrency level (defaults to `Infinity`).
If `isasync` is true, `fn` should return a Promise;
```javascript
s3renity
  .context(bucket, prefix)
  .concurrency(5) // operates on 5 objects at a time
  .each(object => console.log(object))
  .then(_ => console.log('done!')
  .catch(console.error);
```
### map
map(fn[, isasync])  

**Destructive**. Maps `fn` over each file in an s3 directory, replacing each file with what is returned
from the mapper function. If `isasync` is true, `fn` should return a Promise. 
```javascript
const addSmiley = object => object + ':)';

s3renity
  .context(bucket, prefix)
  .map(addSmiley)
  .then(console.log('done!'))
  .catch(console.error);
```
You can make this *non-destructive* by specifying an `output` directory.
```javascript
const outputBucket = 'my-bucket';
const outputPrefix = 'path/to/output/';

s3renity
  .context(bucket, prefix)
  .output(outputBucket, outputPrefix)
  .map(addSmiley)
  .then(console.log('done!')
  .catch(console.error)
```
### reduce
reduce(func[, isasync])  

Reduces the objects in the working context to a single value.
```javascript
// concatonates all the files
const reducer = (previousValue, currentValue, key) => {
  return previousValue + currentValue
};

s3renity
  .context(bucket, prefix)
  .reduce(reducer)
  .then(result => { /* do something with result */ })
  .catch(console.error);
```
### filter
filter(func[, isasync])  

**Destructive**.  Filters (deletes) files in s3. `func` should return `true` to keep the object, and `false` to delete it. If `isasync` is true, `func` returns a Promise.
```javascript
// filters empty files
const fn = object => object.length > 0;

s3renity
  .context(bucket, prefix)
  .filter(fn)
  .then(_ => console.log('done!')
  .catch(console.error);
```
Just like in `map`, you can make this *non-destructive* by specifying an `output` directory.
```javascript
s3renity
  .context(bucket, prefix)
  .output(outputBucket, outputPrefix)
  .filter(filter)
  .then(console.log('done!'))
  .catch(console.error();
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

List all keys in `s3://bucket/prefix`.  If you use a marker, the s3renity will start listing alphabetically from there.
```javascript
s3renity
  .list(bucket, prefix)
  .then(list => console.log(list))
  .catch(console.error);
```
### keys
keys(bucket, prefix[, marker])  

Returns an array of keys for the given `bucket` and `prefix`.
```javascript
s3renity
  .keys(bucket, prefix)
  .then(keys => console.log(keys))
  .catch(console.error)
```
### get
get(bucket, key[, encoding[, transformer]])  

Gets an object in s3, calling `toString(encoding` on objects.
```javascript
s3renity
  .get(bucket, key)
  .then(object => { /* do something with object */ }
  .catch(console.error);
```
Optionally you can supply your own transformer function to use when retrieving objects.
```javascript
const zlib = require('zlib');

const transformer = object => {
  return zlib.gunzipSync(object).toString('utf8');
}

s3renity
  .get(bucket, key, null, transformer)
  .then(object => { /* do something with object */ }
  .catch(console.error);
```
### put
put(bucket, key, object[, encoding])  

Puts an object in s3.  Default encoding is `utf8`.
```javascript
s3renity
  .put(bucket, key, 'hello world!')
  .then(console.log('done!').catch(console.error);
```
### copy
copy(bucket, key, targetBucket, targetKey)  

Copies an object in s3 from `s3://sourceBucket/sourceKey` to `s3://targetBucket/targetKey`.
```javascript
s3renity
  .copy(sourceBucket, sourceKey, targetBucket, targetKey)
  .then(console.log('done!').catch(console.error);
```
### delete
delete(bucket, key)  

Deletes an object in s3 (`s3://bucket/key`).
```javascript
s3renity
  .delete(bucket, key)
  .then(console.log('done!').catch(console.error);
```
