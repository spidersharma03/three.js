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
	this.kernelRadius = 25;
	this.minResolution = 0;
	this.blurEnabled = true;
	this.blurRadius = 12;
	this.blurStdDev = 6;
	this.blurDepthCutoff = 0.01;
	this.outputOverride = null; // 'beauty', 'depth', 'sao'

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

	if ( THREE.SAOShader === undefined )	console.error( "THREE.SAOPass relies on THREE.SAOShader" );
	if ( THREE.DepthLimitedBlurShader === undefined )	console.error( "THREE.SAOPass relies on THREE.DepthLimitedBlurShader" );
	if ( THREE.CopyShader === undefined )	console.error( "THREE.SAOPass relies on THREE.CopyShader" );

	this.saoMaterial = new THREE.ShaderMaterial( THREE.SAOShader );
	this.saoMaterial.uniforms = THREE.UniformsUtils.clone( this.saoMaterial.uniforms );
	this.saoMaterial.defines = THREE.UniformsUtils.cloneDefines( this.saoMaterial.defines );
	this.saoMaterial.defines[ 'DIFFUSE_TEXTURE' ] = 0;
	this.saoMaterial.defines[ 'NORMAL_TEXTURE' ] = 0;
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
	this.copyMaterial.premultipliedAlpha = true;
	this.copyMaterial.transparent = true;
	this.copyMaterial.depthTest = false;
	this.copyMaterial.depthWrite = false;

	console.log( 'saoPass', this );
};

THREE.SAOPass.prototype = {

	constructor: THREE.SAOEffect,

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

	},


	setSize: function ( width, height ) {

		if( this.saoRenderTarget ) this.saoRenderTarget.setSize( width, height );
		if( this.blurIntermediateRenderTarget ) this.blurIntermediateRenderTarget.setSize( width, height );
		if( this.depthRenderTarget ) this.depthRenderTarget.setSize( width, height );

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

		this.saoMaterial.uniforms[ 'cameraNear' ].value = camera.near;
		this.saoMaterial.uniforms[ 'cameraFar' ].value = camera.far;
		this.saoMaterial.uniforms[ 'cameraProjectionMatrix' ].value = camera.projectionMatrix;
		this.saoMaterial.uniforms[ 'cameraInverseProjectionMatrix' ].value.getInverse( camera.projectionMatrix );

		var depthCutoff = this.blurDepthCutoff * ( camera.far - camera.near );

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

		this.updateParameters( camera );
		console.log( 'this.outputOverride', this.outputOverride );
		if( this.outputOverride === "beauty" ) {

			this.copyMaterial.uniforms[ 'opacity' ].value = 1.0;
			this.copyMaterial.uniforms[ 'tDiffuse' ].value = readBuffer.texture;
			this.copyMaterial.blending = THREE.NormalBlending;

			renderer.renderPass( this.copyMaterial, writeBuffer, true );
			return;

		}

		//renderer.render( this.scene, this.camera, writeBuffer );
		//return;

		/*this.copyMaterial.uniforms[ 'opacity' ].value = 1.0;
		this.copyMaterial.uniforms[ 'tDiffuse' ].value = readBuffer.texture;
		this.copyMaterial.blending = THREE.NormalBlending;

		renderer.renderPass( this.copyMaterial, writeBuffer, true );
		return;*/

		var depthPackingMode = 0;


		if( ! depthTexture ) {

			renderer.renderOverride( this.depthMaterial, this.scene, this.camera, writeBuffer );

			depthTexture = this.depthRenderTarget.texture;
			depthPackingMode = 1;

			console.log( 'depthTexture', depthTexture );

			this.copyMaterial.uniforms[ 'opacity' ].value = 1.0;
			this.copyMaterial.uniforms[ 'tDiffuse' ].value = depthTexture;//readBuffer.texture;
			this.copyMaterial.blending = THREE.NormalBlending;

			//renderer.renderPass( this.copyMaterial, writeBuffer, true );
			return;

		}

		if( this.outputOverride === "depth" ) {

			this.copyMaterial.uniforms[ 'opacity' ].value = 1.0;
			this.copyMaterial.uniforms[ 'tDiffuse' ].value = depthTexture;
			this.copyMaterial.blending = THREE.NoBlending;

			renderer.renderPass( this.copyMaterial, writeBuffer );
			return;

		}

		this.saoMaterial.defines[ 'DEPTH_PACKING' ] = depthPackingMode;
		this.saoMaterial.uniforms[ "tDepth" ].value = depthTexture;

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

			this.copyMaterial.uniforms[ 'opacity' ].value = 1.0;
			this.copyMaterial.uniforms[ 'tDiffuse' ].value = this.saoRenderTarget.texture;
			this.copyMaterial.blending = THREE.NoBlending;

			renderer.renderPass( this.copyMaterial, writeBuffer );
			return;

		}

		this.copyMaterial.uniforms[ 'opacity' ] = 1.0;
		this.copyMaterial.uniforms[ 'tDiffuse' ] = this.saoRenderTarget.texture;
		this.copyMaterial.blending = THREE.MultiplyBlending;
		renderer.renderPass( this.copyMaterial, writeBuffer );

	}

};
