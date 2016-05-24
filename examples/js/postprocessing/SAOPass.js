/**
*
* Scalable Ambient Occlusion
*
* @author bhouston / http://clara.io/
*
*
*/

THREE.SAOPass = function ( scene, camera ) {

	THREE.Pass.call( this );

	this.scene = scene;
	this.camera = camera;

	this.bias = 0.5;
	this.intensity = 0.25;
	this.scale = 1;
	this.kernelRadius = 20;
	this.minResolution = 0;
	this.maxDistance = 0.02;
	this.blurEnabled = true;
	this.blurRadius = 7;
	this.blurStdDev = 4;
	this.outputOverride = null; // 'beauty', 'depth', 'sao'
	this.manualCompositing = false;

	/*
	if ( false && renderer.extensions.get('WEBGL_depth_texture') ) {

		console.log( "using depth extension");

		this.depthTexture = optionalBuffers.depthTexture || new THREE.DepthTexture();
		this.depthTexture.type = isWebGL2 ? THREE.FloatType : THREE.UnsignedShortType;
		this.depthTexture.minFilter = THREE.NearestFilter;
		this.depthTexture.maxFilter = THREE.NearestFilter;

		this.beautyRenderTarget.depthBuffer = true;
		this.beautyRenderTarget.depthTexture = this.depthTexture;

	}*/

	this.depthMaterial = new THREE.MeshDepthMaterial();
	this.depthMaterial.depthPacking = THREE.RGBADepthPacking;
	this.depthMaterial.blending = THREE.NoBlending;

	this.normalMaterial = new THREE.MeshNormalMaterial();

	if ( THREE.SAOShader === undefined )	console.error( "THREE.SAOPass relies on THREE.SAOShader" );
	if ( THREE.DepthLimitedBlurShader === undefined )	console.error( "THREE.SAOPass relies on THREE.DepthLimitedBlurShader" );
	if ( THREE.CopyShader === undefined )	console.error( "THREE.SAOPass relies on THREE.CopyShader" );

	this.saoMaterial = new THREE.ShaderMaterial( THREE.SAOShader );
	this.saoMaterial.uniforms = THREE.UniformsUtils.clone( this.saoMaterial.uniforms );
	this.saoMaterial.defines = THREE.UniformsUtils.cloneDefines( this.saoMaterial.defines );
	this.saoMaterial.defines[ 'DIFFUSE_TEXTURE' ] = 0;
	this.saoMaterial.defines[ 'NORMAL_TEXTURE' ] = 1;
	this.saoMaterial.defines[ 'MODE' ] = 2;

	// TODO: combine v and h blur materials together.
	this.vBlurMaterial = new THREE.ShaderMaterial( THREE.DepthLimitedBlurShader );
	this.vBlurMaterial.uniforms = THREE.UniformsUtils.clone( this.vBlurMaterial.uniforms );
	this.vBlurMaterial.defines = THREE.UniformsUtils.cloneDefines( this.vBlurMaterial.defines );

	this.hBlurMaterial = new THREE.ShaderMaterial( THREE.DepthLimitedBlurShader );
	this.hBlurMaterial.uniforms = THREE.UniformsUtils.clone( this.hBlurMaterial.uniforms );
	this.hBlurMaterial.defines = THREE.UniformsUtils.cloneDefines( this.hBlurMaterial.defines );

	this.copyMaterial = new THREE.ShaderMaterial( THREE.CopyShader );
	this.copyMaterial.uniforms = THREE.UniformsUtils.clone( this.copyMaterial.uniforms );
	this.copyMaterial.uniforms['opacity'].value = 1.0;
	this.copyMaterial.blending = THREE.NoBlending;
	this.copyMaterial.premultipliedAlpha = true;
	this.copyMaterial.transparent = true;
	this.copyMaterial.depthTest = false;
	this.copyMaterial.depthWrite = false;

	if ( THREE.CompositeShader === undefined ) console.error( "THREE.SAOPass relies on THREE.CompositeShader" );

	this.compositeMaterial = new THREE.ShaderMaterial( THREE.CompositeShader );
	this.compositeMaterial.uniforms = THREE.UniformsUtils.clone( this.compositeMaterial.uniforms );
	this.compositeMaterial.defines = THREE.UniformsUtils.cloneDefines( this.compositeMaterial.defines );
	this.compositeMaterial.defines['BLENDING'] = THREE.MultiplyBlending;
	this.compositeMaterial.blending = THREE.NoBlending;
	this.compositeMaterial.premultipliedAlpha = true;
	this.compositeMaterial.transparent = true;
	this.compositeMaterial.depthTest = false;
	this.compositeMaterial.depthWrite = false;

};

THREE.SAOPass.prototype = {

	dispose: function() {

		if( this.saoRenderTarget ) {
			this.saoRenderTarget.dispose();
			this.saoRenderTarget = null;
		}
		if( this.blurIntermediateRenderTarget ) {
			this.blurIntermediateRenderTarget.dispose();
			this.blurIntermediateRenderTarget = null;
		}
		if( this.depthRenderTarget ) {
			this.depthRenderTarget.dispose();
			this.depthRenderTarget = null;
		}
		if( this.normalRenderTarget ) {
			this.normalRenderTarget.dispose();
			this.normalRenderTarget = null;
		}

	},


	setSize: function ( width, height ) {

		if( this.saoRenderTarget ) this.saoRenderTarget.setSize( width, height );
		if( this.blurIntermediateRenderTarget ) this.blurIntermediateRenderTarget.setSize( width, height );
		if( this.depthRenderTarget ) this.depthRenderTarget.setSize( width, height );
		if( this.normalRenderTarget ) this.normalRenderTarget.setSize( width, height );

		this.saoMaterial.uniforms[ 'size' ].value.set( width, height );
		this.vBlurMaterial.uniforms[ 'size' ].value.set( width, height );
		this.hBlurMaterial.uniforms[ 'size' ].value.set( width, height );

	},

	updateParameters: function( camera ) {

		this.saoMaterial.uniforms['bias'].value = this.bias;
		this.saoMaterial.uniforms['intensity'].value = this.intensity;
		this.saoMaterial.uniforms['scale'].value = this.scale;
		this.saoMaterial.uniforms['kernelRadius'].value = this.kernelRadius;
		this.saoMaterial.uniforms['minResolution'].value = this.minResolution;

		var depthCutoff = this.maxDistance * ( camera.far - camera.near );

		this.saoMaterial.uniforms['maxDistance'].value = depthCutoff;

		this.saoMaterial.uniforms[ 'cameraNear' ].value = camera.near;
		this.saoMaterial.uniforms[ 'cameraFar' ].value = camera.far;
		this.saoMaterial.uniforms[ 'cameraProjectionMatrix' ].value = camera.projectionMatrix;
		this.saoMaterial.uniforms[ 'cameraInverseProjectionMatrix' ].value.getInverse( camera.projectionMatrix );

		this.vBlurMaterial.uniforms[ 'depthCutoff' ].value = depthCutoff;
		this.vBlurMaterial.uniforms[ "cameraFar" ].value = camera.far;
		this.vBlurMaterial.uniforms[ "cameraNear" ].value = camera.near;

		this.hBlurMaterial.uniforms[ 'depthCutoff' ].value = depthCutoff;
		this.hBlurMaterial.uniforms[ "cameraFar" ].value = camera.far;
		this.hBlurMaterial.uniforms[ "cameraNear" ].value = camera.near;

		THREE.BlurShaderUtils.configure( this.vBlurMaterial, this.blurRadius, this.blurStdDev, new THREE.Vector2( 0, 1 ) );
		THREE.BlurShaderUtils.configure( this.hBlurMaterial, this.blurRadius, this.blurStdDev, new THREE.Vector2( 1, 0 ) );

	},

	render: function( renderer, writeBuffer, readBuffer, delta, maskActive ) {

		var depthTexture = ( readBuffer.depthBuffer && readBuffer.depthTexture ) ? readBuffer.depthTexture : null;

		if ( ! this.saoRenderTarget ) {

			this.saoRenderTarget = new THREE.WebGLRenderTarget( readBuffer.width, readBuffer.height,
				{ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat } );

		}

		if ( ! this.blurIntermediateRenderTarget ) {

			this.blurIntermediateRenderTarget = new THREE.WebGLRenderTarget( readBuffer.width, readBuffer.height,
				{ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat } );

		}

		if( ! depthTexture && ! this.depthRenderTarget ) {

			this.depthRenderTarget = new THREE.WebGLRenderTarget( readBuffer.width, readBuffer.height,
				{ minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat } );

		}

		if( ! this.normalRenderTarget ) {

			this.normalRenderTarget = new THREE.WebGLRenderTarget( readBuffer.width, readBuffer.height,
				{ minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBFormat } );

		}

		this.updateParameters( this.camera );

		var clearColor = renderer.getClearColor(), clearAlpha = renderer.getClearAlpha(), autoClear = renderer.autoClear;

		if( ! this.renderToScreen ) {

			this.copyMaterial.uniforms[ 'tDiffuse' ].value = readBuffer.texture;
			this.copyMaterial.blending = THREE.NoBlending;

			renderer.renderPass( this.copyMaterial, writeBuffer, true );

		}

		var depthPackingMode = 0;

		if( ! depthTexture ) {

			renderer.setClearColor( 0xffffff );
			renderer.setClearAlpha( 1.0 );
			renderer.renderOverride( this.depthMaterial, this.scene, this.camera, this.depthRenderTarget, true );

			depthTexture = this.depthRenderTarget.texture;
			depthPackingMode = 1;

		}

		if( this.outputOverride === "depth" ) {

			this.copyMaterial.uniforms[ 'tDiffuse' ].value = depthTexture;
			this.copyMaterial.blending = THREE.NoBlending;

			renderer.renderPass( this.copyMaterial, this.renderToScreen ? null : writeBuffer, true );
			return;

		}

		renderer.setClearColor( new THREE.Color( 0.5, 0.5, 1.0 ) );
		renderer.setClearAlpha( 1.0 );
		renderer.renderOverride( this.normalMaterial, this.scene, this.camera, this.normalRenderTarget, true );
		renderer.setClearColor( 0xffffff );

		if( this.outputOverride === "normal" ) {

			this.copyMaterial.uniforms[ 'tDiffuse' ].value = this.normalRenderTarget.texture;
			this.copyMaterial.blending = THREE.NoBlending;

			renderer.renderPass( this.copyMaterial, this.renderToScreen ? null : this.renderToScreen ? null : writeBuffer, true );
			return;

		}

		this.saoMaterial.defines[ 'DEPTH_PACKING' ] = depthPackingMode;
		this.saoMaterial.uniforms[ "tDepth" ].value = depthTexture;
		this.saoMaterial.uniforms[ "tNormal" ].value = this.normalRenderTarget.texture;

		renderer.renderPass( this.saoMaterial, this.saoRenderTarget ); // , 0xffffff, 0.0, "sao"

		if( this.blurEnabled ) {

			this.vBlurMaterial.defines[ 'DEPTH_PACKING' ] = depthPackingMode;
			this.vBlurMaterial.uniforms[ "tDepth" ].value = depthTexture;
			this.vBlurMaterial.uniforms[ "tDiffuse" ].value = this.saoRenderTarget.texture;

			renderer.renderPass( this.vBlurMaterial, this.blurIntermediateRenderTarget ); // , 0xffffff, 0.0, "sao vBlur"

			this.hBlurMaterial.defines[ 'DEPTH_PACKING' ] = depthPackingMode;
			this.hBlurMaterial.uniforms[ "tDepth" ].value = depthTexture;
			this.hBlurMaterial.uniforms[ "tDiffuse" ].value = this.blurIntermediateRenderTarget.texture;

			renderer.renderPass( this.hBlurMaterial, this.saoRenderTarget ); // 0xffffff, 0.0, "sao hBlur"

		}

		if( this.outputOverride === "sao" ) {

			this.copyMaterial.uniforms[ 'tDiffuse' ].value = this.saoRenderTarget.texture;
			this.copyMaterial.blending = THREE.NoBlending;

			renderer.renderPass( this.copyMaterial, this.renderToScreen ? null : writeBuffer, true );
			return;

		}


		renderer.autoClear = false;

		if( this.manualCompositing ) {

			this.compositeMaterial.uniforms['opacitySource'].value = 1.0;
			this.compositeMaterial.uniforms['tDestination'].value = readBuffer.texture;
			this.compositeMaterial.uniforms['tSource'].value = this.saoRenderTarget.texture;
			this.compositeMaterial.blending = THREE.NoBlending;

			renderer.renderPass( this.compositeMaterial, this.blurIntermediateRenderTarget, true );

			this.copyMaterial.uniforms[ 'tDiffuse' ].value = this.blurIntermediateRenderTarget.texture;
			this.copyMaterial.blending = THREE.NoBlending;

			renderer.renderPass( this.copyMaterial, this.renderToScreen ? null : writeBuffer, true );

		}
		else {

			this.copyMaterial.uniforms[ 'tDiffuse' ].value = this.saoRenderTarget.texture;
			this.copyMaterial.blending = THREE.MultiplyBlending;

			renderer.renderPass( this.copyMaterial, this.renderToScreen ? null : writeBuffer, false );

		}

		renderer.autoClear = autoClear;
		renderer.setClearColor( clearColor );
		renderer.setClearAlpha( clearAlpha );

	}

};
