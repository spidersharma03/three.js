/**
 * @author bhouston / http://clara.io/
 *
 * Scalable Ambient Occlusion
 *
 */

THREE.ShaderChunk['sao'] = [

"#include <packing>",

"float getDepth( const in vec2 screenPosition ) {",
		"return unpackRGBAToDepth( texture2D( tDepth, screenPosition ) );",
"}",

"vec4 setDepth( const in float depth ) {",
		"return packDepthToRGBA( depth );",
"}",

"float getViewZ( const in float depth ) {",
		"return perspectiveDepthToViewZ( depth, cameraNear, cameraFar );",
"}"

].join( "\n" );

THREE.SAOShader = {

	blending: THREE.NoBlending,

	defines: {
		'NUM_SAMPLES': 7,
		'MAX_SAMPLES': 7,
		'NUM_RINGS': 7,
	},

	extensions: {
		'derivatives': true
	},

	uniforms: {

		"tPoissonSamples":  { type: "t", value: null },
		"tAOPrevious":  { type: "t", value: null },
		"tDepth":       { type: "t", value: null },
		"tNormal":      { type: "t", value: null },
		"size":         { type: "v2", value: new THREE.Vector2( 512, 512 ) },

		"cameraNear":   { type: "f", value: 1 },
		"cameraFar":    { type: "f", value: 100 },
		"cameraProjectionMatrix": { type: "m4", value: new THREE.Matrix4() },
		"cameraInverseProjectionMatrix": { type: "m4", value: new THREE.Matrix4() },

		"intensity":    { type: "f", value: 0.1 },

		"occlusionSphereWorldRadius": { type: "f", value: 10.0 },
		"worldToScreenRatio": { type: "v2", value: new THREE.Vector2( 1, 1 ) },
		"frameCount":   { type: "f", value: 0.0 },
		"currentFrameCount":   { type: "f", value: 0.0 },
		"poissonTextureWidth":   { type: "f", value: 0.0 },
	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",

			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [


		"#include <common>",

		"varying vec2 vUv;",

		"uniform sampler2D tAOPrevious;",
		"uniform sampler2D tPoissonSamples;",


		"#define MAX_MIP_LEVEL 3",

		"uniform sampler2D tDepth;",
		"uniform sampler2D tNormal;",

		"uniform float cameraNear;",
		"uniform float cameraFar;",
		"uniform mat4 cameraProjectionMatrix;",
		"uniform mat4 cameraInverseProjectionMatrix;",

		"uniform float intensity;",
		"uniform float occlusionSphereWorldRadius;",
		"uniform vec2 size;",
		"uniform vec2 worldToScreenRatio;",
		"uniform float frameCount;",
		"uniform float currentFrameCount;",
		"uniform float poissonTextureWidth;",


		"#include <sao>",

		"vec3 getViewPosition( const in vec2 screenPosition, const in float depth, const in float viewZ ) {",

			"float clipW = cameraProjectionMatrix[2][3] * viewZ + cameraProjectionMatrix[3][3];",
			"vec4 clipPosition = vec4( ( vec3( screenPosition, depth ) - 0.5 ) * 2.0, 1.0 );",
			"clipPosition *= clipW;", // unprojection.
			"return ( cameraInverseProjectionMatrix * clipPosition ).xyz;",

		"}",

		"vec3 getViewNormal( const in vec3 viewPosition, const in vec2 screenPosition ) {",
				"return -unpackRGBToNormal( texture2D( tNormal, screenPosition ).xyz );",
		"}",

		"float getDepthMIP( const in vec2 screenPosition, const int mipLevel ) {",

			"vec4 rawDepth;",
			"rawDepth = texture2D( tDepth, screenPosition );",

			"#if DEPTH_PACKING == 1",
				"return unpackRGBAToDepth( rawDepth );",
			"#else",
				"return rawDepth.x;",
			"#endif",

		"}",

		"float scaleDividedByCameraFar;",
		"float minResolutionMultipliedByCameraFar;",
		"float errorCorrectionFactor;",

		"float getOcclusion( const in vec3 centerViewPosition, const in vec3 centerViewNormal, const in vec3 sampleViewPosition ) {",

			"vec3 viewDelta = sampleViewPosition - centerViewPosition;",
			"float viewDistance2 = dot( viewDelta, viewDelta );",

			"float occlusion = max( ( dot( centerViewNormal, viewDelta ) + centerViewPosition.z * 0.001 ) / ( viewDistance2 + 0.0001 ), 0.0 );// * smoothstep( pow2( occlusionSphereWorldRadius ), 0.0, viewDistance2 );",
			"return pow(occlusion,1.0);",
		"}",
		// moving costly divides into consts
		"const float ANGLE_STEP = PI2 * float( NUM_RINGS ) / float( MAX_SAMPLES );",
		"const float INV_NUM_SAMPLES = 1.0 / float( MAX_SAMPLES );",

		"float getAmbientOcclusion( const in vec3 centerViewPosition ) {",

			// precompute some variables require in getOcclusion.
			"vec3 centerViewNormal = -unpackRGBToNormal( texture2D( tNormal, vUv ).xyz );",

			"vec2 invSize = 1.0 / size;",

			"vec2 occlusionSphereScreenRadius = occlusionSphereWorldRadius * worldToScreenRatio / centerViewPosition.z;",
			"float screenRadius = occlusionSphereWorldRadius * cameraNear / centerViewPosition.z;",

			"float random = rand( vUv );",
			"float angle = random * PI2 + ANGLE_STEP * (frameCount - 1.0);",

			"float occlusionSum = 0.0;",
			"float cs = cos(angle); float sn = sin(angle);",
			"mat2 rotMatrix = mat2(cs, sn, -sn, cs);",
			"float invPoissonTextureWidth = 1.0/poissonTextureWidth;",
			"for( int i = 0; i < NUM_SAMPLES; i ++ ) {",
				"float xOffset = (float(i) + frameCount - 1.0 + 0.5)*invPoissonTextureWidth;",
				"vec2 poissonSample = texture2D( tPoissonSamples, vec2(xOffset, 0.5)).xw * screenRadius * 4.0;",
				"poissonSample = rotMatrix * poissonSample;",
				"vec2 sampleUvOffset = poissonSample;",
				// round to nearest true sample to avoid misalignments between viewZ and normals, etc.
				"vec2 sampleUv = vUv + sampleUvOffset;",

				"float sampleDepth = getDepthMIP( sampleUv, 0 );",
				"if( sampleDepth >= ( 1.0 - EPSILON ) ) {",
					"continue;",
				"}",

				"float sampleViewZ = getViewZ( sampleDepth );",
				"vec3 sampleViewPosition = getViewPosition( sampleUv, sampleDepth, sampleViewZ );",
				"float occlusion = getOcclusion( centerViewPosition, centerViewNormal, sampleViewPosition );",
				"occlusionSum += occlusion;",
			"}",
			"float occlusion = occlusionSum * intensity * 2.0 * occlusionSphereWorldRadius / ( float( NUM_SAMPLES ) );",
			"return occlusion;",
		"}",

		"void main() {",

			"float centerDepth = getDepth( vUv );",
			"if( centerDepth >= ( 1.0 - EPSILON ) ) {",
				"discard;",
			"}",

		/*	"float mipDepth = unpackRGBAToDepth( texture2D( tDepth3, vUv ) );",
			"gl_FragColor.xyz = vec3( (centerDepth - mipDepth) * 50.0 + 0.5 );",
			"gl_FragColor.a = 1.0;",
			"return;",*/

			"float centerViewZ = getViewZ( centerDepth );",
			"vec3 viewPosition = getViewPosition( vUv, centerDepth, centerViewZ );",

			"float ambientOcclusion = getAmbientOcclusion( viewPosition );",

			//"gl_FragColor = getDefaultColor( vUv );",

			"float aoValue = ( 1.0 - ambientOcclusion );",
			"float prevAoSum = texture2D(tAOPrevious, vUv).a;",
			"if(currentFrameCount > poissonTextureWidth/float(NUM_SAMPLES)){",
				"aoValue = prevAoSum;",
			"}",
			"float newAoValue = (currentFrameCount - 1.0) * prevAoSum + aoValue;",
			"newAoValue /= currentFrameCount;",
			"gl_FragColor = vec4( newAoValue);",
		"}"

	].join( "\n" )

};
