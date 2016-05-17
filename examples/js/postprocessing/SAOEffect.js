/**
*
* Scalable Ambient Occlusion
*
* @author bhouston / http://clara.io/
*
*
*/

THREE.SAOEffect = function ( renderer, beautyRenderTarget, optionalBuffers ) {

	optionalBuffers = optionalBuffers || {};
	var width = beautyRenderTarget.width, height = beautyRenderTarget.height;

	this.bias = 0.5;
	this.intensity = 0.25;
	this.scale = 1;
	this.kernelRadius = 25;
	this.minResolution = 0;
	this.blurEnabled = true;
	this.blurRadius = 12;
	this.blurStdDev = 6;
	this.blurDepthCutoff = 0.01;
	this.outputOverride = null;

	this.beautyRenderTarget = beautyRenderTarget; // not owned by SAOEffect
	this.saoRenderTarget = optionalBuffers.saoRenderTarget || new THREE.WebGLRenderTarget( width, height, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat } );
	this.blurIntermediateRenderTarget = optionalBuffers.blurIntermediateRenderTarget || new THREE.WebGLRenderTarget( width, height, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat } );
	this.depthRenderTarget = optionalBuffers.depthRenderTarget || new THREE.WebGLRenderTarget( width, height, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat } );

	if ( false && renderer.extensions.get('WEBGL_depth_texture') ) {

		console.log( "using depth extension");

		this.depthTexture = optionalBuffers.depthTexture || new THREE.DepthTexture();
		this.depthTexture.type = isWebGL2 ? THREE.FloatType : THREE.UnsignedShortType;
		this.depthTexture.minFilter = THREE.NearestFilter;
		this.depthTexture.maxFilter = THREE.NearestFilter;

		this.beautyRenderTarget.depthBuffer = true;
		this.beautyRenderTarget.depthTexture = this.depthTexture;

	}
	else {

		this.depthMaterial = new THREE.MeshDepthMaterial();
		this.depthMaterial.depthPacking = THREE.RGBADepthPacking;
		this.depthMaterial.blending = THREE.NoBlending;

	}

	if ( THREE.SAOShader === undefined )	console.error( "THREE.SAOEffect relies on THREE.SAOShader" );
	if ( THREE.DepthLimitedBlurShader === undefined )	console.error( "THREE.SAOEffect relies on THREE.DepthLimitedBlurShader" );
	if ( THREE.CompositeShader === undefined )	console.error( "THREE.SAOEffect relies on THREE.CompositeShader" );

	this.saoMaterial = new THREE.ShaderMaterial( THREE.SAOShader );
	this.saoMaterial.uniforms = THREE.UniformsUtils.clone( this.saoMaterial.uniforms );
	this.saoMaterial.defines = THREE.UniformsUtils.cloneDefines( this.saoMaterial.defines );
	this.saoMaterial.defines[ 'DIFFUSE_TEXTURE' ] = 0;
	this.saoMaterial.defines[ 'NORMAL_TEXTURE' ] = 0;
	this.saoMaterial.defines[ 'DEPTH_PACKING' ] = this.depthTexture ? 0 : 1;
	this.saoMaterial.defines[ 'MODE' ] = 2;
	this.saoMaterial.uniforms[ "tDepth" ].value = ( this.depthTexture ) ? this.depthTexture : this.depthRenderTarget.texture;

	this.vBlurMaterial = new THREE.ShaderMaterial( THREE.DepthLimitedBlurShader );
	this.vBlurMaterial.uniforms = THREE.UniformsUtils.clone( this.vBlurMaterial.uniforms );
	this.vBlurMaterial.defines = THREE.UniformsUtils.cloneDefines( this.vBlurMaterial.defines );
	this.vBlurMaterial.defines[ 'DEPTH_PACKING' ] = ( this.depthTexture ) ? 0 : 1;
	this.vBlurMaterial.uniforms[ "tDiffuse" ].value = this.saoRenderTarget.texture;
	this.vBlurMaterial.uniforms[ "tDepth" ].value = ( this.depthTexture ) ? this.depthTexture : this.depthRenderTarget.texture;

	this.hBlurMaterial = new THREE.ShaderMaterial( THREE.DepthLimitedBlurShader );
	this.hBlurMaterial.uniforms = THREE.UniformsUtils.clone( this.hBlurMaterial.uniforms );
	this.hBlurMaterial.defines = THREE.UniformsUtils.cloneDefines( this.hBlurMaterial.defines );
	this.hBlurMaterial.defines[ 'DEPTH_PACKING' ] = ( this.depthTexture ) ? 0 : 1;
	this.hBlurMaterial.uniforms[ "tDiffuse" ].value = this.blurIntermediateRenderTarget.texture;
	this.hBlurMaterial.uniforms[ "tDepth" ].value = ( this.depthTexture ) ? this.depthTexture : this.depthRenderTarget.texture;

	this.setSize( width, height );

};

THREE.SAOEffect.prototype = {

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

		this.saoRenderTarget.setSize( width, height );
		this.blurIntermediateRenderTarget.setSize( width, height );
		this.depthRenderTarget.setSize( width, height );

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

	renderPass: function( renderer, scene, camera ) {

		this.updateParameters( camera );

		if( this.outputOverride === "beauty" ) return;

		if( ! this.depthTexture ) {

			THREE.EffectRenderer.renderOverride( renderer, this.depthMaterial, scene, camera, this.depthRenderTarget, undefined, undefined, 'depth rgba' );

		}

		if( this.outputOverride === "depth" ) {

			THREE.EffectRenderer.renderCopy( renderer, ( this.depthTexture ) ? this.depthTexture : this.depthRenderTarget.texture, 1.0, THREE.NoBlending, this.beautyRenderTarget, 0x000000, 0.0, 'output depth' );
			return;

		}

		THREE.EffectRenderer.renderPass( renderer, this.saoMaterial, this.saoRenderTarget, 0xffffff, 0.0, "sao" );

		if( this.blurEnabled ) {

			THREE.EffectRenderer.renderPass( renderer, this.vBlurMaterial, this.blurIntermediateRenderTarget, 0xffffff, 0.0, "sao vBlur" );
			THREE.EffectRenderer.renderPass( renderer,  this.hBlurMaterial, this.saoRenderTarget, 0xffffff, 0.0, "sao hBlur" );
		}

		if( this.outputOverride === "sao" ) {

			THREE.EffectRenderer.renderCopy( renderer, this.saoRenderTarget.texture, 1.0, THREE.NoBlending, this.beautyRenderTarget, 0x000000, 0.0, 'output sao' );
			return;

		}

		THREE.EffectRenderer.renderCopy( renderer, this.saoRenderTarget.texture, 1.0, THREE.MultiplyBlending, this.beautyRenderTarget, undefined, undefined, "composite" );

	}

};
