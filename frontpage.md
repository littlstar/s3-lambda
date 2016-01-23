## S3renity
S3renity is an [S3](https://aws.amazon.com/s3/) toolbelt for Node.js that enables you to treat directories like arrays of S3 objects, and perform batch functions on them. It also provides extra functionality for handling s3 objects. Some things we use S3renity for at Littlstar are prototyping MapReduce jobs and cleaning/organizing logs.

## Batch Functions
Perform sync or async functions over each file in a directory.
- forEach
- map
- reduce
- filter
- join

#### Setting Context
The `context` method enables you to issue a new batch request by telling s3renity where the files are in s3.
```javascript
var bucket = 'my-bucket';
var prefix = 'path/to/files/';

s3renity
  .context(bucket, prefix)
  // .forEach() ...
```
#### forEach(func[, isAsync])
Loops over each file in a s3 directory and performs `func`.  If `isAsync` is true, `func` should return a `Promise`.
```javascript
s3renity
  .context(bucket, prefix)
  .forEach(object => {
    // do something with `object`
  })
  .then(console.log('done!')
  .catch(console.error);
```
<br/>
#### map(func[, isAsync])
**Destructive**. Maps `func` over each file in an s3 directory, replacing each file with what is returned
from the mapper function. If `isAsync` is true, `func` should return a `Promise`. 
```javascript
const addSmiley = object => object + ':)';

// update s3 files inline
s3renity
  .context(bucket, prefix)
  .map(addSmiley)
  .then(console.log('done!'))
  .catch(console.error);
```
You can make this *non-destructive* by specifying an `output` directory.
```javascript
// leaves original s3 files and redirects output
s3renity
  .context(bucket, prefix)
  .output(bucket, outputPrefix)
  .map(addSmiley)
  .then(console.log('done!'))
  .catch(console.error);
```
<br/>
#### reduce(func[, isAsync])
Reduces the objects in the working context to a single value.
```javascript
// concatonates all the files
const reducer = (previousValue, currentValue, key) => {
  return previousValue + currentValue
};

s3renity
  .context(bucket, prefix)
  .reduce(reducer)
  .then(console.log('done!')
  .catch(console.error);
```

## S3 Functions
Promise-based wrapper around common S3 methods.
- list
- get
- put
- copy
- delete
- split

## Install
```bash
npm install s3renity --save
```
