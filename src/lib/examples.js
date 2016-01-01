'use strict'

var S3renity = require('S3renity');

var config = {
  access_key_id: 'access-key',
  secret_access_key: 'secret-access-key'
};

var s3renity = new S3renity(config);
var s3dir = 's3://<bucket>/path/to/folder/';


// list keys
s3renity
  .context(s3dir)
  .list()
  .then(keys => {
    console.log(keys);
  });


// join
s3renity
  .context(s3dir)
  .join('\n')
  .then(result =>  console.log(result))
  .catch(e => console.log(e));


// forEach
// forEach with synchronous function
var a = o => {
  console.log(o);
};

s3renity
  .context(s3dir)
  .forEach(a)
  .then(s => console.log('done!'))
  .catch(e => console.log(e));

s3renity
  .context(s3dir)
  .split('\n')
  .forEach(a)
  .then(_ =>  console.log('done!'))
  .catch(e => console.log(e));

// forEach with async function
var b = o => {
  return new Promise((success, fail) => {
    setTimeout(function() {
      console.log(o);
      success('success message');
    }, 100);
  });
};

s3renity
  .context(s3dir)
  .forEach(b, true)
  .then(_ => console.log('done!'))
  .catch(e => console.log(e));

s3renity
  .context(s3dir)
  .split('\n')
  .forEach(b, true)
  .then(_ => console.log('done!'))
  .catch(e => console.log(e));


// map
// map with synchronous function
var a = o => {
  return o + ' added text';
};

s3renity
  .context(s3dir)
  .map(a)
  .then(s => console.log(s))
  .catch(e => console.log(e));

s3renity
  .context(s3dir)
  .split('\n')
  .map(a)
  .then(s => console.log(s))
  .catch(e => console.log(e));

// map with async function
var b = o => {
  return new Promise((success, fail) => {
    setTimeout(function() {
      success(o + ' added text');
    }, 200);
  });
};

s3renity
  .context(s3dir)
  .split('\n')
  .map(b, true)
  .then(s => console.log(s))
  .catch(e => console.log(e));

s3renity
  .context(s3dir)
  .map(b, true)
  .then(s => console.log(s))
  .catch(e => console.log(e));


// reduce
// reduce with sync function
var a = (p, c, k) => {
  if (p == null) return c;
  return p + c;
};

s3renity
  .context(s3dir)
  .reduce(a)
  .then(result => console.log(result))
  .catch(e=> console.log(e));

s3renity
  .context(s3dir)
  .split('\n')
  .reduce(a)
  .then(result => console.log(result))
  .catch(e=> console.log(e));

// reduce with async function
var b = (p, c, k) => {
  return new Promise((success, fail) => {
    setTimeout(function() {
      if (p == null) {
        success(c);
      } else {
        success(p + c);
      }
    }, 100);
  });
};

s3renity
  .context(s3dir)
  .reduce(b, null, true)
  .then(result => console.log(result))
  .catch(e=> console.log(e));

s3renity
  .context(s3dir)
  .split('\n')
  .reduce(b, null, true)
  .then(result => console.log(result))
  .catch(e=> console.log(e));


// filter
// filter with sync function
var a = b => {
  console.log(b[11]);
  if (b[11] == '3') {
    return false;
  }
  return true;
};

s3renity
  .context(s3dir)
  .filter(a)
  .then(s=> console.log(s))
  .catch(e=> console.log(e));

s3renity
  .context(s3dir)
  .split('\n')
  .filter(a)
  .then(s=> console.log(s))
  .catch(e=> console.log(e));

// filter with async function
var b = e => {
  return new Promise((success, fail) => {
    setTimeout(function() {
      if (e[11] == '3') {
        success(false);
      } else {
        success(true);
      }
    }, 200);
  });
};

s3renity
  .context(s3dir)
  .filter(b, true)
  .then(s => console.log(s))
  .catch(e => console.log(e));

s3renity
  .context(s3dir)
  .split('\n')
  .filter(b, true)
  .then(s => console.log(s))
  .catch(e => console.log(e));


// clean (delete empty files)
s3renity
  .context(s3dir)
  .clean()
  .then(_ => console.log('done!'))
  .catch(e=>console.log(e));

// write
// to single location
s3renity.write('body text', 'output1.txt');

// to multiple locations
s3renity.write('body text', ['output2.txt', s3dir + 'output3.txt']);

// delete
// single file
s3renity
  .delete('your-bucket', 'path/to/file.txt')
  .then(_ => console.log('done'))
  .catch(e => console.log(e));

// multiple files
s3renity
  .delete('your-bucket', ['path/to/local/output1.txt', 's3://path/to/output2.txt'])
  .then(_ => console.log('done!'))
  .catch(e => console.log(e));
