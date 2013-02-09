"use strict";

var fs = require("fs");
var uglify = require("uglify-js2");

var outputs = {

	three: {
		includes: [ 'common', 'extras' ]
	},

	'three-canvas': {
		includes: [ 'canvas' ]
	},

	'three-css3d': {
		includes: [ 'css3d' ]
	},

	'three-webgl': {
		includes: [ 'webgl' ]
	},

	'three-extras': {
		includes: [ 'extras' ]
	},

	'three-math': {
		includes: [ 'math' ]
	},

	'three-max': {
		includes: [ 'common', 'extras', 'examples' ]
	}

};

for( var outputName in outputs ) {
	console.log('Building ' + outputName + '...');

	var outputSettings = outputs[outputName];
	var includesNames = outputSettings.includes;

	var includeSources = [];

	for( var i = 0; i < includesNames.length; i ++ ) {
		console.log('  Including ' + includesNames[i] + '.');
		var includePathName = './includes/' + includesNames[i] + '.json';
		var includeData = fs.readFileSync( includePathName, 'utf8' );
		var sourceFilesNames = JSON.parse( includeData );

		for ( var j = 0; j < sourceFilesNames.length; j ++ ){

			var sourcePathName = '../../' + sourceFilesNames[ j ];
			var includeSource = fs.readFileSync( sourcePathName, 'utf8' );
			includeSources.push( includeSource );
		}
	}

	var outputPathName = '../../build/' + outputName + '.js';		
	console.log('  Creating output ' + outputPathName + '.');
	var combinedSource = includeSources.join( '' );
	fs.writeFile( outputPathName, combinedSource, 'utf8' );

	var minifiedOutputPathName = '../../build/' + outputName + '.min.js';		
	console.log('  Creating output ' + minifiedOutputPathName + '.');
	var minifiedCombinedSource = uglify.minify( combinedSource, { fromString: true } );
	fs.writeFile( minifiedOutputPathName, minifiedCombinedSource.source, 'utf8' );

}
