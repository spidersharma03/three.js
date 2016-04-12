/**
 * @author bhouston / http://clara.io
 *
 * One Dimensional Guassian Blur Shader, Optionally limted by Depth Discontinuities


 */

THREE.BlendShader = {

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
    "uniform float kernelWeights[ KERNEL_RADIUS ];",

    "#ifdef DEPTH_LIMITED",

      "uniform sampler2D tDepth;",
		  "uniform float cameraNear;",
		  "uniform float cameraFar;",
      "uniform float depthLimit;",

    "#endif",

		"varying vec2 vUv;",

		"void main() {",

      "vec2 pixelToUvScale = 1.0 / size;"

			"float centerViewZ = perspectiveDepthToViewZ( unpackRGBAToDepth( texture2D( tDepth, vUv ) ) );",

      "vec4 colorSum = vec4( 0.0 );",
      "float weightSum = 0.0;",

      "for( int i = 0; i < TAP_COUNT; i ++ ) {",

        "vec2 tapUvOffset = pixelToUvScale * tapPixelOffsets[ i ];",
        "vec2 tapUv = vUv + tapUvOffset;",

        "float tapViewZ = perspectiveDepthToViewZ( unpackRGBAToDepth( texture2D( tDepth, tapUv ) ) );",
        "float depthSlope = fabs( centerViewZ - tapViewZ ) / length( tapOffset );",
        "if( depthSlope <= depthSlopeLimit ) {",

          "colorSum += texture2D( tDiffuse, tapUv ) * tapWeights[ i ];",
          "weightSum += tapWeights[ i ];",

        "}",

      "}",

			"gl_FragColor = ( weightSum > 0.0 ) ? ( colorSum / weightSum ) : vec4( 0.0 );",

		"}"

	].join( "\n" )

};
