/**
 * @author Prashant Sharma / spidersharma03
 */

THREE.AreaLightTextureFilter = function( sourceTexture, samplesPerLevel ) {

	this.sourceTexture = sourceTexture;
	this.resolution = {x: sourceTexture.image.width, y:sourceTexture.image.height };
  this.samplesPerLevel = ( samplesPerLevel !== undefined ) ? samplesPerLevel : 16;

	// var monotonicEncoding = ( sourceTexture.encoding === THREE.LinearEncoding ) ||
	// 	( sourceTexture.encoding === THREE.GammaEncoding ) || ( sourceTexture.encoding === THREE.sRGBEncoding );

	// this.sourceTexture.minFilter = ( monotonicEncoding ) ? THREE.LinearFilter : THREE.NearestFilter;
	// this.sourceTexture.magFilter = ( monotonicEncoding ) ? THREE.LinearFilter : THREE.NearestFilter;
	// this.sourceTexture.generateMipmaps = this.sourceTexture.generateMipmaps && monotonicEncoding;

	var size = this.resolution;
	var params = {
		format: this.sourceTexture.format,
		magFilter: THREE.LinearFilter,
		minFilter: THREE.LinearFilter,
		type: this.sourceTexture.type,
		generateMipmaps: false,
		anisotropy: this.sourceTexture.anisotropy,
		encoding: this.sourceTexture.encoding
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
		this.renderTargetsHorizontal.push( renderTarget );
		var renderTarget = new THREE.WebGLRenderTarget( sizex, sizey, params );
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

	update: function( renderer ) {

		var gammaInput = renderer.gammaInput;
		var gammaOutput = renderer.gammaOutput;
		var toneMapping = renderer.toneMapping;
		var toneMappingExposure = renderer.toneMappingExposure;

		renderer.toneMapping = THREE.LinearToneMapping;
		renderer.toneMappingExposure = 1.0;
		renderer.gammaInput = false;
		renderer.gammaOutput = false;

    var renderTarget = this.sourceTexture;

		for ( var i = 1; i < this.numLods; i ++ ) {

      this.shader.uniforms[ 'filterRadius' ].value = 0;
			this.shader.uniforms[ 'texSize' ].value = new THREE.Vector2(this.renderTargetsHorizontal[i].width, this.renderTargetsHorizontal[i].height);
      this.shader.uniforms[ 'direction' ].value = new THREE.Vector2(1, 0);
      this.shader.uniforms[ 'colorTexture' ].value = renderTarget;
      renderer.render( this.scene, this.camera, this.renderTargetsHorizontal[i], true );
      this.shader.uniforms[ 'direction' ].value = new THREE.Vector2(0, 1);
      this.shader.uniforms[ 'colorTexture' ].value = this.renderTargetsHorizontal[i].texture;
      renderer.render( this.scene, this.camera, this.renderTargetsVertical[i], true );
      renderTarget = this.renderTargetsVertical[i];

      var buffer = new Uint8Array(4 * renderTarget.width * renderTarget.height);
			renderer.setRenderTarget( renderTarget );
      renderer.readRenderTargetPixels( renderTarget, 0, 0, renderTarget.width, renderTarget.height, buffer);
      this.sourceTexture.mipmaps[i] = { data: buffer, width: renderTarget.width, height: renderTarget.height };
		}
		this.sourceTexture.generateMipmaps = false;
		this.sourceTexture.needsUpdate = true;

		renderer.toneMapping = toneMapping;
		renderer.toneMappingExposure = toneMappingExposure;
		renderer.gammaInput = gammaInput;
		renderer.gammaOutput = gammaOutput;

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
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);}"
		} );
	}

};
