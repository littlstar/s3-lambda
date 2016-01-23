## S3renity
S3renity is an [S3](https://aws.amazon.com/s3/) toolbelt for Node.js that enables you to treat directories like arrays of S3 objects, and perform batch functions on them. It also provides a promise-based wrapper around the s3 api. Some things we use S3renity for at Littlstar are prototyping MapReduce jobs and cleaning/organizing logs.

## Quick Example
```javascript
const S3renity = require('s3renity');

const s3renity = new S3renity({
  aws_access_key: 'aws-access-key',
  aws_secret_key: 'aws-secret-key',
  max_retries: 30, // optional
  timeout: 120,    // optional
  verbose: true    // optional
});

const bucket = 'my-bucket';
const prefix = 'path/to/files/';

s3renity
  .context(bucket, prefix)
  .forEach(object => { /* do something with object */ })
  .then(console.log('done!'))
  .catch(console.error);
```

## Install
```bash
npm install s3renity --save
```

## Batch Functions
Perform sync or async functions over each file in a directory.
- forEach
- map
- reduce
- filter
- join

<br/>
#### forEach
forEach(func[, isAsync])  

Loops over each file in a s3 directory and performs `func`.  If `isAsync` is true, `func` should return a Promise.
```javascript
s3renity
  .context(bucket, prefix)
  .forEach(object => { /* do something with object */ })
  .then(console.log('done!')
  .catch(console.error);
```
<br/>
#### map
map(func[, isAsync])  

**Destructive**. Maps `func` over each file in an s3 directory, replacing each file with what is returned
from the mapper function. If `isAsync` is true, `func` should return a Promise. 
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
s3renity
  .context(bucket, prefix)
  .output(outputBucket, outputPrefix)
  .map(addSmiley)
  .then(console.log('done!')
  .catch(console.error)
```
<br/>
#### reduce
reduce(func[, isAsync])  

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
<br/>
#### filter
filter(func[, isAsync])  

**Destructive**.  Filters (deletes) files in s3. `func` should return `true` to keep the object, and `false` to delete it. If `isAsync` is true, `func` returns a Promise.
```javascript
// filters empty files
const filter = object => object.length > 0;

s3renity
  .context(bucket, prefix)
  .filter(filter)
  .then(console.log('done!')
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
<br/>
#### join
join(delimiter)  

Joins objects in s3 to a single value.
```javascript
s3renity
  .context(bucket, prefix)
  .join('\n')
  .then(result => { /* do something with result */ }
  .catch(console.error);
```
## S3 Functions
Promise-based wrapper around common S3 methods.
- list
- get
- put
- copy
- delete

<br/>
#### list
list(bucket, prefix[, marker])  

Returns an array of keys in `s3://bucket/prefix`.  If you use a marker, the s3renity will start listing alphabetically from there.
```javascript
s3renity
  .list(bucket, prefix)
  .then(keys => { /* do something with keys */ }
  .catch(console.error);
```
<br/>
#### get
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
<br/>
#### put
put(bucket, key, object[, encoding])  

Puts an object in s3.  Default encoding is `utf8`.
```javascript
s3renity
  .put(bucket, key, 'hello world!')
  .then(console.log('done!').catch(console.error);
```
<br/>
#### copy
copy(bucket, key, targetBucket, targetKey)  

Copies an object in s3 from `s3://sourceBucket/sourceKey` to `s3://targetBucket/targetKey`.
```javascript
s3renity
  .copy(sourceBucket, sourceKey, targetBucket, targetKey)
  .then(console.log('done!').catch(console.error);
```
<br/>
#### delete
delete(bucket, key)  

Deletes an object in s3 (`s3://bucket/key`).
```javascript
s3renity
  .delete(bucket, key)
  .then(console.log('done!').catch(console.error);
```
