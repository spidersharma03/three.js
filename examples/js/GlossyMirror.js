/**
 * @author spidersharma03
 * @author bhouston / Ben Houston / ben@clara.io
 */

THREE.GlossyMirror = function ( renderer, camera, options ) {

	THREE.Object3D.call( this );

	this.name = 'mirror_' + this.id;

	options = options || {};

	this.matrixNeedsUpdate = true;

	var width = options.textureWidth !== undefined ? options.textureWidth : 1024;
	var height = options.textureHeight !== undefined ? options.textureHeight : 1024;

	this.distanceFade = 0.1;
	this.metalness = 0.0;
	this.specularColor = new THREE.Color( 0xffffff );
	this.roughness = 0.0;
	this.reflectivity = 0.5;
	
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

	this.reflectionTextureMatrix = new THREE.Matrix4();

	var parameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: false };

	this.reflectionRenderTarget = new THREE.WebGLRenderTarget( width, height, parameters );

	this.reflectionMaterial = new THREE.ShaderMaterial( THREE.ReflectionShader );
	this.reflectionMaterial.defines = THREE.UniformsUtils.cloneDefines( this.reflectionMaterial.defines );
	this.reflectionMaterial.uniforms = THREE.UniformsUtils.clone( this.reflectionMaterial.uniforms );
	this.reflectionMaterial.uniforms.reflectionTextureMatrix.value = this.reflectionTextureMatrix;

	if ( ! THREE.Math.isPowerOfTwo( width ) || ! THREE.Math.isPowerOfTwo( height ) ) {

		this.reflectionRenderTarget.texture.generateMipmaps = false;

	}

	this.clipPlane = new THREE.Plane(new THREE.Vector3(0,0,1), 0);
	this.originalClipPlane = this.clipPlane.clone();
	this.falseClipPlane = new THREE.Plane(new THREE.Vector3(0,0,1), 10000);

	this.depthMaterial = new THREE.MeshDepthMaterial();
 	this.depthMaterial.depthPacking = THREE.RGBADepthPacking;
 	this.depthMaterial.blending = THREE.NoBlending;

	this.depthRenderTarget = new THREE.WebGLRenderTarget( width, height,
 					{ minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat } );
	this.depthRenderTarget.texture.generateMipmaps = false;
	

  	this.reflectionMaterial.uniforms.screenSize.value = new THREE.Vector2(width, height);

	this.initBlurrer();

	this.reflectionMaterial.uniforms.tReflectionDepth.value = this.depthRenderTarget.texture;

	this.reflectionMaterial.uniforms.tReflection.value = this.reflectionRenderTarget.texture;
	this.reflectionMaterial.uniforms.tReflection1.value = this.reflectionMipMapRenderTarget[0].texture;
	this.reflectionMaterial.uniforms.tReflection2.value = this.reflectionMipMapRenderTarget[1].texture;
	this.reflectionMaterial.uniforms.tReflection3.value = this.reflectionMipMapRenderTarget[2].texture;
	this.reflectionMaterial.uniforms.tReflection4.value = this.reflectionMipMapRenderTarget[3].texture;


};

THREE.GlossyMirror.prototype = Object.assign( Object.create( THREE.Object3D.prototype ), {

	constructor: THREE.GlossyMirror,

	initBlurrer: function() {

		this.numMipMaps = 4;

		this.reflectionMipMapRenderTarget = [];
		this.tempRenderTargets = [];

		var parameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: false };

		var width = this.reflectionRenderTarget.width/2, height = this.reflectionRenderTarget.height/2;

		for( var i=0; i<this.numMipMaps; i++) {

			var renderTarget = new THREE.WebGLRenderTarget( width, height, parameters );
			renderTarget.texture.generateMipmaps = false;
			this.reflectionMipMapRenderTarget.push(renderTarget);

			var renderTarget = new THREE.WebGLRenderTarget( width, height, parameters );
			renderTarget.texture.generateMipmaps = false;
			this.tempRenderTargets.push(renderTarget);

			width /= 2; height /= 2;
		}

		this.vBlurMaterial = new THREE.ShaderMaterial( THREE.BlurShader );
		this.vBlurMaterial.side = THREE.DoubleSide;
		this.vBlurMaterial.uniforms[ 'size' ].value.set( this.reflectionRenderTarget.width/2, this.reflectionRenderTarget.height/2 );
		this.vBlurMaterial.blending = THREE.NoBlending;
		THREE.BlurShaderUtils.configure( this.vBlurMaterial, 5, 3.0, new THREE.Vector2( 0, 1 ) );

		this.hBlurMaterial = this.vBlurMaterial.clone();
		this.hBlurMaterial.side = THREE.DoubleSide;
		this.hBlurMaterial.uniforms[ 'size' ].value.set( this.reflectionRenderTarget.width/2, this.reflectionRenderTarget.height/2 );
		this.hBlurMaterial.blending = THREE.NoBlending;
		THREE.BlurShaderUtils.configure( this.hBlurMaterial, 5, 3.0, new THREE.Vector2( 1, 0 ) );
	},

	updateBlurrer: function( renderer ) {

		var clearColor = renderer.getClearColor(), clearAlpha = renderer.getClearAlpha();		
		renderer.setClearColor(0x000000, 0.0);

		var currentReflectionRenderTarget = this.reflectionRenderTarget;
		for( var i=0; i<this.numMipMaps; i++) {
			var nextReflectionRenderTarget = this.reflectionMipMapRenderTarget[i];
			var tempRenderTarget = this.tempRenderTargets[i];

			this.hBlurMaterial.uniforms[ 'size' ].value.set( currentReflectionRenderTarget.width, currentReflectionRenderTarget.height );
			this.hBlurMaterial.uniforms[ "tDiffuse" ].value = currentReflectionRenderTarget.texture;
			renderer.renderPass( this.hBlurMaterial, this.cameraOrtho, tempRenderTarget, true);

			this.vBlurMaterial.uniforms[ 'size' ].value.set( tempRenderTarget.width, tempRenderTarget.height );
			this.vBlurMaterial.uniforms[ "tDiffuse" ].value = tempRenderTarget.texture;
			renderer.renderPass( this.vBlurMaterial, this.cameraOrtho, nextReflectionRenderTarget, true);

		 	currentReflectionRenderTarget = nextReflectionRenderTarget;
		}

		renderer.setClearColor(clearColor, clearAlpha);

	},

	updateReflectionTextureMatrix: function( camera ) {

		this.updateMatrixWorld();
	
		this.mirrorWorldPosition.setFromMatrixPosition( this.matrixWorld );
		this.cameraWorldPosition.setFromMatrixPosition( camera.matrixWorld );

		this.rotationMatrix.extractRotation( this.matrixWorld );

		this.normal.set( 0, 0, 1 );
		this.normal.applyMatrix4( this.rotationMatrix );

		var view = this.mirrorWorldPosition.clone().sub( this.cameraWorldPosition );
		view.reflect( this.normal ).negate();
		view.add( this.mirrorWorldPosition );

		this.rotationMatrix.extractRotation( camera.matrixWorld );

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

		this.reflectionMaterial.uniforms[ 'mirrorCameraProjectionMatrix' ].value = this.mirrorCamera.projectionMatrix;
		this.reflectionMaterial.uniforms[ 'mirrorCameraViewMatrix' ].value.getInverse( this.mirrorCamera.matrixWorldInverse );
		this.reflectionMaterial.uniforms[ 'mirrorCameraNear' ].value = this.mirrorCamera.near;
		this.reflectionMaterial.uniforms[ 'mirrorCameraFar' ].value = this.mirrorCamera.far;

		this.reflectionMaterial.uniforms[ 'mirrorNormal' ].value = this.normal;
		this.reflectionMaterial.uniforms[ 'mirrorWorldPosition' ].value = this.mirrorWorldPosition;

	},

	render: function ( renderer, scene, camera ) {

		if ( ! camera || ! ( camera instanceof THREE.PerspectiveCamera ) ) console.error( 'THREE.GlossyMirror: camera is not a Perspective Camera!' );
		if ( ! scene || ! ( scene instanceof THREE.Scene ) ) console.error( 'THREE.GlossyMirror: scene is not a Scene!' );

		renderer = renderer;
		if( ! renderer.clippingPlanes || renderer.clippingPlanes.length === 0 ) {
			renderer.clippingPlanes = [this.clipPlane];
		}


		if( ! this.mirrorCamera ) {
			this.mirrorCamera = camera.clone();
		}

		this.matrixNeedsUpdate = true;
		this.mirrorCamera.matrixAutoUpdate = true;

		//if ( this.matrixNeedsUpdate ) {
			this.updateReflectionTextureMatrix( camera );
		//}

		this.clipPlane.copy(this.originalClipPlane);
		this.clipPlane.applyMatrix4(this.matrixWorld);

		// We can't render ourself to ourself
		var visible = this.reflectionMaterial.visible;
		var clearColor = renderer.getClearColor(), clearAlpha = renderer.getClearAlpha();

		this.reflectionMaterial.visible = false;
		renderer.setClearAlpha( 0 );
		renderer.render( scene, this.mirrorCamera, this.reflectionRenderTarget, true );

		renderer.setClearColor(0xffffff, 1);
		renderer.renderOverride( this.depthMaterial, scene, this.mirrorCamera, this.depthRenderTarget, true );

		this.reflectionMaterial.visible = visible;
		renderer.setClearColor( clearColor, clearAlpha );

		this.reflectionMaterial.uniforms.distanceFade.value = this.distanceFade;
		this.reflectionMaterial.uniforms.metalness.value = this.metalness;
		this.reflectionMaterial.uniforms.specularColor.value = this.specularColor;
		this.reflectionMaterial.uniforms.roughness.value = this.roughness;
		this.reflectionMaterial.uniforms.reflectivity.value = this.reflectivity;
	
		if(this.clipPlane !== undefined) {

			this.clipPlane.copy(this.falseClipPlane);

		}

		this.updateBlurrer( renderer );
	}

} );