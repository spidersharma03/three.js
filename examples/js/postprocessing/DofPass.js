/**
 * @author spidersharma03 / http://eduperiment.com/
 */

THREE.DofPass = function (resolution, renderScene, renderCamera) {

	THREE.Pass.call( this );

	var resolution = ( resolution !== undefined ) ? resolution : new THREE.Vector2(256, 256);
	// render targets
  this.downSampleRes = new THREE.Vector2(resolution.x/2, resolution.y/2);

	var pars = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType, format: THREE.RGBAFormat };

	this.renderTargetDownSample = new THREE.WebGLRenderTarget( this.downSampleRes.x, this.downSampleRes.y, pars );
	this.renderTargetDownSample.texture.generateMipmaps = false;
	this.renderTargetBlurTemp = new THREE.WebGLRenderTarget( this.downSampleRes.x, this.downSampleRes.y, pars );
	this.renderTargetBlurTemp.texture.generateMipmaps = false;

	var pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };

	this.renderTargetDofBlur = new THREE.WebGLRenderTarget( this.downSampleRes.x, this.downSampleRes.y, pars );
	this.renderTargetDofBlur.texture.generateMipmaps = false;
	this.renderTargetDofBlurTemp = new THREE.WebGLRenderTarget( this.downSampleRes.x, this.downSampleRes.y, pars );
	this.renderTargetDofBlurTemp.texture.generateMipmaps = false;

	this.renderTargetDofCombine = new THREE.WebGLRenderTarget( resolution.x, resolution.y, pars );
	this.renderTargetDofCombine.texture.generateMipmaps = false;

	this.needsSwap = false;
	this.oldClearColor = new THREE.Color();
	this.oldClearAlpha = 1;

	this.camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
	this.scene  = new THREE.Scene();

	this.quad = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ), null );
	this.scene.add( this.quad );

	this.focalDepth = 10.0;
	this.NearFarBlurScale = new THREE.Vector2(0.1, 0.5);

	this.downSamplingMaterial = this.getDownSamplingMaterial();
	this.downSamplingMaterial.uniforms[ "NearFarBlurScale" ].value = this.NearFarBlurScale;
	this.downSamplingMaterial.uniforms[ "cameraNearFar" ].value = new THREE.Vector2(renderCamera.near, renderCamera.far);
	this.downSamplingMaterial.uniforms[ "focalDepth" ].value = this.focalDepth;

	this.dilateNearCocMaterial = this.getExpandNearCocMaterial();
	this.dilateNearCocMaterial.uniforms[ "NearFarBlurScale" ].value = this.NearFarBlurScale;
	this.dilateNearCocMaterial.uniforms[ "texSize" ].value = new THREE.Vector2(this.downSampleRes.x, this.downSampleRes.y);

	this.dofBlurType = 1;
	this.dofBlurMaterial = (this.dofBlurType === 0) ? this.getDofBlurCircularMaterial() : this.getDofBlurSeperableMaterial();
	this.dofBlurMaterial.uniforms[ "texSize" ].value = new THREE.Vector2(this.downSampleRes.x, this.downSampleRes.y);

	this.dofCombineMaterial = this.getDofCombineMaterial();
	this.dofCombineMaterial.uniforms[ "NearFarBlurScale" ].value = this.NearFarBlurScale;
	this.dofCombineMaterial.uniforms[ "texSize" ].value = new THREE.Vector2(this.downSampleRes.x, this.downSampleRes.y);
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

	changeBlurType: function(blurType) {
		this.dofBlurType = blurType;
		this.dofBlurMaterial = (this.dofBlurType === 0) ? this.getDofBlurCircularMaterial() : this.getDofBlurSeperableMaterial();
		this.dofBlurMaterial.uniforms[ "texSize" ].value = new THREE.Vector2(this.downSampleRes.x, this.downSampleRes.y);
	},

	setFocalDepth: function(focalDepth) {
		this.focalDepth = focalDepth;
		this.downSamplingMaterial.uniforms[ "focalDepth" ].value = focalDepth;
		this.dofCombineMaterial.uniforms[ "focalDepth" ].value = focalDepth;
	},

	render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

		this.oldClearColor.copy( renderer.getClearColor() );
		this.oldClearAlpha = renderer.getClearAlpha();
		var oldAutoClear = renderer.autoClear;

		if ( maskActive ) renderer.context.disable( renderer.context.STENCIL_TEST );

		// Render Scene into depth buffer. This is temporary and should not be done here.
		this.renderScene.overrideMaterial = this.depthMaterial;
		renderer.setClearColor(0xffffff, 1);
	  renderer.render( this.renderScene, this.renderCamera, this.depthRenderTarget );
		this.renderScene.overrideMaterial = null;

		// 1. Downsample the Original texture, and store coc in the alpha channel
		this.quad.material = this.downSamplingMaterial;
		this.downSamplingMaterial.uniforms[ "colorTexture" ].value = readBuffer.texture;
		this.downSamplingMaterial.uniforms[ "depthTexture" ].value = this.depthRenderTarget.texture;
		renderer.render( this.scene, this.camera, this.renderTargetDownSample );

		// 2. Dilate/Blur Near field coc
		this.quad.material = this.dilateNearCocMaterial;
		this.dilateNearCocMaterial.uniforms[ "colorTexture" ].value = this.renderTargetDownSample.texture;
		this.dilateNearCocMaterial.uniforms[ "depthTexture" ].value = this.depthRenderTarget.texture;
		this.dilateNearCocMaterial.uniforms[ "direction" ].value = new THREE.Vector2(1, 0);
		renderer.render( this.scene, this.camera, this.renderTargetBlurTemp );
		this.dilateNearCocMaterial.uniforms[ "colorTexture" ].value = this.renderTargetBlurTemp.texture;
		this.dilateNearCocMaterial.uniforms[ "direction" ].value = new THREE.Vector2(0, 1);
		renderer.render( this.scene, this.camera, this.renderTargetDownSample );

		// 3. Blur Dof
		if( this.dofBlurType === 0 ){
			this.quad.material = this.dofBlurMaterial;
			this.dofBlurMaterial.uniforms[ "colorTexture" ].value = this.renderTargetDownSample.texture;
			this.dofBlurMaterial.uniforms[ "depthTexture" ].value = this.depthRenderTarget.texture;
			renderer.render( this.scene, this.camera, this.renderTargetDofBlurTemp );
		}
		else {
			this.quad.material = this.dofBlurMaterial;
			this.dofBlurMaterial.uniforms[ "cocTexture" ].value = this.renderTargetDownSample.texture;
			this.dofBlurMaterial.uniforms[ "colorTexture" ].value = this.renderTargetDownSample.texture;
			this.dofBlurMaterial.uniforms[ "direction" ].value = new THREE.Vector2(1, 0);
			renderer.render( this.scene, this.camera, this.renderTargetDofBlur );
			this.dofBlurMaterial.uniforms[ "colorTexture" ].value = this.renderTargetDofBlur.texture;
			this.dofBlurMaterial.uniforms[ "direction" ].value = new THREE.Vector2(0, 1);
			renderer.render( this.scene, this.camera, this.renderTargetDofBlurTemp );
		}
		// 4. Dof Combine
		this.quad.material = this.dofCombineMaterial;
		this.dofCombineMaterial.uniforms[ "colorTexture" ].value = readBuffer.texture;
		this.dofCombineMaterial.uniforms[ "depthTexture" ].value = this.depthRenderTarget.texture;
		this.dofCombineMaterial.uniforms[ "blurTexture" ].value = this.renderTargetDofBlurTemp.texture;
		this.dofCombineMaterial.uniforms[ "cocTexture" ].value = this.renderTargetDownSample.texture;
		renderer.render( this.scene, this.camera, this.renderTargetDofCombine );

		// Copy Pass
		this.quad.material = this.materialCopy;
		this.copyUniforms[ "tDiffuse" ].value = this.renderTargetDofCombine.texture;

		if ( maskActive ) renderer.context.enable( renderer.context.STENCIL_TEST );
		renderer.render( this.scene, this.camera, readBuffer, this.clear );

		renderer.setClearColor( this.oldClearColor, this.oldClearAlpha );
	},

	getDownSamplingMaterial: function() {

		return new THREE.ShaderMaterial( {

			uniforms: {
				"colorTexture": { value: null },
				"depthTexture": { value: null },
				"NearFarBlurScale": { value: new THREE.Vector2( 0.5, 0.5 ) },
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
				uniform sampler2D colorTexture;\n\
				uniform sampler2D depthTexture;\n\
				uniform vec2 NearFarBlurScale;\
				uniform vec2 cameraNearFar;\
				uniform float focalDepth;\
				const float MAXIMUM_BLUR_SIZE = 8.0;\
				\
				float computeCoc() {\
				    vec4 packDepth = texture2D(depthTexture, vUv).rgba;\
				    if(packDepth.x == 1.0) return max(NearFarBlurScale.x, NearFarBlurScale.y);\
						float depth = unpackRGBAToDepth(packDepth);\
						depth = -perspectiveDepthToViewZ(depth, cameraNearFar.x, cameraNearFar.y);\
						float coc = (depth - focalDepth)/depth;\
				    return (coc > 0.0 ? coc * NearFarBlurScale.y : coc * NearFarBlurScale.x);\
				}\
				\
				void main() {\n\
					gl_FragColor = vec4(texture2D(colorTexture, vUv).rgb, computeCoc());\n\
				}"
		} );
	},

	getExpandNearCocMaterial: function() {

		return new THREE.ShaderMaterial( {

			uniforms: {
				"colorTexture": { value: null },
				"depthTexture": { value: null },
				"NearFarBlurScale": { value: new THREE.Vector2( 0.5, 0.5 ) },
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
				uniform sampler2D colorTexture;\n\
				uniform sampler2D depthTexture;\n\
				uniform vec2 direction;\
				uniform vec2 texSize;\
				uniform vec2 NearFarBlurScale;\
				const float MAXIMUM_BLUR_SIZE = 8.0;\
				\
				float expandNear(const in vec2 offset, const in bool isBackground) {\
				    float coc = 0.0;\
				    vec2 sampleOffsets = MAXIMUM_BLUR_SIZE * offset / 5.0;\
				    float coc0 = texture2D(colorTexture, vUv).a;\
				    float coc1 = texture2D(colorTexture, vUv - 5.0 * sampleOffsets).a;\
				    float coc2 = texture2D(colorTexture, vUv - 4.0 * sampleOffsets).a;\
				    float coc3 = texture2D(colorTexture, vUv - 3.0 * sampleOffsets).a;\
				    float coc4 = texture2D(colorTexture, vUv - 2.0 * sampleOffsets).a;\
				    float coc5 = texture2D(colorTexture, vUv - 1.0 * sampleOffsets).a;\
				    float coc6 = texture2D(colorTexture, vUv + 1.0 * sampleOffsets).a;\
				    float coc7 = texture2D(colorTexture, vUv + 2.0 * sampleOffsets).a;\
				    float coc8 = texture2D(colorTexture, vUv + 3.0 * sampleOffsets).a;\
				    float coc9 = texture2D(colorTexture, vUv + 4.0 * sampleOffsets).a;\
				    float coc10 = texture2D(colorTexture, vUv + 5.0 * sampleOffsets).a;\
						\
				    if(isBackground){\
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
				void main() {\n\
					vec2 offset = direction/texSize;\
					float coc = expandNear(offset, texture2D(depthTexture, vUv).x == 1.0);\
					gl_FragColor = vec4(texture2D(colorTexture, vUv).rgb, coc);\n\
				}"
		} );
	},

	getDofBlurCircularMaterial: function() {

		return new THREE.ShaderMaterial( {

			uniforms: {
				"colorTexture": { value: null },
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
				uniform sampler2D colorTexture;\n\
				uniform sampler2D depthTexture;\n\
				uniform vec2 texSize;\
				const float MAXIMUM_BLUR_SIZE = 8.0;\
				\
				vec4 CircularBlur() {\
				    \
				    const int NUM_SAMPLES = 16;\
				    vec2 poisson_disk_samples[NUM_SAMPLES];\
				    poisson_disk_samples[0] = vec2(-0.399691779231, 0.728591545584);\
				    poisson_disk_samples[1] = vec2(-0.48622557676, -0.84016533712);\
				    poisson_disk_samples[2] = vec2(0.770309468987, -0.24906070432);\
				    poisson_disk_samples[3] = vec2(0.556596796154, 0.820359876432);\
				    poisson_disk_samples[4] = vec2(-0.933902004071, 0.0600539051593);\
				    poisson_disk_samples[5] = vec2(0.330144964342, 0.207477293384);\
				    poisson_disk_samples[6] = vec2(0.289013230975, -0.686749271417);\
				    poisson_disk_samples[7] = vec2(-0.0832470893559, -0.187351643125);\
				    poisson_disk_samples[8] = vec2(-0.296314525615, 0.254474834305);\
				    poisson_disk_samples[9] = vec2(-0.850977666059, 0.484642744689);\
				    poisson_disk_samples[10] = vec2(0.829287915319, 0.2345063545);\
				    poisson_disk_samples[11] = vec2(-0.773042143899, -0.543741521254);\
				    poisson_disk_samples[12] = vec2(0.0561133030864, 0.928419742597);\
				    poisson_disk_samples[13] = vec2(-0.205799249508, -0.562072714492);\
				    poisson_disk_samples[14] = vec2(-0.526991665882, -0.193690188118);\
				    poisson_disk_samples[15] = vec2(-0.051789270667, -0.935374050821);\
						\
				    vec4 color = texture2D(colorTexture, vUv);\
						\
				    float blurDist = MAXIMUM_BLUR_SIZE * color.a;\
						\
				    float rnd = PI2 * rand( vUv );\
				    float costheta = cos(rnd);\
				    float sintheta = sin(rnd);\
				    vec4 rotationMatrix = vec4(costheta, -sintheta, sintheta, costheta);\
						\
				    vec3 colorSum = vec3(0.0);\
				    float weightSum = 0.0;\
						\
				    for (int i = 0; i < NUM_SAMPLES; i++) {\
				        vec2 ofs = poisson_disk_samples[i];\
				        ofs = vec2(dot(ofs, rotationMatrix.xy), dot(ofs, rotationMatrix.zw) );\
				        vec2 texcoord = vUv + blurDist * ofs / texSize.xy;\
				        vec4 sample = texture2D(colorTexture, texcoord);\
				        float cocWeight = abs(sample.a);\
				        cocWeight *= cocWeight * cocWeight;\
				        colorSum += sample.rgb * cocWeight;\
				        weightSum += cocWeight;\
				    }\
						\
				    colorSum /= weightSum;\
						\
				    return vec4(colorSum, 1.0);\
				}\
				\
				void main() {\n\
					gl_FragColor = CircularBlur();\n\
				}"
		} );
	},

	getDofBlurSeperableMaterial: function() {

		return new THREE.ShaderMaterial( {

			uniforms: {
				"cocTexture":   { value: null },
				"colorTexture": { value: null },
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
				uniform sampler2D colorTexture;\n\
				uniform vec2 texSize;\
				uniform vec2 direction;\
				const float MAXIMUM_BLUR_SIZE = 8.0;\
				\
				const float SIGMA = 5.0;\
				const int NUM_SAMPLES = 4;\
				float normpdf(in float x, in float sigma)\
				{\
					return 0.39894*exp(-0.5*x*x/(sigma*sigma))/sigma;\
				}\
				\
				vec3 weightedBlur() { \
					float cocIn = texture2D(cocTexture, vUv).a;\
					float kernelRadius = MAXIMUM_BLUR_SIZE * cocIn;\
					vec2 invSize = 1.0 / texSize;\
					cocIn *= cocIn * cocIn;\
					float centreSpaceWeight = normpdf(0.0, SIGMA) * abs(cocIn);\
					float weightSum = centreSpaceWeight;\
					vec3 centreSample = texture2D(colorTexture, vUv).rgb;\
					vec3 diffuseSum = centreSample * weightSum;\
					vec2 delta = invSize * kernelRadius/float(NUM_SAMPLES);\
					for( int i = 1; i <= NUM_SAMPLES; i ++ ) {\
							float spaceWeight = normpdf(float(i), SIGMA);\
							vec2 texcoord = direction * delta * float(i);\
							vec4 rightSample = texture2D( colorTexture, vUv + texcoord);\
							vec4 leftSample = texture2D( colorTexture, vUv - texcoord);\
							float leftCocWeight = abs(texture2D( cocTexture, vUv - texcoord).a);\
							float rightCocWeight = abs(texture2D( cocTexture, vUv + texcoord).a);\
							leftCocWeight *= leftCocWeight * leftCocWeight;\
							rightCocWeight *= rightCocWeight * rightCocWeight;\
							diffuseSum += ( (leftSample.rgb * leftCocWeight) + (rightSample.rgb * rightCocWeight) ) * spaceWeight;\
							weightSum += (spaceWeight * (leftCocWeight + rightCocWeight));\
					}\
				  return diffuseSum/weightSum;\
				}\
				\
				void main() {\n\
					gl_FragColor = vec4(weightedBlur(), 1.0);\n\
				}"
		} );
	},

	getDofCombineMaterial: function() {

		return new THREE.ShaderMaterial( {

			uniforms: {
				"colorTexture": { value: null },
				"blurTexture": { value: null },
				"cocTexture": { value: null },
				"depthTexture": { value: null },
				"NearFarBlurScale": { value: new THREE.Vector2( 0.5, 0.5 ) },
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
				uniform sampler2D colorTexture;\n\
				uniform sampler2D blurTexture;\n\
				uniform sampler2D cocTexture;\n\
				uniform sampler2D depthTexture;\n\
				uniform vec2 texSize;\
				uniform vec2 NearFarBlurScale;\
				uniform vec2 cameraNearFar;\
				uniform float focalDepth;\
				\
				float computeCoc() {\
				    vec4 packedDepth = texture2D(depthTexture, vUv);\
				    if(packedDepth.x == 1.0) return max(NearFarBlurScale.x, NearFarBlurScale.y);\
						float depth = unpackRGBAToDepth(packedDepth);\
						depth = -perspectiveDepthToViewZ(depth, cameraNearFar.x, cameraNearFar.y);\
						float coc = (depth - focalDepth)/depth;\
				    return (coc > 0.0 ? coc * NearFarBlurScale.y : coc * NearFarBlurScale.x);\
				}\
				\
				void main() {\n\
					vec4 blur = texture2D(blurTexture, vUv);\
					blur += texture2D(blurTexture, vUv + vec2(1.5, 0.5) / texSize);\
					blur += texture2D(blurTexture, vUv + vec2(-0.5, 1.5) / texSize);\
					blur += texture2D(blurTexture, vUv + vec2(-1.5, -0.5) / texSize);\
					blur += texture2D(blurTexture, vUv + vec2(0.5, -1.5) / texSize);\
					blur /= 5.0;\
					float coc = abs(min(texture2D(cocTexture, vUv).a, computeCoc()));\
					coc = clamp(coc * coc * 8.0, 0.0, 1.0);\
					vec3 color = mix(texture2D(colorTexture, vUv).rgb, blur.rgb, vec3(coc));\
					gl_FragColor = vec4(color, 1.0);\n\
				}"
		} );
	}

});
