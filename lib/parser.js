var Transform = require('stream').Transform;
var util = require('util');

var escapable = ['%', '\\', '{', '}'];
var noArgMacro = {
  'cr': '\r',
  'dots': '...',
  'ldots ': '...',
  'R': 'R',
  'tab': '\t'
};

var listHandlerFunctionBuilder = function(mark) {
  return function() {
    var str = '<'+mark+'>';
    var thisChar;
    var currentCursor;
    var first = true;
    while((currentCursor = this.searchNextMarkupOrEnd()) &&
      (thisChar = this._string.charAt(currentCursor)) !== '}') {
      if (thisChar !== '\\') {
        throw 'Unidentified token';
      } else {
        var precedingText = this._string.slice(this._cursor, currentCursor).trim();
        this._cursor = currentCursor + 1;
        var name = this.readMacroName();
        str += precedingText.trim();
        if (name === 'item') {
          if (first) first = false;
          else {
            str += '</li>'; //close the previous element
          }
          str += '<li>';
        } else {
          str += this.handleMacro(name);
        }
      }
    }
    str += this._string.slice(this._cursor, currentCursor).trim();
    if (!first) str += '</li>'; //close the last element

    this._cursor = currentCursor + 1;
    str += '</'+ mark +'>';
    return str;
  };
};

var specialMacro = {
  method: function() {
    var toParse = this._string.slice(this._cursor);
    console.log(toParse);
    var matches = toParse.match(/(.*)\}\{(.*)\}\((.*)\)/);

    if (matches === null) {
      throw "method macro ill formated";
    } else {
      var _generic = matches[1];
      var _class = matches[2];
      var _args = matches[3];
      console.log(matches[0].length);
      this._cursor += matches[0].length;
      return  "## S3 method for class '"+ _class +"':\n" +
        ""+ _generic +"("+ _args +")";
    }
  },
  itemize: listHandlerFunctionBuilder('ul'),
  enumerate: listHandlerFunctionBuilder('ol'),
  describe: function() {
    return this.readItems();
  },
  donttest: function() {
    return this.readVerbatimArgument();
  },
  dontrun: function() {
    return this.readVerbatimArgument();
  },
  dontshow: function() {
    return this.readVerbatimArgument();
  }
};

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
            object[macro] = this.readLatexLikeArgument();
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

RdocParser.prototype.handleMacro = function(macroName) {
  var handle;
  if (handle = noArgMacro[macroName]) { // no arg macro, just replace by correct text
    return handle;
  } else if (handle = specialMacro[macroName]) { //special macro, call special handle function
    return handle.apply(this);
  } else { // nothing special, enclose the macro like this <macro>...</macro>
    return '<' + macroName + '>' + this.readLatexLikeArgument() + '</' + macroName + '>';
  }
};

RdocParser.prototype.searchNextMarkupOrEnd = function() {
  var oldCursor = this._cursor;
  var cursor;
  if (typeof(until)==='undefined') until = Infinity;
  var str = '';
  var braceCount = 0;
  do {
    var toParse = this._string.slice(this._cursor);
    // console.log('c' + this._cursor + ' ' + this._string.charAt(this._cursor));
    // console.log('u' + until  + ' ' + this._string.charAt(until));
    switch (true) {
      case /^\}/.test(toParse):
        if (braceCount-- <= 0) { // found the end of a macro
          cursor = this._cursor;
          this._cursor = oldCursor;
          return cursor;
        } else {
          this.consumeChar();
        }
        break;
      case /^\{/.test(toParse):
          braceCount++;
          this.consumeChar();
        break;
      case /^\\/.test(toParse):
        var next = this._string.charAt(this._cursor + 1);
        if (escapable.indexOf(next) > -1) {
          this._cursor += 1;
          this.consumeChar();
        } else if (/[A-Za-z0-9]/.test(next)) {
          cursor = this._cursor;
          this._cursor = oldCursor;
          return cursor;
        }
        break;
      case /^\s*%/.test(toParse):
        this.readComment();
        break;
      default:
        this.consumeChar();
        break;
    }
   
  } while (true);
  
};

RdocParser.prototype.consumeChar = function () {
  return this._string.charAt(this._cursor++);
};

RdocParser.prototype.readRLikeArgument = function() {
  if (typeof(until)==='undefined') until = Infinity;
  var str = '';
  var braceCount = 0;
  do {
    var toParse = this._string.slice(this._cursor);
    // console.log('c' + this._cursor + ' ' + this._string.charAt(this._cursor));
    // console.log('u' + until  + ' ' + this._string.charAt(until));
    switch (true) {
      case /^\}/.test(toParse):
        if (braceCount-- <= 0) { // found the end of a macro
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
        } else if (/[A-Za-z0-9]/.test(next)) {
          this._cursor += 1;
          str += this.handleMacro(this.readMacroName());
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
};


// Read a macro argument as a string, replacing all inner macro by <macro>....</macro>
// Precondition: Assume that the cursor is placed just after the opening bracket '{'.
// Post: the cursor is placed after the matching closing brackets '}'
RdocParser.prototype.readLatexLikeArgument = function(until) {
  if (typeof(until)==='undefined') until = Infinity;
  var str = '';
  var braceCount = 0;
  do {
    var toParse = this._string.slice(this._cursor);
    // console.log('c' + this._cursor + ' ' + this._string.charAt(this._cursor));
    // console.log('u' + until  + ' ' + this._string.charAt(until));
    switch (true) {
      case /^\}/.test(toParse):
        if (braceCount-- <= 0) { // found the end of a macro
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
        } else if (/[A-Za-z0-9]/.test(next)) {
          this._cursor += 1;
          str += this.handleMacro(this.readMacroName());
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
      var itemName = this.readLatexLikeArgument(); //read the first argument
      var description;
      if (this._string.charAt(this._cursor) === '{') { //Check if there is a second argument
        this._cursor += 1;
        description = this.readLatexLikeArgument(); //read the second argument
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
    var text = this.readLatexLikeArgument(this._cursor + matches.index);
    if (text !== '') arr.push(text);

    while (item = this.readItem()) {
      arr.push(item);
    }
  } else {
    var text = this.readLatexLikeArgument();
    arr.push(text);
  }

  return arr;
};


module.exports = RdocParser;