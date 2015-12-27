# S3renity.js
A powerful toolbelt for batch operations in S3.  S3renity provides `forEach`, `map`, `reduce`, `filter`, as well as a friendly promise-based wrapper around the S3 api.  

- Quickly prototype MapReduce jobs
- Clean or organize dirty log files
- Perform sync or async functions over each file with forEach, map, reduce, and filter
- Many more...

## Getting started
Install S3renity  
```bash
npm install s3renity --save
```

Quick Example
```javascript
var S3renity = require('s3renity');

var s3renity = new S3renity({
  access_key_id: 'your access key',
  secret_access_key: 'your secret key'
});

// Print out the contents of every file in an S3 directory
var folder = 's3://<bucket>/path/to/folder/';
var print = body => console.log('this is a s3 object:', body);

s3renity
  .context(folder)                 // sets the directory in S3
  .forEach(print)                  // function to perform over each s3 object
  .then(_ => console.log('done!')) // continue
  .catch(e => console.log(e))      // handle error
```
## Options
```
{
  verbose: true,  // default: false
}
```

## Input
Before operating over S3 files, you must tell S3renity where to get the S3 objects and how to treat them.  There are a few functions you can use before calling a batch function.

**S3renity.context(dir)**  
Required  
Sets the directory in S3 to work on.
```javascript
s3renity.context('s3://<bucket>/path/to/dir')...
```

**S3renity.marker(start)**  
Optional  
Tells S3renity which file to start on, proceeding alphabetically from `start`.  This is the same way `marker` works in [getObject()](http://docs.aws.amazon.com/AmazonS3/latest/API/RESTBucketGET.html) in the S3 spec.
```javascript
s3renity
  .context('s3://<bucket>/path/to/dir/')
  .marker('1234.text')
  ...
```

**S3renity.encode(encoding)**  
Otional  
Tells S3renity what encoding to use when calling `toString()` on the S3 object body (default is 'utf8').  Alternatively, you can use `S3renity.transform` to do something else to load the file.
```javascript
s3renity
  .context('s3://<bucket>/path/to/dir/')
  .encode('ascii')
  ...
```

**S3renity.transform(func)**  
Optional  
Tells S3renity to run `func` over S3 objects before using them.  For example, you may want to use `zlib` to unzip files before processing.
```javascript
var zlib = require('zlib');

S3renity
  .context('s3://<bucket>/path/to/dir/')
  .transform(obj => zlib.gunzipSync(obj).toString('utf8'))
  ...
```

**S3renity.split(delimiter)**  
Optional  
Tells S3renity to work over the deliminations of objects instead of the objects themselves.  For example, calling `S3renity.split('\n')` would tell S3renity to perform operations over each line in each file. 
```javascript
S3renity
  .context('s3//<bucket>/path/to/dir/')
  .split('\n')
  .forEach(line => console.log(line))
```

## Batch Functions
- forEach
- map
- reduce
- filter

**forEach(func[, isAsync])**  
Perform ```func``` on every item in the working context.  If ```split``` is called, ```func``` takes a string.  Otherwise, it takes an S3 object.  ```func``` either performs a synchronous action on the argument, or returns a promise.
```javascript
s3renity
  .context(path)
  .forEach(func)
  .then(_ => {})
  .catch(e => {})
  
s3renity
  .context(path)
  .split('\n')
  .forEach(func)
  .then(_ => {})
  .catch(e => {})
```

**map(func[, isAsync])**  
Destructuve (unless `output` is specified)  
Perform ```func``` on every item in the working context, replacing each in place.  If ```split``` is called, ```func``` takes a string.  Otherwise, it takes an S3 object.  ```func``` is either synchronous that returns the new object (or item) or returns a promise that resolves to the new object.
```javascript
s3renity
  .context(path)
  .output(outputFolder)  // optional
  .map(func)
  .then(_ => {})
  .catch(e => {})
  
s3renity
  .context(path)
  .split('\n')
  .map(func)
  .then(_ => {})
  .catch(e => {})
```

**reduce(func[, initialValue, isAsync])**  
Reduce the working context to a single value with ```func```. ```func``` takes three arguments: ```previousValue```, ```currentValue```, and ```key``` (the key of the current S3 object), and returns the updated object.

```javascript
s3renity
  .context(path)
  .reduce(func)
  .then(result => {})
  .catch(e => {})

s3renity
  .context(path)
  .split('\n')
  .reduce(func)
  .then(result => {})
  .catch(e => {})
```

**filter(func)**  
Destructive (unless `output` is specified)  
Filter the working context with ```func```, removing all objects or entries that don't pass the test.  *This function is destructive unless if you specify an output*.  If ```split``` is called, ```func``` takes a string.  Otherwise, it takes an S3 object.  ```func``` is either synchronous or returns a promise, and returns false if the item should be filtered.
```javascript
s3renity
  .context(path)
  .output(outputFolder) // optional
  .filter(func)
  .then(_ => {})
  .catch(e)
  
s3renity
  .context(path)
  .split('\n')
  .filter(func)
  .then(_ => ...)
  .catch(e)
```

## Extra Functionality
- list
- get
- put
- delete
- join
- write
- splitObject

**list()**  
List all the keys in the working context.
```javascript
s3renity
  .context(path)
  .list()
  .then(keys => {})
  .catch(e => {})
```

**get(arg1[, arg2])**  
Get an object from S3 either by specifying a valid key, or separate them into two arguments key and bucket.
```javascript
s3renity
  .get('bucket', 'path/to/object')
  .then(object => {})
  .catch(e => {})

s3renity
  .get('s3://path/to/object')
  .then(object => ...)
  .catch(e => ...)
```

**put(bucket, key, body)**  
Put an object in S3.
```javascript
s3renity
  .put(bucket, key, body)
  .then(_ => ...)
  .catch(e => ...)
```

**delete(bucket, key)**  
Delete an object or list of objects from S3.  Key can be a string key, the object to delete, or an array of keys to delete.
```javascript
s3renity.delete('bucket', 'path/to/file.txt')
s3renity.delete('bucket', ['s3://bucket/path/to/thing', 's3://bucket/path/to/thing2'])
```

**join(delimiter)**  
Joins the objects in the working context by ```delimiter``` and returns the result.
```javascript
s3renity
  .context(path)
  .join('\n')
  .then(result => console.log(result))
  .catch(e => ...)
```

**write(body, targets)**  
Output the working context to a file or location in s3. Targets can be a string (single target) or an array of targets.  Targets can be local files or valid S3 paths.
```javascript
var text = 'blah';
s3renity.write(text, ['s3://bucket/path/to/file.txt', 'localfile.txt']);
```

**splitObject(bucket, key[, delimiter, encoding])**  
Split a single (text) object in S3 by a delimiter. Default delimiter is \n and encoding is utf8.
```javascript
s3renity
  .context(path)
  .splitObject('bucket', 'path/to/object', '\t');
  .then(result => {}) // do something with result
  .catch(console.log)
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

## More Examples
Check out the examples file https://github.com/littlstar/s3renity/blob/master/examples.js
