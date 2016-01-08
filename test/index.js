'use strict'

const test = require('tape');
const s3renity = require(`${__dirname}/../src/S3renity.js`);

const s = new s3renity({
  local_path: `${__dirname}/tmp/`
});

const bucket = 'ls-playground';
const prefix = 's3renity-test';
const outputPrefix = 's3renity-test2';
const fileName = 'test';
const name = `${prefix}/${fileName}`;
const body = 'hello world';

test('clean up', t => {
  t.plan(2);
  s.list(bucket, prefix + '/').then(keys => {
    if (keys.length == 0) {
      t.ok(true, '(nothing to do)');
    } else {
      s.delete(bucket, keys).then(() => {
        t.ok(true, 's3renity.delete');
      }).catch(console.error);
    }
  }).catch(e => {
    console.log(e);
  });
  s.list(bucket, outputPrefix + '/').then(keys => {
    if (keys.length == 0) {
      t.ok(true, '(nothing to do)');
    } else {
      s.delete(bucket, keys).then(() => {
        t.ok(true, 's3renity.delete');
      }).catch(console.error);
    }
  }).catch(e => {
    console.log(e);
  });
});

// 1
test('s3renity.put, s3renity.list, s3renity.get, s3renity.delete', t => {

  t.plan(4);

  s.put(bucket, name, body).then(_ => {
    t.ok(true, 's3renity.put');
    s.list(bucket, prefix).then(keys => {
      console.log(keys[0], name);
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

// 2
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

test('map sync', t => {

  t.plan(3);

  s.context(bucket, prefix).map((line, i) => {
    return line + i;
  }).then(_ => {
    s.list(bucket, prefix).then(keys => {
      keys.forEach(key => {
        s.get(bucket, key).then(result => {
          var num = key.slice(-1);
          t.ok(result.trim() == 'hello world ' + String(num) + '' + String(num - 1), 's3renity.map sync');
        }).catch(e => console.log(e.stack));
      })
    }).catch(e => console.log(e.stack));
  }).catch(e => console.log(e.stack));
});

test('map async', t => {
  t.plan(3);
  s.context(bucket, prefix).map((line, i) => {
    return new Promise((success, fail) => {
      success(line + i);
    });
  }, true).then(_ => {
    s.list(bucket, prefix).then(keys => {
      keys.forEach(key => {
        s.get(bucket, key).then(result => {
          var num = key.slice(-1);
          t.ok(result.trim() == 'hello world ' + String(num) + String(num - 1) + String(num - 1), 's3renity.map async');
        }).catch(e => console.log(e.stack));
      })
    }).catch(e => console.log(e.stack));
  }).catch(e => console.log(e.stack));
})

test('map with output', t => {
  t.plan(4);
  var count = 0;
  s.context(bucket, prefix)
    .output(bucket, outputPrefix)
    .map((line, i) => {
      return new Promise((success, fail) => {
        success(line + i);
      });
    }, true).then(_ => {
      s.list(bucket, outputPrefix).then(keys => {
        keys.forEach(key => {
          s.get(bucket, key).then(result => {
            var num = key.slice(-1);
            t.ok(result.trim() == 'hello world ' + String(num) + String(num - 1) + String(num - 1) + String(num - 1), 's3renity.map with output ' + count);
            count++;
            if (count == 3) {
              s.list(bucket, outputPrefix).then(keys => {
                s.delete(bucket, keys).then(() => {
                  t.ok(true, 's3renity.delete');
                }).catch(console.error);
              })
            }
          }).catch(e => console.log(e.stack));
        });
      }).catch(e => console.log(e.stack));
    }).catch(e => console.log(e.stack));
});

test('reduce sync', t => {
  t.plan(1);
  s.context(bucket, prefix).reduce((prev, cur, key) => {
    if (prev == null) {
      return cur + key;
    } else {
      return prev + cur + key;
    }
  }).then((result) => {
    var answer = 'hello world 100s3renity-test/test1hello world 211s3renity-test/test2hello world 322s3renity-test/test3';
    t.ok(result == answer, 'reduce sync');
  }).catch(e => console.log(e.stack));
});

test('reduce async', t => {
  t.plan(1);
  s.context(bucket, prefix).reduce((prev, cur, key) => {
    return new Promise((success, fail) => {
      if (prev == null) {
        success(cur + key);
      } else {
        success(prev + cur + key);
      }
    });
  }, null, true).then(result => {
    var answer = 'hello world 100s3renity-test/test1hello world 211s3renity-test/test2hello world 322s3renity-test/test3';
    t.ok(result == answer, 'reduce sync');
  }).catch(e => console.log(e.stack));
});

test('filter sync', t => {
  t.plan(1);
  s.context(bucket, prefix).filter(obj => {
    if (obj == 'hello world 211') {
      return false;
    } else {
      return true;
    }
  }).then(() => {
    s.list(bucket, prefix).then(keys => {
      var answer = ['s3renity-test/test1', 's3renity-test/test3'];
      t.ok(keys[0] == answer[0] && keys[1] == answer[1] && keys.length == answer.length, 'filter');
    }).catch(e => console.log(e.stack));
  }).catch(e => console.log(e.stack));
});

test('filter async', t => {
  t.plan(1);
  s.context(bucket, prefix).filter(obj => {
    return new Promise((success, fail) => {
      if (obj == 'hello world 211') {
        success(false);
      } else {
        success(true);
      }
    });
  }, true).then(() => {
    s.list(bucket, prefix).then(keys => {
      var answer = ['s3renity-test/test1', 's3renity-test/test3'];
      t.ok(keys[0] == answer[0] && keys[1] == answer[1] && keys.length == answer.length, 'filter');
    }).catch(e => console.log(e.stack));
  }).catch(e => console.log(e.stack));
});

test('filter with output', t => {
  t.plan(1);
  s.context(bucket, prefix)
    .output(bucket, outputPrefix)
    .filter(obj => {
      if (obj == 'hello world 211') {
        return false;
      } else {
        return true;
      }
    }).then(() => {
      s.list(bucket, outputPrefix).then(keys => {
        var answer = ['s3renity-test2/test1', 's3renity-test2/test3'];
        t.ok(keys[0] == answer[0] && keys[1] == answer[1] && keys.length == answer.length, 'filter with output');
      }).catch(e => console.log(e.stack));
    }).catch(e => console.log(e.stack));
});

test('join', t => {
  t.plan(1);
  s.context(bucket, prefix)
  .join('\n')
  .then(result => {
    var answer = 'hello world 100\nhello world 322';
    t.ok(result == answer, 'join');
  }).catch(e => console.log(e.stack));
});
