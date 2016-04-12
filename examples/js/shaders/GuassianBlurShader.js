/**
 * @author bhouston / http://clara.io
 *
 * One Dimensional Guassian Blur Shader, Optionally limted by Depth Discontinuities


 */

THREE.GaussianBlurShader = {

  getTapOffets: function( numTaps, direction ) {
    var tapOffsets = [];
    for( var i = 0; i < numTaps; i ++ ) {
      tapOffsets.push( direction.clone().multiplyScalar( i - ( numTaps - 1 )*0.5 ) );
    }
    return tapOffsets;
  },

  getGaussianTapWeights: function( numTaps ) {
    var tapWeights = [];
    var tapWeightSum = 0;
    for( var i = 0; i < numTaps; i ++ ) {
      var tapWeight = THREE.Math.gaussian( i - ( numTaps - 1 ) * 0.5, numTaps * 0.25 ); // should sigma be 2?
      tapWeightSum += tapWeight;
      tapWeights.push( tapWeight );
    }
    // normalize weights
    for( var i = 0; i < numTaps; i ++ ) {
      tapWeights[i] /= tapWeightSum;
    }
    return tapWeights;
  },

  defines: {

		'TAP_COUNT': 5,
    'DEPTH_LIMITED': 1,

  },

	uniforms: {

		"tDiffuse": { type: "t", value: null },
    "size": { type: "v2", value: new THREE.Vector2( 256, 256 ) },

    "tapPixelOffsets": { type: "fv2", value: [] },
    "tapWeights": { type: "fv1", value: [] },

		"tDepth": { type: "t", value: null },
    "cameraNear": { type: "f", value: 10 },
    "cameraFar": { type: "f", value: 1000 },
    "depthLimit": { type: "f", value: 1 },

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

    "uniform sampler2D tDiffuse;",
    "uniform vec2 size;",
    "uniform float tapWeights[ TAP_COUNT ];",
    "uniform vec2 tapPixelOffsets[ TAP_COUNT ];",

    "#ifdef DEPTH_LIMITED",

      "uniform sampler2D tDepth;",
		  "uniform float cameraNear;",
		  "uniform float cameraFar;",
      "uniform float depthLimit;",

    "#endif",

		"varying vec2 vUv;",

		"void main() {",

      "vec2 pixelToUvScale = 1.0 / size;"

      "#ifdef DEPTH_LIMITED",

			   "float centerViewZ = perspectiveDepthToViewZ( unpackRGBAToDepth( texture2D( tDepth, vUv ) ) );",

      "#endif",

      "vec4 colorSum = vec4( 0.0 );",
      "float weightSum = 0.0;",

      "for( int i = 0; i < TAP_COUNT; i ++ ) {",

        "vec2 tapUvOffset = pixelToUvScale * tapPixelOffsets[ i ];",
        "vec2 tapUv = vUv + tapUvOffset;",

        "#ifdef DEPTH_LIMITED",

          "float tapViewZ = perspectiveDepthToViewZ( unpackRGBAToDepth( texture2D( tDepth, tapUv ) ) );",
          "float depthSlope = fabs( centerViewZ - tapViewZ ) / length( tapOffset );",
          "if( depthSlope <= depthSlopeLimit ) {",

            "colorSum += texture2D( tDiffuse, tapUv ) * tapWeights[ i ];",
            "weightSum += tapWeights[ i ];",

          "}",

        "#else",

          "colorSum += texture2D( tDiffuse, tapUv ) * tapWeights[ i ];",
          "weightSum += tapWeights[ i ];",

        "#endif",

      "}",

			"gl_FragColor = ( weightSum > 0.0 ) ? ( colorSum / weightSum ) : vec4( 0.0 );",

		"}"

	].join( "\n" )

};
