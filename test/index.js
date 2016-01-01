'use strict'

const test = require('tape');
const s3renity = require(`${__dirname}/../src/`);
const key = 's3://ls-playground/s3renity-test';

const s3 = new s3renity({
  verbose: true
});

test('s3renity.write and s3renity.get', t => {

  t.plan(4);

  let body = `hello world`;
  let name = `${key}/test`;

  s3.write(name, body).then(_ => {

    t.ok(true, `s3renity.write`);

    s3.list('ls-playground', 's3renity-test').then(keys => {

      console.log(keys);

      t.ok(keys == ['s3renity-test/test'], 's3renity.list');

      s3.get(name).then(object => {

        t.ok(object == 'hello world test', 's3renity.get');

        s3.delete(name).then(_ => {
          t.ok(true, `s3renity.delete`);
        })
      });

    });

  });
});
