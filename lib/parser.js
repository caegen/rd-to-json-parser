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
          return this.readItems([]);
        default:
          return this.readMacroArgument('');
      }
    }).apply(this);

    object[sectionName] = content;
    return this.readMain(object);
  }


};


RdocParser.prototype.readItem = function() {
  var toParse = this._string.slice(this._cursor);
  var matches = toParse.match(/(\s)*\\item\{/);


  if (matches === null) {
    return null;
  } else {
    if (matches.index !== 0) {
      throw "Content found before item macro";
    } else {
      var index = matches.index + matches[0].length;
      this._cursor += index;
      var itemName = this.readMacroArgument(''); //read the first argument
      var description;
      if (this._string.charAt(this._cursor) === '{') { //Check if there is a second argument
        this._cursor += 1;
        description = this.readMacroArgument(''); //read the second argument
        return { name: itemName, description: description};
      } else {
        return itemName;
      }
    }
  }

};


RdocParser.prototype.readItems = function() {
  var arr = [];
  while (item = this.readItem()) {
    arr.push(item);
  }
  return arr;
};


// Read a macro argument, replacing all inner macro by <macro>....</macro>
// Precondition: Assume that the cursor is placed just after the opening bracket '}'.
// Post: the cursor is placed after the matching closing brackets '}'
RdocParser.prototype.readMacroArgument = function(parsed) {
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
      var content = this.readMacroArgument('');
      var parsedMacro = '<' + macroName + '>' + content + '</' + macroName + '>';

      return this.readMacroArgument(parsed + toParse.slice(0, matches.index) + parsedMacro);
    }
  }

};

RdocParser.prototype.readRLikeMacro = function(macroName, toParse) {
  

};


module.exports = RdocParser;