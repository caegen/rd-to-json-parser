var RdParser = require('../lib/parser.js');
var fs = require('fs');


describe('Parser', function() {
  it('should print out content', function (done) {
    var inputStream = fs.createReadStream('./test/fixtures/a3.Rd');
    var rdocParser = new RdParser();
    var finalStream = inputStream.pipe(rdocParser);

    finalStream.on('data', function(data) {
      console.log(data);
    });

    finalStream.on('end', function(err) {
      done();
    });
  });
});

