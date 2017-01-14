'use strict'

// Dependencies
const s3renity = require(`${__dirname}/..`);
const equals = require('array-equal')
const mkdirp = require('mkdirp').sync
const rimraf = require('rimraf').sync
const test = require('tape');
const path = require('path')
const fs = require('fs')

// Path variables
const folder = 'buckets'
const bucket = 's3renity';
const prefix = 'files';
const files = ['file1', 'file2', 'file3', 'file4']
const localPath = path.resolve(__dirname, folder)
const bucketPath = path.resolve(__dirname, folder, bucket)
const prefixPath = path.resolve(__dirname, folder, bucket, prefix)

// S3renity object
const s3 = new s3renity({
  localPath,
  show_progress: false,
  verbose: true
});

resetSandbox()

function resetSandbox() {
  rimraf(path.resolve(__dirname, 'buckets'))
  mkdirp(prefixPath)
  files.forEach(file => {
    const filePath = path.resolve(__dirname, folder, bucketPath, prefixPath, file)
    fs.writeFileSync(filePath, file)
  })
  console.log()
}

function readFile(path) {
  return fs.readFileSync(path).toString().trim()
}

function filesExist(paths) {
  return paths.map(fileExists).every(f => f)
}

function fileExists(path) {
  return fs.existsSync(path)
}

function arraysEqual(arr1, arr2) {
  return arr1.every((obj, index) => equals(obj, arr2[index]))
}

/**
 * Test key listing function
 * TODO test with endPrefix and marker
 */

test('s3renity.keys', t => {
  t.plan(1);
  let answer = files.map(f => `${prefix}/${f}`)
  s3
    .keys(bucket, prefix)
    .then(keys => {
      t.ok(equals(keys, answer), 'keys length matches')
    })
    .catch(e => console.error(e.stack));
});

/**
 * Test S3 methods get, put, and delete
 */

test('s3renity.put, s3renity.get, s3renity.delete', t => {

  resetSandbox()
  t.plan(3)

  let file = files[0]
  let key = `${prefix}/${file}`
  let body = 'hello world'
  let name = 'test'

  s3
    .put(bucket, key, body)
    .then(() => {
      let fileContents = readFile(`${prefixPath}/${file}`)
      t.ok(fileContents == body, 'put object')
      s3.get(bucket, key).then(obj => {
        t.ok(obj == body, 'get object')
        s3.delete(bucket, key).then(() => {
          t.ok(!fs.existsSync(`${key}`), 'delete object');
        }).catch(console.error);
      })
        .catch(console.error)
    })
    .catch(console.error)
});

test('s3renity.delete (batch)', t => {

  t.plan(1);

  const files = ['file2', 'file3', 'file4']
  const keys = files.map(file => `${prefix}/${file}`)

  s3.deleteObjects(bucket, keys).then(() => {
    t.ok(!filesExist(keys), 'delete multiple objects');
  }).catch(console.error);
});

test('s3renity.context.forEach (sync)', t => {

  resetSandbox();
  t.plan(1);

  const objects = []
  const answer = [ { object: 'file1', key: 'files/file1' },
    { object: 'file2', key: 'files/file2' },
    { object: 'file3', key: 'files/file3' },
    { object: 'file4', key: 'files/file4' } ]

  s3
    .context(bucket, prefix).forEach((obj, key) => {
      objects.push({
        object: obj,
        key: key
      })
    })
    .then(() => {
      t.ok(arraysEqual(objects, answer), 'forEach sync over 3 objects')
    })
    .catch(e => console.error(e.stack));
});

// test('s3renity.context.forEach (async)', t => {

//   reset();
//   t.plan(1);

//   let names = ['test1', 'test2', 'test3'];
//   let keys = names.map(key => `${prefix}${key}`);
//   names.forEach(key => fs.writeFileSync(`${path}/${key}`, key));

//   let results = [];

//   s3.context(bucket, prefix).forEach((obj, key) => {
//     return new Promise((success, fail) => {
//       results.push(key + obj);
//       success();
//     });
//   }, true).then(() => {
//     let answers = keys.map((key, i) => key + names[i]);
//     let success = answers[0] == results[0] && answers[1] == results[1] && answers[2] == results[2];
//     t.ok(success, 'forEach async over 3 objects')
//   });
// });

// test('s3renity.context.map (sync)', t => {

//   reset();
//   t.plan(1);

//   let names = ['test1', 'test2', 'test3'];
//   let keys = names.map(key => `${prefix}${key}`);
//   names.forEach(key => fs.writeFileSync(`${path}/${key}`, key));

//   s3.context(bucket, prefix).map((obj, key) => {
//     return key + obj;
//   }).then(() => {
//     let answers = keys.map((key, i) => key + names[i]);
//     let results = [];
//     names.forEach(name => {
//       results.push(fs.readFileSync(`${path}/${name}`).toString());
//     });
//     let success = answers[0] == results[0] && answers[1] == results[1] && answers[2] == results[2];
//     t.ok(success, 'map sync over 3 objects')
//   }).catch(console.error);
// });

// test('s3renity.context.map (async)', t => {

//   reset();
//   t.plan(1);

//   let names = ['test1', 'test2', 'test3'];
//   let keys = names.map(key => `${prefix}${key}`);
//   names.forEach(key => fs.writeFileSync(`${path}${key}`, key));

//   s3.context(bucket, prefix).map((obj, key) => {
//     return new Promise((success, fail) => {
//       success(key + obj);
//     });
//   }, true).then(() => {
//     let answers = keys.map((key, i) => key + names[i]);
//     let results = [];
//     names.forEach(name => {
//       results.push(fs.readFileSync(`${path}/${name}`).toString());
//     });
//     let success = answers[0] == results[0] && answers[1] == results[1] && answers[2] == results[2];
//     t.ok(success, 'map async over 3 objects')
//   }).catch(console.error);
// });

// test('s3renity.context.output.map (sync)', t => {

//   reset();
//   t.plan(1);

//   let names = ['test1', 'test2', 'test3'];
//   let keys = names.map(key => `${prefix}${key}`);
//   names.forEach(key => fs.writeFileSync(`${path}${key}`, key));

//   s3.context(bucket, prefix)
//     .output(bucket, outputPrefix)
//     .map((obj, key) => {
//       return key + obj;
//     }).then(() => {
//       let answers = keys.map((key, i) => key + names[i]);
//       let results = [];
//       keys.forEach(key => {
//         results.push(fs.readFileSync(`${outputPath}${key}`).toString());
//       });
//       let success = answers[0] == results[0] && answers[1] == results[1] && answers[2] == results[2];
//       t.ok(success, 'map sync over 3 objects')
//     }).catch(console.error);
// });

// test('s3renity.context.output.map (async)', t => {

//   reset();
//   t.plan(1);

//   let names = ['test1', 'test2', 'test3'];
//   let keys = names.map(key => `${prefix}${key}`);
//   names.forEach(key => fs.writeFileSync(`${path}${key}`, key));

//   s3.context(bucket, prefix)
//     .output(bucket, outputPrefix)
//     .map((obj, key) => {
//       return new Promise((success, fail) => {
//         success(key + obj);
//       });
//     }, true).then(() => {
//       let answers = keys.map((key, i) => key + names[i]);
//       let results = [];
//       keys.forEach(key => {
//         results.push(fs.readFileSync(`${outputPath}${key}`).toString());
//       });
//       let success = answers[0] == results[0] && answers[1] == results[1] && answers[2] == results[2];
//       t.ok(success, 'map async over 3 objects')
//     }).catch(console.error);
// });

// test('s3renity.context.reduce (sync)', t => {

//   t.plan(1);
//   reset();

//   let names = ['test1', 'test2', 'test3'];
//   let keys = names.map(key => `${prefix}/${key}`);
//   names.forEach(key => fs.writeFileSync(`${path}/${key}`, key));
//   let answer = 'test1test2test3';

//   s3.context(bucket, prefix)
//     .reduce((prev, cur, key) => {
//       if (!prev) {
//         return cur;
//       } else {
//         return prev + cur;
//       }
//     })
//     .then(result => {
//       t.ok(result == answer, 'reduce sync 3 objects');
//     }).catch(e => console.error(e.stack));
// });

// test('s3renity.context.reduce (async)', t => {

//   reset();
//   t.plan(1);

//   let names = ['test1', 'test2', 'test3'];
//   let keys = names.map(key => `${prefix}/${key}`);
//   names.forEach(key => fs.writeFileSync(`${path}/${key}`, key));
//   let answer = 'test1test2test3';

//   s3.context(bucket, prefix)
//     .reduce((prev, cur, key) => {
//       return new Promise((success, fail) => {
//         if (!prev) {
//           success(cur);
//         } else {
//           success(prev + cur);
//         }
//       });
//     }, null, true)
//     .then(result => {
//       t.ok(result == answer, 'reduce async 3 objects');
//     }).catch(e => console.error(e.stack));
// });

// test('s3renity.context.filter (sync)', t => {

//   reset();
//   t.plan(1);

//   let names = ['test1', 'test2', 'test3'];
//   let keys = names.map(key => `${prefix}${key}`);
//   names.forEach(key => fs.writeFileSync(`${path}${key}`, key));
//   let answer = 'test1';

//   let d = s3.context(bucket, prefix)
//     .filter(obj => {
//       return obj == 'test1';
//     })
//     .then(() => {
//       t.ok(fs.readdirSync(path)[0] == answer, 'filter 3 files to 1');
//     })
//     .catch(e => {
//       console.error(e || e.stack, 'URR');
//     });
// });

// test('s3renity.context.filter (async)', t => {

//   reset();
//   t.plan(1);

//   let names = ['test1', 'test2', 'test3'];
//   let keys = names.map(key => `${prefix}/${key}`);
//   names.forEach(key => fs.writeFileSync(`${path}/${key}`, key));
//   let answer = 'test1';

//   s3.context(bucket, prefix)
//     .filter(obj => {
//       return new Promise((success, fail) => {
//         success(obj == 'test1');
//       });
//     }, true)
//     .then(() => {
//       t.ok(fs.readdirSync(path) == answer, 'filter 3 files to 1');
//     })
//     .catch(e => console.error(e.stack));
// });

// test('s3renity.context.output.filter (sync)', t => {

//   reset();
//   t.plan(1);

//   let names = ['test1', 'test2', 'test3'];
//   let keys = names.map(key => `${prefix}/${key}`);
//   names.forEach(key => fs.writeFileSync(`${path}/${key}`, key));
//   let answer = 'test1';

//   s3.context(bucket, prefix)
//     .output(bucket, outputPrefix)
//     .filter(obj => {
//       return obj == 'test1';
//     })
//     .then(() => {
//       t.ok(fs.readdirSync(outputPath) == answer, 'filter 3 files to 1');
//     })
//     .catch(e => console.error(e.stack));
// });

// test('s3renity.context.output.filter (async)', t => {

//   reset();
//   t.plan(1);

//   let names = ['test1', 'test2', 'test3'];
//   let keys = names.map(key => `${prefix}/${key}`);
//   names.forEach(key => fs.writeFileSync(`${path}/${key}`, key));
//   let answer = 'test1';

//   s3.context(bucket, prefix)
//     .output(bucket, outputPrefix)
//     .filter(obj => {
//       return new Promise((success, fail) => {
//         success(obj == 'test1');
//       });
//     }, true)
//     .then(() => {
//       t.ok(fs.readdirSync(outputPath) == answer, 'filter 3 files to 1');
//     })
//     .catch(e => console.error(e.stack));
// });

// test('end', t => {
//   reset();
//   fs.removeSync(`${__dirname}/buckets`);
//   t.end();
// })
