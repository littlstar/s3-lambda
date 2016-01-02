'use strict'

const test = require('tape');
const s3renity = require(`${__dirname}/../src/`);

const s = new s3renity({
  verbose: true
});

test('s3renity.write and s3renity.get', t => {

  t.plan(4);

  let bucket = 'ls-playground';
  let prefix = 's3renity-test';
  let fileName = 'test';
  let name = `${prefix}/${fileName}`;
  let body = 'hello world';

  s.put(bucket, name, body).then(_ => {

    t.ok(true, 's3renity.put');

    s.list(bucket, prefix).then(keys => {

      t.ok(keys[0] == name, 's3renity.list');

      s.get(bucket, name).then(object => {

        t.ok(object == 'hello world', 's3renity.get');

        s.delete(bucket, name).then(_ => {
          s.list(bucket, prefix).then(keys => {
            t.ok(keys.length == 0, `s3renity.delete`);
          });
        })
      });

    });

  });
});
