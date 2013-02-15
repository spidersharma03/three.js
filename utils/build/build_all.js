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

var buildOutput = function ( outputName, includeNames ) {

	console.log('Building: ' + outputName );

	console.log('  Reading includes: ' + includeNames.join( ', ' ) );

	var includeSources = [];

	for( var i = 0; i < includeNames.length; i ++ ) {

		var includePathName = './includes/' + includeNames[i] + '.json';
		var includeData = fs.readFileSync( includePathName, 'utf8' );
		var sourceFilesNames = JSON.parse( includeData );

		for ( var j = 0; j < sourceFilesNames.length; j ++ ){

			var sourcePathName = '../../' + sourceFilesNames[ j ];
			var includeSource = fs.readFileSync( sourcePathName, 'utf8' );
			includeSources.push( includeSource );
		}
	}

	var combinedSource = includeSources.join( '' );

	console.log('  Minifying.' );

	var minifiedResult = uglify.minify( combinedSource, { fromString: true } );
	var minifiedCombinedSource = minifiedResult.code;

	console.log('  Writing: ' + outputName + '.js' + ' (' + Math.round( combinedSource.length/1024) + ' Kb)' );

	var outputPathName = '../../build/' + outputName + '.js';		
	fs.writeFile( outputPathName, combinedSource, 'utf8' );

	console.log('  Writing: ' + outputName + '.min.js' + ' (' + Math.round( minifiedCombinedSource.length/1024 ) + ' Kb)' );

	var minifiedOutputPathName = '../../build/' + outputName + '.min.js';		
	fs.writeFile( minifiedOutputPathName, minifiedCombinedSource, 'utf8' );

}

for( var outputName in outputs ) {

	var outputSettings = outputs[ outputName ];
	
	console.log();

	buildOutput( outputName, outputSettings.includes );

}