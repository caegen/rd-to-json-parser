var Transform = require('stream').Transform;
var util = require('util');
var _ = require('lodash');

var escapable = ['%', '\\', '{', '}'];

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

var methodMacroHandler = function() {
  var toParse = this._string.slice(this._cursor);
  var matches = toParse.match(/(.*)\}\{(.*)\}\s*\(([\s\S]*?)\)/);

  if (matches === null) {
    throw "method macro ill formated";
  } else {
    var _generic = matches[1];
    var _class = matches[2];
    var _args = matches[3];
    this._cursor += matches[0].length;
    return  "## S3 method for class '"+ _class +"':\n" +
      ""+ _generic +"("+ _args +")";
  }
};

var noArgMacro = {
  'cr': '\r',
  'dots': '...',
  'ldots': '...',
  'R': 'R',
  'tab': '\t'
};

var replaceableMacro = {
  'emph': 'em',
  'bold': 'b'
};

var macroHandlers = {
  method: function() {
    return methodMacroHandler.apply(this);
  },
  S3method: function() {
    return methodMacroHandler.apply(this);
  },
  S4method: function() {
    return methodMacroHandler.apply(this);
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
  },
  preformatted: function() {
    return this.readVerbatimArgument();
  },
  eqn: function() {
    return this.readEqMacro('$');
  },
  deqn: function() {
    return this.readEqMacro('$$');
  },
  code: function() {
    return '<code>' + this.readRLikeArgument() + '</code>';
  },
  link: function() {
    var options = '';
    if (this.readChar() === '[') {
      options = this.readOption();
    } else {
      this._cursor -= 1;
    }
    var arg = this.readLatexLikeArgument();
    return '<a href="'+ arg +'" rd-options="'+ options +'">' + arg + '</a>';
  },
  author: function() {
    var authorText = this.readLatexLikeArgument();
    var authors = authorText.split(',');
    if (authors.length < 2) { // try splitting with 'and' if only 1 author found
      authors = authorText.split('and');
    }
    return authors.map(function(author) {
      var delimiters = [ 
        {begin: '<email>', end: '</email>'},
        {begin: '<', end: '>'},
        {begin: '(', end: ')'}
      ];
      var authorObject = {};
      for (var i in delimiters) {
        var delimiter = delimiters[i];
        var regex = new RegExp(delimiter.begin + '(.*)' + delimiter.end);
        var emailMatch = author.match(regex);
        if (emailMatch !== null) {
          authorObject.name = author.replace(regex, '').trim();
          authorObject.email = emailMatch[1].trim();
          break;
        }
      }
      if (authorObject.email) { //email found
        return authorObject;
      } else { //no email found
        return {name: author.trim()};
      }
    });
  }
};

function RdocParser(options) {
    options = options || {};
    options.readableObjectMode = true;
    this.macroHandlers = _.merge({}, macroHandlers, options.macroHandlers);
    this.replaceableMacro = _.merge({}, replaceableMacro, options.replaceableMacro);
    this.noArgMacro = _.merge({}, noArgMacro, options.noArgMacro);
    this._string = '';
    Transform.call(this, options);
}

util.inherits(RdocParser, Transform);


RdocParser.prototype._transform = function(chunk, enc, done) {
  this._string += chunk.toString();
  this._cursor = 0;
  done();
};


RdocParser.prototype._flush = function (cb) {
  try {
    var data = this.readMain({});
    this.push(JSON.stringify(data, null, 4));
    cb();
  } catch (err) {
    this.emit('error', err);
    cb(err);
  }
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
          this.readChar();
        } else if (/[A-Za-z0-9]/.test(next)) {
          this._cursor += 1;
          var macro = this.readMacroName();
          //console.log(macro);
          if (macro === 'arguments' || macro === 'value') {
            object[macro] = this.readItems();
          } else if (this.macroHandlers[macro]) {
            object[macro] = this.macroHandlers[macro].apply(this);
          } else if (macro === 'section') { //custom section, 2 args
            var sectionName = this.readLatexLikeArgument();
            this.skipWhitespaces();
            if (this._string.charAt(this._cursor) !== '{') {
              throw 'Expected second argument for custom section';
            } else {
              this.readChar();
              object[sectionName] = this.readLatexLikeArgument();
            }
          } else if (macro === 'examples') {
            object[macro] = this.readRLikeArgument();
          }
          else {
            if (object[macro]) { //if it already exists, make it an array and push to it
              var initial = object[macro];
              var newValue = this.readLatexLikeArgument();
              if (Array.isArray(initial)) object[macro].push(newValue);
              else {
                var arr = [initial];
                arr.push(newValue);
                object[macro] = arr;
              } 
            } else {
              object[macro] = this.readLatexLikeArgument();
            }
          }
        }
        break;
      default:
        this.readChar();
        break;
    }
  } while (this._cursor <= this._string.length);

  return object;
};

RdocParser.prototype.handleMacro = function(macroName) {
  var handle;
  if (handle = this.noArgMacro[macroName]) { // no arg macro, just replace by correct text
    return handle;
  } else if (handle = this.macroHandlers[macroName]) { //special macro, call special handle function
    return handle.apply(this);
  } else if (handle = this.replaceableMacro[macroName]) {
    return '<' + handle + '>' + this.readLatexLikeArgument() + '</' + handle + '>';
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
          this.readChar();
        }
        break;
      case /^\{/.test(toParse):
          braceCount++;
          this.readChar();
        break;
      case /^\\/.test(toParse):
        var next = this._string.charAt(this._cursor + 1);
        if (escapable.indexOf(next) > -1) {
          this._cursor += 1;
          this.readChar();
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
        this.readChar();
        break;
    }
   
  } while (true);
  
};

RdocParser.prototype.readChar = function () {
  return this._string.charAt(this._cursor++);
};

RdocParser.prototype.skipWhitespaces = function () {
  while(/^\s/.test(this._string.charAt(this._cursor))) {
    this._cursor++;
  }
};

RdocParser.prototype.readRLikeArgument = function(until) {
  if (typeof(until)==='undefined') until = this._string.length;
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
          str += this.readChar();
        }
        break;
      case /^\{/.test(toParse):
          braceCount++;
          str += this.readChar();
        break;
      case /^\\/.test(toParse):
        var next = this._string.charAt(this._cursor + 1);
        if (escapable.indexOf(next) > -1) {
          this._cursor += 1;
          str += this.readChar();
        } else if (/[A-Za-z0-9]/.test(next)) {
          this._cursor += 1;
          str += this.handleMacro(this.readMacroName());
        }
        break;
      case /^\s*%/.test(toParse):
        this.readComment();
        break;
      case /^\s*#/.test(toParse):
        str += this.readComment() + '\n';
        break;
      case /^("|`)/.test(toParse):
        var delimiter = this.readChar();
        str += delimiter;
        str += this.readQuotedString(delimiter);
        break;
      default:
        str += this.readChar();
        break;
    }
   
  } while (this._cursor < until);
  
  return str.trim();
};

RdocParser.prototype.readQuotedString = function(delimiter) {
  var until = this._string.length;
  var str = '';
  do {
    switch (this._string.charAt(this._cursor)) {
      case delimiter:
        str += this.readChar();
        return str.trim();
      case '\\':
        var next = this._string.charAt(this._cursor + 1);
        if (next === 'v' || next === 'l') {
          this._cursor += 1;
          str += this.handleMacro(this.readMacroName());
        } else if (next === 'n') {
          this._cursor += 1;
          this.readChar();
          str += '\n';
        } else { // escaping
          this._cursor += 1;
          str += this.readChar();
        }
        break;
      case '%':
        str += this.readComment();
        break;
      default:
        str += this.readChar();
        break;
    }
  } while (this._cursor < until);
  return str.trim();
};

RdocParser.prototype.readVerbatimArgument = function(until) {
  if (typeof(until)==='undefined') until = this._string.length;
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
          str += this.readChar();
        }
        break;
      case /^\{/.test(toParse):
          braceCount++;
          str += this.readChar();
        break;
      case /^\\/.test(toParse):
        var next = this._string.charAt(this._cursor + 1);
        if (escapable.indexOf(next) > -1) {
          this._cursor += 1;
        }
        str += this.readChar();
        break;
      case /^\s*%/.test(toParse):
        this.readComment();
        break;
      default:
        str += this.readChar();
        break;
    }
   
  } while (this._cursor < until);
  return str.trim();
};


// Read a macro argument as a string, replacing all inner macro by <macro>....</macro>
// Precondition: Assume that the cursor is placed just after the opening bracket '{'.
// Post: the cursor is placed after the matching closing brackets '}'
RdocParser.prototype.readLatexLikeArgument = function(until) {
  if (typeof(until)==='undefined') until = this._string.length;
  var str = '';
  var braceCount = 0;
  do {
    var toParse = this._string.slice(this._cursor);
     //console.log('c' + this._cursor + ' ' + this._string.charAt(this._cursor));
    // console.log('u' + until  + ' ' + this._string.charAt(until));
    switch (true) {
      case /^\}/.test(toParse):
        if (braceCount-- <= 0) { // found the end of a macro
          this._cursor += 1;
          return str.trim();
        } else {
          str += this.readChar();
        }
        break;
      case /^\{/.test(toParse):
          braceCount++;
          str += this.readChar();
        break;
      case /^\\/.test(toParse):
        var next = this._string.charAt(this._cursor + 1);
        this._cursor += 1;
        if (escapable.indexOf(next) > -1) {
          str += this.readChar();
        } else if (/[A-Za-z0-9]/.test(next)) {
          str += this.handleMacro(this.readMacroName());
        }
        break;
      case /^\s*%/.test(toParse):
        this.readComment();
        break;
      default:
        str += this.readChar();
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

// Read a item macro having 1 or 2 argument
// Precondition: Assume that the cursor is placed just before the \item macro, white space between cursor and 
// opening backslash will be trimmed.
// Post: the cursor is placed after the closing bracket '}' closing the last argument
// @return An object with 2 properties
RdocParser.prototype.readItem = function() {
  var toParse = this._string.slice(this._cursor);

  var itemName = this.readLatexLikeArgument(); //read the first argument
  var description;
  if (this._string.charAt(this._cursor) === '{') { //Check if there is a second argument
    this._cursor += 1;
    description = this.readLatexLikeArgument(); //read the second argument
    return { name: itemName, description: description};
  } else {
    return { name: itemName };
  }

};


RdocParser.prototype.readItems = function(until) {
  if (typeof(until)==='undefined') until = this._string.length;
  var arr = [];
  var buff = '';
  var braceCount = 0;
  do {
    var toParse = this._string.slice(this._cursor);
     //console.log('c' + this._cursor + ' ' + this._string.charAt(this._cursor));
    // console.log('u' + until  + ' ' + this._string.charAt(until));
    switch (true) {
      case /^\}/.test(toParse):
        if (braceCount-- <= 0) { // found the end of a macro
          this._cursor += 1;
          if(buff.trim() !== '') {
            arr.push(buff.trim());
          }
          return arr;
        } else {
          buff += this.readChar();
        }
        break;
      case /^\{/.test(toParse):
          braceCount++;
          buff += this.readChar();
        break;
      case /^\\/.test(toParse):
        var next = this._string.charAt(this._cursor + 1);
        this._cursor += 1;
        if (escapable.indexOf(next) > -1) {
          buff += this.readChar();
        } else if (/[A-Za-z0-9]/.test(next)) {
          var macroName = this.readMacroName();
          if (macroName === 'item') {
            if(buff.trim() !== '') {
              arr.push(buff.trim());
              buff = '';
            }
            arr.push(this.readItem());
          }
          else buff += this.handleMacro(macroName);
        }
        break;
      case /^\s*%/.test(toParse):
        this.readComment();
        break;
      default:
        buff += this.readChar();
        break;
    }
   
  } while (this._cursor < until);
  
  if(buff.trim() !== '') {
    arr.push(buff.trim());
  }
  return arr;
};

//Read the option preceding the link macro, search for the closing ] bracket
//Precondition: The cursor is placed after the opening [ bracket
//Postcondition: The cursor is placed after the opening { bracket of the following argument
//@return the option
RdocParser.prototype.readOption = function() {
  var char = this.readChar();
  var str = '';
  while (char !== ']') {
    str += char;
    char = this.readChar();
  }
  if (this.readChar() !== '{') {
    throw "Expected second argument after link options";
  }
  return str;
};

RdocParser.prototype.readEqMacro = function(marker) {
  var latexEq = this.readVerbatimArgument();
  if (this._string.charAt(this._cursor) === '{') { //eqn has a second arg, ignore it.
    this._cursor += 1;
    this.readVerbatimArgument();
  }
  return marker + latexEq + marker;
};

module.exports = RdocParser;