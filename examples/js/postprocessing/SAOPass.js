/**
*
* Scalable Ambient Occlusion
*
* @author bhouston / http://clara.io/
*
*
*/

THREE.SAOPass = function ( scene, camera ) {

	// THREE.Pass.call( this );
	this.sceneOrtho = new THREE.Scene();
  this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -0.001, 1000);
  var geometry = new THREE.PlaneGeometry( 2, 2, 1, 1 );
  var material = new THREE.MeshBasicMaterial( {color: 0xffffff, side: THREE.DoubleSide} );
  var plane = new THREE.Mesh( geometry, material );
  this.sceneOrtho.add(plane);

	this.scene = scene;
	this.camera = camera;

	this.intensity = 1;
	this.implicitNormals = false; // explicit normals requires or there are artifacts on mobile.
	this.occlusionSphereWorldRadius = 3.0;

	var poissonDiskGenerator = new PoissonDiskGenerator(5500, -1, true, true);
	this.samples = poissonDiskGenerator.generatePoints();
	this.poissonTexture = poissonDiskGenerator.createDataTexture(this.samples);

	this.depthMaterial = new THREE.MeshDepthMaterial();
	this.depthMaterial.depthPacking = THREE.RGBADepthPacking;
	this.depthMaterial.blending = THREE.NoBlending;
	// this.depthMaterial.side = THREE.DoubleSide;

	this.normalMaterial = new THREE.MeshNormalMaterial();

	if ( THREE.SAOShader === undefined )	console.error( "THREE.SAOPass relies on THREE.SAOShader" );

	this.saoMaterial = new THREE.ShaderMaterial( THREE.SAOShader );
	this.saoMaterial.uniforms = THREE.UniformsUtils.clone( this.saoMaterial.uniforms );
	this.saoMaterial.defines = THREE.UniformsUtils.cloneDefines( this.saoMaterial.defines );
	this.saoMaterial.defines[ 'NORMAL_TEXTURE' ] = this.implicitNormals ? 0 : 1;

	this.frameCount = 1;
	this.frameCountIncrement = 7;
	this.currentFrameCount = 1;

	var poissonSamplerAA = new PoissonDiskGenerator(30, -1, false, false);
	this.supersamplePositions = poissonSamplerAA.generatePoints();
};

THREE.SAOPass.prototype = {

	dispose: function() {

		if( this.saoRenderTarget ) {
			this.saoRenderTarget.dispose();
			this.saoRenderTarget = null;
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

		if( this.saoRenderTargetPingPong ) this.saoRenderTargetPingPong.setSize( width, height );
		if( this.saoRenderTarget ) this.saoRenderTarget.setSize( width, height );
		if( this.depthRenderTarget ) this.depthRenderTarget.setSize( width, height );
		if( this.normalRenderTarget ) this.normalRenderTarget.setSize( width, height );

		this.saoMaterial.uniforms[ 'size' ].value.set( width, height );
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
	},

  perturbProjectionMatrix:function ( sampleNumber ) {
		var projectionMatrix = this.camera.projectionMatrix;
		var sample;
		var N = sampleNumber;
		N = sampleNumber % (this.supersamplePositions.length);
		sample = this.supersamplePositions[N];

		var w = window.innerWidth; var h = window.innerHeight;
		// sample.x = 0.5*Math.random() - 0.5;
		// sample.y = 0.5*Math.random() - 0.5;
		var scale = 0.5;
		var x = (2*sample.x-1) * scale;
		var y = (2*sample.y-1) * scale;
		var theta = Math.random() * 2 * Math.PI;
		var temp = x * Math.cos(theta) + Math.sin(theta) * y;
		y = x * -Math.sin(theta) + Math.cos(theta) * y;
		x = temp;
		this.camera.setViewOffset(w, h, x, y, w, h);
	},

	render: function( renderer ) {
		var width = window.innerWidth, height = window.innerHeight;

		var depthTexture = null;

		this.perturbProjectionMatrix(this.frameCount-1);

		if ( ! this.saoRenderTarget ) {

			this.saoRenderTarget = new THREE.WebGLRenderTarget( width, height,
				{ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.FloatType, format: THREE.RGBAFormat } );
			this.saoRenderTargetPingPong = new THREE.WebGLRenderTarget( width, height,
					{ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.FloatType, format: THREE.RGBAFormat } );
			this.normalRenderTarget = new THREE.WebGLRenderTarget( width, height,
				{ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat } );
		}
		// return;
		if( ! depthTexture && ! this.depthRenderTarget ) {

			this.depthRenderTarget = new THREE.WebGLRenderTarget( width, height,
				{ minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat } );
		}

		this.updateParameters( this.camera );

		var clearColor = renderer.getClearColor(), clearAlpha = renderer.getClearAlpha(), autoClear = renderer.autoClear;
		renderer.autoClear = false;

		var depthPackingMode = 0;

		if( ! depthTexture ) {

			var oldClearColor = renderer.getClearColor(), oldClearAlpha = renderer.getClearAlpha();
			renderer.setClearColor( 0xffffff, 1.0 );

			this.scene.overrideMaterial = this.depthMaterial;
			renderer.render( this.scene, this.camera, this.depthRenderTarget, true );
			this.scene.overrideMaterial = null;

			renderer.setClearColor( 0xffffff, 1.0 );

			depthTexture = this.depthRenderTarget.texture;
			depthPackingMode = 1;

		}

		if( ! this.implicitNormals ) {

			var oldClearColor = renderer.getClearColor(), oldClearAlpha = renderer.getClearAlpha();
			renderer.setClearColor( new THREE.Color( 0.5, 0.5, 1.0 ), 1.0 );

			this.scene.overrideMaterial = this.normalMaterial;
			renderer.render( this.scene, this.camera, this.normalRenderTarget, true );
			this.scene.overrideMaterial = null;

			renderer.setClearColor( oldClearColor, oldClearAlpha );

		}
		this.camera.view = null;
		var w = window.innerWidth; var h = window.innerHeight;
		this.camera.setViewOffset(w, h, 0, 0, w, h);

		this.saoMaterial.defines[ 'DEPTH_PACKING' ] = depthPackingMode;
		this.saoMaterial.defines[ 'DEPTH_MIPS' ] = this.depthMIPs ? 1 : 0;
		this.saoMaterial.uniforms[ "tNormal" ].value = this.normalRenderTarget.texture;
		this.saoMaterial.uniforms[ "tDepth" ].value = depthTexture;

		var currentSAOReadTarget = (this.currentFrameCount % 2 == 0) ? this.saoRenderTargetPingPong : this.saoRenderTarget;
		this.saoMaterial.uniforms[ "tAOPrevious" ].value = currentSAOReadTarget;
		this.saoMaterial.uniforms[ "tPoissonSamples" ].value = this.poissonTexture;
		this.saoMaterial.uniforms[ "frameCount" ].value = this.frameCount;
		this.saoMaterial.uniforms[ "currentFrameCount" ].value = this.currentFrameCount;
		this.saoMaterial.uniforms[ "poissonTextureWidth" ].value = this.poissonTexture.image.width;

		var oldClearColor = renderer.getClearColor(), oldClearAlpha = renderer.getClearAlpha();
		renderer.setClearColor( 0xffffff, 1.0 );

		var currentSAOWriteTarget = (this.currentFrameCount % 2 == 0) ? this.saoRenderTarget : this.saoRenderTargetPingPong;

		this.sceneOrtho.overrideMaterial = this.saoMaterial;
    renderer.render( this.sceneOrtho, this.orthoCamera, currentSAOWriteTarget, true);
    this.sceneOrtho.overrideMaterial = null;

		this.frameCount += this.frameCountIncrement;
		this.currentFrameCount += 1.0;
		this.frameCount = this.frameCount >= this.samples.length ? this.samples.length : this.frameCount;
		this.currentFrameCount = this.currentFrameCount >= this.samples.length ? this.samples.length : this.currentFrameCount;

		renderer.autoClear = autoClear;
		renderer.setClearColor( clearColor );
		renderer.setClearAlpha( clearAlpha );

	},

	getSAOBuffer: function() {
		var currentSAOWriteTarget = (this.currentFrameCount % 2 === 0) ? this.saoRenderTarget : this.saoRenderTargetPingPong;
		return this.saoRenderTargetPingPong;
	}

};
