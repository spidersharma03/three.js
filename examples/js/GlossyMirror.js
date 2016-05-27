/**
 * @author spidersharma03
 * @author bhouston / Ben Houston / ben@clara.io
 */

console.trace( "here1");

THREE.GlossyMirror = function ( renderer, camera, options ) {

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

	this.reflectionTextureMatrix = new THREE.Matrix4();

	this.mirrorCamera = this.camera.clone();
	this.mirrorCamera.matrixAutoUpdate = true;

	var parameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBFormat, stencilBuffer: false };

	this.texture = new THREE.WebGLRenderTarget( width, height, parameters );
	this.tempTexture = new THREE.WebGLRenderTarget( width, height, parameters );

	this.material = new THREE.ShaderMaterial( THREE.GlossyMirrorShader );
	this.material.defines = THREE.UniformsUtils.cloneDefines( this.material.defines );
	this.material.uniforms = THREE.UniformsUtils.clone( this.material.uniforms );
	this.material.uniforms.tReflection.value = this.texture;
	this.material.uniforms.reflectionTextureMatrix.value = this.reflectionTextureMatrix;

	if ( ! THREE.Math.isPowerOfTwo( width ) || ! THREE.Math.isPowerOfTwo( height ) ) {

		this.texture.generateMipmaps = false;
		this.tempTexture.generateMipmaps = false;

	}

	this.updateReflectionTextureMatrix();
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
	this.material.uniforms.tReflectionDepth.value = this.depthRenderTarget;

	this.material.uniforms[ 'mirrorCameraInverseProjectionMatrix' ].value.getInverse( this.camera.projectionMatrix );
	this.material.uniforms[ 'mirrorCameraProjectionMatrix' ].value = this.camera.projectionMatrix;
	this.material.uniforms[ 'mirrorCameraNear' ].value = this.camera.near;
	this.material.uniforms[ 'mirrorCameraFar' ].value = this.camera.far;
  	this.material.uniforms[ 'screenSize' ].value = new THREE.Vector2(width, height);

	this.mirrorHelper = new THREE.MirrorHelper(this);

	this.material.uniforms.tReflection.value = this.texture;
	this.material.uniforms.tReflection1.value = this.mirrorHelper.mirrorTextureMipMaps[0];
	this.material.uniforms.tReflection2.value = this.mirrorHelper.mirrorTextureMipMaps[1];
	this.material.uniforms.tReflection3.value = this.mirrorHelper.mirrorTextureMipMaps[2];
	this.material.uniforms.tReflection4.value = this.mirrorHelper.mirrorTextureMipMaps[3];

};

console.trace( "here");
console.log( "here3");

THREE.GlossyMirror.prototype = Object.assign( Object.create( THREE.Object3D.prototype ), {

	constructor: THREE.GlossyMirror,

	updateReflectionTextureMatrix: function () {

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
		this.reflectionTextureMatrix.set( 0.5, 0.0, 0.0, 0.5,
								0.0, 0.5, 0.0, 0.5,
								0.0, 0.0, 0.5, 0.5,
								0.0, 0.0, 0.0, 1.0 );
		this.reflectionTextureMatrix.multiply( this.mirrorCamera.projectionMatrix );
		this.reflectionTextureMatrix.multiply( this.mirrorCamera.matrixWorldInverse );

		this.mirrorPlane.setFromNormalAndCoplanarPoint( this.normal, this.mirrorWorldPosition );
		this.mirrorPlane.applyMatrix4( this.mirrorCamera.matrixWorldInverse );

		this.material.uniforms[ 'mirrorCameraViewMatrix' ].value.getInverse( this.camera.matrixWorldInverse );
		this.material.uniforms[ 'mirrorCameraNear' ].value = this.mirrorCamera.near;
		this.material.uniforms[ 'mirrorCameraFar' ].value = this.mirrorCamera.far;

		this.material.uniforms[ 'mirrorNormal' ].value = this.normal;
		this.material.uniforms[ 'mirrorWorldPosition' ].value = this.mirrorWorldPosition;
	},

	render: function () {

		if ( this.matrixNeedsUpdate ) this.updateReflectionTextureMatrix();

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
	},

	renderTemp: function () {

		if ( this.matrixNeedsUpdate ) this.updateReflectionTextureMatrix();

		this.matrixNeedsUpdate = true;

		// Render the mirrored view of the current scene into the target texture
		var scene = this;

		while ( scene.parent !== null ) {

			scene = scene.parent;

		}

		if ( scene !== undefined && scene instanceof THREE.Scene ) {

			this.renderer.render( scene, this.mirrorCamera, this.tempTexture, true );

		}

	}
} );