/**
 * @author bhouston / http://clara.io/
 *
 * Normal from Depth Shader
 *
 */

THREE.NormalFromDepthShader = {

	uniforms: {

		"tDepth":       { type: "t", value: null },
		"cameraNear":   { type: "f", value: 1 },
		"cameraFar":    { type: "f", value: 100 },
		"cameraProjectionMatrix": { type: "m4", value: new THREE.Matrix4() },
		"cameraInverseProjectionMatrix": { type: "m4", value: new THREE.Matrix4() },
	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",

			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

		// total number of samples at each fragment",
    "#extension GL_OES_standard_derivatives : enable",

		"#include <common>",

    "varying vec2 vUv;",

    "uniform sampler2D tDepth;",
    "uniform sampler2D tDiffuse;",

    "uniform mat4 cameraInverseProjectionMatrix;",
    "uniform mat4 cameraProjectionMatrix;",
    "uniform float cameraNear;",
    "uniform float cameraFar;",

		// RGBA depth

		"#include <packing>",
		"#include <procedural>",

		"vec3 getViewSpacePosition( vec2 screenSpacePosition ) {",
		"   float perspectiveDepth = unpackRGBAToLinearUnit( texture2D( tDepth, screenSpacePosition ) );",
		"   float viewSpaceZ = perspectiveDepthToViewZ( perspectiveDepth, cameraNear, cameraFar );",
		"   float w = cameraProjectionMatrix[2][3] * viewSpaceZ + cameraProjectionMatrix[3][3];",
		"   vec3 clipPos = ( vec3( screenSpacePosition, perspectiveDepth ) - 0.5 ) * 2.0;",
		"   return ( cameraInverseProjectionMatrix * vec4( w * clipPos.xyz, w ) ).xyz;",
		"}",

		"vec3 getViewSpaceNormalFromDepth(vec3 viewSpacePosition ) {",
		"    return normalize( cross( dFdx( viewSpacePosition ), dFdy( viewSpacePosition ) ) );",
		"}",

		"void main() {",

      "vec4 color = texture2D( tDiffuse, vUv );",
      "vec3 viewSpacePosition = getViewSpacePosition( vUv );",
      "vec3 normal = getViewSpaceNormalFromDepth( viewSpacePosition );",

      "gl_FragColor = vec4( packNormalToRGB( normal ), 1.0 );",

		"}"

	].join( "\n" )

};
