'use strict'

const test = require('tape');
const s3renity = require(`${__dirname}/../src/S3renity.js`);

const s = new s3renity({
  verbose: true
});

const bucket = 'ls-playground';
const prefix = 's3renity-test';
const fileName = 'test';
const name = `${prefix}/${fileName}`;
const body = 'hello world';

test('put, list, get, delete', t => {

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
          });
        }).catch(console.error);
      }).catch(console.error);
    }).catch(console.error);
  }).catch(console.error);
});

test('put', t => {
  t.plan(3);
  [1, 2, 3].forEach(n => {
    s.put(bucket, `${name}${n}`, `${body} ${n}`).then(_ => {
      t.ok(true, 's3renity.put');
    }).catch(console.error);
  });
});

test('forEach, delete [target, target]', t => {

  t.plan(2);

  var str = '';
  const func = obj => {
    str += obj;
  }

  s.context(bucket, prefix).forEach(func).then(_ => {
    let answer = 'hello world 1hello world 2hello world 3';
    t.ok(str.trim() == answer, 's3renity.context.forEach');

    s.list(bucket, prefix).then(keys => {
      s.delete(bucket, keys).then(_ => {
        s.list(bucket, prefix).then(keys => {
          t.ok(keys.length == 0, 's3renity.delete([key, key2, key3])')
        }).catch(console.error);
      }).catch(console.error);
    });

  }).catch(console.error);
});
