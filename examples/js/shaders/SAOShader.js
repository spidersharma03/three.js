/**
 * @author bhouston / http://clara.io/
 *
 * Scalable Ambient Occlusion
 *
 */

THREE.ShaderChunk['sao'] = [

"#include <packing>",

"float getDepth( const in vec2 screenPosition ) {",

	"#if DEPTH_PACKING == 1",
		"return unpackRGBAToDepth( texture2D( tDepth, screenPosition ) );",
	"#else",
		"return texture2D( tDepth, screenPosition ).x;",
	"#endif",

"}",

"vec4 setDepth( const in float depth ) {",

	"#if DEPTH_PACKING == 1",
		"return packDepthToRGBA( depth );",
	"#else",
		"return vec4( depth, 0, 0, 0 );",
	"#endif",

"}",

"float getViewZ( const in float depth ) {",

	"#if PERSPECTIVE_CAMERA == 1",
		"return perspectiveDepthToViewZ( depth, cameraNear, cameraFar );",
	"#else",
		"return orthographicDepthToViewZ( depth, cameraNear, cameraFar );",
	"#endif",

"}"

].join( "\n" );

THREE.SAOShader = {

	blending: THREE.NoBlending,

	defines: {
		'NUM_SAMPLES': 7,
		'MAX_SAMPLES': 7,
		'NUM_RINGS': 7,
		"NORMAL_TEXTURE": 0,
		"DIFFUSE_TEXTURE": 1,
		"DEPTH_PACKING": 1,
		"DEPTH_MIPS": 0,
		"PERSPECTIVE_CAMERA": 1
	},

	extensions: {
		'derivatives': true
	},

	uniforms: {

		"tPoissonSamples":  { type: "t", value: null },
		"tAOPrevious":  { type: "t", value: null },
		"tDepth":       { type: "t", value: null },
		"tDepth1":       { type: "t", value: null },
		"tDepth2":       { type: "t", value: null },
		"tDepth3":       { type: "t", value: null },

		"tDiffuse":     { type: "t", value: null },
		"tNormal":      { type: "t", value: null },
		"size":         { type: "v2", value: new THREE.Vector2( 512, 512 ) },

		"cameraNear":   { type: "f", value: 1 },
		"cameraFar":    { type: "f", value: 100 },
		"cameraProjectionMatrix": { type: "m4", value: new THREE.Matrix4() },
		"cameraInverseProjectionMatrix": { type: "m4", value: new THREE.Matrix4() },

		"intensity":    { type: "f", value: 0.1 },

		"occlusionSphereWorldRadius": { type: "f", value: 100.0 },
		"worldToScreenRatio": { type: "v2", value: new THREE.Vector2( 1, 1 ) },
		"randomSeed":   { type: "f", value: 0.0 },
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

		"#if DIFFUSE_TEXTURE == 1",
			"uniform sampler2D tDiffuse;",
		"#endif",

		"#define MAX_MIP_LEVEL 3",

		"uniform sampler2D tDepth;",

		"#if DEPTH_MIPS == 1",
			"uniform sampler2D tDepth1;",
			"uniform sampler2D tDepth2;",
			"uniform sampler2D tDepth3;",
		"#endif",

		"#if NORMAL_TEXTURE == 1",
			"uniform sampler2D tNormal;",
		"#endif",

		"uniform float cameraNear;",
		"uniform float cameraFar;",
		"uniform mat4 cameraProjectionMatrix;",
		"uniform mat4 cameraInverseProjectionMatrix;",

		"uniform float intensity;",
		"uniform float occlusionSphereWorldRadius;",
		"uniform vec2 size;",
		"uniform vec2 worldToScreenRatio;",
		"uniform float randomSeed;",
		"uniform float frameCount;",
		"uniform float currentFrameCount;",
		"uniform float poissonTextureWidth;",


		"#include <sao>",

		"vec4 getDefaultColor( const in vec2 screenPosition ) {",

			"#if DIFFUSE_TEXTURE == 1",
				"return texture2D( tDiffuse, vUv );",
			"#else",
				"return vec4( 1.0 );",
			"#endif",

		"}",

		"vec3 getViewPosition( const in vec2 screenPosition, const in float depth, const in float viewZ ) {",

			"float clipW = cameraProjectionMatrix[2][3] * viewZ + cameraProjectionMatrix[3][3];",
			"vec4 clipPosition = vec4( ( vec3( screenPosition, depth ) - 0.5 ) * 2.0, 1.0 );",
			"clipPosition *= clipW;", // unprojection.
			"return ( cameraInverseProjectionMatrix * clipPosition ).xyz;",

		"}",

		"vec3 getViewNormal( const in vec3 viewPosition, const in vec2 screenPosition ) {",

			"#if NORMAL_TEXTURE == 1",
				"return -unpackRGBToNormal( texture2D( tNormal, screenPosition ).xyz );",
			"#else",
				"return normalize( cross( dFdx( viewPosition ), dFdy( viewPosition ) ) );",
			"#endif",

		"}",

		"float getDepthMIP( const in vec2 screenPosition, const int mipLevel ) {",

			"vec4 rawDepth;",
			"#if DEPTH_MIPS == 0",
				"rawDepth = texture2D( tDepth, screenPosition );",
			"#else",
				"if( mipLevel == 0 ) {",
					"rawDepth = texture2D( tDepth, screenPosition );",
				"}",
				"else if( mipLevel == 1 ) {",
					"rawDepth = texture2D( tDepth1, screenPosition );",
				"}",
				"else if( mipLevel == 2 ) {",
					"rawDepth = texture2D( tDepth2, screenPosition );",
				"}",
				"else {",
					"rawDepth = texture2D( tDepth3, screenPosition );",
				"}",
			"#endif",

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

			"float occlusion = max( ( dot( centerViewNormal, viewDelta ) + centerViewPosition.z * 0.001 ) / ( viewDistance2 + 0.001 ), 0.0 );// * smoothstep( pow2( occlusionSphereWorldRadius ), 0.0, viewDistance2 );",
			"return pow(occlusion,1.0);",
		"}",

		/*
		"float getOcclusion( const in vec3 centerViewPosition, const in vec3 centerViewNormal, const in vec3 sampleViewPosition ) {",

			"vec3 viewDelta = sampleViewPosition - centerViewPosition;",
			"float viewDistance2 = dot( viewDelta, viewDelta );",

			"return max( pow3( pow2( occlusionSphereWorldRadius ) - viewDistance2 ), 0.0 ) *",
				"max( ( dot( centerViewNormal, viewDelta ) - 0.01 * occlusionSphereWorldRadius ) / ( viewDistance2 + 0.0001 ), 0.0 );",

		"}",*/

		//"const float maximumScreenRadius = 10.0;",

		"int getMipLevel( const in vec2 occlusionSphereScreenRadius ) {",
    		"return int( clamp( floor( log2( length( occlusionSphereScreenRadius * size ) ) - 4.0 ), 0.0, 3.0 ) );",
		"}",

		// moving costly divides into consts
		"const float ANGLE_STEP = PI2 * float( NUM_RINGS ) / float( MAX_SAMPLES );",
		"const float INV_NUM_SAMPLES = 1.0 / float( MAX_SAMPLES );",

		"vec4 getAmbientOcclusion( const in vec3 centerViewPosition ) {",

			// precompute some variables require in getOcclusion.
			"vec3 centerViewNormal = getViewNormal( centerViewPosition, vUv );",

			"vec2 invSize = 1.0 / size;",

			"vec2 occlusionSphereScreenRadius = occlusionSphereWorldRadius * worldToScreenRatio / centerViewPosition.z;",
			"float screenRadius = occlusionSphereWorldRadius * cameraNear / centerViewPosition.z;",

			// jsfiddle that shows sample pattern: https://jsfiddle.net/a16ff1p7/
			"float random = rand( vUv + randomSeed );",
			"float angle = random * PI2 + ANGLE_STEP * (frameCount - 1.0);",
			"float radiusStep = INV_NUM_SAMPLES/float(1.0);",
			"float radius = radiusStep * ( 0.5 + random );",

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

				//"int depthMipLevel = getMipLevel( radius * occlusionSphereScreenRadius );",
				"float sampleDepth = getDepthMIP( sampleUv, int( 4.0 * 0.0 ) );",
				"if( sampleDepth >= ( 1.0 - EPSILON ) ) {",
					"continue;",
				"}",

				"float sampleViewZ = getViewZ( sampleDepth );",
				"vec3 sampleViewPosition = getViewPosition( sampleUv, sampleDepth, sampleViewZ );",
				"float occlusion = getOcclusion( centerViewPosition, centerViewNormal, sampleViewPosition );",
				"occlusionSum += occlusion;",
			"}",
			"float occlusion = occlusionSum * intensity * 2.0 * occlusionSphereWorldRadius / ( float( NUM_SAMPLES ) );",
			"return vec4(occlusion);",
			//"return occlusionSum * intensity * 5.0 / ( float( NUM_SAMPLES ) * pow( occlusionSphereWorldRadius, 6.0 ) );",

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

			"vec4 ambientOcclusion = getAmbientOcclusion( viewPosition );",

			//"gl_FragColor = getDefaultColor( vUv );",

			"float aoValue = ambientOcclusion.a;",
			"float prevAoSum = texture2D(tAOPrevious, vUv).a;",
			"if(currentFrameCount > poissonTextureWidth/float(NUM_SAMPLES)){",
				"aoValue = prevAoSum;",
			"}",
			"float newAoValue = (currentFrameCount - 1.0) * prevAoSum + aoValue;",
			"newAoValue /= currentFrameCount;",
			"gl_FragColor = vec4( newAoValue);",
			"float xOffset = gl_FragCoord.x/size.x;",
		"}"

	].join( "\n" )

};

// source: http://g3d.cs.williams.edu/websvn/filedetails.php?repname=g3d&path=%2FG3D10%2Fdata-files%2Fshader%2FAmbientOcclusion%2FAmbientOcclusion_minify.pix
THREE.SAODepthMinifyShader = {

	blending: THREE.NoBlending,

	defines: {
		"DEPTH_PACKING": 1,
	//	"JITTERED_SAMPLING": 1
	},

	uniforms: {

		"tDepth":	{ type: "t", value: null },
		"cameraNear":   { type: "f", value: 1 },
		"cameraFar":    { type: "f", value: 100 },
		"size": { type: "v2", value: new THREE.Vector2( 256, 256 ) },

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
		"#include <packing>",

		"varying vec2 vUv;",

		"uniform sampler2D tDepth;",
		"uniform vec2 size;",
		"uniform float cameraNear;",
		"uniform float cameraFar;",

		"void main() {",

/*		g3d_FragColor.mask = texelFetch(
			CSZ_buffer,
			clamp(
				ssP * 2 + ivec2(ssP.y & 1, ssP.x & 1),
				ivec2(0),
				textureSize(CSZ_buffer, previousMIPNumber) - ivec2(1)),
			previousMIPNumber).mask;

	 }*/

	 		"vec2 uv = vUv;",

		//	"uv += ( round( vec2( rand( vUv * size ), rand( vUv * size + vec2( 0.333, 2.0 ) ) ) ) - 0.5 ) / size;",
			"vec2 invSize = 0.5 / size;",

			// NOTE: no need for depth decoding if nearest interpolation is used.
		/*	"float viewZ = 1.0 / perspectiveDepthToViewZ( unpackRGBAToDepth( texture2D( tDepth, vUv + invSize * vec2( -1.0, -1.0 ) ) ), cameraNear, cameraFar );",
			"viewZ += 1.0 / perspectiveDepthToViewZ( unpackRGBAToDepth( texture2D( tDepth, vUv + invSize * vec2( 1.0, 1.0 ) ) ), cameraNear, cameraFar );",
			"viewZ += 1.0 / perspectiveDepthToViewZ( unpackRGBAToDepth( texture2D( tDepth, vUv + invSize * vec2( -1.0, 1.0 ) ) ), cameraNear, cameraFar );",
			"viewZ += 1.0 / perspectiveDepthToViewZ( unpackRGBAToDepth( texture2D( tDepth, vUv + invSize * vec2( 1.0, -1.0 ) ) ), cameraNear, cameraFar );",
			"viewZ *= 0.25;",
			"gl_FragColor = packDepthToRGBA( viewZToPerspectiveDepth( 1.0 / viewZ, cameraNear, cameraFar ) );",*/
			"float depth = unpackRGBAToDepth( texture2D( tDepth, vUv + invSize * vec2( -1.0, -1.0 ) ) );",
			"depth += unpackRGBAToDepth( texture2D( tDepth, vUv + invSize * vec2( 1.0, 1.0 ) ) );",
			"depth += unpackRGBAToDepth( texture2D( tDepth, vUv + invSize * vec2( -1.0, 1.0 ) ) );",
			"depth += unpackRGBAToDepth( texture2D( tDepth, vUv + invSize * vec2( 1.0, -1.0 ) ) );",
			"depth *= 0.25;",
			"gl_FragColor = packDepthToRGBA( depth );",
		"}"

	].join( "\n" )

};

THREE.SAOBilaterialFilterShader = {

	blending: THREE.NoBlending,

	defines: {
		"PERSPECTIVE_CAMERA": 1,
		"KERNEL_SAMPLE_RADIUS": 4,
	},

	uniforms: {

		"tAODepth":	{ type: "t", value: null },
		"tAONormal":	{ type: "t", value: null },
		"size": { type: "v2", value: new THREE.Vector2( 256, 256 ) },

		"kernelDirection": { type: "v2", value: new THREE.Vector2( 1, 0 ) },
		"occlusionSphereWorldRadius": { type: "f", value: 50 },

		"cameraNear":   { type: "f", value: 1 },
		"cameraFar":    { type: "f", value: 100 },
		"edgeSharpness":    { type: "f", value: 3 },
		"scaleFactor":    { type: "f", value: 1 },
		"packOutput":    { type: "f", value: 1 }

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

		"uniform sampler2D tAODepth;",
		"uniform sampler2D tAONormal;",
		"uniform vec2 size;",

		"uniform float cameraNear;",
		"uniform float cameraFar;",
		"uniform float edgeSharpness;",
		"uniform float scaleFactor;",
		"uniform int packOutput;",

		"uniform float occlusionSphereWorldRadius;",
		"uniform float kernelSizeModifier;",
		"uniform vec2 kernelDirection;",

		"#include <packing>",
		"const float EDGE_SHARPNESS = 1.0;",
		"const float SCALE_FACTOR = 0.0;",

		"float getViewZ( const in float depth ) {",

			"#if PERSPECTIVE_CAMERA == 1",
				"return perspectiveDepthToViewZ( depth, cameraNear, cameraFar );",
			"#else",
				"return orthographicDepthToViewZ( depth, cameraNear, cameraFar );",
			"#endif",

		"}",

		"void addTapInfluence( const in vec2 tapUv, const in vec3 centerNormal, const in float centerViewZ, const in float sampleWeight, inout float aoSum, inout float tapWeight, inout float weightSum ) {",

			"vec4 depthTexel = texture2D( tAODepth, tapUv );",
			"float ao = depthTexel.r;",
			"depthTexel.r = 1.0;",
			"float depth = unpackRGBAToDepth( depthTexel );",

			"if( depth >= ( 1.0 - EPSILON ) ) {",
				"return;",
			"}",

			"float tapViewZ = -getViewZ( depth );",
			"tapWeight = max(0.0, 1.0 - (edgeSharpness * 20.0) * abs(tapViewZ - centerViewZ) * scaleFactor);",
			"aoSum += ao * sampleWeight * tapWeight;",
			"weightSum += sampleWeight * tapWeight;",

			"vec3 normal = unpackRGBToNormal(texture2D(tAONormal, tapUv).rgb);",
			"float norm_weight = pow(abs(dot(normal, centerNormal)), 32.0);",
			"float normalCloseness = dot(normal, centerNormal);",
      "normalCloseness = normalCloseness*normalCloseness;",
      "normalCloseness = normalCloseness*normalCloseness;",
      "float k_normal = 4.0;",
      "float normalError = (1.0 - normalCloseness) * k_normal;",
      "norm_weight = max((1.0 - edgeSharpness * normalError), 0.00);",

			"aoSum += ao * sampleWeight * norm_weight;",
			"weightSum += sampleWeight * norm_weight;",
		"}",
		"float normpdf(in float x, in float sigma)",
		"{",
			"return 0.39894*exp(-0.5*x*x/(sigma*sigma))/sigma;",
		"}",
		"void main() {",

			"float gaussian[KERNEL_SAMPLE_RADIUS + 1];",
    		"gaussian[0] = 0.153170;",
			"gaussian[1] = 0.144893;",
			"gaussian[2] = 0.122649;",
			"gaussian[3] = 0.092902;",
			"gaussian[4] = 0.062970;",

			"vec4 depthTexel = texture2D( tAODepth, vUv );",
			"float ao = depthTexel.r;",
			"depthTexel.r = 1.0;",
			"float depth = unpackRGBAToDepth( depthTexel );",
			"if( depth >= ( 1.0 - EPSILON ) ) {",
				"discard;",
			"}",

			"float centerViewZ = -getViewZ( depth );",

			"float weightSum = normpdf(0.0, 5.0);",
			"float aoSum = ao * weightSum;",

			"vec2 uvIncrement = ( kernelDirection / size ) * 2.0/sqrt(centerViewZ);",

			"vec2 rTapUv = vUv, lTapUv = vUv;",
			"float rWeight = 1.0, lWeight = 1.0;",
			"vec3 normalCenter = unpackRGBToNormal(texture2D(tAONormal, vUv).rgb);",

			"for( int i = 1; i <= 0; i ++ ) {",

				"float sampleWeight = normpdf(float(i), 5.0);",

				"rTapUv += uvIncrement;",
				"addTapInfluence( rTapUv, normalCenter, centerViewZ, sampleWeight, aoSum, rWeight, weightSum );",

				"lTapUv -= uvIncrement;",
				"addTapInfluence( lTapUv, normalCenter, centerViewZ, sampleWeight, aoSum, lWeight, weightSum );",

			"}",

			"ao = aoSum / weightSum;",
			"if( packOutput == 1 ) {",
				"gl_FragColor = depthTexel;",
				"gl_FragColor.r = ao;",
			"}",
			"else {",
				"gl_FragColor = vec4( vec3( ao ), 1.0 );",
			"}",
			"gl_FragColor = vec4( vec3( ao ), 1.0 );",

		"}"

	].join( "\n" )

};
