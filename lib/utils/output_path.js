var path = require('path'),
    _ = require('underscore'),
    adapters = require('../adapters');

// takes a path from a lfa project and outputs the path
// that it will compile to.

module.exports = function(file){

  var fc = global.options.folder_config;
  var extension = path.basename(file).split('.')[1]; // this should take the *first* extension only

  // dump views/assets to public
  // I'm worried about the second replace call...
  var result = path.join(file.replace(process.cwd(), options.output_folder))
                   .replace(new RegExp(fc.views + '|' + fc.assets), '');

  // swap extension if needed
  if (adapters[extension]) {
    result = result.replace(new RegExp('\\.' + extension + '.*'), '.' + adapters[extension].settings.target);
  }

  return path.join(process.cwd(), result);
};
