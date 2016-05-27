/**
 * @author spidersharma03
 */

THREE.ShaderLib[ 'mirror' ] = {

	defines: {
		"SPECULAR_MAP": 0,
		"ROUGHNESS_MAP": 0,
		"GLOSSY_REFLECTIONS": 0,
		"PERSPECTIVE_CAMERA": 1
	}
	uniforms: {

	 	"specularColor": { type: "c", value: new THREE.Color( 0x7F7F7F ) },
		"tSpecular": { type: "t", value: null },

		"tReflection": { type: "t", value: null },
		"tReflection1": { type: "t", value: null },
		"tReflection2": { type: "t", value: null },
		"tReflection3": { type: "t", value: null },
		"tReflection4": { type: "t", value: null },
		"tDepth": { type: "t", value: null },

		"roughness": { type: "f", value: 0 },

		"textureMatrix" : { type: "m4", value: new THREE.Matrix4() },
		"cameraViewMatrix": { type: "m4", value: new THREE.Matrix4() },
		"cameraProjectionMatrix": { type: "m4", value: new THREE.Matrix4() },
		"cameraInverseProjectionMatrix": { type: "m4", value: new THREE.Matrix4() },
		"cameraNear": { type: "f", value: 0 },
		"cameraFar": { type: "f", value: 0 },
		"screenSize": { type: "v2", value: new THREE.Vector2() },
		"mirrorNormal": { type: "v3", value: new THREE.Vector3() },
		"mirrorWorldPosition": { type: "v3", value: new THREE.Vector3() }
	},

	vertexShader: [

		"uniform mat4 textureMatrix;",

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
			"mirrorCoord = textureMatrix * worldPosition;",

			"gl_Position = projectionMatrix * mvPosition;",

		"}"

	].join( "\n" ),

	fragmentShader: [

		"#include <common>",
		"#include <packing>",

		"uniform vec3 roughness;",
		"#if ROUGHNESS_MAP == 1",
			"uniform sampler2D tRoughness;",
		"#endif",

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
			"uniform sampler2D tDepth;",
		"#endif",

		"varying vec3 vecPosition;",
		"varying vec3 worldNormal;",
		"varying vec2 vUv;",

		"varying vec4 mirrorCoord;",
		"uniform mat4 cameraProjectionMatrix;",
 		"uniform mat4 cameraInverseProjectionMatrix;",
		"uniform mat4 cameraViewMatrix;",
		"uniform float cameraNear;",
		"uniform float cameraFar;",
		"uniform vec2 screenSize;",
		"uniform vec3 mirrorNormal;",
		"uniform vec3 mirrorWorldPosition;",

		"const float roughnessGradient = 0.05;",

		"float getDepth() {",

			"return unpackRGBAToDepth( texture2DProj( tDepth, mirrorCoord ) );",

 		"}",

		"float getViewZ( const in float depth ) {",
			"#if PERSPECTIVE_CAMERA == 1",
 				"return perspectiveDepthToViewZ( depth, cameraNear, cameraFar );",
			"#else",
				"return orthographicDepthToViewZ( depth, cameraNear, cameraFar );",
			"#endif",
 		"}",

		"vec3 getWorldPosition( const in vec2 screenPosition, const in float depth, const in float viewZ ) {",

 			"float clipW = cameraProjectionMatrix[2][3] * viewZ + cameraProjectionMatrix[3][3];",
 			"vec4 clipPosition = vec4( ( vec3( screenPosition, depth ) - 0.5 ) * 2.0, 1.0 );",
 			"clipPosition *= clipW;", // unprojection.
			"vec4 temp = cameraInverseProjectionMatrix * clipPosition;",
 			"return ( cameraViewMatrix * temp ).xyz;",

 		"}",

		"vec3 SchlickApproxFresenel( vec3 f0, float NdotV ) {",

				"float schlick = pow(1.0 - (NdotV), 5.0);",
				"return f0 * ( 1.0 - schlick) + schlick;",

		"}",

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
				"else if( lodLevel > 3.0 ) {",
					"color0 = texture2DProj( tReflection2, mirrorCoord );",
					"color1 = texture2DProj( tReflection3, mirrorCoord );",
					"alpha = lodLevel - 3.0;",
				"}",
				"else {",
					"color0 = texture2DProj( tReflection3, mirrorCoord );",
					"color1 = vec4( 0.0 );",
					"alpha = 1.0;",
				"}",

				"return mix( color0, color1, alpha );"

			"#endif",

		"}",

		"vec4 sampleMirror(vec3 sampleWorldPosition) {",

			"vec3 closestPointOnMirror = projectOnPlane(sampleWorldPosition, mirrorWorldPosition, mirrorNormal );",
			"vec3 pointOnMirror = linePlaneIntersect(cameraPosition, normalize(sampleWorldPosition - cameraPosition), mirrorWorldPosition, mirrorNormal);",
			"float distance = length(closestPointOnMirror - sampleWorldPosition);",

			"vec4 specular = specularColor;",
			"#if SPECULAR_MAP == 1",
				"specular *= texture2D( tSpecular, vUv );",
			"#endif",

			"float localRoughness = roughness;",
			"#if ROUGHNESS_MAP == 1",
				"localRoughness *= texture2D( tRoughness, vUv );",
			"#endif",

			"localRoughness += distance * roughnessGradient;",

			"float lodLevel = REFLECTION_LOD_LEVELS * ( distance * roughnessGradient + localRoughness );",
			"vec4 reflection = getReflection( mirrorCoord, lodLevel );",

			"float NdotV = dot( normalize( worldNormal ), normalize( vecPosition ) );",

			"float fresnelReflection = SchlickApproxFresenel( specular1, NdotV );",
		  "return fresnelReflection * reflectionColor;",

			"return vec4(outColor);",
		"}",

		"void main() {",

			"vec2 screenPos = gl_FragCoord.xy / screenSize;",
			"float sampleDepth = getDepth();",
			"float sampleViewZ = getViewZ( sampleDepth );",
			"vec3 sampleWorldPosition = getWorldPosition( screenPos, sampleDepth, sampleViewZ );",
			"vec4 color = sampleMirror( sampleWorldPosition );",

			"gl_FragColor = color;",

		"}"

		].join( "\n" )

};

THREE.Mirror = function ( renderer, camera, options ) {

	THREE.Object3D.call( this );

	this.name = 'mirror_' + this.id;

	options = options || {};

	this.matrixNeedsUpdate = true;

	var width = options.textureWidth !== undefined ? options.textureWidth : 512;
	var height = options.textureHeight !== undefined ? options.textureHeight : 512;

	this.renderer = renderer;

	this.mirrorPlane = new THREE.Plane();
	this.normal = new THREE.Vector3( 0, 0, 1 );
	this.mirrorWorldPosition = new THREE.Vector3();
	this.cameraWorldPosition = new THREE.Vector3();
	this.rotationMatrix = new THREE.Matrix4();
	this.lookAtPosition = new THREE.Vector3( 0, 0, - 1 );

	// For debug only, show the normal and plane of the mirror
	var debugMode = options.debugMode !== undefined ? options.debugMode : false;

	if ( debugMode ) {

		var arrow = new THREE.ArrowHelper( new THREE.Vector3( 0, 0, 1 ), new THREE.Vector3( 0, 0, 0 ), 10, 0xffff80 );
		var planeGeometry = new THREE.Geometry();
		planeGeometry.vertices.push( new THREE.Vector3( - 10, - 10, 0 ) );
		planeGeometry.vertices.push( new THREE.Vector3( 10, - 10, 0 ) );
		planeGeometry.vertices.push( new THREE.Vector3( 10, 10, 0 ) );
		planeGeometry.vertices.push( new THREE.Vector3( - 10, 10, 0 ) );
		planeGeometry.vertices.push( planeGeometry.vertices[ 0 ] );
		var plane = new THREE.Line( planeGeometry, new THREE.LineBasicMaterial( { color: 0xffff80 } ) );

		this.add( arrow );
		this.add( plane );

	}

	if ( camera instanceof THREE.PerspectiveCamera ) {

		this.camera = camera;

	} else {

		this.camera = new THREE.PerspectiveCamera();
		console.log( this.name + ': camera is not a Perspective Camera!' );

	}

	this.textureMatrix = new THREE.Matrix4();

	this.mirrorCamera = this.camera.clone();
	this.mirrorCamera.matrixAutoUpdate = true;

	var parameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBFormat, stencilBuffer: false };

	this.texture = new THREE.WebGLRenderTarget( width, height, parameters );
	this.tempTexture = new THREE.WebGLRenderTarget( width, height, parameters );

	var mirrorShader = THREE.ShaderLib[ "mirror" ];
	var mirrorUniforms = THREE.UniformsUtils.clone( mirrorShader.uniforms );

	this.material = new THREE.ShaderMaterial( {

		fragmentShader: mirrorShader.fragmentShader,
		vertexShader: mirrorShader.vertexShader,
		uniforms: mirrorUniforms

	} );

	this.material.uniforms.mirrorSampler0.value = this.texture;
	this.material.uniforms.textureMatrix.value = this.textureMatrix;

	if ( ! THREE.Math.isPowerOfTwo( width ) || ! THREE.Math.isPowerOfTwo( height ) ) {

		this.texture.generateMipmaps = false;
		this.tempTexture.generateMipmaps = false;

	}

	this.updateTextureMatrix();
	this.render();

	this.clipPlane = new THREE.Plane(new THREE.Vector3(0,0,1), 0);
	this.renderer.clippingPlanes = [this.clipPlane];
	this.originalClipPlane = this.clipPlane.clone();
	this.falseClipPlane = new THREE.Plane(new THREE.Vector3(0,0,1), 10000);

	this.depthMaterial = new THREE.MeshDepthMaterial();
 	this.depthMaterial.depthPacking = THREE.RGBADepthPacking;
 	this.depthMaterial.blending = THREE.NoBlending;

	this.depthRenderTarget = new THREE.WebGLRenderTarget( width, height,
 					{ minFilter: THREE.LinearFilter, magFilter: THREE.NearesFilter, format: THREE.RGBAFormat } );
	this.material.uniforms.depthSampler.value = this.depthRenderTarget;

	this.material.uniforms[ 'cameraInverseProjectionMatrix' ].value.getInverse( this.camera.projectionMatrix );
	this.material.uniforms[ 'cameraProjectionMatrix' ].value = this.camera.projectionMatrix;
	this.material.uniforms[ 'cameraNear' ].value = this.camera.near;
	this.material.uniforms[ 'cameraFar' ].value = this.camera.far;
  this.material.uniforms[ 'screenSize' ].value = new THREE.Vector2(width, height);

	this.mirrorHelper = new THREE.MirrorHelper(this);

	this.material.uniforms.mirrorSampler0.value = this.texture;
	this.material.uniforms.mirrorSampler1.value = this.mirrorHelper.mirrorTextureMipMaps[0];
	this.material.uniforms.mirrorSampler2.value = this.mirrorHelper.mirrorTextureMipMaps[1];
	this.material.uniforms.mirrorSampler3.value = this.mirrorHelper.mirrorTextureMipMaps[2];
	this.material.uniforms.mirrorSampler4.value = this.mirrorHelper.mirrorTextureMipMaps[3];

	//var loader = new THREE.TextureLoader();
  //this.diffuseTexture = loader.load("textures/crop_wood-090.jpg");
	//this.material.uniforms[ 'diffuseTexture' ].value = this.diffuseTexture;
};

THREE.Mirror.prototype = Object.create( THREE.Object3D.prototype );
THREE.Mirror.prototype.constructor = THREE.Mirror;

THREE.Mirror.prototype.updateTextureMatrix = function () {

	this.updateMatrixWorld();
	this.camera.updateMatrixWorld();

	this.mirrorWorldPosition.setFromMatrixPosition( this.matrixWorld );
	this.cameraWorldPosition.setFromMatrixPosition( this.camera.matrixWorld );

	this.rotationMatrix.extractRotation( this.matrixWorld );

	this.normal.set( 0, 0, 1 );
	this.normal.applyMatrix4( this.rotationMatrix );

	var view = this.mirrorWorldPosition.clone().sub( this.cameraWorldPosition );
	view.reflect( this.normal ).negate();
	view.add( this.mirrorWorldPosition );

	this.rotationMatrix.extractRotation( this.camera.matrixWorld );

	this.lookAtPosition.set( 0, 0, - 1 );
	this.lookAtPosition.applyMatrix4( this.rotationMatrix );
	this.lookAtPosition.add( this.cameraWorldPosition );

	var target = this.mirrorWorldPosition.clone().sub( this.lookAtPosition );
	target.reflect( this.normal ).negate();
	target.add( this.mirrorWorldPosition );

	this.up.set( 0, - 1, 0 );
	this.up.applyMatrix4( this.rotationMatrix );
	this.up.reflect( this.normal ).negate();

	this.mirrorCamera.position.copy( view );
	this.mirrorCamera.up = this.up;
	this.mirrorCamera.lookAt( target );

	this.mirrorCamera.updateProjectionMatrix();
	this.mirrorCamera.updateMatrixWorld();
	this.mirrorCamera.matrixWorldInverse.getInverse( this.mirrorCamera.matrixWorld );

	// Update the texture matrix
	this.textureMatrix.set( 0.5, 0.0, 0.0, 0.5,
							0.0, 0.5, 0.0, 0.5,
							0.0, 0.0, 0.5, 0.5,
							0.0, 0.0, 0.0, 1.0 );
	this.textureMatrix.multiply( this.mirrorCamera.projectionMatrix );
	this.textureMatrix.multiply( this.mirrorCamera.matrixWorldInverse );

	this.mirrorPlane.setFromNormalAndCoplanarPoint( this.normal, this.mirrorWorldPosition );
	this.mirrorPlane.applyMatrix4( this.mirrorCamera.matrixWorldInverse );

	this.material.uniforms[ 'cameraViewMatrix' ].value.getInverse( this.camera.matrixWorldInverse );
	this.material.uniforms[ 'cameraNear' ].value = this.mirrorCamera.near;
	this.material.uniforms[ 'cameraFar' ].value = this.mirrorCamera.far;

	this.material.uniforms[ 'mirrorNormal' ].value = this.normal;
	this.material.uniforms[ 'mirrorWorldPosition' ].value = this.mirrorWorldPosition;
};

THREE.Mirror.prototype.render = function () {

	if ( this.matrixNeedsUpdate ) this.updateTextureMatrix();

	this.matrixNeedsUpdate = true;

	// Render the mirrored view of the current scene into the target texture
	var scene = this;

	while ( scene.parent !== null ) {

		scene = scene.parent;

	}

	if(this.clipPlane !== undefined) {

		this.clipPlane.copy(this.originalClipPlane);

		this.clipPlane.applyMatrix4(this.matrixWorld);
	}

	if ( scene !== undefined && scene instanceof THREE.Scene ) {

		// We can't render ourself to ourself
		var visible = this.material.visible;
		this.material.visible = false;

		this.renderer.render( scene, this.mirrorCamera, this.texture, true );

		this.material.visible = visible;

	}
	scene.overrideMaterial = this.depthMaterial;

	var visible = this.material.visible;

	this.renderer.setClearColor(0xffffff, 1);

	this.material.visible = false;

	this.renderer.render( scene, this.mirrorCamera, this.depthRenderTarget, true );

	scene.overrideMaterial = null;

	this.material.visible = visible;

	if(this.clipPlane !== undefined) {

		this.clipPlane.copy(this.falseClipPlane);

	}
	if(this.mirrorHelper !== undefined) {

		this.mirrorHelper.update(this.renderer);

	}
};

THREE.Mirror.prototype.renderTemp = function () {

	if ( this.matrixNeedsUpdate ) this.updateTextureMatrix();

	this.matrixNeedsUpdate = true;

	// Render the mirrored view of the current scene into the target texture
	var scene = this;

	while ( scene.parent !== null ) {

		scene = scene.parent;

	}

	if ( scene !== undefined && scene instanceof THREE.Scene ) {

		this.renderer.render( scene, this.mirrorCamera, this.tempTexture, true );

	}

};
