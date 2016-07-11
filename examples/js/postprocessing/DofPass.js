/**
 * @author spidersharma03 / http://eduperiment.com/
 */

THREE.DofPass = function (resolution, renderScene, renderCamera) {

	THREE.Pass.call( this );

	var resolution = ( resolution !== undefined ) ? resolution : new THREE.Vector2(256, 256);
	// render targets
  var downSampleRes = new THREE.Vector2(resolution.x/2, resolution.y/2);
	// TODO Check for the availability of half float type, and default it to unsigned byte
	var pars = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType, format: THREE.RGBAFormat };

	this.renderTargetDownSample = new THREE.WebGLRenderTarget( downSampleRes.x, downSampleRes.y, pars );
	this.renderTargetDownSample.generateMipmaps = false;
	this.renderTargetBlurX = new THREE.WebGLRenderTarget( downSampleRes.x, downSampleRes.y, pars );
	this.renderTargetBlurX.generateMipmaps = false;
	this.renderTargetBlurY = new THREE.WebGLRenderTarget( downSampleRes.x, downSampleRes.y, pars );
	this.renderTargetBlurY.generateMipmaps = false;

	var pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
	this.renderTargetDofBlur = new THREE.WebGLRenderTarget( downSampleRes.x, downSampleRes.y, pars );
	this.renderTargetDofBlur.generateMipmaps = false;
	this.renderTargetDofBlur1 = new THREE.WebGLRenderTarget( downSampleRes.x, downSampleRes.y, pars );
	this.renderTargetDofBlur1.generateMipmaps = false;

	this.renderTargetDofCombine = new THREE.WebGLRenderTarget( resolution.x, resolution.y, pars );
	this.renderTargetDofCombine.generateMipmaps = false;

	this.needsSwap = false;

	this.camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
	this.scene  = new THREE.Scene();

	this.quad = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ), null );
	this.scene.add( this.quad );

	this.focalDepth = 10.0;
	this.dofBlurNearFar = new THREE.Vector2(1.5, 0.1);

	this.downSampleMaterial = this.getDownSampleMaterial();
	this.downSampleMaterial.uniforms[ "dofBlurNearFar" ].value = this.dofBlurNearFar;
	this.downSampleMaterial.uniforms[ "cameraNearFar" ].value = new THREE.Vector2(renderCamera.near, renderCamera.far);
	this.downSampleMaterial.uniforms[ "focalDepth" ].value = this.focalDepth;

	this.dilateNearCocMaterial = this.getDilateNearCocMaterial();
	this.dilateNearCocMaterial.uniforms[ "dofBlurNearFar" ].value = this.dofBlurNearFar;
	this.dilateNearCocMaterial.uniforms[ "texSize" ].value = new THREE.Vector2(downSampleRes.x, downSampleRes.y);

	this.dofBlurType = 1;
	this.dofBlurMaterial = (this.dofBlurType === 0) ? this.getDofBlurCircularMaterial() : this.getDofBlurSeperableMaterial();
	this.dofBlurMaterial.uniforms[ "texSize" ].value = new THREE.Vector2(downSampleRes.x, downSampleRes.y);

	this.dofCombineMaterial = this.getDofCombineMaterial();
	this.dofCombineMaterial.uniforms[ "dofBlurNearFar" ].value = this.dofBlurNearFar;
	this.dofCombineMaterial.uniforms[ "texSize" ].value = new THREE.Vector2(downSampleRes.x, downSampleRes.y);
	this.dofCombineMaterial.uniforms[ "cameraNearFar" ].value = new THREE.Vector2(renderCamera.near, renderCamera.far);
	this.dofCombineMaterial.uniforms[ "focalDepth" ].value = this.focalDepth;

	if ( THREE.CopyShader === undefined )
		console.error( "THREE.DofPass relies on THREE.CopyShader" );

	var copyShader = THREE.CopyShader;

	this.copyUniforms = THREE.UniformsUtils.clone( copyShader.uniforms );
	this.materialCopy = new THREE.ShaderMaterial( {

		uniforms: this.copyUniforms,
		vertexShader: copyShader.vertexShader,
		fragmentShader: copyShader.fragmentShader,
	} );

	this.depthMaterial = new THREE.MeshDepthMaterial();
	this.depthMaterial.side = THREE.DoubleSide;
	this.depthMaterial.depthPacking = THREE.RGBADepthPacking;
	this.depthMaterial.blending = THREE.NoBlending;
	this.depthRenderTarget = new THREE.WebGLRenderTarget( resolution.x, resolution.y,
					{ minFilter: THREE.NearesFilter, magFilter: THREE.NearesFilter, format: THREE.RGBAFormat } );
	this.renderScene = renderScene;
	this.renderCamera = renderCamera;
};

THREE.DofPass.prototype = Object.create( THREE.Pass.prototype );

THREE.DofPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: THREE.DofPass,

	setFocalDepth: function(focalDepth) {
		this.focalDepth = focalDepth;
		this.downSampleMaterial.uniforms[ "focalDepth" ].value = focalDepth;
		this.dofCombineMaterial.uniforms[ "focalDepth" ].value = focalDepth;
	},

	render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

		if ( maskActive ) renderer.context.disable( renderer.context.STENCIL_TEST );
		// Render Scene into depth buffer. This is temporary and should not be done here.
		this.renderScene.overrideMaterial = this.depthMaterial;
		renderer.setClearColor(0x666666, 1);
	  renderer.render( this.renderScene, this.renderCamera, this.depthRenderTarget, true );
		this.renderScene.overrideMaterial = null;
		//renderer.setClearColor(0x000000, 0);

		// 1. Downsample the Original texture, and store coc in the alpha channel
		this.quad.material = this.downSampleMaterial;
		this.downSampleMaterial.uniforms[ "inputTexture" ].value = readBuffer.texture;
		this.downSampleMaterial.uniforms[ "depthTexture" ].value = this.depthRenderTarget.texture;
		renderer.render( this.scene, this.camera, this.renderTargetDownSample, true);

		// 2. Dilate Near field coc
		this.quad.material = this.dilateNearCocMaterial;
		this.dilateNearCocMaterial.uniforms[ "inputTexture" ].value = this.renderTargetDownSample.texture;
		this.dilateNearCocMaterial.uniforms[ "depthTexture" ].value = this.depthRenderTarget.texture;
		this.dilateNearCocMaterial.uniforms[ "direction" ].value = new THREE.Vector2(1, 0);
		renderer.render( this.scene, this.camera, this.renderTargetBlurX, true );
		this.dilateNearCocMaterial.uniforms[ "inputTexture" ].value = this.renderTargetBlurX.texture;
		this.dilateNearCocMaterial.uniforms[ "direction" ].value = new THREE.Vector2(0, 1);
		renderer.render( this.scene, this.camera, this.renderTargetDownSample, true );

		// 3. Blur Dof
		if( this.dofBlurType === 0 ){
			this.quad.material = this.dofBlurMaterial;
			this.dofBlurMaterial.uniforms[ "inputTexture" ].value = this.renderTargetDownSample.texture;
			this.dofBlurMaterial.uniforms[ "depthTexture" ].value = this.depthRenderTarget.texture;
			renderer.render( this.scene, this.camera, this.renderTargetDofBlur1, true );
		}
		else {
			this.quad.material = this.dofBlurMaterial;
			this.dofBlurMaterial.uniforms[ "cocTexture" ].value = this.renderTargetDownSample.texture;
			this.dofBlurMaterial.uniforms[ "inputTexture" ].value = this.renderTargetDownSample.texture;
			this.dofBlurMaterial.uniforms[ "direction" ].value = new THREE.Vector2(1, 0);
			renderer.render( this.scene, this.camera, this.renderTargetDofBlur, true );
			this.dofBlurMaterial.uniforms[ "inputTexture" ].value = this.renderTargetDofBlur.texture;
			this.dofBlurMaterial.uniforms[ "direction" ].value = new THREE.Vector2(0, 1);
			renderer.render( this.scene, this.camera, this.renderTargetDofBlur1, true );
		}
		// 4. Dof Combine
		this.quad.material = this.dofCombineMaterial;
		this.dofCombineMaterial.uniforms[ "inputTexture" ].value = readBuffer.texture;
		this.dofCombineMaterial.uniforms[ "depthTexture" ].value = this.depthRenderTarget.texture;
		this.dofCombineMaterial.uniforms[ "blurTexture" ].value = this.renderTargetDofBlur1.texture;
		this.dofCombineMaterial.uniforms[ "cocTexture" ].value = this.renderTargetDownSample.texture;
		renderer.render( this.scene, this.camera, this.renderTargetDofCombine, true );

		// Copy Pass
		this.quad.material = this.materialCopy;
		this.copyUniforms[ "tDiffuse" ].value = this.renderTargetDofCombine.texture;

		if ( maskActive ) renderer.context.enable( renderer.context.STENCIL_TEST );
		renderer.render( this.scene, this.camera, readBuffer, this.clear );
	},

	getDownSampleMaterial: function() {

		return new THREE.ShaderMaterial( {

			uniforms: {
				"inputTexture": { value: null },
				"depthTexture": { value: null },
				"dofBlurNearFar": { value: new THREE.Vector2( 0.5, 0.5 ) },
				"cameraNearFar": { value: new THREE.Vector2( 0.1, 100 ) },
				"focalDepth": { value: 1.0 }
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
				uniform sampler2D depthTexture;\n\
				uniform vec2 dofBlurNearFar;\
				uniform vec2 cameraNearFar;\
				uniform float focalDepth;\
				const float MAX_BLUR = 16.0;\
				\
				float texDepthToCoC(const in sampler2D texDepth, const in vec2 uv, const in vec2 dofBlurNearFar) {\
				    vec4 fetch = texture2D(texDepth, uv).rgba;\
				    if(fetch.x == 1.0) return max(dofBlurNearFar.x, dofBlurNearFar.y);\
						float depth = unpackRGBAToDepth(fetch);\
						depth = -perspectiveDepthToViewZ(depth, cameraNearFar.x, cameraNearFar.y);\
						float coc = (depth - focalDepth)/depth;\
				    return (coc < 0.0 ? coc * dofBlurNearFar.x : coc * dofBlurNearFar.y);\
				}\
				\
				vec4 dofDownsampleInit(const in sampler2D tex, const in sampler2D texDepth, const in vec2 uv, const in vec2 dofBlurNearFar) {\
						float coc = texDepthToCoC(texDepth, uv, dofBlurNearFar);\
						return vec4(texture2D(inputTexture, uv).rgb, coc);\
				}\
				\
				void main() {\n\
					gl_FragColor = dofDownsampleInit(inputTexture, depthTexture, vUv, dofBlurNearFar);\n\
				}"
		} );
	},

	getDilateNearCocMaterial: function() {

		return new THREE.ShaderMaterial( {

			uniforms: {
				"inputTexture": { value: null },
				"depthTexture": { value: null },
				"dofBlurNearFar": { value: new THREE.Vector2( 0.5, 0.5 ) },
				"texSize": 				{ value: new THREE.Vector2( 0.5, 0.5 ) },
				"direction": 				{ value: new THREE.Vector2( 1, 0 ) },
			},

			vertexShader:
				"varying vec2 vUv;\n\
				void main() {\n\
					vUv = uv;\n\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
				}",

			fragmentShader:
				"#include <common>\n\
				varying vec2 vUv;\n\
				uniform sampler2D inputTexture;\n\
				uniform sampler2D depthTexture;\n\
				uniform vec2 direction;\
				uniform vec2 texSize;\
				uniform vec2 dofBlurNearFar;\
				const float MAX_BLUR = 16.0;\
				\
				float dilateNear(const in sampler2D tex, const in vec2 uv, const in vec2 offset, const in bool isBG) {\
				    float coc = 0.0;\
				    vec2 ofs = MAX_BLUR * offset / 5.0;\
				    float coc0 = texture2D(tex, uv).a;\
				    float coc1 = texture2D(tex, uv - 5.0 * ofs).a;\
				    float coc2 = texture2D(tex, uv - 4.0 * ofs).a;\
				    float coc3 = texture2D(tex, uv - 3.0 * ofs).a;\
				    float coc4 = texture2D(tex, uv - 2.0 * ofs).a;\
				    float coc5 = texture2D(tex, uv - 1.0 * ofs).a;\
				    float coc6 = texture2D(tex, uv + 1.0 * ofs).a;\
				    float coc7 = texture2D(tex, uv + 2.0 * ofs).a;\
				    float coc8 = texture2D(tex, uv + 3.0 * ofs).a;\
				    float coc9 = texture2D(tex, uv + 4.0 * ofs).a;\
				    float coc10 = texture2D(tex, uv + 5.0 * ofs).a;\
						\
				    if(isBG == true){\
				        coc = abs(coc0) * 0.095474 + \
				        (abs(coc1) + abs(coc10)) * 0.084264 + \
				        (abs(coc2) + abs(coc9)) * 0.088139 + \
				        (abs(coc3) + abs(coc8)) * 0.091276 + \
				        (abs(coc4) + abs(coc7)) * 0.093585 + \
				        (abs(coc5) + abs(coc6)) * 0.094998;\
				    } else {\
				        coc = min(coc0, 0.0);\
				        coc = min(coc1 * 0.3, coc);\
				        coc = min(coc2 * 0.5, coc);\
				        coc = min(coc3 * 0.75, coc);\
				        coc = min(coc4 * 0.8, coc);\
				        coc = min(coc5 * 0.95, coc);\
				        coc = min(coc6 * 0.95, coc);\
				        coc = min(coc7 * 0.8, coc);\
				        coc = min(coc8 * 0.75, coc);\
				        coc = min(coc9 * 0.5, coc);\
				        coc = min(coc10 * 0.3, coc);\
				        if(abs(coc0) > abs(coc))\
				            coc = coc0;\
				    }\
				    return coc;\
				}\
				\
				vec4 dofDilateNear(const in sampler2D tex, const in sampler2D texDepth, const in vec2 uv, const in vec2 texSize, const in float dofScale) {\
				    vec2 offset = direction/texSize * dofScale;\
				    float coc = dilateNear(tex, uv, offset, texture2D(texDepth, uv).x == 1.0);\
				    return vec4(texture2D(tex, uv).rgb, coc);\
				}\
				\
				void main() {\n\
					float dofScale = 0.5;\
					gl_FragColor = vec4(dofDilateNear(inputTexture, depthTexture, vUv, texSize, dofScale));\n\
				}"
		} );
	},

	getDofBlurCircularMaterial: function() {

		return new THREE.ShaderMaterial( {

			uniforms: {
				"inputTexture": { value: null },
				"depthTexture": { value: null },
				"texSize": 				{ value: new THREE.Vector2( 0.5, 0.5 ) },
			},

			vertexShader:
				"varying vec2 vUv;\n\
				void main() {\n\
					vUv = uv;\n\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
				}",

			fragmentShader:
				"#include <common>\n\
				varying vec2 vUv;\n\
				uniform sampler2D inputTexture;\n\
				uniform sampler2D depthTexture;\n\
				uniform vec2 texSize;\
				const float MAX_BLUR = 16.0;\
				\
				vec4 dofBlurCircular(const in sampler2D tex, const in sampler2D texDepth, const in vec2 uv, const in vec2 texSize, const float dofScale) {\
				    \
				    const int NUM_TAPS = 16;\
				    vec2 fTaps_Poisson[NUM_TAPS];\
				    fTaps_Poisson[0] = vec2(-0.399691779231, 0.728591545584);\
				    fTaps_Poisson[1] = vec2(-0.48622557676, -0.84016533712);\
				    fTaps_Poisson[2] = vec2(0.770309468987, -0.24906070432);\
				    fTaps_Poisson[3] = vec2(0.556596796154, 0.820359876432);\
				    fTaps_Poisson[4] = vec2(-0.933902004071, 0.0600539051593);\
				    fTaps_Poisson[5] = vec2(0.330144964342, 0.207477293384);\
				    fTaps_Poisson[6] = vec2(0.289013230975, -0.686749271417);\
				    fTaps_Poisson[7] = vec2(-0.0832470893559, -0.187351643125);\
				    fTaps_Poisson[8] = vec2(-0.296314525615, 0.254474834305);\
				    fTaps_Poisson[9] = vec2(-0.850977666059, 0.484642744689);\
				    fTaps_Poisson[10] = vec2(0.829287915319, 0.2345063545);\
				    fTaps_Poisson[11] = vec2(-0.773042143899, -0.543741521254);\
				    fTaps_Poisson[12] = vec2(0.0561133030864, 0.928419742597);\
				    fTaps_Poisson[13] = vec2(-0.205799249508, -0.562072714492);\
				    fTaps_Poisson[14] = vec2(-0.526991665882, -0.193690188118);\
				    fTaps_Poisson[15] = vec2(-0.051789270667, -0.935374050821);\
						\
				    vec4 centerFetch = texture2D(tex, uv);\
						\
				    float blurDist = MAX_BLUR * centerFetch.a * dofScale;\
						\
				    float rnd = PI2 * rand( uv );\
				    float cosa = cos(rnd);\
				    float sina = sin(rnd);\
				    vec4 basis = vec4(cosa, -sina, sina, cosa);\
						\
				    vec3 sumcol = vec3(0.0);\
				    float total = 0.0;\
						\
				    for (int i = 0; i < NUM_TAPS; i++) {\
				        vec2 ofs = fTaps_Poisson[i];\
								\
				        ofs = vec2(dot(ofs, basis.xy), dot(ofs, basis.zw) );\
								\
				        vec2 texcoord = uv + blurDist * ofs / texSize.xy;\
				        vec4 sample = texture2D(tex, texcoord);\
								\
				        float cocWeight = abs(sample.a);\
				        cocWeight *= cocWeight * cocWeight;\
								\
				        sumcol += sample.rgb * cocWeight;\
				        total += cocWeight;\
				    }\
						\
				    sumcol /= total;\
						\
				    return vec4(sumcol, 1.0);\
				}\
				\
				void main() {\n\
					float dofScale = 0.5;\
					gl_FragColor = dofBlurCircular(inputTexture, depthTexture, vUv, texSize, dofScale);\n\
				}"
		} );
	},

	getDofBlurSeperableMaterial: function() {

		return new THREE.ShaderMaterial( {

			uniforms: {
				"cocTexture":   { value: null },
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
				"#include <common>\n\
				varying vec2 vUv;\n\
				uniform sampler2D cocTexture;\n\
				uniform sampler2D inputTexture;\n\
				uniform vec2 texSize;\
				uniform vec2 direction;\
				const float MAX_BLUR = 16.0;\
				\
				const float SIGMA = 10.0;\
				const int KERNEL_SAMPLE_COUNT = 8;\
				float normpdf(in float x, in float sigma)\
				{\
					return 0.39894*exp(-0.5*x*x/(sigma*sigma))/sigma;\
				}\
				\
				vec3 dofBlur(vec4 centerFetch) { \
					float dofScale = 0.5;\
					float cocIn = texture2D(cocTexture, vUv).a;\
					float kernelRadius = MAX_BLUR * cocIn * dofScale;\
					vec2 invSize = 1.0 / texSize;\
					cocIn *= cocIn * cocIn;\
					float centreSpaceWeight = normpdf(0.0, SIGMA) * abs(cocIn);\
					float weightSum = centreSpaceWeight;\
					vec3 centreSample = centerFetch.rgb;\
					vec3 diffuseSum = centreSample * weightSum;\
					vec2 delta = invSize * kernelRadius/float(KERNEL_SAMPLE_COUNT);\
					for( int i = 1; i <= KERNEL_SAMPLE_COUNT; i ++ ) {\
							float spaceWeight = normpdf(float(i), SIGMA);\
							vec2 texcoord = direction * delta * float(i);\
							vec4 rightSample = texture2D( inputTexture, vUv + texcoord);\
							vec4 leftSample = texture2D( inputTexture, vUv - texcoord);\
							float leftCocWeight = texture2D( cocTexture, vUv - texcoord).a;\
							float rightCocWeight = texture2D( cocTexture, vUv + texcoord).a;\
							leftCocWeight *= leftCocWeight * leftCocWeight;\
							rightCocWeight *= rightCocWeight * rightCocWeight;\
							diffuseSum += (leftSample.rgb * abs(leftCocWeight) + rightSample.rgb * abs(rightCocWeight)) * spaceWeight;\
							weightSum += (spaceWeight * (abs(leftCocWeight) + abs(rightCocWeight)));\
					}\
				  return diffuseSum/weightSum;\
				}\
				\
				void main() {\n\
					vec4 centerFetch = texture2D(inputTexture, vUv);\
					gl_FragColor = vec4(dofBlur(centerFetch), 1.0);\n\
				}"
		} );
	},

	getDofCombineMaterial: function() {

		return new THREE.ShaderMaterial( {

			uniforms: {
				"inputTexture": { value: null },
				"blurTexture": { value: null },
				"cocTexture": { value: null },
				"depthTexture": { value: null },
				"dofBlurNearFar": { value: new THREE.Vector2( 0.5, 0.5 ) },
				"texSize": 				{ value: new THREE.Vector2( 0.5, 0.5 ) },
				"cameraNearFar": { value: new THREE.Vector2( 0.1, 100 ) },
				"focalDepth" : {value: 20.0 }
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
				uniform sampler2D blurTexture;\n\
				uniform sampler2D cocTexture;\n\
				uniform sampler2D depthTexture;\n\
				uniform vec2 texSize;\
				uniform vec2 dofBlurNearFar;\
				uniform vec2 cameraNearFar;\
				uniform float focalDepth;\
				const float MAX_BLUR = 16.0;\
				\
				float texDepthToCoC(const in sampler2D texDepth, const in vec2 uv, const in vec2 dofBlurNearFar) {\
				    vec4 fetch = texture2D(texDepth, uv);\
				    if(fetch.x == 1.0) return max(dofBlurNearFar.x, dofBlurNearFar.y);\
						float depth = unpackRGBAToDepth(fetch);\
						depth = -perspectiveDepthToViewZ(depth, cameraNearFar.x, cameraNearFar.y);\
						float coc = (depth - focalDepth)/depth;\
				    return (coc < 0.0 ? coc * dofBlurNearFar.x : coc * dofBlurNearFar.y);\
				}\
				\
				vec3 dofCombine(const in vec3 color, const in sampler2D texBlur, const in sampler2D texCoc, const in sampler2D texDepth, const in vec2 uv, const in vec2 texSize, const in float dofScale, const in vec2 dofBlurNearFar) {\
				    vec4 blur = texture2D(texBlur, uv);\
				    vec2 off = vec2(1.0, -1.0) * dofScale;\
						\
				    float coc = abs(min(texture2D(texCoc, uv).a, texDepthToCoC(texDepth, uv, dofBlurNearFar)));\
						\
				    return mix(color, blur.rgb, clamp(coc * coc * 16.0, 0.0, 1.0));\
				}\
				\
				void main() {\n\
					float dofScale = 0.5;\
					vec3 color = texture2D(inputTexture, vUv).rgb;\
					vec3 outColor = dofCombine(color, blurTexture, cocTexture, depthTexture, vUv, texSize, dofScale, dofBlurNearFar);\n\
					gl_FragColor = vec4(outColor,1.0);\n\
				}"
		} );
	}

});
