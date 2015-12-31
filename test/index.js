'use strict'

const test = require('tape');
const s3renity = require('./');

const key = 's3://ls-playground/s3renity-test';

const s3 = new s3renity({
  verbose: true
});

test('s3renity write', t => {
  s3.write(key, 'hello world');
});
