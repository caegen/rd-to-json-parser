var RdParser = require('../lib/parser.js');
var fs = require('fs');
var assert = require('chai').assert;

var parseFile = function(fixtureName, assertions, mochaCallback, options) {
  var inputStream = fs.createReadStream('./test/fixtures/'+ fixtureName +'.Rd');
  var rdocParser = new RdParser(options);
  var finalStream = inputStream.pipe(rdocParser);
  var strJSON = '';
  finalStream.on('data', function(data) {
    strJSON += data;
  });

  finalStream.on('end', function(err) {
    assertions(JSON.parse(strJSON));
    mochaCallback();
  });
};

describe('Basic section', function() {
  var fixtureFile = "basic_section";

  it('should have correct sections', function (done) {
    parseFile(fixtureFile, function(data) {
      assert.strictEqual(data.title, 'Trimmed', 'title is not equal');
      assert.deepEqual(data.alias, ['BasicSection', 'bs'], 'aliases are not equal');
      assert.strictEqual(data.name, 'BasicSection', 'name is not equal');
      assert.deepEqual(data.keyword, [ '1', '2', '3' ], 'keyword are not equal');
      assert.strictEqual(data.examples, 'fn("quoted string\n with \\macro"){second}\n\twrd <- GetNewWrd(%){}\n\tWrdR("sapply(iris[,-5], mean)", wrd=wrd)fn("quoted string with <a href="pkg" rd-options="">pkg</a>")', 'examples are not equal');
      assert.deepEqual(data.author, [ { name: 'John Doe', email: 'john.doe@email.com' },
        { name: 'John Smith', email: 'john.smith@email.com' } ], 'author are not equal');
    }, done);
  });

  it('should replace no arg macro with appropriate text', function (done) {
    parseFile(fixtureFile, function(data) {
      assert.strictEqual(data.description, 'Just a no arg macro ...', 'no arg macro not correcly replaced');
    }, done);
  });

  it('should replace replaceable macro with appropriate text and support overridden options', function (done) {
    parseFile(fixtureFile, function(data) {
      assert.strictEqual(data.details, '<em>just</em> 2 <o>replaceable</o> {macros} <strong>strong</strong>', 'replaceable macro not correcly replaced');
    }, done, {replaceableMacro: {bold: 'o'}});
  });

  it('should have a custom section', function (done) {
    parseFile(fixtureFile, function(data) {
      assert.strictEqual(data['Custom Section'], 'Content $R^2$', 'custom section not correct');
    }, done);
  });

  it('should parse the method macro in usage', function (done) {
    parseFile(fixtureFile, function(data) {
      assert.strictEqual(data.usage, '## S3 method for class \'A3\':\nplot(x, ...)', 'method macro not parsed correcly');
    }, done);
  });

});

describe('Section with nested macros', function() {
  var rdocParser = new RdParser();
  var fixtureFile = "section_nested_macros";

  it('should have nested macro replaced by appropriate text ', function (done) {
    parseFile(fixtureFile, function(data) {
      assert.strictEqual(data.name, 'section_nested_macros', 'name is not equal');
      assert.strictEqual(data.note, 'This function is melted from the <code><a href="jarque.bera.test" rd-options="pkg">jarque.bera.test</a></code> (in <code>tseries</code> package) and the <code>rjb.test</code> from the package <code>lawstat</code>.', 'name is not equal');
    }, done);
  });

});

describe('Comments', function() {
  var rdocParser = new RdParser();
  var fixtureFile = "comments";

  it('top level comment should not appear in result', function (done) {
    parseFile(fixtureFile, function(data) {
      assert.strictEqual(data.name, 'comments', 'name is not equal');
      assert.strictEqual(data.comments1, undefined, 'top level comment is not ignored');
    }, done);
  });

  it('comments in sections should be ignored', function (done) {
    parseFile(fixtureFile, function(data) {
      assert.strictEqual(data.name, 'comments', 'name is not equal');
      assert.deepEqual(data.value,
        [ 'before',
          { name: 'arg1', description: 'desc1' },
          { name: 'arg2', description: 'desc2' } 
        ], 
        'value are not equal'
      );
    }, done);
  });

  it('should process R comments but ignore macro within them', function (done) {
    parseFile(fixtureFile, function(data) {
      assert.strictEqual(data.name, 'comments', 'name is not equal');
      assert.strictEqual(data.examples, '# RComment + \\code{x}\n\t<code>x</code>', 'examples are not equal');
    }, done);
  });


});

describe('Listing Macros', function() {
  var rdocParser = new RdParser();
  var fixtureFile = "listing_macros";

  it('arguments and value should contain an array', function (done) {
    parseFile(fixtureFile, function(data) {
      assert.strictEqual(data.name, 'listing_macros', 'name is not equal');
      assert.deepEqual(data.value, [ 'pretext',
          { name: '1', description: 'd1' },
          { name: '2', description: 'd2' },
          { name: '3', description: 'd3' },
          { name: '4', description: 'd4' } ], 
        'value are not equal');
      assert.deepEqual(data.arguments,  [ { name: '1', description: 'd1' },
          { name: '2', description: 'd2' },
          { name: '3', description: 'd3' },
          { name: '4', description: 'd4' } ],
        'arguments are not equal');
    }, done);
  });

});

describe('List-Like Macros', function() {
  var rdocParser = new RdParser();
  var fixtureFile = "list_like";

  it('should produce correct nested html lists', function (done) {
    parseFile(fixtureFile, function(data) {
     assert.strictEqual(data.description, '<ul><li>first item<ol><li>first nested item</li><li>second nested item</li></ol></li><li>second item</li><li>third item</li></ul>', 'list like html markup not correct');
    }, done);
  });

});

describe('Print out for debug', function() {
  var rdocParser = new RdParser();
  var fixtureFile = "debug";

  it('should print out content', function (done) {
    parseFile(fixtureFile, function(data) {
      console.log(data);
    }, done);
  });

});
