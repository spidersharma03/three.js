/**
 * @author spidersharma03 / http://eduperiment.com
 *
 * For a horizontal blur, use X_STEP 1, Y_STEP 0
 * For a vertical blur, use X_STEP 0, Y_STEP 1
 *
 */

THREE.BilateralBlurShader = {

	defines: {

		"KERNEL_SAMPLE_COUNT": 15

	},

	uniforms: {

		"tDiffuse":         { type: "t", value: null },
		"size":             { type: "v2", value: new THREE.Vector2( 1024, 1024 ) },
		"kernelRadius":		{ type: "f", value: 15.0 },
		"direction":		{ type: "v2", value: new THREE.Vector2( 1.0, 0.0 ) }
	},

	vertexShader: [

		"#include <common>",

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",

			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [
		
		"#define SIGMA 10.0",
		"#define BSIGMA 0.1",
		"uniform sampler2D tDiffuse;",
		"uniform vec2 size;",

		"uniform float kernelRadius;",
		"uniform vec2 direction;",
		
		"varying vec2 vUv;",
		
		"float normpdf(in float x, in float sigma)",
		"{",
			"return 0.39894*exp(-0.5*x*x/(sigma*sigma))/sigma;",
		"}",
		
		"float normpdf3(in vec3 v, in float sigma)",
		"{",
			"return 0.39894*exp(-0.5*dot(v,v)/(sigma*sigma))/sigma;",
		"}",
		
		"void main() {",

			"vec2 invSize = 1.0 / size;",
			"float centreSpaceWeight = normpdf(0.0, SIGMA);",
			"float weightSum = normpdf(0.0, SIGMA) * normpdf(0.0, BSIGMA);",
			"vec3 centreSample = texture2D( tDiffuse, vUv ).rgb;",
			"vec3 diffuseSum = centreSample * weightSum;",
			"vec2 delta = invSize * kernelRadius/float(KERNEL_SAMPLE_COUNT);",
			"for( int i = 1; i <= KERNEL_SAMPLE_COUNT; i ++ ) {",

				"float spaceWeight = normpdf(float(i), SIGMA);",
				"vec3 rightSample = texture2D( tDiffuse, vUv + direction * delta).rgb;",
				"vec3 leftSample = texture2D( tDiffuse, vUv - direction * delta).rgb;",
				"float rightSampleWeight = normpdf3(rightSample - centreSample, BSIGMA) * spaceWeight;",
				"float leftSampleWeight = normpdf3(leftSample - centreSample, BSIGMA) * spaceWeight;",
				"diffuseSum += (leftSample * leftSampleWeight + rightSample * rightSampleWeight);",
				"weightSum += (leftSampleWeight + rightSampleWeight);",
			"}",
			"if(gl_FragCoord.x/size.x < 0.5)",
			"{",
				"gl_FragColor = vec4(diffuseSum,1.0) / weightSum;",
			"}",
			"else",
			"{",
				"gl_FragColor = texture2D( tDiffuse, vUv );",
			"}",

		"}"

	].join( "\n" )

};


THREE.BilateralBlurShaderUtils = {

	createSampleWeights: function( kernelRadius, stdDev ) {

		var gaussian = function( x, stdDev ) {
			return Math.exp( - ( x*x ) / ( 2.0 * ( stdDev * stdDev ) ) ) / ( Math.sqrt( 2.0 * Math.PI ) * stdDev );
		};

		var weights = [];

		for( var i = 0; i <= kernelRadius; i ++ ) {
			weights.push( gaussian( i, stdDev ) );
		}

		return weights;
	},

	createSampleOffsets: function( kernelRadius, uvIncrement ) {

		var offsets = [];

		for( var i = 0; i <= kernelRadius; i ++ ) {
			offsets.push( uvIncrement.clone().multiplyScalar( i ) );
		}

		return offsets;

	},

	configure: function( material, kernelRadius, stdDev, uvIncrement ) {

		material.defines[ 'KERNEL_RADIUS' ] = kernelRadius;
		material.uniforms[ 'sampleUvOffsets' ].value = THREE.BilateralBlurShaderUtils.createSampleOffsets( kernelRadius, uvIncrement );
		material.uniforms[ 'sampleWeights' ].value = THREE.BilateralBlurShaderUtils.createSampleWeights( kernelRadius, stdDev );
		material.needsUpdate = true;

	}

};
