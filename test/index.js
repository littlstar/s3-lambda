'use strict'

const test = require('tape');
const s3renity = require(`${__dirname}/../src/S3renity.js`);

const s = new s3renity({
  // local_path: `${__dirname}/tmp/`,
  // verbose: true
});

const bucket = 'ls-playground';
const prefix = 's3renity-test';
const fileName = 'test';
const name = `${prefix}/${fileName}`;
const body = 'hello world';

test('s3renity.put, s3renity.list, s3renity.get, s3renity.delete', t => {

  t.plan(4);

  s.put(bucket, name, body).then(_ => {
    t.ok(true, 's3renity.put');
    s.list(bucket, prefix).then(keys => {
      t.ok(keys[0] == name, 's3renity.list');
      s.get(bucket, name).then(object => {
        t.ok(object == 'hello world', 's3renity.get');
        s.delete(bucket, name).then(_ => {
          s.list(bucket, prefix).then(keys => {
            t.ok(keys.length == 0, 's3renity.delete');
          }).catch(console.error);
        }).catch(console.error);
      }).catch(console.error);
    }).catch(console.error);
  }).catch(console.error);
});

test('context.forEach sync & async', t => {

  t.plan(2);

  var str = '';
  const func = obj => {
    str += obj;
  }
  var str2 = '';
  const funcAsync = obj => {
    return new Promise((success, fail) => {
      str2 += obj;
      success();
    });
  };

  var p = [];
  [1, 2, 3].forEach(n => {
    p.push(s.put(bucket, `${name}${n}`, `${body} ${n}`));
  });

  let answer = 'hello world 1hello world 2hello world 3';

  Promise.all(p).then(_ => {

    s.context(bucket, prefix).forEach(func).then(_ => {
      t.ok(str == answer, 's3renity.context.forEach sync');
    }).catch(console.error);

    s.context(bucket, prefix).forEach(funcAsync).then(_ => {
      t.ok(str2 == answer, 's3renity.context.forEach async');
    });
  });

});

test('context.split.forEach sync & async', t => {

  t.plan(2);

  let sum = '';
  let answer = 'hello world 1hello world 2hello world 3';

  s.context(bucket, prefix).split('\n').forEach(line => {
    sum += line;
  }).then(_ => {
    t.ok(sum == answer, `s.context.split('\n').forEach(func, false) - synch`);
  }).catch(console.error);

  let sum2 = '';
  s.context(bucket, prefix).split('\n').forEach(line => {
    return new Promise((success, fail) => {
      sum2 += line;
      success();
    });
  }, true).then(_ => {
    t.ok(sum2 == answer, `s.context.split('\n').forEach(func, true) - async`);
  }).catch(console.error);
});

test('s3renity.delete(bucket, [target1, target2, target3])', t => {
  t.plan(1);
  s.list(bucket, prefix).then(keys => {
    s.delete(bucket, keys).then(_ => {
      s.list(bucket, prefix).then(keys => {
        t.ok(keys.length == 0, 's3renity.delete([key, key2, key3])')
      }).catch(console.error);
    }).catch(console.error);
  });
});
