/**
 * @author Prashant Sharma / spidersharma03
 */

THREE.AreaLightTextureFilter = function( sourceTexture, samplesPerLevel ) {

	this.sourceTexture = sourceTexture;

	if( !this.isPowerOfTwo(sourceTexture.image) )
		this.sourceTexture.image = this.makePowerOfTwo( sourceTexture.image );

	this.resolution = {x: sourceTexture.image.width, y:sourceTexture.image.height };
  this.samplesPerLevel = ( samplesPerLevel !== undefined ) ? samplesPerLevel : 16;

	var size = this.resolution;
	var params = {
		format: THREE.RGBAFormat,
		magFilter: THREE.LinearFilter,
		minFilter: THREE.LinearFilter,
	};

	// how many LODs fit
  var maxSize = Math.max( size.x, size.y );
	this.numLods = Math.log( maxSize ) / Math.log( 2 ) + 1;  // IE11 doesn't support Math.log2

  this.renderTargetsHorizontal = [];
  this.renderTargetsVertical = [];

  sizex = size.x;
  sizey = size.y;

	for ( var i = 0; i < this.numLods; i ++ ) {
		var renderTarget = new THREE.WebGLRenderTarget( sizex, sizey, params );
		// renderTarget.texture.generateMipmaps = false;
		this.renderTargetsHorizontal.push( renderTarget );
		var renderTarget = new THREE.WebGLRenderTarget( sizex, sizey, params );
		// renderTarget.texture.generateMipmaps = false;
    this.renderTargetsVertical.push( renderTarget );
		sizex = Math.ceil(sizex / 2);
    sizey = Math.ceil(sizey / 2);
	}

	this.camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0.0, 1000 );

	// this.shader = this.getShader();
  this.shader = this.getSeperableBlurMaterial();

	// this.shader.defines['SAMPLES_PER_LEVEL'] = this.samplesPerLevel;
	this.planeMesh = new THREE.Mesh( new THREE.PlaneGeometry( 2, 2, 0 ), this.shader );
	this.planeMesh.material.side = THREE.DoubleSide;
	this.scene = new THREE.Scene();
	this.scene.add( this.planeMesh );
	this.scene.add( this.camera );

	this.shader.uniforms[ 'colorTexture' ].value = this.sourceTexture;
	this.shader.envMap = this.sourceTexture;

};

THREE.AreaLightTextureFilter.prototype = {

	constructor : THREE.AreaLightTextureFilter,

	isPowerOfTwo: function( image ) {

		return this._isPowerOfTwo( image.width ) && this._isPowerOfTwo( image.height );

	},

	_isPowerOfTwo: function ( value ) {

		return ( value & ( value - 1 ) ) === 0 && value !== 0;

	},

	nearestPowerOfTwo: function ( value ) {

		return Math.pow( 2, Math.round( Math.log( value ) / Math.LN2 ) );

	},

	makePowerOfTwo: function( image ) {

		if ( image instanceof HTMLImageElement || image instanceof HTMLCanvasElement ) {

			var canvas = document.createElementNS( 'http://www.w3.org/1999/xhtml', 'canvas' );
			canvas.width = this.nearestPowerOfTwo( image.width );
			canvas.height = this.nearestPowerOfTwo( image.height );

			var context = canvas.getContext( '2d' );
			context.drawImage( image, 0, 0, canvas.width, canvas.height );

			console.warn( 'THREE.WebGLRenderer: image is not power of two (' + image.width + 'x' + image.height + '). Resized to ' + canvas.width + 'x' + canvas.height, image );

			return canvas;

		}

		return image;

	},

	disposeRenderTargets: function() {
		for( let i=0; i<this.renderTargetsHorizontal.length; i++ ) {
			let renderTarget = this.renderTargetsHorizontal[i];
			renderTarget.dispose();
		  renderTarget = this.renderTargetsVertical[i];
			renderTarget.dispose();
		}
		this.renderTargetsHorizontal = [];
		this.renderTargetsVertical	 = [];
	},

	createFilteredTexture: function( renderer ) {

		var texture = new THREE.DataTexture();
		texture.format = THREE.RGBAFormat;
		texture.generateMipmaps = false;
		texture.magFilter = THREE.LinearFilter;
		texture.minFilter = THREE.LinearMipMapLinearFilter;

		var channelsPerPixel = 4;

		var gammaInput = renderer.gammaInput;
		var gammaOutput = renderer.gammaOutput;
		var toneMapping = renderer.toneMapping;
		var toneMappingExposure = renderer.toneMappingExposure;

		renderer.toneMapping = THREE.LinearToneMapping;
		renderer.toneMappingExposure = 1.0;
		renderer.gammaInput = false;
		renderer.gammaOutput = false;

    var renderTarget = this.sourceTexture;
		var filterRadii = [1, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5];
		for ( var i = 0; i < this.numLods; i ++ ) {
			// renderTarget = this.sourceTexture;
      this.shader.uniforms[ 'filterRadius' ].value = filterRadii[i];
			this.shader.uniforms[ 'texSize' ].value = new THREE.Vector2(this.renderTargetsHorizontal[i].width, this.renderTargetsHorizontal[i].height);
      this.shader.uniforms[ 'direction' ].value = new THREE.Vector2(1, 0);
      this.shader.uniforms[ 'colorTexture' ].value = renderTarget;
      renderer.render( this.scene, this.camera, this.renderTargetsHorizontal[i], true );
      this.shader.uniforms[ 'direction' ].value = new THREE.Vector2(0, 1);
      this.shader.uniforms[ 'colorTexture' ].value = this.renderTargetsHorizontal[i].texture;
      renderer.render( this.scene, this.camera, this.renderTargetsVertical[i], true );
      renderTarget = this.renderTargetsVertical[i];

      var buffer = new Uint8Array(channelsPerPixel * renderTarget.width * renderTarget.height);
			renderer.setRenderTarget( renderTarget );
      renderer.readRenderTargetPixels( renderTarget, 0, 0, renderTarget.width, renderTarget.height, buffer);
      texture.mipmaps[i] = { data: buffer, width: renderTarget.width, height: renderTarget.height };
		}
		texture.image.data = texture.mipmaps[0].data;
		texture.image.width = texture.mipmaps[0].width;
		texture.image.height = texture.mipmaps[0].height;
		texture.needsUpdate = true;

		renderer.toneMapping = toneMapping;
		renderer.toneMappingExposure = toneMappingExposure;
		renderer.gammaInput = gammaInput;
		renderer.gammaOutput = gammaOutput;

		this.disposeRenderTargets();

		return texture;
	},

  getSeperableBlurMaterial: function() {

		return new THREE.ShaderMaterial( {

			defines: {
				"NUM_SAMPLES" : 32,
			},

			uniforms: {
				"colorTexture": { value: null },
				"texSize": 				{ value: new THREE.Vector2( 0.5, 0.5 ) },
				"direction": 				{ value: new THREE.Vector2( 0.5, 0.5 ) },
				"filterRadius": { value: 10}
			},

			vertexShader:
				"varying vec2 vUv;\n\
				void main() {\n\
					vUv = uv;\n\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
				}",

			fragmentShader:
			 "varying vec2 vUv;\
				uniform sampler2D colorTexture;\
				uniform float filterRadius;\
				uniform vec2 texSize;\
				uniform vec2 direction;\
				\
				float gaussianPdf(in float x, in float sigma) {\
					return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;\
				}\
				void main() {\n\
					vec2 invSize = 1.0 / texSize;\
					float fSigma = filterRadius;\
					float weightSum = gaussianPdf(0.0, fSigma);\
					vec3 diffuseSum = texture2D( colorTexture, vUv).rgb * weightSum;\
					float INV_NUM_SAMPLES = 1.0/float(NUM_SAMPLES - 1);\
					for( int i = 1; i < NUM_SAMPLES; i ++ ) {\
						float x = float(i);\
						float weight = gaussianPdf(x, fSigma);\
						vec2 uvOffset = direction * invSize * filterRadius * x * INV_NUM_SAMPLES;\
						vec2 vUv1 = vUv + uvOffset;\
						float w = weight;\
						if( vUv1.x < 0.0 || vUv1.x > 1.0 || vUv1.y < 0.0 || vUv1.y > 1.0 ) {\
							w = 0.0;\
						}\
						vec3 sample1 = texture2D( colorTexture, vUv1).rgb;\
						diffuseSum += sample1 * w;\
						weightSum += w;\
						\
						vec2 vUv2 = vUv - uvOffset;\
						w = weight;\
						if( vUv2.x < 0.0 || vUv2.x > 1.0 || vUv2.y < 0.0 || vUv2.y > 1.0 ) {\
							w = 0.0;\
						}\
						vec3 sample2 = texture2D( colorTexture, vUv2).rgb;\
						diffuseSum += sample2 * w;\
						weightSum += w;\
					}\
					gl_FragColor = vec4(diffuseSum/weightSum , 1.0);}"
		} );
	}

};
