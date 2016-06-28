/**
 * @author spidersharma03
 * @author bhouston / Ben Houston / ben@clara.io
 */

THREE.MirrorHelper = function(mirror) {
  this.scene = new THREE.Scene();
  this.cameraOrtho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
  this.scene.add(this.quad);
  this.mirror = mirror;
  this.numMipMaps = 4;
	

  this.mirrorTextureMipMaps = [];
  this.tempRenderTargets = [];
  var parameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: false };
  var mirrorTexture = mirror.mirrorRenderTarget;
  var width = mirrorTexture.width/2, height = mirrorTexture.height/2;
  for( var i=0; i<this.numMipMaps; i++) {
    var renderTarget = new THREE.WebGLRenderTarget( width, height, parameters );
    renderTarget.texture.generateMipmaps = false;
    this.mirrorTextureMipMaps.push(renderTarget);
    width /= 2; height /= 2;
  }

  width = mirrorTexture.width/2; height = mirrorTexture.height/2;
  for( var i=0; i<this.numMipMaps; i++) {
    var renderTarget = new THREE.WebGLRenderTarget( width, height, parameters );
    renderTarget.texture.generateMipmaps = false;
    this.tempRenderTargets.push(renderTarget);
    width /= 2; height /= 2;
  }

  this.vBlurMaterial = new THREE.ShaderMaterial( THREE.BlurShader );
  this.vBlurMaterial.side = THREE.DoubleSide;
  this.vBlurMaterial.uniforms[ 'size' ].value.set( mirrorTexture.width/2, mirrorTexture.height/2 );
  this.vBlurMaterial.blending = THREE.NoBlending;
  THREE.BlurShaderUtils.configure( this.vBlurMaterial, 5, 3.0, new THREE.Vector2( 0, 1 ) );

  this.hBlurMaterial = this.vBlurMaterial.clone();
  this.hBlurMaterial.side = THREE.DoubleSide;
  this.hBlurMaterial.uniforms[ 'size' ].value.set( mirrorTexture.width/2, mirrorTexture.height/2 );
  this.hBlurMaterial.blending = THREE.NoBlending;
  THREE.BlurShaderUtils.configure( this.hBlurMaterial, 5, 3.0, new THREE.Vector2( 1, 0 ) );
}


THREE.MirrorHelper.prototype = {

  constructor: THREE.MirrorHelper,

  update: function(renderer) {

    var textureIn = this.mirror.mirrorRenderTarget;
    for( var i=0; i<this.numMipMaps; i++) {
      var renderTarget = this.mirrorTextureMipMaps[i];
      var tempRenderTarget = this.tempRenderTargets[i];

      this.hBlurMaterial.uniforms[ 'size' ].value.set( textureIn.width, textureIn.height );
      this.hBlurMaterial.uniforms[ "tDiffuse" ].value = textureIn.texture;
      this.quad.material = this.hBlurMaterial;
      renderer.render(this.scene, this.cameraOrtho, tempRenderTarget, true);

      this.vBlurMaterial.uniforms[ 'size' ].value.set( tempRenderTarget.width, tempRenderTarget.height );
      this.vBlurMaterial.uniforms[ "tDiffuse" ].value = tempRenderTarget.texture;
      this.quad.material = this.vBlurMaterial;
      renderer.render(this.scene, this.cameraOrtho, renderTarget, true);

      textureIn = renderTarget;
    }
  }
}



THREE.GlossyMirror = function ( options ) {

	THREE.Object3D.call( this );

	this.name = 'mirror_' + this.id;

	options = options || {};

	this.matrixNeedsUpdate = true;

	var width = options.textureWidth !== undefined ? options.textureWidth : 512;
	var height = options.textureHeight !== undefined ? options.textureHeight : 512;

	this.localMirrorNormal = options.localMirrorNormal !== undefined ? options.localMirrorNormal : new THREE.Vector3( 0, 0, 1 );

	this.distanceFade = 0.1;
	this.metalness = 0.0;
	this.specularColor = new THREE.Color( 0xffffff );
	this.roughness = 0.0;
	this.opacity = 1.0;

	this.mirrorPlane = new THREE.Plane();
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

	this.mirrorNormal = new THREE.Vector3();
	var parameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: false };

	this.mirrorRenderTarget = new THREE.WebGLRenderTarget( width, height, parameters );
	
	this.material = new THREE.ShaderMaterial( THREE.GlossyMirrorShader );
	this.material.defines = THREE.UniformsUtils.cloneDefines( this.material.defines );
	this.material.uniforms = THREE.UniformsUtils.clone( this.material.uniforms );
	this.material.uniforms.tReflection.value = this.mirrorRenderTarget;
	this.material.uniforms.reflectionTextureMatrix.value = this.reflectionTextureMatrix;

	if ( ! THREE.Math.isPowerOfTwo( width ) || ! THREE.Math.isPowerOfTwo( height ) ) {

		this.mirrorRenderTarget.texture.generateMipmaps = false;
	
	}
	
	this.clipPlane = new THREE.Plane( this.localMirrorNormal, 0 );
	this.originalClipPlane = this.clipPlane.clone();
	this.falseClipPlane = this.clipPlane.clone();
	this.falseClipPlane.constant = 10000;

	this.depthMaterial = new THREE.MeshDepthMaterial();
 	this.depthMaterial.depthPacking = THREE.RGBADepthPacking;
 	this.depthMaterial.blending = THREE.NoBlending;
	this.depthMaterial.side = THREE.DoubleSide;

	this.depthRenderTarget = new THREE.WebGLRenderTarget( width, height,
 					{ minFilter: THREE.LinearFilter, magFilter: THREE.NearesFilter, format: THREE.RGBAFormat } );
	this.material.uniforms.tReflectionDepth.value = this.depthRenderTarget.texture;


  	this.material.uniforms[ 'screenSize' ].value = new THREE.Vector2(width, height);

	this.mirrorHelper = new THREE.MirrorHelper(this);

	this.material.uniforms.tReflection.value = this.mirrorRenderTarget;
	this.material.uniforms.tReflection1.value = this.mirrorHelper.mirrorTextureMipMaps[0].texture;
	this.material.uniforms.tReflection2.value = this.mirrorHelper.mirrorTextureMipMaps[1].texture;
	this.material.uniforms.tReflection3.value = this.mirrorHelper.mirrorTextureMipMaps[2].texture;
	this.material.uniforms.tReflection4.value = this.mirrorHelper.mirrorTextureMipMaps[3].texture;

};

THREE.GlossyMirror.prototype = Object.assign( Object.create( THREE.Object3D.prototype ), {

	constructor: THREE.GlossyMirror,

	updateReflectionTextureMatrix: function ( camera ) {

		this.updateMatrixWorld();
		camera.updateMatrixWorld();

		this.mirrorWorldPosition.setFromMatrixPosition( this.matrixWorld );
		this.cameraWorldPosition.setFromMatrixPosition( camera.matrixWorld );

		this.rotationMatrix.extractRotation( this.matrixWorld );

		this.mirrorNormal.copy( this.localMirrorNormal );
		this.mirrorNormal.applyMatrix4( this.rotationMatrix );

		var view = this.mirrorWorldPosition.clone().sub( this.cameraWorldPosition );
		view.reflect( this.mirrorNormal ).negate();
		view.add( this.mirrorWorldPosition );

		this.rotationMatrix.extractRotation( camera.matrixWorld );

		this.lookAtPosition.set( 0, 0, - 1 );
		this.lookAtPosition.applyMatrix4( this.rotationMatrix );
		this.lookAtPosition.add( this.cameraWorldPosition );

		var target = this.mirrorWorldPosition.clone().sub( this.lookAtPosition );
		target.reflect( this.mirrorNormal ).negate();
		target.add( this.mirrorWorldPosition );

		this.up.set( 0, - 1, 0 );
		this.up.applyMatrix4( this.rotationMatrix );
		this.up.reflect( this.mirrorNormal ).negate();

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

		this.mirrorPlane.setFromNormalAndCoplanarPoint( this.mirrorNormal, this.mirrorWorldPosition );
		this.mirrorPlane.applyMatrix4( this.mirrorCamera.matrixWorldInverse );
		

		this.material.uniforms[ 'mirrorCameraProjectionMatrix' ].value.copy( this.mirrorCamera.projectionMatrix );
		this.material.uniforms[ 'mirrorCameraInverseProjectionMatrix' ].value.getInverse( this.mirrorCamera.projectionMatrix );

		this.material.uniforms[ 'mirrorCameraWorldMatrix' ].value.copy( camera.matrixWorld );
		this.material.uniforms[ 'mirrorCameraNear' ].value = this.mirrorCamera.near;
		this.material.uniforms[ 'mirrorCameraFar' ].value = this.mirrorCamera.far;

		this.material.uniforms[ 'mirrorNormal' ].value = this.mirrorNormal;
		this.material.uniforms[ 'mirrorWorldPosition' ].value = this.mirrorWorldPosition;
	},

	render: function ( renderer, scene, camera ) {

		if ( ! camera instanceof THREE.PerspectiveCamera ) console.error( "THREE.GlossyMirror: camera is not a Perspective Camera!" );

		if( ! this.mirrorCamera ) {
			this.mirrorCamera = camera.clone();
			this.mirrorCamera.matrixAutoUpdate = true;

		}


		if ( this.matrixNeedsUpdate ) this.updateReflectionTextureMatrix( camera );

		this.matrixNeedsUpdate = true;

		// Render the mirrored view of the current scene into the target texture
	

		if(this.clipPlane !== undefined) {

			this.clipPlane.copy(this.originalClipPlane);

			this.clipPlane.applyMatrix4(this.matrixWorld);
			this.clippingPlanes = [this.clipPlane];
		}

		renderer.clippingPlanes = this.clippingPlanes;
	
		if ( scene !== undefined && scene instanceof THREE.Scene ) {

			// We can't render ourself to ourself
			var visible = this.material.visible;
			this.material.visible = false;

			renderer.render( scene, this.mirrorCamera, this.mirrorRenderTarget, true );

			this.material.visible = visible;

		}
		scene.overrideMaterial = this.depthMaterial;

		var visible = this.material.visible;

		var oldClearColor = renderer.getClearColor(), oldClearAlpha = renderer.getClearAlpha();

		renderer.setClearColor(0xffffff, 1);
		this.material.visible = false;

		renderer.render( scene, this.mirrorCamera, this.depthRenderTarget, true );

		scene.overrideMaterial = null;
		renderer.setClearColor( oldClearColor, oldClearAlpha );

	
		this.material.visible = visible;
		this.material.uniforms.distanceFade.value = this.distanceFade;
		this.material.uniforms.opacity.value = this.opacity;
		this.material.uniforms.metalness.value = this.metalness;
		this.material.uniforms.specularColor.value.copy( this.specularColor );
		this.material.uniforms.roughness.value = this.roughness;
	
		if(this.clipPlane !== undefined) {

			this.clipPlane.copy(this.falseClipPlane);

		}
		if(this.mirrorHelper !== undefined) {

			this.mirrorHelper.update(renderer);

		}
	}

} );