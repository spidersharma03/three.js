console.log( "Be sure to run 'npm run dev' to ensure three.js is up to date.");
console.log( "Be sure to run 'node build.js' to create three.extras.js" );

var version = process.argv[2];
if( version === undefined ) {
	console.error( "expecting command line argument of a semver");
	return -1;
}

var fs = require("fs");
var path = require("path");

var inputs = [
	"three.js",
	"three.extra.js"
	];

var inputDirectory = "./build";
var outputDirectory = "../Clara/hub/three";

var packageTemplate = {
  "name": "three",
  "description": "threehub three.js",
  "version": version,
  "private": true,
  "license": "UNLICENSED",
  "main": "./three.extra.js",
  "jsnext:main": "./three.extra.js",
  "dependencies": {
  },
  "devDependencies": {
  }
};

console.log( "Deploying: " + version );

for( var i = 0; i < inputs.length; i ++ ) {
	var v = function() {
		var input = inputs[i];
		fs.readFile( inputDirectory + "/" + input, 'utf8', function( err, data ) {
			if( err ) return console.log( "Error: ", err );
			fs.writeFile( outputDirectory + "/" + input, data, "utf8", function( err ) {
				if( err ) return console.log( "Error: ", err );
				console.log( "Success: " +  inputDirectory + "/" + input + " --> " + outputDirectory + "/" + input  );
			})
		} );
	}();
}

fs.writeFile( outputDirectory + "/package.json", JSON.stringify( packageTemplate, null, '  ' ) + '\n', "utf8", function( err ) {
	if( err ) return console.log( "Error: ", err );
	console.log( "Success: " + "package.json" );
});
