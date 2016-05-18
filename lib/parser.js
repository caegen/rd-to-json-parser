var Transform = require('stream').Transform;
var util = require('util');

var escapable = ['%', '\\', '{', '}'];


function RdocParser(options) {
    options = options || {};
    options.readableObjectMode = true;
    Transform.call(this, options);
}

util.inherits(RdocParser, Transform);


RdocParser.prototype._transform = function(chunk, enc, done) {
  this._buffer = chunk;
  this._string = this._buffer.toString();
  this._cursor = 0;

  var arrString = this._string.split('');

  console.log(this.readMain({}));

  done();
};


RdocParser.prototype.readMain = function(object) {

  do {
    var toParse = this._string.slice(this._cursor);
    switch (true) {
      case /^\s*%/.test(toParse):
        this.readComment();
        break;
      case /^\\/.test(toParse):
        var next = this._string.charAt(this._cursor + 1);
        if (escapable.indexOf(next) > -1) {
          this._cursor += 1;
          this.consumeChar();
        } else if (/[A-Za-z0-9]/.test(next)) {
          this._cursor += 1;
          var macro = this.readMacroName();
          if (macro === 'arguments' || macro === 'value') {
            object[macro] = this.readItems();
          } else {
            object[macro] = this.readMacroArgument();
          }
        }
        break;
      default:
        this.consumeChar();
        break;
    }
  } while (this._cursor <= this._string.length);

  return object;
};


RdocParser.prototype.readItem = function() {
  var toParse = this._string.slice(this._cursor);
  var matches = toParse.match(/(\s)*\\item\{|\}/);

  if (matches === null || matches[0] === '}') {
    return null;
  } else {
    if (matches.index !== 0) {
      throw "Content found before item macro";
    } else {
      var index = matches.index + matches[0].length;
      this._cursor += index;
      var itemName = this.readMacroArgument(); //read the first argument
      var description;
      if (this._string.charAt(this._cursor) === '{') { //Check if there is a second argument
        this._cursor += 1;
        description = this.readMacroArgument(); //read the second argument
        return { name: itemName, description: description};
      } else {
        return itemName;
      }
    }
  }

};


RdocParser.prototype.readItems = function() {
  var arr = [];
  var toParse = this._string.slice(this._cursor);
  var matches = toParse.match(/\\item/);

  if (matches !== null) {
    var text = this.readMacroArgument(this._cursor + matches.index);
    if (text !== '') arr.push(text);

    while (item = this.readItem()) {
      arr.push(item);
    }
  } else {
    var text = this.readMacroArgument();
    arr.push(text);
  }

  return arr;
};


RdocParser.prototype.consumeChar = function () {
  return this._string.charAt(this._cursor++);
};

RdocParser.prototype.readVerbatimArgument = function(until) {
  if (typeof(until)==='undefined') until = Infinity;
  var str = '';
  var braceCount = 0;
  do {
    var toParse = this._string.slice(this._cursor);
    // console.log('c' + this._cursor + ' ' + this._string.charAt(this._cursor));
    // console.log('u' + until  + ' ' + this._string.charAt(until));
    switch (true) {
      case /^\}/.test(toParse):
        if (braceCount-- <= 0) { // found the end of the verbatim macro
          this._cursor += 1;
            return str.trim();
        } else {
          str += this.consumeChar();
        }
        break;
      case /^\{/.test(toParse):
          braceCount++;
          str += this.consumeChar();
        break;
      case /^\\/.test(toParse):
        var next = this._string.charAt(this._cursor + 1);
        if (escapable.indexOf(next) > -1) {
          this._cursor += 1;
          str += this.consumeChar();
        }
        break;
      case /^\s*%/.test(toParse):
        this.readComment();
        break;
      default:
        str += this.consumeChar();
        break;
    }
   
  } while (this._cursor < until);
  return str.trim();
}


// Read a comment
// Precondition: Assume that the cursor is placed just after the opening % character
// Post: the cursor is placed on the first character after the closing newline character
// @return the whole comment
RdocParser.prototype.readComment = function() {
  var toParse = this._string.slice(this._cursor);
  var matches = toParse.match(/\n/);

  if (matches === null) { //means this is the end of file, return what's left
    this._cursor += toParse.length;
    return toParse;
  } else {
    var index = matches.index;
    var comment = toParse.slice(0, index);
    this._cursor += index + 1;
    return comment;
  }

};


// Read a macro name
// Precondition: Assume that the cursor is placed just after the backslash opening the macro '\'
// Post: the cursor is placed after the opening bracket that follow the macro name or just after the name if there is no argument
// @return the macro name
RdocParser.prototype.readMacroName = function() {
  var toParse = this._string.slice(this._cursor);
  var matches = toParse.match(/^([A-Za-z0-9]+)\s*\{?/);

  if (matches === null) {
    throw "Macro name not found";
  } else {
    var macroName = matches[1];
    var index = matches[0].length;
    this._cursor += index;
    return macroName;
  }

};

// Read a macro argument as a string, replacing all inner macro by <macro>....</macro>
// Precondition: Assume that the cursor is placed just after the opening bracket '{'.
// Post: the cursor is placed after the matching closing brackets '}'
RdocParser.prototype.readMacroArgument = function(until) {
  if (typeof(until)==='undefined') until = Infinity;
  var str = '';
  var braceCount = 0;
  var lastMacro = [];
  do {
    var toParse = this._string.slice(this._cursor);
    // console.log('c' + this._cursor + ' ' + this._string.charAt(this._cursor));
    // console.log('u' + until  + ' ' + this._string.charAt(until));
    switch (true) {
      case /^\}/.test(toParse):
        if (braceCount-- <= 0) { // found the end of a macro
          this._cursor += 1;
          var last;
          if (last = lastMacro.pop()) { //end of inner macro
            str += '</' + last + '>';
          } else { //end of this macro
            return str.trim();
          }
        } else {
          str += this.consumeChar();
        }
        break;
      case /^\{/.test(toParse):
          braceCount++;
          str += this.consumeChar();
        break;
      case /^\\/.test(toParse):
        var next = this._string.charAt(this._cursor + 1);
        if (escapable.indexOf(next) > -1) {
          this._cursor += 1;
          str += this.consumeChar();
        } else if (/[A-Za-z0-9]/.test(next)) {
          this._cursor += 1;
          var macroName = this.readMacroName();
          str += '<' + macroName + '>';
          lastMacro.push(macroName);
        }
        break;
      case /^\s*%/.test(toParse):
        this.readComment();
        break;
      default:
        str += this.consumeChar();
        break;
    }
   
  } while (this._cursor < until);
  
  return str.trim();
};


module.exports = RdocParser;