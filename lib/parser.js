var Transform = require('stream').Transform;


function RdocParser(options) {
    options = options || {};
    options.readableObjectMode = true;
    Transform.call(this, options);
}

require('util').inherits(RdocParser, Transform);


RdocParser.prototype._transform = function(chunk, enc, done) {
  this._buffer = chunk;
  this._string = this._buffer.toString();
  this._cursor = 0;

  // var docType = this.readDocType(this._string);

  // this.push(function() {
  //   switch(docType) {
  //     case 'function':
  //       return this.readFunction(this._string);
  //     case 'package':
  //       return this.readPackage(this._string);
  //     default:
  //       console.warn("Unsupported docType");
  //   }
  // }.apply(this));

  console.log(this.readMain({}));

  done();
};

RdocParser.prototype.readMain = function(object) {
  var toParse = this._string.slice(this._cursor);
  var matches = toParse.match(/\\([A-Za-z]+)\{/);

  if (matches === null) {
    return object;
  } else {
    this._cursor += matches.index + matches[0].length;
    var sectionName = matches[1];

    var content = (function() {
      switch (sectionName) {
        case 'arguments':
          return this.readArguments([]);
        default:
          return this.readMacroContent('');
      }
    }).apply(this);

    object[sectionName] = content;
    return this.readMain(object);
  }


};

RdocParser.prototype.readArguments = function(args) {
  var toParse = this._string.slice(this._cursor);
  var matches = toParse.match(/\}|\\item\{/);


  if (matches === null) {
    return parsed;
  } else {
    if (matches[0] === '}') {
      this._cursor += matches.index + 1;
      return args;
    } else {
      var index = matches.index + matches[0].length;
      this._cursor += index;
      var argName = this.readMacroContent('');
      var argDesc;
      if (this._string.charAt(this._cursor) === '{') {
        this._cursor += 1;
        argDesc = this.readMacroContent('');
      } else {
        throw "item macro in arguments section should have 2 arguments";
      }
      args.push({name: argName, desc: argDesc});
      return this.readArguments(args);
    }
  }

};

RdocParser.prototype.readMacroContent = function(parsed) {
  var toParse = this._string.slice(this._cursor);
  var matches = toParse.match(/(\}|\\([A-Za-z]+)\{)/);

  if (matches === null) {
    return parsed;
  } else {
    if (matches[1] === "}") {
      this._cursor += matches.index + 1;
      return parsed + toParse.slice(0, matches.index);
    } else {
      var index = matches.index + matches[0].length;
      var macroName = matches[2];
      this._cursor += index;
      var content = this.readMacroContent('');
      var parsedMacro = '<' + macroName + '>' + content + '</' + macroName + '>';

      return this.readMacroContent(parsed + toParse.slice(0, matches.index) + parsedMacro);
    }
  }

};

RdocParser.prototype.readRLikeMacro = function(macroName, toParse) {
  

};


module.exports = RdocParser;