/**
 * @author spidersharma03
 */

THREE.ShaderLib[ 'mirror' ] = {

	uniforms: { "mirrorColor": { type: "c", value: new THREE.Color( 0x7F7F7F ) },
				"mirrorSampler0": { type: "t", value: null },
				"mirrorSampler1": { type: "t", value: null },
				"mirrorSampler2": { type: "t", value: null },
				"mirrorSampler3": { type: "t", value: null },
				"mirrorSampler4": { type: "t", value: null },
				"depthSampler": { type: "t", value: null },
				"diffuseTexture": { type: "t", value: null },
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
		"uniform vec3 mirrorColor;",
		"uniform sampler2D mirrorSampler0;",
		"uniform sampler2D mirrorSampler1;",
		"uniform sampler2D mirrorSampler2;",
		"uniform sampler2D mirrorSampler3;",
		"uniform sampler2D mirrorSampler4;",
		"uniform sampler2D depthSampler;",
		"uniform sampler2D diffuseTexture;",
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

		"const float roughnessOffset   = 0.025;",
		"const float roughnessGradient = 0.05;",

		"float getDepth() {",
				"return unpackRGBAToDepth(texture2DProj( depthSampler, mirrorCoord ));",
 		"}",

		"float getViewZ( const in float depth ) {",
 				"return perspectiveDepthToViewZ( depth, cameraNear, cameraFar );",
 		"}",

		"vec3 getWorldPosition( const in vec2 screenPosition, const in float depth, const in float viewZ ) {",
 			"float clipW = cameraProjectionMatrix[2][3] * viewZ + cameraProjectionMatrix[3][3];",
 			"vec4 clipPosition = vec4( ( vec3( screenPosition, depth ) - 0.5 ) * 2.0, 1.0 );",
 			"clipPosition *= clipW;", // unprojection.
			"vec4 temp = cameraInverseProjectionMatrix * clipPosition;",
 			"return ( cameraViewMatrix * temp ).xyz;",
 		"}",

		"float SchlickApproxFresenel(float a, float NdotV) {",
				"float schlick = pow(1.0 - (NdotV), 5.0);",
				"return a * ( 1.0 - schlick) + schlick;",
		"}",

		"vec4 sampleMirror(vec3 sampleWorldPosition) {",
			"vec4 color1;",
		  "vec4 color2;",
	  	"float t = 0.0;",
			"vec3 closestPointOnMirror = projectOnPlane(sampleWorldPosition, mirrorWorldPosition, mirrorNormal );",
			"vec3 pointOnMirror = linePlaneIntersect(cameraPosition, normalize(sampleWorldPosition - cameraPosition), mirrorWorldPosition, mirrorNormal);",
			"float d = length(closestPointOnMirror - sampleWorldPosition);",
			"vec4 colorDiffuse = texture2D(diffuseTexture, vUv);",
			"float sampleDepth = d * roughnessGradient + roughnessOffset;",
			"if( sampleDepth <= 0.25) {",
				"color1 = texture2DProj(mirrorSampler0, mirrorCoord);",
				"color2 = texture2DProj(mirrorSampler1, mirrorCoord);",
				"t = sampleDepth;",
			"}",
			"else if(sampleDepth > 0.25 && sampleDepth <= 0.5) {",
				"color1 = texture2DProj(mirrorSampler1, mirrorCoord);",
				"color2 = texture2DProj(mirrorSampler2, mirrorCoord);",
				"t = (sampleDepth - 0.25);",
			"}",
			"else if(sampleDepth > 0.5 && sampleDepth <= 0.75) {",
				"color1 = texture2DProj(mirrorSampler2, mirrorCoord);",
				"color2 = texture2DProj(mirrorSampler3, mirrorCoord);",
				"t = (sampleDepth - 0.5);",
			"}",
			"else {",
				"color1 = texture2DProj(mirrorSampler3, mirrorCoord);",
				"color2 = texture2DProj(mirrorSampler4, mirrorCoord);",
				"t = (sampleDepth - 0.75);",
			"}",
			"t *= 4.0; // Assuming the above hardcoded range",
			"t = t>1.0 ? 1.0: t;",
			"float NdotV = dot(normalize(worldNormal), normalize(vecPosition));",
			"float schlick = SchlickApproxFresenel(0.1, NdotV);",
		   "vec4 outColor = colorDiffuse * (1.0 - schlick) + schlick * ((1.0 - t) * color1 + color2 * t);",
			 "return vec4(outColor);",
		"}",

		"void main() {",
			"vec2 screenPos = gl_FragCoord.xy/screenSize;",
			"float sampleDepth = getDepth();",
			"float sampleViewZ = getViewZ( sampleDepth );",
			"vec3 sampleWorldPosition = getWorldPosition( screenPos, sampleDepth, sampleViewZ );",
			"vec4 color = sampleMirror(sampleWorldPosition);",
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

	var loader = new THREE.TextureLoader();
  this.diffuseTexture = loader.load("textures/crop_wood-090.jpg");
	this.material.uniforms[ 'diffuseTexture' ].value = this.diffuseTexture;
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
