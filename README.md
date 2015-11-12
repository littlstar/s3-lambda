# S3renity.js
A powerful S3 toolbelt that gives you access to batch operations like forEach, map, reduce, filter, and more...

## Use Cases
- Quickly prototype map-reduce jobs
- Clean or organize dirty log files
- Perform sync or async functions over each file with forEach, map, reduce, and filter
- Many more...

## Getting started
```javascript
var S3renity = require('S3renity');

var s3renity = new S3renity({
  access_key_id: 'your access key',
  secret_access_key: 'your secret key'
});

var folder = 's3://<bucket>/path/to/folder/';

// map func over every line separated string
s3renity
  .get(folder)
  .reduce(fn)
  .then(result => ...do stuff...)
  .catch(e)
```

## Instructions
S3renity has the concept of a working context, which defines the files or log entries you are working with.  The working context is set by ```S3renity.context()```.  By calling that on a valid s3 path, the working context is set to all the files with that key prefix (in that directory).  From there, you can perform batch operations.  For example:  
```
S3renity
  .context(dir)
  .forEach(body => console.log('do something with file body')
  .then(s => ...do something else...)
  .catch(e => ...handle error...);
```

It is also possible for the working context to set to the lines in the files by calling ```split()```.  Suppose you wanted to iterate over every line in every file in a S3 directory.  You could do something like:  
```
S3renity
  .context(dir)
  .split('\n')
  .forEach(line => console.log('do something with line'))
  .then(s => ...do something else...)
  .catch(e => ...handle error);
```

## Functions

**forEach(func)**  
Perform ```func``` on every item in the working context.  If ```split``` is called, ```func``` takes a string.  Otherwise, it takes an S3 object.  ```func``` either performs a synchronous action on the argument, or returns a promise.
```javascript
s3renity
  .get(key)
  .forEach(func)
  .then(..)
  .catch(..)
  
s3renity
  .get(key)
  .split('\n')
  .forEach(func)
  .then(self => ...)
  .catch(e)
```

**map(func)**  
Perform ```func``` on every item in the working context, replacing each in place.  *This function is destructive*.  If ```split``` is called, ```func``` takes a string.  Otherwise, it takes an S3 object.  ```func``` is either synchronous that returns the new object (or item) or returns a promise that resolves to the new object.
```javascript
s3renity
  .get(key)
  .map(func)
  .then(self => ...)
  .catch(e)
  
s3renity
  .get(key)
  .split('\n')
  .map(func)
  .then(self => ...)
  .catch(e)
```

**filter(func)**  
Filter the working context with ```func```, removing all objects or entries that don't pass the test.  *This function is destructive*.  If ```split``` is called, ```func``` takes a string.  Otherwise, it takes an S3 object.  ```func``` is either synchronous or returns a promise, and returns false if the item should be filtered.
```javascript
s3renity
  .get(key)
  .filter(func)
  .then(self => ...)
  .catch(e)
  
s3renity
  .get(key)
  .split('\n')
  .filter(func)
  .then(self => ...)
  .catch(e)
```

**join(delimiter)**  
Join the objects in the working context into one file, and direct the output to an S3 path or a local file.  Output can also be an array of paths.  Under the hood, join deferrs a promise and returns ```this```, so you need to call ```output()``` after for it to run.
```javascript
s3renity
  .get(key)
  .join('\n')
  .output('output.txt')
  .then(self => ...)
  .catch(e)
  
s3renity
  .get(key)
  .join('\n')
  .output(['output.txt', 's3://bucket/path/to/file1', 's3://bucket/path/to/file2'])
  .then()
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
  .get(key)
  .split('\n')
  .forEach(lookupId)
  .then(..)
  .catch(..)
```

Add a field to each log entry and then concatonate all the files into one and save it locally.
```javascript
s3renity
  .get(key)
  .split('\n')
  .map(entry => {
    var temp = JSON.parse(entry);
    if (temp.timestamp == null) {
     temp.timestamp = Date.now()/1000|0;
    }
    return temp; 
  })
  .then(_ => s3renity.join('\n').then(b => write('output.txt'))
  .catch(err => console.log(err));
```

## More Examples
Check out the examples file https://github.com/littlstar/s3renity/blob/master/examples.js
