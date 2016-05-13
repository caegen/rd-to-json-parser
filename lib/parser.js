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

RdocParser.prototype.readDocType = function(rdString) {
  var matches = rdString.match(/\\docType\{(.*)\}/);
  if (matches === null) {
    return 'function';
  } else {
    return matches[1];
  }
};

RdocParser.prototype.readFunction = function(rdString) {
  var functionJSON = { };

  functionJSON.name = this.readName(rdString);
  functionJSON.alias = this.readAlias(rdString);
  functionJSON.title = this.readTitle(rdString);
  functionJSON.usage = this.readUsage(rdString);
  functionJSON.description = this.readDescription(rdString);

  return functionJSON;
};

RdocParser.prototype.readMain = function(object) {
  var toParse = this._string.slice(this._cursor);
  var matches = toParse.match(/\\([A-Za-z]+)\{/);

  if (matches === null) {
    return object;
  } else {
    this._cursor += matches.index + matches[0].length;
    var content = this.readSectionContent("");
    var sectionName = matches[1];
    object[sectionName] = content;
    return this.readMain(object);
  }


};

RdocParser.prototype.readSectionContent = function(parsed) {
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
      var content = this.readSectionContent('');
      var parsedMacro = '<' + macroName + '>' + content + '</' + macroName + '>';

      return this.readSectionContent(parsed + toParse.slice(0, matches.index) + parsedMacro);
    }
  }

};

RdocParser.prototype.readRLikeMacro = function(macroName, toParse) {
  

};


module.exports = RdocParser;