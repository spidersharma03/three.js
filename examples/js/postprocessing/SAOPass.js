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

	this.intensity = 0.25;
	this.implicitNormals = false; // explicit normals requires or there are artifacts on mobile.
	this.occlusionSphereWorldRadius = 20;
	this.blurEnabled = true;
	this.outputOverride = null; // 'beauty', 'depth', 'sao'
	this.manualCompositing = false;
	this.depthMIPs = false;
	this.downSamplingRatio = 1;

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
	if ( THREE.CopyShader === undefined )	console.error( "THREE.SAOPass relies on THREE.CopyShader" );

	this.depthMinifyMaterial = new THREE.ShaderMaterial( THREE.SAODepthMinifyShader );
	this.depthMinifyMaterial.uniforms = THREE.UniformsUtils.clone( this.depthMinifyMaterial.uniforms );
	this.depthMinifyMaterial.defines = THREE.UniformsUtils.cloneDefines( this.depthMinifyMaterial.defines );
	this.depthMinifyMaterial.blending = THREE.NoBlending;

	this.saoMaterial = new THREE.ShaderMaterial( THREE.SAOShader );
	this.saoMaterial.uniforms = THREE.UniformsUtils.clone( this.saoMaterial.uniforms );
	this.saoMaterial.defines = THREE.UniformsUtils.cloneDefines( this.saoMaterial.defines );
	this.saoMaterial.defines[ 'DIFFUSE_TEXTURE' ] = 0;
	this.saoMaterial.defines[ 'NORMAL_TEXTURE' ] = this.implicitNormals ? 0 : 1;
	this.saoMaterial.defines[ 'MODE' ] = 2;

	this.bilateralFilterMaterial = new THREE.ShaderMaterial( THREE.SAOBilaterialFilterShader );
	this.bilateralFilterMaterial.uniforms = THREE.UniformsUtils.clone( this.bilateralFilterMaterial.uniforms );
	this.bilateralFilterMaterial.defines = THREE.UniformsUtils.cloneDefines( this.bilateralFilterMaterial.defines );
	this.bilateralFilterMaterial.blending = THREE.NoBlending;
	this.bilateralFilterMaterial.premultipliedAlpha = true;

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
		if( this.depth1RenderTarget ) {
			this.depth1RenderTarget.dispose();
			this.depth1RenderTarget = null;
		}
		if( this.depth2RenderTarget ) {
			this.depth2RenderTarget.dispose();
			this.depth2RenderTarget = null;
		}
		if( this.depth3RenderTarget ) {
			this.depth3RenderTarget.dispose();
			this.depth3RenderTarget = null;
		}
		if( this.normalRenderTarget ) {
			this.normalRenderTarget.dispose();
			this.normalRenderTarget = null;
		}

	},


	setSize: function ( width, height ) {

		width = Math.ceil( width / this.downSamplingRatio );
		height = Math.ceil( height / this.downSamplingRatio );
		if( this.saoRenderTarget ) this.saoRenderTarget.setSize( width / this.downSamplingRatio, height );
		if( this.blurIntermediateRenderTarget ) this.blurIntermediateRenderTarget.setSize( width, height );
		if( this.depthRenderTarget ) this.depthRenderTarget.setSize( width, height );
		if( this.depth1RenderTarget ) this.depth1RenderTarget.setSize( Math.ceil( width / 2 ), Math.ceil( height / 2 ) );
		if( this.depth2RenderTarget ) this.depth2RenderTarget.setSize( Math.ceil( width / 4 ), Math.ceil( height / 4 ) );
		if( this.depth3RenderTarget ) this.depth3RenderTarget.setSize( Math.ceil( width / 8 ), Math.ceil( height / 8 ) );
		if( this.normalRenderTarget ) this.normalRenderTarget.setSize( width, height );

		this.saoMaterial.uniforms[ 'size' ].value.set( width, height );
		this.bilateralFilterMaterial.uniforms[ 'size' ].value.set( width, height );
		//console.log( 'downsampledsize: ', width, height );
	},

	updateParameters: function( camera ) {

		var vSizeAt1M = 1 / ( Math.tan( THREE.Math.DEG2RAD * camera.fov * 0.5 ) * 2 );
		var sizeAt1M = new THREE.Vector2( vSizeAt1M / camera.aspect, vSizeAt1M );

		this.saoMaterial.uniforms['worldToScreenRatio'].value = sizeAt1M;
		this.saoMaterial.uniforms['intensity'].value = this.intensity;
		this.saoMaterial.uniforms['occlusionSphereWorldRadius'].value = this.occlusionSphereWorldRadius;


		this.saoMaterial.uniforms[ 'cameraNear' ].value = camera.near;
		this.saoMaterial.uniforms[ 'cameraFar' ].value = camera.far;
		this.saoMaterial.uniforms[ 'cameraProjectionMatrix' ].value = camera.projectionMatrix;
		this.saoMaterial.uniforms[ 'cameraInverseProjectionMatrix' ].value.getInverse( camera.projectionMatrix );

		this.bilateralFilterMaterial.uniforms[ "cameraNear" ].value = camera.near;
		this.bilateralFilterMaterial.uniforms[ "cameraFar" ].value = camera.far;
	},

	render: function( renderer, writeBuffer, readBuffer, delta, maskActive ) {

		var width = readBuffer.width, height = readBuffer.height;

		width = Math.ceil( width / this.downSamplingRatio );
		height = Math.ceil( height / this.downSamplingRatio );
	
		var depthTexture = ( readBuffer.depthBuffer && readBuffer.depthTexture ) ? readBuffer.depthTexture : null;

		if ( ! this.saoRenderTarget ) {

			this.saoRenderTarget = new THREE.WebGLRenderTarget( width, height,
				{ minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat } );
			this.blurIntermediateRenderTarget = new THREE.WebGLRenderTarget( width, height,
				{ minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat } );
			this.depth1RenderTarget = new THREE.WebGLRenderTarget( Math.ceil( width / 2 ), Math.ceil( height / 2 ),
				{ minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat } );
			this.depth2RenderTarget = new THREE.WebGLRenderTarget( Math.ceil( width / 4 ), Math.ceil( height / 4 ),
				{ minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat } );
			this.depth3RenderTarget = new THREE.WebGLRenderTarget( Math.ceil( width / 8 ), Math.ceil( height / 8 ),
				{ minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat } );
			this.normalRenderTarget = new THREE.WebGLRenderTarget( width, height,
				{ minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBFormat } );

		}

		if( ! depthTexture && ! this.depthRenderTarget ) {

			this.depthRenderTarget = new THREE.WebGLRenderTarget( width, height,
				{ minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat } );

		}

		this.updateParameters( this.camera );

		var clearColor = renderer.getClearColor(), clearAlpha = renderer.getClearAlpha(), autoClear = renderer.autoClear;
		renderer.autoClear = false;

		if( ! this.renderToScreen ) {

			this.copyMaterial.uniforms[ 'tDiffuse' ].value = readBuffer.texture;
			this.copyMaterial.blending = THREE.NoBlending;

			renderer.renderPass( this.copyMaterial, writeBuffer, true );

		}

		var depthPackingMode = 0;

		if( ! depthTexture ) {

			var oldClearColor = renderer.getClearColor(), oldClearAlpha = renderer.getClearAlpha();
			renderer.setClearColor( 0xffffff, 1.0 );

			renderer.renderOverride( this.depthMaterial, this.scene, this.camera, this.depthRenderTarget, true );

			renderer.setClearColor( oldClearColor, oldClearAlpha );

			depthTexture = this.depthRenderTarget.texture;
			depthPackingMode = 1;

		}

		if( this.depthMIPs ) {

			this.depthMinifyMaterial.uniforms['tDepth'].value = depthTexture;
			this.depthMinifyMaterial.uniforms['size'].value.set( width, height );
			renderer.renderPass( this.depthMinifyMaterial, this.depth1RenderTarget, true );

			this.depthMinifyMaterial.uniforms['tDepth'].value = this.depth1RenderTarget.texture;
			this.depthMinifyMaterial.uniforms['size'].value.set( Math.ceil( width / 2 ), Math.ceil( height / 2 ) );
			renderer.renderPass( this.depthMinifyMaterial, this.depth2RenderTarget, true );

			this.depthMinifyMaterial.uniforms['tDepth'].value = this.depth2RenderTarget.texture;
			this.depthMinifyMaterial.uniforms['size'].value.set( Math.ceil( width / 4 ), Math.ceil( height / 4 ) );
			renderer.renderPass( this.depthMinifyMaterial, this.depth3RenderTarget, true );

		}

		if( this.outputOverride === "depth" ) {

			this.copyMaterial.uniforms[ 'tDiffuse' ].value = depthTexture;
			this.copyMaterial.blending = THREE.NoBlending;

			renderer.renderPass( this.copyMaterial, this.renderToScreen ? null : writeBuffer, true );
			return;

		}
		if( this.outputOverride === "depth1" ) {

			this.copyMaterial.uniforms[ 'tDiffuse' ].value = this.depth1RenderTarget.texture;
			this.copyMaterial.blending = THREE.NoBlending;

			renderer.renderPass( this.copyMaterial, this.renderToScreen ? null : writeBuffer, true );
			return;

		}
		if( this.outputOverride === "depth2" ) {

			this.copyMaterial.uniforms[ 'tDiffuse' ].value = this.depth2RenderTarget.texture;
			this.copyMaterial.blending = THREE.NoBlending;

			renderer.renderPass( this.copyMaterial, this.renderToScreen ? null : writeBuffer, true );
			return;

		}
		if( this.outputOverride === "depth3" ) {

			this.copyMaterial.uniforms[ 'tDiffuse' ].value = this.depth3RenderTarget.texture;
			this.copyMaterial.blending = THREE.NoBlending;

			renderer.renderPass( this.copyMaterial, this.renderToScreen ? null : writeBuffer, true );
			return;

		}

		if( ! this.implicitNormals ) {

			var oldClearColor = renderer.getClearColor(), oldClearAlpha = renderer.getClearAlpha();
			renderer.setClearColor( new THREE.Color( 0.5, 0.5, 1.0 ), 1.0 );

			renderer.renderOverride( this.normalMaterial, this.scene, this.camera, this.normalRenderTarget, true );

			renderer.setClearColor( oldClearColor, oldClearAlpha );

		}

		if( this.outputOverride === "normal" ) {

			this.copyMaterial.uniforms[ 'tDiffuse' ].value = this.normalRenderTarget.texture;
			this.copyMaterial.blending = THREE.NoBlending;

			renderer.renderPass( this.copyMaterial, this.renderToScreen ? null : this.renderToScreen ? null : writeBuffer, true );
			return;

		}

		this.saoMaterial.defines[ 'DEPTH_PACKING' ] = depthPackingMode;
		this.saoMaterial.defines[ 'DEPTH_MIPS' ] = this.depthMIPs ? 1 : 0;
		this.saoMaterial.uniforms[ "tNormal" ].value = this.normalRenderTarget.texture;
		this.saoMaterial.uniforms[ "tDepth" ].value = depthTexture;
		if( this.depthMIPs ) {

			this.saoMaterial.uniforms[ "tDepth1" ].value = this.depth1RenderTarget.texture;
			this.saoMaterial.uniforms[ "tDepth2" ].value = this.depth2RenderTarget.texture;
			this.saoMaterial.uniforms[ "tDepth3" ].value = this.depth3RenderTarget.texture;
		}

		var oldClearColor = renderer.getClearColor(), oldClearAlpha = renderer.getClearAlpha();
		renderer.setClearColor( 0xffffff, 1.0 );

		renderer.renderPass( this.saoMaterial, this.saoRenderTarget, true ); // , 0xffffff, 0.0, "sao"

		if( this.blurEnabled ) {

			this.bilateralFilterMaterial.defines[ 'DEPTH_PACKING' ] = depthPackingMode;
			this.bilateralFilterMaterial.uniforms[ "tAO" ].value = this.saoRenderTarget.texture;
			this.bilateralFilterMaterial.uniforms[ "tDepth" ].value = depthTexture;
			this.bilateralFilterMaterial.uniforms[ "occlusionSphereWorldRadius" ].value = this.occlusionSphereWorldRadius * 0.5;
			this.bilateralFilterMaterial.uniforms[ "kernelDirection" ].value = new THREE.Vector2( 1, 0 );

			renderer.renderPass( this.bilateralFilterMaterial, this.blurIntermediateRenderTarget, true ); // , 0xffffff, 0.0, "sao vBlur"

			this.bilateralFilterMaterial.uniforms[ "tAO" ].value = this.blurIntermediateRenderTarget.texture;
			this.bilateralFilterMaterial.uniforms[ "kernelDirection" ].value = new THREE.Vector2( 0, 1 );

			renderer.renderPass( this.bilateralFilterMaterial, this.saoRenderTarget, true ); // 0xffffff, 0.0, "sao hBlur"

		}

		renderer.setClearColor( oldClearColor, oldClearAlpha );

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
			this.copyMaterial.premultipliedAlpha = true;

			renderer.renderPass( this.copyMaterial, this.renderToScreen ? null : writeBuffer, false );

		}

		renderer.autoClear = autoClear;
		renderer.setClearColor( clearColor );
		renderer.setClearAlpha( clearAlpha );

	}

};
