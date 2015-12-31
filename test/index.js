'use strict'

const test = require('tape');
const s3renity = require(`${__dirname}/../`);

const key = 's3://ls-playground/s3renity-test';

const s3 = new s3renity({
  verbose: true
});

test('s3renity.write and s3renity.get', t => {

  t.plan(2);

  let i = 'test';
  let body = `hello world ${i}`;
  let name = `${key}/${i}`;

  s3.write(name, body).then(_ => {
    t.ok(true, 's3renity.write');
    s3.get(name).then(object => {
      t.ok(object == 'hello world test', 's3renity.get');
    });
  });
});
