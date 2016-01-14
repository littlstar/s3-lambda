## S3renity
S3renity is an [S3](https://aws.amazon.com/s3/) toolbelt for [node](https://nodejs.org/en/) that enables you to treat directories like arrays, and perform batch functions on them. It also provides a promise-based wrapper around the most common S3 methods. Some things we use this for at Littlstar are prototyping MapReduce jobs and cleaning/organizing logs.

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
- delete
- split

## Install
```bash
npm install s3renity --save
```
