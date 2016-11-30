var fs = require("fs");
var path = require("path");

var includes = [
	"examples/js/pmrem/PMREMGenerator.js",
	"examples/js/pmrem/PMREMCubeUVPacker.js",
	"examples/js/shaders/CopyShader.js",
	"examples/js/shaders/CompositeShader.js",
	"examples/js/shaders/GlossyMirrorShader.js",
	"examples/js/shaders/SAOShader.js",
	"examples/js/shaders/BlurShader.js",
	"examples/js/postprocessing/EffectComposer.js",
	"examples/js/postprocessing/RenderPass.js",
	"examples/js/postprocessing/MaskPass.js",
	"examples/js/postprocessing/ShaderPass.js",
	"examples/js/postprocessing/SAOPass.js",
	"examples/js/postprocessing/SSAARenderPass.js",
	"examples/js/postprocessing/ClearPass.js",
	"examples/js/postprocessing/TexturePass.js",
	"examples/js/postprocessing/CubeTexturePass.js",
	"examples/js/GlossyMirror.js"
];

//fs.writeFileSync( "../Clara.io/threehub/vendor/three.js", fs.readFileSync( "build/three.js", 'utf8' ), 'utf8' );

var output = "./build/three.extra.js";

var buffer = [];
buffer.push( "var THREE = require('./three');\n" );

for ( var j = 0; j < includes.length; j ++ ){

	var file = includes[ j ];

	buffer.push('// File:' + file );
	buffer.push('\n\n');

	buffer.push( fs.readFileSync( file, 'utf8' ) );
	buffer.push( '\n' );
}

buffer.push( '\nmodule.exports = THREE;\n' );
var temp = buffer.join( '' );

// Write un-minified output
console.log( '  Writing un-minified output: ' + output );
fs.writeFileSync( output, temp, 'utf8' );
