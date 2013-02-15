"use strict";

var fs = require("fs");
var uglify = require("uglify-js2");
var argparse =  require( "argparse" );

var targetSettingsMap = {

	'three': {
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

var sizeString = function ( byteCount ) {
	return '' + Math.round( byteCount / 1024 ) + ' Kb';
};

var buildOutput = function ( outputName, includeNames, minify ) {

	console.log('Target: ' + outputName );

	console.log('  Includes: ' + includeNames.join( ', ' ) );

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

	console.log('  Output: ' + outputName + '.js' + ' (' + sizeString( combinedSource.length ) + ')' );

	var outputPathName = '../../build/' + outputName + '.js';		
	fs.writeFile( outputPathName, combinedSource, 'utf8' );

	if( minify ) {

		console.log('  Minifying...' );

		var startTime = Date.now();
		var minifiedResult = uglify.minify( combinedSource, { fromString: true } );
		var minifiedCombinedSource = minifiedResult.code;

		console.log('  Minifying complete.  (' + Math.round( ( Date.now() - startTime )/100 )/10 + ' s)');

		console.log('  Output: ' + outputName + '.min.js' + ' (' + sizeString( minifiedCombinedSource.length ) + ')' );

		var minifiedOutputPathName = '../../build/' + outputName + '.min.js';		
		fs.writeFile( minifiedOutputPathName, minifiedCombinedSource, 'utf8' );

	}

};

var parser = new argparse.ArgumentParser();
parser.addArgument( ['--target'], { action: 'append', required: false } );
parser.addArgument( ['--minify'], { action: 'storeTrue', defaultValue: false } );

var args = parser.parseArgs();

if( args.target ) {

	var originalTargetSettingsMap = targetSettingsMap;
	targetSettingsMap = {};

	for( var i = 0; i < args.target.length; i ++ ) {

		var targetName = args.target[ i ];

		if( originalTargetSettingsMap[ targetName ] ) {

			targetSettingsMap[ targetName ] = originalTargetSettingsMap[ targetName ];

		}
		else {

			targetSettingsMap[ targetName ] = null;

		}

	}

}

for( var targetName in targetSettingsMap ) {

	var targetSettings = targetSettingsMap[ targetName ];

	console.log();

	if( ! targetSettings ) {

		console.log( "WARNING: No target with the name '" + targetName + "' found, skipping." );

	}
	else {

		buildOutput( targetName, targetSettings.includes, args.minify );

	}

}