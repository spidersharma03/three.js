/**
 * @author spidersharma / http://eduperiment.com/
 */

THREE.BloomPassNew = function ( resolution, strength, radius, threshold ) {

	THREE.Pass.call( this );

	this.strength = ( strength !== undefined ) ? strength : 1;
	this.resolution = ( resolution !== undefined ) ? new THREE.Vector2(resolution.x, resolution.y) : new THREE.Vector2(256, 256);

	// render targets
	var pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
	this.renderTargetsHorizontal = [];
	this.renderTargetsVertical = [];
	this.nMips = 5;
	var resx = Math.round(this.resolution.x/2);
	var resy = Math.round(this.resolution.y/2);

	this.renderTargetBright = new THREE.WebGLRenderTarget( resx, resy, pars );
	this.renderTargetBright.generateMipmaps = false;

	for( var i=0; i<this.nMips; i++) {
		var renderTarget = new THREE.WebGLRenderTarget( resx, resy, pars );
		renderTarget.generateMipmaps = false;
		this.renderTargetsHorizontal.push(renderTarget);
		var renderTarget = new THREE.WebGLRenderTarget( resx, resy, pars );
		renderTarget.generateMipmaps = false;
		this.renderTargetsVertical.push(renderTarget);
	  resx = Math.round(resx/2);
		resy = Math.round(resy/2);
	}

	// luminosity high pass material

	if ( THREE.LuminosityHighPassShader === undefined )
		console.error( "THREE.BloomPass relies on THREE.LuminosityHighPassShader" );

	var highPassShader = THREE.LuminosityHighPassShader;
	this.highPassUniforms = THREE.UniformsUtils.clone( highPassShader.uniforms );

	this.highPassUniforms[ "luminosityThreshold" ].value = threshold;
	this.highPassUniforms[ "smoothWidth" ].value = 0.01;

	this.materialHighPassFilter = new THREE.ShaderMaterial( {
		shaderID: highPassShader.shaderID,
		uniforms: this.highPassUniforms,
		vertexShader:  highPassShader.vertexShader,
		fragmentShader: highPassShader.fragmentShader,
		defines: {}
	} );

	// Gaussian Blur Materials
	this.separableBlurMaterials = [];
	var kernelSizeArray = [3, 5, 7, 9, 11];
	var resx = Math.round(this.resolution.x/2);
	var resy = Math.round(this.resolution.y/2);
	for( var i=0; i<this.nMips; i++) {
		this.separableBlurMaterials.push(this.getSeperableBlurMaterial(kernelSizeArray[i]));
		this.separableBlurMaterials[i].uniforms[ "texSize" ].value = new THREE.Vector2(resx, resy);
		resx = Math.round(resx/2);
		resy = Math.round(resy/2);
	}

	// Composite material
	this.compositeMaterial = this.getCompositeMaterial(this.nMips);
	this.compositeMaterial.uniforms["blurTexture1"].value = this.renderTargetsVertical[0].texture;
	this.compositeMaterial.uniforms["blurTexture2"].value = this.renderTargetsVertical[1].texture;
	this.compositeMaterial.uniforms["blurTexture3"].value = this.renderTargetsVertical[2].texture;
	this.compositeMaterial.uniforms["blurTexture4"].value = this.renderTargetsVertical[3].texture;
	this.compositeMaterial.uniforms["blurTexture5"].value = this.renderTargetsVertical[4].texture;
	this.compositeMaterial.uniforms["bloomStrength"].value = strength;
	this.compositeMaterial.uniforms["bloomRadius"].value = 0.1;

	var bloomFactors = [1.1, 0.9, 0.6, 0.3, 0.1];
	// var bloomFactors = [0.1, 0.3, 0.6, 0.9, 1.1];
	this.compositeMaterial.uniforms["bloomFactors"].value = bloomFactors;

	// copy material

	if ( THREE.CopyShader === undefined )
		console.error( "THREE.BloomPass relies on THREE.CopyShader" );

	var copyShader = THREE.CopyShader;

	this.copyUniforms = THREE.UniformsUtils.clone( copyShader.uniforms );
	this.copyUniforms[ "opacity" ].value = 1.0;

	this.materialCopy = new THREE.ShaderMaterial( {
		shaderID: copyShader.shaderID,
		uniforms: this.copyUniforms,
		vertexShader: copyShader.vertexShader,
		fragmentShader: copyShader.fragmentShader,
		blending: THREE.AdditiveBlending,
		// premultipliedAlpha: true,
		depthTest: false,
		depthWrite: false,
		transparent: true
	} );

	this.enabled = true;
	this.needsSwap = false;

	this.oldClearColor = new THREE.Color();
	this.oldClearAlpha = 1;

	this.camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
	this.scene  = new THREE.Scene();

	this.quad = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ), null );
	this.scene.add( this.quad );

};

THREE.BloomPassNew.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: THREE.BloomPassNew,

	setStrength: function(strength) {
		this.compositeMaterial.uniforms["bloomStrength"].value = strength;
	},

	setThreshold: function(threshold) {
		this.highPassUniforms[ "luminosityThreshold" ].value = threshold;
	},

	setRadius: function(radius) {
		this.compositeMaterial.uniforms["bloomRadius"].value = radius;
	},

	render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

		this.oldClearColor.copy( renderer.getClearColor() );
		this.oldClearAlpha = renderer.getClearAlpha();
		renderer.autoClear = false;

		renderer.setClearColor( new THREE.Color( 0, 0, 0 ), 0 );

		if ( maskActive ) renderer.context.disable( renderer.context.STENCIL_TEST );

		// 1. Extract Bright Areas
		this.highPassUniforms[ "tDiffuse" ].value = readBuffer;
		this.quad.material = this.materialHighPassFilter;
		renderer.render( this.scene, this.camera, this.renderTargetBright, true );

		// 2. Blur All the mips progressively
		var inputRenderTarget = this.renderTargetBright;
		for(var i=0; i<this.nMips; i++) {
			this.quad.material = this.separableBlurMaterials[i];
			this.separableBlurMaterials[i].uniforms[ "inputTexture" ].value = inputRenderTarget.texture;
			this.separableBlurMaterials[i].uniforms[ "direction" ].value = THREE.BloomPassNew.BlurDirectionX;
			renderer.render( this.scene, this.camera, this.renderTargetsHorizontal[i], true );
			this.separableBlurMaterials[i].uniforms[ "inputTexture" ].value = this.renderTargetsHorizontal[i].texture;
			this.separableBlurMaterials[i].uniforms[ "direction" ].value = THREE.BloomPassNew.BlurDirectionY;
			renderer.render( this.scene, this.camera, this.renderTargetsVertical[i], true );
			inputRenderTarget = this.renderTargetsVertical[i];
		}

		// Composite
		this.quad.material = this.compositeMaterial;
		renderer.render( this.scene, this.camera, this.renderTargetsHorizontal[0], true );

		// Copy
		this.quad.material = this.materialCopy;

		this.copyUniforms[ "tDiffuse" ].value = this.renderTargetsHorizontal[0].texture;

		if ( maskActive ) renderer.context.enable( renderer.context.STENCIL_TEST );

		renderer.render( this.scene, this.camera, readBuffer, false );

		renderer.setClearColor( this.oldClearColor, this.oldClearAlpha );
	},

	getSeperableBlurMaterial: function(kernelRadius) {

		return new THREE.ShaderMaterial( {

			defines: {
				"KERNEL_RADIUS" : kernelRadius,
				"SIGMA" : kernelRadius
			},

			uniforms: {
				"inputTexture": { value: null },
				"texSize": 				{ value: new THREE.Vector2( 0.5, 0.5 ) },
				"direction": 				{ value: new THREE.Vector2( 0.5, 0.5 ) },
			},

			vertexShader:
				"varying vec2 vUv;\n\
				void main() {\n\
					vUv = uv;\n\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
				}",

			fragmentShader:
				"varying vec2 vUv;\n\
				uniform sampler2D inputTexture;\n\
				uniform vec2 texSize;\
				uniform vec2 direction;\
				\
				float normpdf(in float x, in float sigma)\
				{\
					return 0.39894*exp(-0.5*x*x/(sigma*sigma))/sigma;\
				}\
				\
				vec3 dofBlur() { \
					vec2 invSize = 1.0 / texSize;\
					float weightSum = 0.0;\
					vec3 diffuseSum = vec3(0.0);\
					for( int i = -KERNEL_RADIUS; i < KERNEL_RADIUS; i +=2 ) {\
						float w1 = normpdf(float(i), float(SIGMA));\
						float w2 = normpdf(float(i+1), float(SIGMA));\
						float t = w2/(w1 + w2);\
						vec2 offset = direction * invSize * ( float(i) + t );\
						vec3 interpolatedSample = texture2D( inputTexture, vUv + offset).rgb;\
						diffuseSum += interpolatedSample * (w1 + w2);\
						weightSum += (w1 + w2);\
					}\
					float w = normpdf(float(KERNEL_RADIUS), float(SIGMA));\
					vec2 offset = direction * invSize * float(KERNEL_RADIUS);\
					vec3 sample = texture2D( inputTexture, vUv + offset).rgb * w;\
					diffuseSum += sample;\
					weightSum += w;\
				  return diffuseSum/weightSum;\
				}\
				\
				\
				void main() {\n\
					gl_FragColor = vec4(dofBlur(), 1.0);\n\
				}"
		} );
	},

	getCompositeMaterial: function(nMips) {

		return new THREE.ShaderMaterial( {

			defines:{
				"NUM_MIPS" : nMips
			},

			uniforms: {
				"blurTexture1": { value: null },
				"blurTexture2": { value: null },
				"blurTexture3": { value: null },
				"blurTexture4": { value: null },
				"blurTexture5": { value: null },
				"bloomStrength" : { value: 1.0 },
				"bloomFactors" : { value: null },
				"bloomRadius" : { value: 0.0 }
			},

			vertexShader:
				"varying vec2 vUv;\n\
				void main() {\n\
					vUv = uv;\n\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
				}",

			fragmentShader:
				"varying vec2 vUv;\
				uniform sampler2D blurTexture1;\
				uniform sampler2D blurTexture2;\
				uniform sampler2D blurTexture3;\
				uniform sampler2D blurTexture4;\
				uniform sampler2D blurTexture5;\
				uniform float bloomStrength;\
				uniform float bloomRadius;\
				uniform float bloomFactors[NUM_MIPS];\
				\
				float lerpBloomFactor(const in float a) { \
					float x = 1.2 - a;\
					return mix(a, x, bloomRadius);\
				}\
				\
				void main() {\
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * texture2D(blurTexture1, vUv) + \
					 							 lerpBloomFactor(bloomFactors[1]) * texture2D(blurTexture2, vUv) + \
												 lerpBloomFactor(bloomFactors[2]) * texture2D(blurTexture3, vUv) + \
												 lerpBloomFactor(bloomFactors[3]) * texture2D(blurTexture4, vUv) + \
												 lerpBloomFactor(bloomFactors[4]) * texture2D(blurTexture5, vUv) );\
				}"
		} );
	}

} );

THREE.BloomPassNew.BlurDirectionX = new THREE.Vector2( 1.0, 0.0 );
THREE.BloomPassNew.BlurDirectionY = new THREE.Vector2( 0.0, 1.0 );
