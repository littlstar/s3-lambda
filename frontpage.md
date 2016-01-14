## S3renity
S3renity allows you to treat S3 files like arrays, and lets you perform batch operations on them.

Some use cases...
- Quickly prototype MapReduce jobs
- Clean or organize dirty log files
- Perform sync or async functions over each file with forEach, map, reduce, and filter
- Many more...

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

## S3 Object Functions
Promise-based wrapper around common S3 methods.
- list
- get
- put
- delete
- split

## forEach
Loop over a directory and print the contents of each file
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
  .forEach(print)                  // function to perform over each s3 object
  .then(() => console.log('done')) // continue
  .catch(e => console.log(e))      // handle error
```

## Advanced Examples
Perform an asynchronous db lookup for every line of JSON in every file in the working context.
```javascript
const lookupId = line => {
  line = JSON.parse(line);
  return new Promise((success, fail) => {
    db.lookup(line.id).then(success).catch(fail);
  });
};

s3renity
  .context(path)
  .split('\n')
  .forEach(lookupId, true)
  .then(_ => console.log('done!'))
  .catch(e => console.log(e))
```

Add a field to each log entry and then concatonate all the files into one and save it locally.
```javascript

var folder = 's3://bucket/path/to/folder';
var tmpFolder = 's3://bucket/path/to/temporary/output/folder';
var localOutput = 'output.txt';

s3renity
  .context(folder)
  .split('\n')
  .target(tmpFolder)
  .map(entry => {
    var temp = JSON.parse(entry);
    if (temp.timestamp == null) {
     temp.timestamp = Date.now()/1000|0;
    }
    return temp;
  })
  .then(_ => {
    s3renity.ctx(tmpFolder).join('\n').then(results => {
      s3renity.write(results, localOutput);
    })}
  )
  .catch(err => console.log(err));
```
