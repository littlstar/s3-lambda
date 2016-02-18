'use strict'

const test = require('tape');
const fs = require('fs-extra');
const s3renity = require(`${__dirname}/../src/S3renity.js`);

const s3 = new s3renity({
  local_path: `${__dirname}/buckets/`
  // verbose: true
});

const bucket = 's3renity';
const prefix = 'files';
const path = `${__dirname}/buckets/s3renity/${prefix}`;
const outputPrefix = 'output-test';


test('s3renity.list', t => {

  reset();
  t.plan(1);

  let keys = ['test1', 'test2', 'test3'];
  let answer = keys.map(key => `${prefix}/${key}`);
  keys.forEach(key => fs.writeFileSync(`${path}/${key}`));

  s3.list(bucket, prefix).then(keys => {
    let correct = (keys[0] == answer[0] && keys[1] == answer[1] && keys[2] == answer[2]);
    t.ok(correct, 'list objects');
  });

});

test('s3renity.put', t => {

  reset();
  t.plan(1);

  let body = 'hello world';
  let name = 'test'
  let key = `${prefix}/${name}`;
  let filePath = `${path}/${name}`;

  s3.put(bucket, key, body).then(() => {
    let output = fs.readFileSync(filePath);
    t.ok(output == 'hello world', 'put object');
  })
  .catch(console.error);
});

test('s3renity.get', t => {

  reset();
  t.plan(1);

  let name = 'test';
  let answer = 'hello world';

  fs.writeFileSync(`${path}/${name}`, answer);
  let key = `${prefix}/${name}`;

  s3.get(bucket, key).then(obj => {
    t.ok(obj == answer, 'get object');
  });
});

test('s3renity.delete (single)', t => {

  reset();
  t.plan(1);

  let name = 'test';
  let key = `${prefix}/${name}`;

  fs.writeFileSync(`${path}/${name}`, 'hello world');

  s3.delete(bucket, key).then(() => {
    t.ok(!fs.existsSync(`${path}/${name}`), 'delete single object');
  }).catch(console.error);
});

test('s3renity.delete (batch)', t => {

  reset();
  t.plan(1);

  let names = ['test1', 'test2', 'test3'];
  let keys = names.map(key => `${prefix}/${key}`);
  names.forEach(key => fs.writeFileSync(`${path}/${key}`));

  s3.delete(bucket, keys).then(() => {
    let empty = names.filter(key => fs.existsSync(`${prefix}/${key}`)).length == 0;
    t.ok(empty, 'delete multiple objects');
  }).catch(console.error);
});

test('s3renity.context.forEach (sync)', t => {

  reset();
  t.plan(1);

  let names = ['test1', 'test2', 'test3'];
  let keys = names.map(key => `${prefix}/${key}`);
  names.forEach(key => fs.writeFileSync(`${path}/${key}`, key));

  let results = [];

  s3.context(bucket, prefix).forEach((obj, key) => {
    results.push(key + obj);
  }).then(() => {
    let answers = keys.map((key, i) => key + names[i]);
    let success = answers[0] == results[0] && answers[1] == results[1] && answers[2] == results[2];
    t.ok(success, 'forEach sync over 3 objects')
  });
});

test('s3renity.context.forEach (async)', t => {

  reset();
  t.plan(1);

  let names = ['test1', 'test2', 'test3'];
  let keys = names.map(key => `${prefix}/${key}`);
  names.forEach(key => fs.writeFileSync(`${path}/${key}`, key));

  let results = [];

  s3.context(bucket, prefix).forEach((obj, key) => {
    return new Promise((success, fail) => {
      results.push(key + obj);
      success();
    })
  }, true).then(() => {
    let answers = keys.map((key, i) => key + names[i]);
    let success = answers[0] == results[0] && answers[1] == results[1] && answers[2] == results[2];
    t.ok(success, 'forEach sync over 3 objects')
  });
});

test('s3renity.context.map (sync) (no output)', t => {

  reset();
  t.plan(1);

  let names = ['test1', 'test2', 'test3'];
  let keys = names.map(key => `${prefix}/${key}`);
  names.forEach(key => fs.writeFileSync(`${path}/${key}`, key));

  s3.context(bucket, prefix).map((obj, key) => {
    return key + obj;
  }).then(() => {
    let answers = keys.map((key, i) => key + names[i]);
    let results = [];
    names.forEach(name => {
      results.push(fs.readFileSync(`${path}/${name}`).toString());
    });
    let success = answers[0] == results[0] && answers[1] == results[1] && answers[2] == results[2];
    t.ok(success, 'map sync over 3 objects')
  }).catch(console.error);
});

test('s3renity.context.map (async) (no output)', t => {

  reset();
  t.plan(1);

  let names = ['test1', 'test2', 'test3'];
  let keys = names.map(key => `${prefix}/${key}`);
  names.forEach(key => fs.writeFileSync(`${path}/${key}`, key));

  s3.context(bucket, prefix).map((obj, key) => {
    return new Promise((success, fail) => {
      success(key + obj);
    });
  }, true).then(() => {
    let answers = keys.map((key, i) => key + names[i]);
    let results = [];
    names.forEach(name => {
      results.push(fs.readFileSync(`${path}/${name}`).toString());
    });
    let success = answers[0] == results[0] && answers[1] == results[1] && answers[2] == results[2];
    t.ok(success, 'map async over 3 objects')
  }).catch(console.error);
});

function reset() {
  fs.removeSync(path);
  fs.mkdirsSync(path);
}

// // 2
// test('context.forEach sync & async', t => {

//   t.plan(2);

//   var str = '';
//   const func = obj => {
//     str += obj;
//   }
//   var str2 = '';
//   const funcAsync = obj => {
//     return new Promise((success, fail) => {
//       str2 += obj;
//       success();
//     });
//   };

//   let name = 's3renity-test/test';
//   let body = 'hello world';

//   var p = [];
//   [1, 2, 3].forEach(n => {
//     p.push(s.put(bucket, `${name}${n}`, `${body} ${n}`));
//   });

//   let answer = 'hello world 1hello world 2hello world 3';

//   Promise.all(p).then(_ => {

//     s.context(bucket, prefix).forEach(func).then(_ => {
//       t.ok(str == answer, 's3renity.context.forEach sync');
//     }).catch(console.error);

//     s.context(bucket, prefix).forEach(funcAsync).then(_ => {
//       t.ok(str2 == answer, 's3renity.context.forEach async');
//     });
//   });

// });

// test('map sync', t => {

//   t.plan(3);

//   let answer = 's3renity-test/test';
//   let index = 1;

//   s.context(bucket, prefix).map((line, key) => {
//     return key;
//   }).then(_ => {
//     s.list(bucket, prefix).then(keys => {
//       keys.forEach(key => {
//         s.get(bucket, key).then(result => {
//           t.ok(result == key, 's3renity.map sync');
//         }).catch(e => console.error(e.stack));
//       })
//     }).catch(e => console.error(e.stack));
//   }).catch(e => console.error(e.stack));
// });

// test('map async', t => {

//   t.plan(3);

//   s.context(bucket, prefix).map((line, key) => {
//     return new Promise((success, fail) => {
//       success(key);
//     });
//   }, true).then(_ => {
//     s.list(bucket, prefix).then(keys => {
//       keys.forEach(key => {
//         s.get(bucket, key).then(result => {
//           t.ok(result == key, 's3renity.map async');
//         }).catch(e => console.error(e.stack));
//       })
//     }).catch(e => console.error(e.stack));
//   }).catch(e => console.error(e.stack));
// })

// test('map with output', t => {

//   t.plan(4);

//   let count = 0;
//   s.context(bucket, prefix)
//     .output(bucket, outputPrefix)
//     .map((line, key) => {
//       return new Promise((success, fail) => {
//         success(key);
//       });
//     }, true).then(_ => {

//       s.list(bucket, prefix).then(keys => {
//         keys.forEach(key => {
//           s.get(bucket, key).then(result => {
//             t.ok(result == key, 's3renity.map with output ' + count);
//             count++;
//             if (count == 3) {
//               s.list(bucket, outputPrefix).then(keys => {
//                 s.delete(bucket, keys).then(() => {
//                   t.ok(true, 's3renity.delete');
//                 }).catch(console.error);
//               })
//             }
//           }).catch(e => console.error(e.stack));
//         });
//       }).catch(e => console.error(e.stack));
//     }).catch(e => console.error(e.stack));
// });

// test('reduce sync', t => {

//   t.plan(1);

//   s.context(bucket, prefix).reduce((prev, cur, key) => {
//     if (prev == null) {
//       return key;
//     } else {
//       return prev + key;
//     }
//   }).then((result) => {
//     let answer = 's3renity-test/test1s3renity-test/test2s3renity-test/test3';
//     t.ok(result == answer, 'reduce sync');
//   }).catch(e => console.error(e.stack));
// });

// test('reduce async', t => {

//   t.plan(1);

//   s.context(bucket, prefix).reduce((prev, cur, key) => {
//     return new Promise((success, fail) => {
//       if (prev == null) {
//         success(key);
//       } else {
//         success(prev + key);
//       }
//     });
//   }, null, true).then(result => {
//     console.error(result);
//     let answer = 's3renity-test/test1s3renity-test/test2s3renity-test/test3';
//     t.ok(result == answer, 'reduce async');
//   }).catch(e => console.error(e.stack));
// });

// test('filter sync', t => {

//   t.plan(1);

//   s.context(bucket, prefix).filter(obj => {
//     if (obj == 's3renity-test/test1') {
//       return false;
//     } else {
//       return true;
//     }
//   }).then(() => {

//     s.list(bucket, prefix).then(keys => {
//       let answer = ['s3renity-test/test2', 's3renity-test/test3'];
//       t.ok(keys[0] == answer[0] && keys[1] == answer[1] && keys.length == answer.length, 'filter');
//     }).catch(e => console.error(e.stack));
//   }).catch(e => console.error(e.stack));
// });

// test('filter async', t => {

//   t.plan(1);

//   s.context(bucket, prefix).filter(obj => {
//     return new Promise((success, fail) => {
//       if (obj == 's3renity-test/test2') {
//         success(false);
//       } else {
//         success(true);
//       }
//     });
//   }, true).then(() => {
//     s.list(bucket, prefix).then(keys => {
//       var answer = ['s3renity-test/test3'];
//       t.ok(keys[0] == answer[0] && keys.length == answer.length, 'filter');
//     }).catch(e => console.error(e.stack));
//   }).catch(e => console.error(e.stack));
// });

// test('filter with output', t => {

//   t.plan(1);

//   s.context(bucket, prefix)
//     .output(bucket, outputPrefix)
//     .filter((obj, key) => {
//       console.error('OBJ', obj);
//       if (obj == 's3renity-test/test3') {
//         return false;
//       } else {
//         return true;
//       }
//     }).then(() => {
//       s.list(bucket, outputPrefix).then(keys => {
//         t.ok(keys.length == 0, 'filter with output');
//       }).catch(e => console.error(e.stack));
//     }).catch(e => console.error(e.stack));
// });

// test('join', t => {
//   t.plan(1);
//   s.context(bucket, prefix)
//   .join('\n')
//   .then(result => {
//     var answer = 's3renity-test/test3';
//     t.ok(result == answer, 'join');
//   }).catch(e => console.error(e.stack));
// });
