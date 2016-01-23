## S3renity
S3renity is an [S3](https://aws.amazon.com/s3/) toolbelt for Node.js that enables you to treat directories like arrays of S3 objects, and perform batch functions on them. It also provides extra functionality for handling s3 objects. Some things we use S3renity for at Littlstar are prototyping MapReduce jobs and cleaning/organizing logs.

## Batch Functions
Perform sync or async functions over each file in a directory.
- forEach
- map
- reduce
- filter
- join

## S3 Functions
Promise-based wrapper around common S3 methods.
- list
- get
- put
- copy
- delete
- split

## Reference
#### Setting Context
The `context` method enables you to issue a new batch request by telling s3renity where the files are in s3.
```javascript
var bucket = 'my-bucket';
var prefix = 'path/to/files/';

s3renity
  .context(bucket, prefix)
  // .forEach() ...
```
<br/><br/>
#### forEach
Loops over each file in a s3 directory and performs a function.
```javascript
s3renity
  .context(bucket, prefix)
  .forEach(obj => {
    // do something with obj
  })
  .then(() => {
    console.log('done!');
  })
  .catch(console.error);
```
<br/>
#### map
**Destructive**. Maps a function over each file in an s3 directory, replacing each file with what is returned
from the mapper function.  Optionally you can make this *non-destructive* by specifying an `output` directory.
```javascript
// update s3 files inline
s3renity
  .context(bucket, prefix)
  .map(obj => {
    return obj + 'altered!';
  })
  .then(() => {
    console.log('done!');
  })
  .catch(console.error);

// leaves s3 files be and redirects output
s3renity
  .context(bucket, prefix)
  .output(bucket, outputPrefix)
  .map(obj => {
    return obj + 'altered!';
  })
  .then(() => {
    console.log('done!');
  })
  .catch(console.error);
```
<br/>
#### reduce
Reduces the objects in the working context to a single value.
```javascript
s3renity
  .context(bucket
```

## Quick Example
```javascript
var S3renity = require('s3renity');

var s3renity = new S3renity({
  access_key_id: 'your access key',
  secret_access_key: 'your secret key'
});

// Print out the contents of every file in an S3 directory
var bucket = 'my-bucket';
var prefix = 'path/to/files';
var print = body => console.log(body);

s3renity
  .context(bucket, prefix)         // sets the directory context in S3
  .forEach(print)                  // loop over every object and print it
  .then(() => console.log('done')) // callback function (resolved promise)
  .catch(e => console.log(e))      // handle error
```

## Install
```bash
npm install s3renity --save
```
