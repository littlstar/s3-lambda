'use strict'

const test = require('tape');
const fs = require('fs-extra');
const s3renity = require(`${__dirname}/..`);

const s3 = new s3renity({
  local_path: `${__dirname}/buckets/`,
  verbose: false,
  show_progress: false
});

const bucket = 's3renity';
const prefix = 'files1/';
const prefix2 = 'files2/';
const path = `${__dirname}/buckets/s3renity/${prefix}`;
const path2 = `${__dirname}/buckets/s3renity/${prefix2}`;
const outputPrefix = 'output-test/';
const outputPath = `${__dirname}/buckets/s3renity/${outputPrefix}`;

test('s3renity.keys', t => {

  reset();
  t.plan(1);

  let keys = ['test1', 'test2', 'test3'];
  let answer = keys;
  keys.forEach(key => fs.writeFileSync(`${path}/${key}`));

  s3.s3.keys(bucket, prefix).then(keys => {
    let correct = (keys[0] == answer[0] && keys[1] == answer[1] && keys[2] == answer[2]);
    t.ok(correct, 'keys');
  }).catch(e => console.error(e.stack));
});

test('s3renity.put', t => {

  reset();
  t.plan(1);

  let body = 'hello world';
  let name = 'test'
  let key = `${prefix}/${name}`;
  let filePath = `${path}/${name}`;

  s3.s3.put(bucket, key, body).then(() => {
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

  s3.s3.get(bucket, key).then(obj => {
    t.ok(obj == answer, 'get object');
  });
});

test('s3renity.delete (single)', t => {

  reset();
  t.plan(1);

  let name = 'test';
  let key = `${prefix}/${name}`;

  fs.writeFileSync(`${path}/${name}`, 'hello world');

  s3.s3.delete(bucket, key).then(() => {
    t.ok(!fs.existsSync(`${path}/${name}`), 'delete single object');
  }).catch(console.error);
});

test('s3renity.delete (batch)', t => {

  reset();
  t.plan(1);

  let names = ['test1', 'test2', 'test3'];
  let keys = names.map(key => `${prefix}/${key}`);
  names.forEach(key => fs.writeFileSync(`${path}/${key}`));

  s3.s3.delete(bucket, keys).then(() => {
    let empty = names.filter(key => fs.existsSync(`${prefix}/${key}`)).length == 0;
    t.ok(empty, 'delete multiple objects');
  }).catch(console.error);
});

test('s3renity.context.forEach (sync)', t => {

  reset();
  t.plan(1);

  let names = ['test1', 'test2', 'test3'];
  let keys = names.map(key => `${prefix}${key}`);
  names.forEach(key => fs.writeFileSync(`${path}/${key}`, key));

  let results = [];

  s3.context(bucket, prefix).forEach((obj, key) => {
    results.push(key + obj);
  }).then(() => {
    let answers = keys.map((key, i) => key + names[i]);
    let success = answers[0] == results[0] && answers[1] == results[1] && answers[2] == results[2];
    t.ok(success, 'forEach sync over 3 objects')
  }).catch(e => console.error(e.stack));
});

test('s3renity.context.forEach (async)', t => {

  reset();
  t.plan(1);

  let names = ['test1', 'test2', 'test3'];
  let keys = names.map(key => `${prefix}${key}`);
  names.forEach(key => fs.writeFileSync(`${path}/${key}`, key));

  let results = [];

  s3.context(bucket, prefix).forEach((obj, key) => {
    return new Promise((success, fail) => {
      results.push(key + obj);
      success();
    });
  }, true).then(() => {
    let answers = keys.map((key, i) => key + names[i]);
    let success = answers[0] == results[0] && answers[1] == results[1] && answers[2] == results[2];
    t.ok(success, 'forEach async over 3 objects')
  });
});

test('s3renity.context.map (sync)', t => {

  reset();
  t.plan(1);

  let names = ['test1', 'test2', 'test3'];
  let keys = names.map(key => `${prefix}${key}`);
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

test('s3renity.context.map (async)', t => {

  reset();
  t.plan(1);

  let names = ['test1', 'test2', 'test3'];
  let keys = names.map(key => `${prefix}${key}`);
  names.forEach(key => fs.writeFileSync(`${path}${key}`, key));

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

test('s3renity.context.output.map (sync)', t => {

  reset();
  t.plan(1);

  let names = ['test1', 'test2', 'test3'];
  let keys = names.map(key => `${prefix}${key}`);
  names.forEach(key => fs.writeFileSync(`${path}${key}`, key));

  s3.context(bucket, prefix)
    .output(bucket, outputPrefix)
    .map((obj, key) => {
      return key + obj;
    }).then(() => {
      let answers = keys.map((key, i) => key + names[i]);
      let results = [];
      keys.forEach(key => {
        results.push(fs.readFileSync(`${outputPath}${key}`).toString());
      });
      let success = answers[0] == results[0] && answers[1] == results[1] && answers[2] == results[2];
      t.ok(success, 'map sync over 3 objects')
    }).catch(console.error);
});

test('s3renity.context.output.map (async)', t => {

  reset();
  t.plan(1);

  let names = ['test1', 'test2', 'test3'];
  let keys = names.map(key => `${prefix}${key}`);
  names.forEach(key => fs.writeFileSync(`${path}${key}`, key));

  s3.context(bucket, prefix)
    .output(bucket, outputPrefix)
    .map((obj, key) => {
      return new Promise((success, fail) => {
        success(key + obj);
      });
    }, true).then(() => {
      let answers = keys.map((key, i) => key + names[i]);
      let results = [];
      keys.forEach(key => {
        results.push(fs.readFileSync(`${outputPath}${key}`).toString());
      });
      let success = answers[0] == results[0] && answers[1] == results[1] && answers[2] == results[2];
      t.ok(success, 'map async over 3 objects')
    }).catch(console.error);
});

test('s3renity.context.reduce (sync)', t => {

  t.plan(1);
  reset();

  let names = ['test1', 'test2', 'test3'];
  let keys = names.map(key => `${prefix}/${key}`);
  names.forEach(key => fs.writeFileSync(`${path}/${key}`, key));
  let answer = 'test1test2test3';

  s3.context(bucket, prefix)
    .reduce((prev, cur, key) => {
      if (!prev) {
        return cur;
      } else {
        return prev + cur;
      }
    })
    .then(result => {
      t.ok(result == answer, 'reduce sync 3 objects');
    }).catch(e => console.error(e.stack));
});

test('s3renity.context.reduce (async)', t => {

  reset();
  t.plan(1);

  let names = ['test1', 'test2', 'test3'];
  let keys = names.map(key => `${prefix}/${key}`);
  names.forEach(key => fs.writeFileSync(`${path}/${key}`, key));
  let answer = 'test1test2test3';

  s3.context(bucket, prefix)
    .reduce((prev, cur, key) => {
      return new Promise((success, fail) => {
        if (!prev) {
          success(cur);
        } else {
          success(prev + cur);
        }
      });
    }, null, true)
    .then(result => {
      t.ok(result == answer, 'reduce async 3 objects');
    }).catch(e => console.error(e.stack));
});

test('s3renity.context.filter (sync)', t => {

  reset();
  t.plan(1);

  let names = ['test1', 'test2', 'test3'];
  let keys = names.map(key => `${prefix}${key}`);
  names.forEach(key => fs.writeFileSync(`${path}${key}`, key));
  let answer = 'test1';

  let d = s3.context(bucket, prefix)
  .filter(obj => {
    return obj == 'test1';
  })
  .then(() => {
    t.ok(fs.readdirSync(path)[0] == answer, 'filter 3 files to 1');
  })
  .catch(e => {
    console.error(e || e.stack, 'URR');
  });
});

test('s3renity.context.filter (async)', t => {

  reset();
  t.plan(1);

  let names = ['test1', 'test2', 'test3'];
  let keys = names.map(key => `${prefix}/${key}`);
  names.forEach(key => fs.writeFileSync(`${path}/${key}`, key));
  let answer = 'test1';

  s3.context(bucket, prefix)
  .filter(obj => {
    return new Promise((success, fail) => {
      success(obj == 'test1');
    });
  }, true)
  .then(() => {
    t.ok(fs.readdirSync(path) == answer, 'filter 3 files to 1');
  })
  .catch(e => console.error(e.stack));
});

test('s3renity.context.output.filter (sync)', t => {

  reset();
  t.plan(1);

  let names = ['test1', 'test2', 'test3'];
  let keys = names.map(key => `${prefix}/${key}`);
  names.forEach(key => fs.writeFileSync(`${path}/${key}`, key));
  let answer = 'test1';

  s3.context(bucket, prefix)
  .output(bucket, outputPrefix)
  .filter(obj => {
    return obj == 'test1';
  })
  .then(() => {
    t.ok(fs.readdirSync(outputPath) == answer, 'filter 3 files to 1');
  })
  .catch(e => console.error(e.stack));
});

test('s3renity.context.output.filter (async)', t => {

  reset();
  t.plan(1);

  let names = ['test1', 'test2', 'test3'];
  let keys = names.map(key => `${prefix}/${key}`);
  names.forEach(key => fs.writeFileSync(`${path}/${key}`, key));
  let answer = 'test1';

  s3.context(bucket, prefix)
  .output(bucket, outputPrefix)
  .filter(obj => {
    return new Promise((success, fail) => {
      success(obj == 'test1');
    });
  }, true)
  .then(() => {
    t.ok(fs.readdirSync(outputPath) == answer, 'filter 3 files to 1');
  })
  .catch(e => console.error(e.stack));
});

test('end', t => {
  reset();
  fs.removeSync(`${__dirname}/buckets`);
  t.end();
})

function reset() {
  fs.removeSync(path);
  fs.removeSync(path2);
  fs.removeSync(outputPath);
  fs.mkdirsSync(path);
  fs.mkdirsSync(path2);
}
