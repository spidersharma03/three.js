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

	this.intensity = 0.5;
	this.implicitNormals = false; // explicit normals requires or there are artifacts on mobile.
	this.occlusionSphereWorldRadius = 20;
	this.blurEnabled = true;
	this.outputOverride = null; // 'beauty', 'depth', 'sao'
	this.depthMIPs = false;
	this.downSamplingRatio = 1;
	this.blurKernelSize = (this.downSamplingRatio === 1) ? 8 : 4;

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
	this.depthMaterial.side = THREE.DoubleSide;

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

	this.bilateralUpsamplerMaterial = this.getBilateralUpsamplerMaterial();

	this.copyMaterial = new THREE.ShaderMaterial( THREE.CopyShader );
	this.copyMaterial.uniforms = THREE.UniformsUtils.clone( this.copyMaterial.uniforms );
	this.copyMaterial.uniforms['opacity'].value = 1.0;
	this.copyMaterial.blending = THREE.NoBlending;
	this.copyMaterial.premultipliedAlpha = true;
	this.copyMaterial.transparent = true;
	this.copyMaterial.depthTest = false;
	this.copyMaterial.depthWrite = false;
	this.frameCount = 1;
	this.frameCountIncrement = 1;
	this.currentFrameCount = 1;
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
		if( this.normalRenderTargetFullRes ) {
			this.normalRenderTargetFullRes.dispose();
			this.normalRenderTargetFullRes = null;
		}
		if( this.depthRenderTargetFullRes ) {
			this.depthRenderTargetFullRes.dispose();
			this.depthRenderTargetFullRes = null;
		}
		if( this.saoRenderTargetFullRes ) {
			this.saoRenderTargetFullRes.dispose();
			this.saoRenderTargetFullRes = null;
		}
	},

	setEdgeSharpness: function(value) {
		this.bilateralFilterMaterial.uniforms[ 'edgeSharpness' ].value = Number(value);
	},

	setScaleFactor: function(value) {
		this.bilateralFilterMaterial.uniforms[ 'scaleFactor' ].value = Number(value);
	},

	setSize: function ( width, height ) {

		if( this.saoAlbedoRenderTarget )this.saoAlbedoRenderTarget.setSize( width, height );
		if( this.saoRenderTargetPingPong ) this.saoRenderTargetPingPong.setSize( width, height );
		if( this.saoRenderTargetFullRes ) this.saoRenderTargetFullRes.setSize( width, height );
		if( this.depthRenderTargetFullRes ) this.depthRenderTargetFullRes.setSize( width, height );
		if( this.normalRenderTargetFullRes ) this.normalRenderTargetFullRes.setSize( width, height );
		width = Math.ceil( width / this.downSamplingRatio );
		height = Math.ceil( height / this.downSamplingRatio );
		if( this.saoRenderTarget ) this.saoRenderTarget.setSize( width, height );
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

		this.depthMinifyMaterial.uniforms[ 'cameraNear' ].value = camera.near;
		this.depthMinifyMaterial.uniforms[ 'cameraFar' ].value = camera.far;

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

			this.saoAlbedoRenderTarget = new THREE.WebGLRenderTarget( width, height,
				{ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat } );
			this.saoRenderTarget = new THREE.WebGLRenderTarget( width, height,
				{ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.FloatType, format: THREE.RGBAFormat } );
			this.saoRenderTargetFullRes = new THREE.WebGLRenderTarget( readBuffer.width, readBuffer.height,
					{ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat } );
			this.saoRenderTargetPingPong = new THREE.WebGLRenderTarget( readBuffer.width, readBuffer.height,
					{ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.FloatType, format: THREE.RGBAFormat } );
			this.blurIntermediateRenderTarget = new THREE.WebGLRenderTarget( width, height,
				{ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.FloatType, format: THREE.RGBAFormat } );
			this.depth1RenderTarget = new THREE.WebGLRenderTarget( Math.ceil( width / 2 ), Math.ceil( height / 2 ),
				{ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat } );
			this.depth2RenderTarget = new THREE.WebGLRenderTarget( Math.ceil( width / 4 ), Math.ceil( height / 4 ),
				{ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat } );
			this.depth3RenderTarget = new THREE.WebGLRenderTarget( Math.ceil( width / 8 ), Math.ceil( height / 8 ),
				{ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat } );
			this.normalRenderTarget = new THREE.WebGLRenderTarget( width, height,
				{ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat } );
			this.normalRenderTargetFullRes = new THREE.WebGLRenderTarget( readBuffer.width, readBuffer.height,
				{ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat } );
		}

		if( ! depthTexture && ! this.depthRenderTarget ) {

			this.depthRenderTarget = new THREE.WebGLRenderTarget( width, height,
				{ minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat } );
			this.depthRenderTargetFullRes = new THREE.WebGLRenderTarget( readBuffer.width, readBuffer.height,
				{ minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat } );

		}

		this.updateParameters( this.camera );

		var clearColor = renderer.getClearColor(), clearAlpha = renderer.getClearAlpha(), autoClear = renderer.autoClear;
		renderer.autoClear = false;

		if( ! this.renderToScreen ) {

			// this.copyMaterial.uniforms[ 'tDiffuse' ].value = readBuffer.texture;
			// this.copyMaterial.blending = THREE.NoBlending;

			// renderer.renderPass( this.copyMaterial, writeBuffer, true );

		}

		this.copyMaterial.uniforms[ 'tDiffuse' ].value = readBuffer.texture;
		this.copyMaterial.blending = THREE.NoBlending;

		renderer.render( this.scene, this.camera, this.saoAlbedoRenderTarget, true );

		var depthPackingMode = 0;

		if( ! depthTexture ) {

			var oldClearColor = renderer.getClearColor(), oldClearAlpha = renderer.getClearAlpha();
			renderer.setClearColor( 0xffffff, 1.0 );

			renderer.renderOverride( this.depthMaterial, this.scene, this.camera, this.depthRenderTarget, true );

			renderer.setClearColor( 0xffffff, 1.0 );

			if( this.downSamplingRatio !== 1.0 ) {

				renderer.renderOverride( this.depthMaterial, this.scene, this.camera, this.depthRenderTargetFullRes, true );

				renderer.setClearColor( oldClearColor, oldClearAlpha );

			}
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

			if( this.downSamplingRatio !== 1.0 ) {

					renderer.setClearColor( new THREE.Color( 0.5, 0.5, 1.0 ), 1.0 );

					renderer.renderOverride( this.normalMaterial, this.scene, this.camera, this.normalRenderTargetFullRes, true );

			}

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

		var currentSAOReadTarget = (this.currentFrameCount % 2 == 0) ? this.saoRenderTargetPingPong : this.saoRenderTarget;
		this.saoMaterial.uniforms[ "tAOPrevious" ].value = currentSAOReadTarget;
		this.saoMaterial.uniforms[ "tAlbedo" ].value = this.saoAlbedoRenderTarget;
		this.saoMaterial.uniforms[ "frameCount" ].value = this.frameCount;
		this.saoMaterial.uniforms[ "currentFrameCount" ].value = this.currentFrameCount;

		if( this.depthMIPs ) {

			this.saoMaterial.uniforms[ "tDepth1" ].value = this.depth1RenderTarget.texture;
			this.saoMaterial.uniforms[ "tDepth2" ].value = this.depth2RenderTarget.texture;
			this.saoMaterial.uniforms[ "tDepth3" ].value = this.depth3RenderTarget.texture;
		}

		var oldClearColor = renderer.getClearColor(), oldClearAlpha = renderer.getClearAlpha();
		renderer.setClearColor( 0xffffff, 1.0 );

		var currentSAOWriteTarget = (this.currentFrameCount % 2 == 0) ? this.saoRenderTarget : this.saoRenderTargetPingPong;

		this.frameCount += this.frameCountIncrement;
		this.currentFrameCount += 1.0;

		renderer.renderPass( this.saoMaterial, currentSAOWriteTarget, true ); // , 0xffffff, 0.0, "sao"

		if( false ) {

			this.bilateralFilterMaterial.defines[ 'KERNEL_SAMPLE_RADIUS' ] = this.blurKernelSize;
			this.bilateralFilterMaterial.uniforms[ "tAODepth" ].value = currentSAOWriteTarget.texture;
			this.bilateralFilterMaterial.uniforms[ "tAONormal" ].value = this.normalRenderTarget.texture;
			this.bilateralFilterMaterial.uniforms[ "occlusionSphereWorldRadius" ].value = this.occlusionSphereWorldRadius * 0.5;
			this.bilateralFilterMaterial.uniforms[ "kernelDirection" ].value = new THREE.Vector2( 1, 0 );
			this.bilateralFilterMaterial.uniforms[ "packOutput" ].value = 1;

			renderer.renderPass( this.bilateralFilterMaterial, this.blurIntermediateRenderTarget, true ); // , 0xffffff, 0.0, "sao vBlur"

			this.bilateralFilterMaterial.uniforms[ "tAODepth" ].value = this.blurIntermediateRenderTarget.texture;
			this.bilateralFilterMaterial.uniforms[ "kernelDirection" ].value = new THREE.Vector2( 0, 1 );
			this.bilateralFilterMaterial.uniforms[ "packOutput" ].value = 0;

			renderer.renderPass( this.bilateralFilterMaterial, this.saoRenderTarget, true ); // 0xffffff, 0.0, "sao hBlur"

		}
		if(this.downSamplingRatio > 1.0)
		{
			//Bilateral Up sampler
			this.bilateralUpsamplerMaterial.uniforms["inputTexture"].value = this.saoRenderTarget.texture;
			this.bilateralUpsamplerMaterial.uniforms["NormalTextureFullRes"].value = this.normalRenderTargetFullRes.texture;
			this.bilateralUpsamplerMaterial.uniforms["DepthTextureFullRes"].value = this.depthRenderTargetFullRes.texture;
			this.bilateralUpsamplerMaterial.uniforms["NormalTextureHalfRes"].value = this.normalRenderTarget.texture;
			this.bilateralUpsamplerMaterial.uniforms["DepthTextureHalfRes"].value = this.depthRenderTarget.texture;
			this.bilateralUpsamplerMaterial.uniforms["texSize"].value = new THREE.Vector2(this.saoRenderTarget.width, this.saoRenderTarget.height);
			this.bilateralUpsamplerMaterial.uniforms["cameraNearFar"].value = new THREE.Vector2(this.camera.near, this.camera.far);
			renderer.renderPass( this.bilateralUpsamplerMaterial, this.saoRenderTargetFullRes, true ); // 0xffffff, 0.0, "sao hBlur"

		}
		renderer.setClearColor( oldClearColor, oldClearAlpha );

		if( this.outputOverride === "sao" ) {

			this.copyMaterial.uniforms[ 'tDiffuse' ].value = this.downSamplingRatio > 1.0 ? this.saoRenderTargetFullRes.texture
			: currentSAOWriteTarget.texture;
			this.copyMaterial.blending = THREE.NoBlending;

			renderer.renderPass( this.copyMaterial, this.renderToScreen ? null : writeBuffer, true );
			return;

		}

		renderer.autoClear = false;

		this.copyMaterial.uniforms[ 'tDiffuse' ].value = this.downSamplingRatio > 1.0 ? this.saoRenderTargetFullRes.texture
		: currentSAOWriteTarget.texture;
		this.copyMaterial.blending = THREE.MultiplyBlending;
		this.copyMaterial.premultipliedAlpha = true;

		renderer.renderPass( this.copyMaterial, this.renderToScreen ? null : writeBuffer, false );

		renderer.autoClear = autoClear;
		renderer.setClearColor( clearColor );
		renderer.setClearAlpha( clearAlpha );

	},

	getBilateralUpsamplerMaterial: function(kernelRadius) {

		return new THREE.ShaderMaterial( {

			uniforms: {
				"inputTexture": { value: null },
				"NormalTextureFullRes": { value: null },
				"DepthTextureFullRes": { value: null },
				"NormalTextureHalfRes": { value: null },
				"DepthTextureHalfRes": { value: null },
				"texSize": 				{ value: new THREE.Vector2( 0.5, 0.5 ) },
				"cameraNearFar": 	{ value: new THREE.Vector2( 0.5, 0.5 ) },
			},

			vertexShader:
				"varying vec2 vUv;\n\
				void main() {\n\
					vUv = uv;\n\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
				}",

			fragmentShader:
				"#include <common>\n\
				#include <packing>\n\
				varying vec2 vUv;\n\
				uniform sampler2D inputTexture;\n\
				uniform sampler2D NormalTextureFullRes;\n\
				uniform sampler2D DepthTextureFullRes;\n\
				uniform sampler2D NormalTextureHalfRes;\n\
				uniform sampler2D DepthTextureHalfRes;\n\
				uniform vec2 texSize;\
				uniform vec2 cameraNearFar;\
				\
				void main()\
				{\
					vec2 uvOffsets[4];\
					uvOffsets[0] = vUv + vec2(0.0, 1.0)/texSize;\
					uvOffsets[1] = vUv + vec2(1.0, 0.0)/texSize;\
					uvOffsets[2] = vUv + vec2(-1.0, 0.0)/texSize;\
					uvOffsets[3] = vUv + vec2(0.0, -1.0)/texSize;\
					\
					float depth_weights[4];\
					float depth_hires = unpackRGBAToDepth(texture2D(DepthTextureFullRes, vUv));\
					depth_hires = -perspectiveDepthToViewZ(depth_hires, cameraNearFar.x, cameraNearFar.y);\
					if(depth_hires == 1.0)\
						discard;\
					float depth_coarse1 = unpackRGBAToDepth(texture2D(DepthTextureHalfRes, uvOffsets[0]));\
					depth_coarse1 = -perspectiveDepthToViewZ(depth_coarse1, cameraNearFar.x, cameraNearFar.y);\
					depth_weights[0] = pow(1.0 / (1.0 + abs(depth_hires-depth_coarse1)), 16.0);\
					float depth_coarse2 = unpackRGBAToDepth(texture2D(DepthTextureHalfRes, uvOffsets[1]));\
					depth_coarse2 = -perspectiveDepthToViewZ(depth_coarse2, cameraNearFar.x, cameraNearFar.y);\
					depth_weights[1] = pow(1.0 / (1.0 + abs(depth_hires-depth_coarse2)), 16.0);\
					float depth_coarse3 = unpackRGBAToDepth(texture2D(DepthTextureHalfRes, uvOffsets[2]));\
					depth_coarse3 = -perspectiveDepthToViewZ(depth_coarse3, cameraNearFar.x, cameraNearFar.y);\
					depth_weights[2] = pow(1.0 / (1.0 + abs(depth_hires-depth_coarse3)), 16.0);\
					float depth_coarse4 = unpackRGBAToDepth(texture2D(DepthTextureHalfRes, uvOffsets[3]));\
					depth_coarse4 = -perspectiveDepthToViewZ(depth_coarse4, cameraNearFar.x, cameraNearFar.y);\
					depth_weights[3] = pow(1.0 / (1.0 + abs(depth_hires-depth_coarse4)), 16.0);\
					\
					float norm_weights[4];\
					vec3 norm_fullRes = unpackRGBToNormal(texture2D(NormalTextureFullRes, vUv).rgb);\
					vec3 norm_coarse1 = unpackRGBToNormal(texture2D(NormalTextureHalfRes, uvOffsets[0]).rgb);\
					norm_weights[0] = pow(0.5 * (dot(norm_coarse1, norm_fullRes) + 0.5), 8.0);\
					vec3 norm_coarse2 = unpackRGBToNormal(texture2D(NormalTextureHalfRes, uvOffsets[1]).rgb);\
					norm_weights[1] = pow(0.5 * abs(dot(norm_coarse2, norm_fullRes) + 0.5), 8.0);\
					vec3 norm_coarse3 = unpackRGBToNormal(texture2D(NormalTextureHalfRes, uvOffsets[2]).rgb);\
					norm_weights[2] = pow(0.5 * abs(dot(norm_coarse3, norm_fullRes) + 0.5), 8.0);\
					vec3 norm_coarse4 = unpackRGBToNormal(texture2D(NormalTextureHalfRes, uvOffsets[3]).rgb);\
					norm_weights[3] = pow(0.5 * abs(dot(norm_coarse4, norm_fullRes) + 0.5), 8.0);\
					\
					vec3 colorOut = vec3(0.0);\
					float weight_sum = 0.0;\
					float weight = norm_weights[0] * depth_weights[0];\
					colorOut += texture2D(inputTexture, uvOffsets[0]).rgb*weight;\
					weight_sum += weight;\
				  weight = norm_weights[1] * depth_weights[1];\
					colorOut += texture2D(inputTexture, uvOffsets[1]).rgb*weight;\
					weight_sum += weight;\
				  weight = norm_weights[2] * depth_weights[2];\
					colorOut += texture2D(inputTexture, uvOffsets[2]).rgb*weight;\
					weight_sum += weight;\
				  weight = norm_weights[3] * depth_weights[3];\
					colorOut += texture2D(inputTexture, uvOffsets[3]).rgb*weight;\
					weight_sum += weight;\
					colorOut /= weight_sum;\
					gl_FragColor = vec4(colorOut, 1.0);\
				}"
		} );
	}

};
