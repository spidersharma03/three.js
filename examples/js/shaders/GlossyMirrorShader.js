THREE.GlossyMirrorShader = {

	defines: {
		"SPECULAR_MAP": 0,
		"ROUGHNESS_MAP": 0,
		"GLOSSY_REFLECTIONS": 1,
		"REFLECTION_LOD_LEVELS": 4,
		"PERSPECTIVE_CAMERA": 1
	},

	uniforms: {

	 	"metalness": { type: "f", value: 0.0 },

	 	"specularColor": { type: "c", value: new THREE.Color( 0xffffff ) },
		"tSpecular": { type: "t", value: null },

		"tReflection": { type: "t", value: null },
		"tReflection1": { type: "t", value: null },
		"tReflection2": { type: "t", value: null },
		"tReflection3": { type: "t", value: null },
		"tReflection4": { type: "t", value: null },
		"tReflectionDepth": { type: "t", value: null },

		"roughness": { type: "f", value: 0.0 },
	 	"distanceFade": { type: "f", value: 0.01 },
	 	"fresnelStrength": { type: "f", value: 1.0 },

		"reflectionTextureMatrix" : { type: "m4", value: new THREE.Matrix4() },
		"mirrorCameraWorldMatrix": { type: "m4", value: new THREE.Matrix4() },
		"mirrorCameraProjectionMatrix": { type: "m4", value: new THREE.Matrix4() },
		"mirrorCameraInverseProjectionMatrix": { type: "m4", value: new THREE.Matrix4() },
		"mirrorCameraNear": { type: "f", value: 0 },
		"mirrorCameraFar": { type: "f", value: 0 },
		"screenSize": { type: "v2", value: new THREE.Vector2() },
		"mirrorNormal": { type: "v3", value: new THREE.Vector3() },
		"mirrorWorldPosition": { type: "v3", value: new THREE.Vector3() }
	},

	vertexShader: [

		"uniform mat4 reflectionTextureMatrix;",

		"varying vec4 mirrorCoord;",
		"varying vec3 vecPosition;",
		"varying vec3 worldNormal;",
		"varying vec2 vUv;",

		"void main() {",
			"vUv = uv;",
			"vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
			"vec4 worldPosition = modelMatrix * vec4( position, 1.0 );",
			"vecPosition = cameraPosition - worldPosition.xyz;",
			"worldNormal = (modelMatrix * vec4(normal,0.0)).xyz;",
			"mirrorCoord = reflectionTextureMatrix * worldPosition;",

			"gl_Position = projectionMatrix * mvPosition;",

		"}"

	].join( "\n" ),

	blending: THREE.NormalBlending,
	transparent: true,

	fragmentShader: [

		"#include <common>",
		"#include <packing>",
		"#include <bsdfs>",

		"uniform float roughness;",
		"#if ROUGHNESS_MAP == 1",
			"uniform sampler2D tRoughness;",
		"#endif",

		"uniform float metalness;",
		"uniform float distanceFade;",
		"uniform float fresnelStrength;",

		"uniform vec3 specularColor;",
		"#if SPECULAR_MAP == 1",
			"uniform sampler2D tSpecular;",
		"#endif",

		"uniform sampler2D tReflection;",
		"#if GLOSSY_REFLECTIONS == 1",
			"uniform sampler2D tReflection1;",
			"uniform sampler2D tReflection2;",
			"uniform sampler2D tReflection3;",
			"uniform sampler2D tReflection4;",
			"uniform sampler2D tReflectionDepth;",
		"#endif",

		"varying vec3 vecPosition;",
		"varying vec3 worldNormal;",
		"varying vec2 vUv;",

		"varying vec4 mirrorCoord;",
		"uniform mat4 mirrorCameraProjectionMatrix;",
 		"uniform mat4 mirrorCameraInverseProjectionMatrix;",
		"uniform mat4 mirrorCameraWorldMatrix;",
		"uniform float mirrorCameraNear;",
		"uniform float mirrorCameraFar;",
		"uniform vec2 screenSize;",
		"uniform vec3 mirrorNormal;",
		"uniform vec3 mirrorWorldPosition;",

		"#if GLOSSY_REFLECTIONS == 1",

			"float getReflectionDepth() {",

				"return unpackRGBAToDepth( texture2DProj( tReflectionDepth, mirrorCoord ) );",

	 		"}",

			"float getReflectionViewZ( const in float reflectionDepth ) {",
				"#if PERSPECTIVE_CAMERA == 1",
	 				"return perspectiveDepthToViewZ( reflectionDepth, mirrorCameraNear, mirrorCameraFar );",
				"#else",
					"return orthographicDepthToViewZ( reflectionDepth, mirrorCameraNear, mirrorCameraFar );",
				"#endif",
	 		"}",

	 		"vec3 getReflectionViewPosition( const in vec2 screenPosition, const in float reflectionDepth, const in float reflectionViewZ ) {",

	 			"float clipW = mirrorCameraProjectionMatrix[2][3] * reflectionViewZ + mirrorCameraProjectionMatrix[3][3];",
	 			"vec4 clipPosition = vec4( ( vec3( screenPosition, reflectionDepth ) - 0.5 ) * 2.0, 1.0 );",
	 			"clipPosition *= clipW;", // unprojection.
				"return ( mirrorCameraInverseProjectionMatrix * clipPosition ).xyz;",

	 		"}",

		"#endif",

		"vec4 getReflection( const in vec4 mirrorCoord, const in float lodLevel ) {",

			"#if GLOSSY_REFLECTIONS == 0",

				"return texture2DProj( tReflection, mirrorCoord );",

			"#else",

				"vec4 color0, color1;",
				"float alpha;",

				"if( lodLevel < 1.0 ) {",
					"color0 = texture2DProj( tReflection, mirrorCoord );",
					"color1 = texture2DProj( tReflection1, mirrorCoord );",
					"alpha = lodLevel;",
				"}",
				"else if( lodLevel < 2.0) {",
					"color0 = texture2DProj( tReflection1, mirrorCoord );",
					"color1 = texture2DProj( tReflection2, mirrorCoord );",
					"alpha = lodLevel - 1.0;",
				"}",
				"else if( lodLevel < 3.0 ) {",
					"color0 = texture2DProj( tReflection2, mirrorCoord );",
					"color1 = texture2DProj( tReflection3, mirrorCoord );",
					"alpha = lodLevel - 2.0;",
				"}",
				"else {",
					"color0 = texture2DProj( tReflection3, mirrorCoord );",
					"color1 = color0;",
					"alpha = 0.0;",
				"}",

				"return mix( color0, color1, alpha );",

			"#endif",

		"}",

		"void main() {",

			"vec3 specular = specularColor;",
			"#if SPECULAR_MAP == 1",
				"specular *= texture2D( tSpecular, vUv );",
			"#endif",

			"float fade = 1.0;",

			"#if GLOSSY_REFLECTIONS == 1",

				"float localRoughness = roughness;",
				"#if ROUGHNESS_MAP == 1",
					"localRoughness *= texture2D( tRoughness, vUv ).r;",
				"#endif",

				"vec2 screenPosition = gl_FragCoord.xy / screenSize;",
				"float reflectionDepth = getReflectionDepth();",
				"float reflectionViewZ = getReflectionViewZ( reflectionDepth );",

				"vec3 reflectionViewPosition = getReflectionViewPosition( screenPosition, reflectionDepth, reflectionViewZ );",
				"vec3 reflectionWorldPosition = ( mirrorCameraWorldMatrix * vec4( reflectionViewPosition, 1.0 ) ).xyz;",

				"vec3 closestPointOnMirror = projectOnPlane( reflectionWorldPosition, mirrorWorldPosition, mirrorNormal );",


				"vec3 pointOnMirror = linePlaneIntersect( cameraPosition, normalize( reflectionWorldPosition - cameraPosition ), mirrorWorldPosition, mirrorNormal );",
				"float distance = length( closestPointOnMirror - reflectionWorldPosition );",


				"localRoughness = localRoughness * distance * 0.2;",
				"float lodLevel = localRoughness;",

				"fade = 1.0 - ( distanceFade * distance );",
			"#else",

				"float lodLevel = 0.0;",

			"#endif",

			"vec4 reflection = getReflection( mirrorCoord, lodLevel );",

			// apply dieletric-conductor model parameterized by metalness parameter.
			"float dotNV = clamp( dot( normalize( worldNormal ), normalize( vecPosition ) ), EPSILON, 1.0 );",
			"specular = mix( vec3( 0.05 ), specular, metalness );",
			// TODO: Invert fresnel.
			"vec3 fresnel;",
			"if( fresnelStrength < 0.0 ) {",
				"fresnel = mix( specular, specular * pow( dotNV, 2.0 ), -fresnelStrength ) * pow( 1.0 - roughness, 2.0 );",
			"} else {",
				"fresnel = mix( specular, F_Schlick( specular, dotNV ), fresnelStrength ) * pow( 1.0 - roughness, 2.0 );",
			"}",
			"gl_FragColor = vec4( reflection.rgb, fresnel * fade * reflection.a );", // fresnel controls alpha


		"}"

		].join( "\n" )

};