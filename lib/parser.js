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

  console.log(this.readMain(this._string, {}));

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

RdocParser.prototype.readMain = function(toParse, object) {

  var matches = toParse.match(/\\([A-Za-z]+)\{/);

  if (matches === null) {
    return object;
  } else {
    var sliced = toParse.slice(matches.index + matches[0].length);
    object[matches[1]] = this.readRLikeContent("", sliced);
    return this.readMain(sliced, object);
  }


};

RdocParser.prototype.readRLikeContent = function(parsed, toParse) {
  var matches = toParse.match(/(\}|\\([A-Za-z]+)\{)/);

  if (matches === null) {
    return parsed;
  } else {
    if (matches[1] === "}") {
      return parsed + toParse.slice(0, matches.index);
    } else {
      var index = matches.index + matches[0].length;
      var macroName = matches[2];
      console.log(toParse.slice(index));
      var content = this.readRLikeContent("", toParse.slice(index));

      var parsedMacro = '<' + macroName + '>' + content + '</' + macroName + '>';


      return this.readRLikeContent(parsed + parsedMacro, toParse.slice(content.length));
    }
  }

};

RdocParser.prototype.readRLikeMacro = function(macroName, toParse) {
  

};

RdocParser.prototype.readName = function(rdString) {
  return this.readerConstructor('name')(rdString);
};

RdocParser.prototype.readAlias = function(rdString) {
  return this.readerConstructor('alias')(rdString);
};

RdocParser.prototype.readTitle = function(rdString) {
  return this.readerConstructor('title')(rdString);
};

RdocParser.prototype.readUsage = function(rdString) {
  return this.readerConstructor('usage')(rdString);
};

RdocParser.prototype.readDescription = function(rdString) {
  return this.readerConstructor('description')(rdString);
};

RdocParser.prototype.readArguments = function(rdString) {
  //var arguments = 
};

RdocParser.prototype.readerConstructor = function(prop) {
  return function(rdString) {
    var matches = rdString.match(new RegExp('\\\\'+prop+'\\{\\s*([\\s\\S]+?)\\s*\\}\n'));
    if (matches === null) {
      throw "Cannot find " + prop;
    } else {
      return matches[1];
    }
  };
};


RdocParser.prototype.readPackage = function(rdString) {


};


module.exports = RdocParser;