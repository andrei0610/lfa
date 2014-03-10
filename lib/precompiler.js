var jade = require('jade'),
  fs = require('fs'),
  path = require('path'),
  _ = require('underscore'),
  mkdirp = require('mkdirp'),
  readdirp = require('readdirp'),
  compressor = require('./utils/compressor');

module.exports = {};

module.exports.p = {};

module.exports.getFiles = function(options, cb) {
  readdirp(options, function(err, res) {
    if (Object.keys(module.exports.p).length === 0) {
      module.exports.p = new Precompiler({
        templates: _.map(res.files, function(f) {
          return f.fullPath;
        })
      });
    } else {
      module.exports.p.templates = _.map(res.files, function(f) {
        return f.fullPath;
      });
    }
    
    module.exports.p.templates.push(path.join(__dirname, '..', 'templates', 'clientjs', 'search_result.jade'));
    
    cb();
  });
};

module.exports.run = function() {
  global.options.debug.log('precompiling templates', 'yellow');
  if (global.options.templates === null) {
    return false;
  }
  
  // figure out where the templates are hiding
  var templateDir = path.join(process.cwd(), global.options.templates);
  module.exports.options = {
    root: templateDir,
    directoryFilter: global.options.ignore_folders,
    fileFilter: global.options.ignore_files
  };
  
  // slice and dice them
  module.exports.getFiles(module.exports.options, function() {
    var buf, cleantoc, output_path, searchContent, precompiler = module.exports.p;
    
    output_path = path.join(process.cwd(), global.options.output_folder, 'js', 'templates', 'main.js');
    mkdirp.sync(path.dirname(output_path));
    
    buf = precompiler.compile();
    if (global.options.compress) {
      buf = compressor(buf, 'js');
    }
    
    fs.writeFileSync(output_path, buf);
    
    searchContent = global.options.search_content;
    
    cleantoc = function(chapters) {
      var i, len;
      i = 0;
      len = chapters.length;
      while (i < len) {
        delete chapters[i].locals.html;
        delete chapters[i].locals.text;
        if (chapters[i].children && chapters[i].children.length) {
          chapters[i].children = cleantoc(chapters[i].children);
        }
        i++;
      }
      return chapters;
    };
    
    var toc = cleantoc(global.options.toc);
    
    // hashcodeIndex is a data structure I thought up that converts 'chapter/section' URIs
    // into hashcodes and vice-versa. I don't think the vice-versa is actually useful.
    var generateHashcodeIndex = function(toc, output) {
      for (var i = 0, len = toc.length; i < len; i++) {
        if (toc[i].locals && toc[i].locals.sections && toc[i].locals.sections.length ) {
          for (var j = 0, lenSection = toc[i].locals.sections.length; j < lenSection; j++) {
            var section = toc[i].locals.sections[j];
            if (section && section.hash && toc[i].url) {
              output[toc[i].url + '/' + j] = section.hash.toString();
              output[section.hash] = toc[i].url + '/' + j;
            }
          }
        }
        
        if (toc[i].children && toc[i].children.length) {
          generateHashcodeIndex(toc[i].children, output);
        }
      }
    };
    
    var hashcodeIndex = {};
    generateHashcodeIndex(toc, hashcodeIndex);
    
    global.options.debug.log(require('util').inspect(toc, false, null), 'yellow');
    searchContent = 'define({ pages: ' + JSON.stringify(searchContent) + ', toc: ' + JSON.stringify(toc) + ', hashcodeIndex: ' + JSON.stringify(hashcodeIndex) + '});';
    fs.writeFileSync('_build/js/searchjson.js', searchContent);
    global.options.debug.log('generated js/searchjson.js', 'yellow');
  });
};

var Precompiler = (function() {
  /**
   * deals with setting up the variables for options
   * @param {Object} options = {} an object holding all the options to be
     passed to the compiler. 'templates' must be specified.
   * @constructor
  */

  function Precompiler(options) {
    var defaults;
    if (options === null) {
      options = {};
    }
    defaults = {
      debug: false,
      namespace: 'templates',
      templates: void 0
    };
    _.extend(this, defaults, options);
  }

  /**
   * loop through all the templates specified, compile them, and add a wrapper
   * @return {String} the source of a JS object which holds all the templates
   * @public
   */


  Precompiler.prototype.compile = function() {
    var buf;
    buf = ['define(function(require){\n'];

    this.initHelpers();
    buf.push('  window.jade = require(\'js/templates/helpers.js\');\n');
    
    if (global.options.mixins) {
      this.initMixins();
      buf.push('  window.jade_mixins = require(\'js/templates/mixins.js\');\n');
    }
    
    buf.push('\n  var ' + this.namespace + ' = {};');
    this.initTemplates(this.templates);
    buf.push('\n  templates = require(\'js/templates/index.js\');');
    buf.push('\n  return ' + this.namespace + ';\n});');
    return buf.join('');
  };

  /**
   * compile individual templates, and write them to their respective files
   * @param {String} template the full filename & path of the template to be
     compiled
   * @return {String} template namespace (e.g.: 'ch01-00') of the template
   * @private
  */


  Precompiler.prototype.compileTemplate = function(template) {
    var basePath, basePathSplit, data, templateNamespace;
    basePath = template.split(path.join(process.cwd(), global.options.templates) + path.sep)[1];
    if (!basePath) {
      basePathSplit = template.split(path.sep);
      basePath = basePathSplit[basePathSplit.length - 1];
    }
    templateNamespace = basePath.split('.jade')[0].replace(/[\/\\]/g, '-');
    data = fs.readFileSync(template, 'utf8');
    
    var compileOptions = {
      compileDebug: this.debug || false,
      inline: this.inline || false,
      self: true,
      pretty: false
    };
    
    data = jade.compileClient(data, compileOptions);
    
    // jade_mixins and buf are declared in window, so keep calm
    data = (data + '')
      .replace(/\nvar jade_mixins = {};\n/, '')
      .replace('var buf = [];', 'window.buf = [];');
    
    var buf = 'define(function(){ return ' + data + '});';
    if (global.options.compress) {
      buf = compressor(buf, 'js');
    }
    
    // write the template to its respective file
    fs.writeFileSync(path.join(process.cwd(), global.options.output_folder, 'js', 'templates', templateNamespace + '.js'), buf);
    
    return templateNamespace;
  };
  
  
  Precompiler.prototype.initHelpers = function() {
    var buf = [];
    
    // because JSON.stringify or similar doesn't work on objects with functions
    function convertToText(obj) {
      //create an array that will later be joined into a string.
      var string = [];
      
      if (typeof(obj) === 'object' && (obj.join === undefined)) {
        string.push('{');
        for (var prop in obj) {
          if (obj.hasOwnProperty(prop)) {
            string.push(prop, ': ', convertToText(obj[prop]), ',');
          }
        }
        string.push('}');
      } else if (typeof(obj) === 'object' && obj.join !== undefined) {
        string.push('[');
        for (prop in obj) {
          if (obj.hasOwnProperty(prop)) {
            string.push(convertToText(obj[prop]), ',');
          }
        }
        string.push(']');
      } else if (typeof(obj) === 'function') {
        string.push(obj.toString());
      } else {
        string.push(JSON.stringify(obj));
      }
      return string.join('');
    }
    
    buf.push('define(function(){ return ');
    
    // we don't need this
    var irrelevant = ' else if (escaped) {\n    return \' \' + key + \'="\' + escape(val) + \'"\';\n  }';
    buf.push(convertToText(jade.runtime).replace(/exports\./g, '').replace(irrelevant, ''));
    
    buf.push(';});');
    
    buf = buf.join('');
    
    if (global.options.compress) {
      buf = compressor(buf, 'js');
    }
    
    fs.writeFileSync(path.join(process.cwd(), global.options.output_folder, 'js', 'templates', 'helpers.js'), buf);
  };
  
  Precompiler.prototype.initMixins = function() {
    // compile the mixins and remove some needless boilerplate
    var mixins = jade.compileClient(global.options.mixins)
      .replace(';;return buf.join("");\n}', ';\n')
      .replace('function template(locals) {\nvar buf = [];\nvar jade_mixins = {};\n' +
        'var locals_ = (locals || {}),self = locals_.self;', '');
    
    var buf = 'define(function() {\n  var jade_mixins = {};' + mixins + '  return jade_mixins;\n});';
    
    if (global.options.compress) {
      buf = compressor(buf, 'js');
    }
    
    fs.writeFileSync(path.join(process.cwd(), global.options.output_folder, 'js', 'templates', 'mixins.js'), buf);
  };
  
  Precompiler.prototype.initTemplates = function(ref) {
    var buf = [];
    
    buf.push('define(function(require) {\n  var templates = {};\n');
    for (var i = 0, len = ref.length; i < len; i++) {
      var templateNamespace = this.compileTemplate(ref[i]);
      buf.push('  ' + this.namespace + '[\'' + templateNamespace + '\'] = require(\'js/templates/' + templateNamespace + '.js\');\n');
    }
    buf.push('  return templates;\n});');
    
    buf = buf.join('');
    
    if (global.options.compress) {
      buf = compressor(buf, 'js');
    }
    
    fs.writeFileSync(path.join(process.cwd(), global.options.output_folder, 'js', 'templates', 'index.js'), buf);
  };

  return Precompiler;

})();
