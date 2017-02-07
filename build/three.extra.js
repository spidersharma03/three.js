var THREE = require('./three');
// File:examples/js/pmrem/PMREMGenerator.js

/**
 * @author Prashant Sharma / spidersharma03
 * @author Ben Houston / bhouston, https://clara.io
 *
 * To avoid cube map seams, I create an extra pixel around each face. This way when the cube map is
 * sampled by an application later(with a little care by sampling the centre of the texel), the extra 1 border
 *	of pixels makes sure that there is no seams artifacts present. This works perfectly for cubeUV format as
 *	well where the 6 faces can be arranged in any manner whatsoever.
 * Code in the beginning of fragment shader's main function does this job for a given resolution.
 *	Run Scene_PMREM_Test.html in the examples directory to see the sampling from the cube lods generated
 *	by this class.
 */

THREE.PMREMGenerator = function( sourceTexture, samplesPerLevel, resolution ) {

	this.sourceTexture = sourceTexture;
	this.resolution = ( resolution !== undefined ) ? resolution : 256; // NODE: 256 is currently hard coded in the glsl code for performance reasons
	this.samplesPerLevel = ( samplesPerLevel !== undefined ) ? samplesPerLevel : 16;

	var monotonicEncoding = ( sourceTexture.encoding === THREE.LinearEncoding ) ||
		( sourceTexture.encoding === THREE.GammaEncoding ) || ( sourceTexture.encoding === THREE.sRGBEncoding );

	this.sourceTexture.minFilter = ( monotonicEncoding ) ? THREE.LinearFilter : THREE.NearestFilter;
	this.sourceTexture.magFilter = ( monotonicEncoding ) ? THREE.LinearFilter : THREE.NearestFilter;
	this.sourceTexture.generateMipmaps = this.sourceTexture.generateMipmaps && monotonicEncoding;

	this.cubeLods = [];

	var size = this.resolution;
	var params = {		format: this.sourceTexture.format,
		magFilter: this.sourceTexture.magFilter,
		minFilter: this.sourceTexture.minFilter,
		type: this.sourceTexture.type,
		generateMipmaps: this.sourceTexture.generateMipmaps,
		anisotropy: this.sourceTexture.anisotropy,
		encoding: this.sourceTexture.encoding
	 };

	// how many LODs fit in the given CubeUV Texture.
	this.numLods = Math.log( size ) / Math.log( 2 ) - 2;  // IE11 doesn't support Math.log2

	for ( var i = 0; i < this.numLods; i ++ ) {

		var renderTarget = new THREE.WebGLRenderTargetCube( size, size, params );
		renderTarget.texture.name = "PMREMGenerator.cube" + i;
		this.cubeLods.push( renderTarget );
		size = Math.max( 16, size / 2 );

	}

	this.camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0.0, 1000 );

	this.shader = this.getShader();
	this.shader.defines['SAMPLES_PER_LEVEL'] = this.samplesPerLevel;
	this.planeMesh = new THREE.Mesh( new THREE.PlaneGeometry( 2, 2, 0 ), this.shader );
	this.planeMesh.material.side = THREE.DoubleSide;
	this.scene = new THREE.Scene();
	this.scene.add( this.planeMesh );
	this.scene.add( this.camera );

	this.shader.uniforms[ 'envMap' ].value = this.sourceTexture;
	this.shader.envMap = this.sourceTexture;

};

THREE.PMREMGenerator.prototype = {

	constructor : THREE.PMREMGenerator,

	/*
	 * Prashant Sharma / spidersharma03: More thought and work is needed here.
	 * Right now it's a kind of a hack to use the previously convolved map to convolve the current one.
	 * I tried to use the original map to convolve all the lods, but for many textures(specially the high frequency)
	 * even a high number of samples(1024) dosen't lead to satisfactory results.
	 * By using the previous convolved maps, a lower number of samples are generally sufficient(right now 32, which
	 * gives okay results unless we see the reflection very carefully, or zoom in too much), however the math
	 * goes wrong as the distribution function tries to sample a larger area than what it should be. So I simply scaled
	 * the roughness by 0.9(totally empirical) to try to visually match the original result.
	 * The condition "if(i <5)" is also an attemt to make the result match the original result.
	 * This method requires the most amount of thinking I guess. Here is a paper which we could try to implement in future::
	 * http://http.developer.nvidia.com/GPUGems3/gpugems3_ch20.html
	 */
	update: function( renderer ) {

		this.shader.uniforms[ 'envMap' ].value = this.sourceTexture;
		this.shader.envMap = this.sourceTexture;

		var gammaInput = renderer.gammaInput;
		var gammaOutput = renderer.gammaOutput;
		var toneMapping = renderer.toneMapping;
		var toneMappingExposure = renderer.toneMappingExposure;

		renderer.toneMapping = THREE.LinearToneMapping;
		renderer.toneMappingExposure = 1.0;
		renderer.gammaInput = false;
		renderer.gammaOutput = false;

		for ( var i = 0; i < this.numLods; i ++ ) {

			var r = i / ( this.numLods - 1 );
			this.shader.uniforms[ 'roughness' ].value = r * 0.9; // see comment above, pragmatic choice
			this.shader.uniforms[ 'queryScale' ].value.x = ( i == 0 ) ? -1 : 1;
			var size = this.cubeLods[ i ].width;
			this.shader.uniforms[ 'mapSize' ].value = size;
			this.renderToCubeMapTarget( renderer, this.cubeLods[ i ] );

			if ( i < 5 ) this.shader.uniforms[ 'envMap' ].value = this.cubeLods[ i ].texture;

		}

		renderer.toneMapping = toneMapping;
		renderer.toneMappingExposure = toneMappingExposure;
		renderer.gammaInput = gammaInput;
		renderer.gammaOutput = gammaOutput;

	},

	renderToCubeMapTarget: function( renderer, renderTarget ) {

		for ( var i = 0; i < 6; i ++ ) {

			this.renderToCubeMapTargetFace( renderer, renderTarget, i )

		}

	},

	renderToCubeMapTargetFace: function( renderer, renderTarget, faceIndex ) {

		renderTarget.activeCubeFace = faceIndex;
		this.shader.uniforms[ 'faceIndex' ].value = faceIndex;
		renderer.render( this.scene, this.camera, renderTarget, true );

	},

	getShader: function() {

		return new THREE.ShaderMaterial( {

			defines: {
				"SAMPLES_PER_LEVEL": 20,
			},

			uniforms: {
				"faceIndex": { value: 0 },
				"roughness": { value: 0.5 },
				"mapSize": { value: 0.5 },
				"envMap": { value: null },
				"queryScale": { value: new THREE.Vector3( 1, 1, 1 ) },
				"testColor": { value: new THREE.Vector3( 1, 1, 1 ) },
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
				uniform int faceIndex;\n\
				uniform float roughness;\n\
				uniform samplerCube envMap;\n\
				uniform float mapSize;\n\
				uniform vec3 testColor;\n\
				uniform vec3 queryScale;\n\
				\n\
				float GGXRoughnessToBlinnExponent( const in float ggxRoughness ) {\n\
					float a = ggxRoughness + 0.0001;\n\
					a *= a;\n\
					return ( 2.0 / a - 2.0 );\n\
				}\n\
				vec3 ImportanceSamplePhong(vec2 uv, mat3 vecSpace, float specPow) {\n\
					float phi = uv.y * 2.0 * PI;\n\
					float cosTheta = pow(1.0 - uv.x, 1.0 / (specPow + 1.0));\n\
					float sinTheta = sqrt(1.0 - cosTheta * cosTheta);\n\
					vec3 sampleDir = vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);\n\
					return vecSpace * sampleDir;\n\
				}\n\
				vec3 ImportanceSampleGGX( vec2 uv, mat3 vecSpace, float Roughness )\n\
				{\n\
					float a = Roughness * Roughness;\n\
					float Phi = 2.0 * PI * uv.x;\n\
					float CosTheta = sqrt( (1.0 - uv.y) / ( 1.0 + (a*a - 1.0) * uv.y ) );\n\
					float SinTheta = sqrt( 1.0 - CosTheta * CosTheta );\n\
					return vecSpace * vec3(SinTheta * cos( Phi ), SinTheta * sin( Phi ), CosTheta);\n\
				}\n\
				mat3 matrixFromVector(vec3 n) {\n\
					float a = 1.0 / (1.0 + n.z);\n\
					float b = -n.x * n.y * a;\n\
					vec3 b1 = vec3(1.0 - n.x * n.x * a, b, -n.x);\n\
					vec3 b2 = vec3(b, 1.0 - n.y * n.y * a, -n.y);\n\
					return mat3(b1, b2, n);\n\
				}\n\
				\n\
				vec4 testColorMap(float Roughness) {\n\
					vec4 color;\n\
					if(faceIndex == 0)\n\
						color = vec4(1.0,0.0,0.0,1.0);\n\
					else if(faceIndex == 1)\n\
						color = vec4(0.0,1.0,0.0,1.0);\n\
					else if(faceIndex == 2)\n\
						color = vec4(0.0,0.0,1.0,1.0);\n\
					else if(faceIndex == 3)\n\
						color = vec4(1.0,1.0,0.0,1.0);\n\
					else if(faceIndex == 4)\n\
						color = vec4(0.0,1.0,1.0,1.0);\n\
					else\n\
						color = vec4(1.0,0.0,1.0,1.0);\n\
					color *= ( 1.0 - Roughness );\n\
					return color;\n\
				}\n\
				void main() {\n\
					vec3 sampleDirection;\n\
					vec2 uv = vUv*2.0 - 1.0;\n\
					float offset = -1.0/mapSize;\n\
					const float a = -1.0;\n\
					const float b = 1.0;\n\
					float c = -1.0 + offset;\n\
					float d = 1.0 - offset;\n\
					float bminusa = b - a;\n\
					uv.x = (uv.x - a)/bminusa * d - (uv.x - b)/bminusa * c;\n\
					uv.y = (uv.y - a)/bminusa * d - (uv.y - b)/bminusa * c;\n\
					if (faceIndex==0) {\n\
						sampleDirection = vec3(1.0, -uv.y, -uv.x);\n\
					} else if (faceIndex==1) {\n\
						sampleDirection = vec3(-1.0, -uv.y, uv.x);\n\
					} else if (faceIndex==2) {\n\
						sampleDirection = vec3(uv.x, 1.0, uv.y);\n\
					} else if (faceIndex==3) {\n\
						sampleDirection = vec3(uv.x, -1.0, -uv.y);\n\
					} else if (faceIndex==4) {\n\
						sampleDirection = vec3(uv.x, -uv.y, 1.0);\n\
					} else {\n\
						sampleDirection = vec3(-uv.x, -uv.y, -1.0);\n\
					}\n\
					mat3 vecSpace = matrixFromVector(normalize(sampleDirection * queryScale));\n\
					vec3 rgbColor = vec3(0.0);\n\
					const int NumSamples = SAMPLES_PER_LEVEL;\n\
					vec3 vect;\n\
					float weight = 0.0;\n\
					for( int i = 0; i < NumSamples; i ++ ) {\n\
						float sini = sin(float(i));\n\
						float cosi = cos(float(i));\n\
						float r = rand(vec2(sini, cosi));\n\
						vect = ImportanceSampleGGX(vec2(float(i) / float(NumSamples), r), vecSpace, roughness);\n\
						float dotProd = dot(vect, normalize(sampleDirection));\n\
						weight += dotProd;\n\
						vec3 color = envMapTexelToLinear(textureCube(envMap,vect)).rgb;\n\
						rgbColor.rgb += color;\n\
					}\n\
					rgbColor /= float(NumSamples);\n\
					//rgbColor = testColorMap( roughness ).rgb;\n\
					gl_FragColor = linearToOutputTexel( vec4( rgbColor, 1.0 ) );\n\
				}",
			blending: THREE.CustomBlending,
			blendSrc: THREE.OneFactor,
			blendDst: THREE.ZeroFactor,
			blendSrcAlpha: THREE.OneFactor,
			blendDstAlpha: THREE.ZeroFactor,
			blendEquation: THREE.AddEquation
		} );

	}

};

// File:examples/js/pmrem/PMREMCubeUVPacker.js

/**
 * @author Prashant Sharma / spidersharma03
 * @author Ben Houston / bhouston, https://clara.io
 *
 * This class takes the cube lods(corresponding to different roughness values), and creates a single cubeUV
 * Texture. The format for a given roughness set of faces is simply::
 * +X+Y+Z
 * -X-Y-Z
 * For every roughness a mip map chain is also saved, which is essential to remove the texture artifacts due to
 * minification.
 * Right now for every face a PlaneMesh is drawn, which leads to a lot of geometry draw calls, but can be replaced
 * later by drawing a single buffer and by sending the appropriate faceIndex via vertex attributes.
 * The arrangement of the faces is fixed, as assuming this arrangement, the sampling function has been written.
 */


THREE.PMREMCubeUVPacker = function( cubeTextureLods, numLods ) {

	this.cubeLods = cubeTextureLods;
	this.numLods = numLods;
	var size = cubeTextureLods[ 0 ].width * 4;

	var sourceTexture = cubeTextureLods[ 0 ].texture;
	var params = {
		format: sourceTexture.format,
		magFilter: sourceTexture.magFilter,
		minFilter: sourceTexture.minFilter,
		type: sourceTexture.type,
		generateMipmaps: sourceTexture.generateMipmaps,
		anisotropy: sourceTexture.anisotropy,
		encoding: sourceTexture.encoding
	};

	if( sourceTexture.encoding === THREE.RGBM16Encoding ) {
		params.magFilter = THREE.LinearFilter;
		params.minFilter = THREE.LinearFilter;
	}

	this.CubeUVRenderTarget = new THREE.WebGLRenderTarget( size, size, params );
	this.CubeUVRenderTarget.texture.name = "PMREMCubeUVPacker.cubeUv";
	this.CubeUVRenderTarget.texture.mapping = THREE.CubeUVReflectionMapping;
	this.camera = new THREE.OrthographicCamera( - size * 0.5, size * 0.5, - size * 0.5, size * 0.5, 0.0, 1000 );

	this.scene = new THREE.Scene();
	this.scene.add( this.camera );

	this.objects = [];
	var xOffset = 0;
	var faceOffsets = [];
	faceOffsets.push( new THREE.Vector2( 0, 0 ) );
	faceOffsets.push( new THREE.Vector2( 1, 0 ) );
	faceOffsets.push( new THREE.Vector2( 2, 0 ) );
	faceOffsets.push( new THREE.Vector2( 0, 1 ) );
	faceOffsets.push( new THREE.Vector2( 1, 1 ) );
	faceOffsets.push( new THREE.Vector2( 2, 1 ) );
	var yOffset = 0;
	var textureResolution = size;
	size = cubeTextureLods[ 0 ].width;

	var offset2 = 0;
	var c = 4.0;
	this.numLods = Math.log( cubeTextureLods[ 0 ].width ) / Math.log( 2 ) - 2; // IE11 doesn't support Math.log2
	for ( var i = 0; i < this.numLods; i ++ ) {

		var offset1 = ( textureResolution - textureResolution / c ) * 0.5;
		if ( size > 16 )
		c *= 2;
		var nMips = size > 16 ? 6 : 1;
		var mipOffsetX = 0;
		var mipOffsetY = 0;
		var mipSize = size;

		for ( var j = 0; j < nMips; j ++ ) {

			// Mip Maps
			for ( var k = 0; k < 6; k ++ ) {

				// 6 Cube Faces
				var material = this.getShader();
				material.uniforms[ 'envMap' ].value = this.cubeLods[ i ].texture;
				material.envMap = this.cubeLods[ i ].texture;
				material.uniforms[ 'faceIndex' ].value = k;
				material.uniforms[ 'mapSize' ].value = mipSize;
				var color = material.uniforms[ 'testColor' ].value;
				//color.copy(testColor[j]);
				var planeMesh = new THREE.Mesh(
				new THREE.PlaneGeometry( mipSize, mipSize, 0 ),
				material );
				planeMesh.position.x = faceOffsets[ k ].x * mipSize - offset1 + mipOffsetX;
				planeMesh.position.y = faceOffsets[ k ].y * mipSize - offset1 + offset2 + mipOffsetY;
				planeMesh.material.side = THREE.DoubleSide;
				this.scene.add( planeMesh );
				this.objects.push( planeMesh );

			}
			mipOffsetY += 1.75 * mipSize;
			mipOffsetX += 1.25 * mipSize;
			mipSize /= 2;

		}
		offset2 += 2 * size;
		if ( size > 16 )
		size /= 2;

	}

};

THREE.PMREMCubeUVPacker.prototype = {

	constructor : THREE.PMREMCubeUVPacker,

	update: function( renderer ) {

		var gammaInput = renderer.gammaInput;
		var gammaOutput = renderer.gammaOutput;
		var toneMapping = renderer.toneMapping;
		var toneMappingExposure = renderer.toneMappingExposure;
		renderer.gammaInput = false;
		renderer.gammaOutput = false;
		renderer.toneMapping = THREE.LinearToneMapping;
		renderer.toneMappingExposure = 1.0;
		renderer.render( this.scene, this.camera, this.CubeUVRenderTarget, false );

		renderer.toneMapping = toneMapping;
		renderer.toneMappingExposure = toneMappingExposure;
		renderer.gammaInput = gammaInput;
		renderer.gammaOutput = gammaOutput;

	},

	getShader: function() {

		var shaderMaterial = new THREE.ShaderMaterial( {

			uniforms: {
				"faceIndex": { value: 0 },
				"mapSize": { value: 0 },
				"envMap": { value: null },
				"testColor": { value: new THREE.Vector3( 1, 1, 1 ) }
			},

			vertexShader:
				"precision highp float;\
				varying vec2 vUv;\
				void main() {\
					vUv = uv;\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\
				}",

			fragmentShader:
				"precision highp float;\
				varying vec2 vUv;\
				uniform samplerCube envMap;\
				uniform float mapSize;\
				uniform vec3 testColor;\
				uniform int faceIndex;\
				\
				void main() {\
					vec3 sampleDirection;\
					vec2 uv = vUv;\
					uv = uv * 2.0 - 1.0;\
					uv.y *= -1.0;\
					if(faceIndex == 0) {\
						sampleDirection = normalize(vec3(1.0, uv.y, -uv.x));\
					} else if(faceIndex == 1) {\
						sampleDirection = normalize(vec3(uv.x, 1.0, uv.y));\
					} else if(faceIndex == 2) {\
						sampleDirection = normalize(vec3(uv.x, uv.y, 1.0));\
					} else if(faceIndex == 3) {\
						sampleDirection = normalize(vec3(-1.0, uv.y, uv.x));\
					} else if(faceIndex == 4) {\
						sampleDirection = normalize(vec3(uv.x, -1.0, -uv.y));\
					} else {\
						sampleDirection = normalize(vec3(-uv.x, uv.y, -1.0));\
					}\
					vec4 color = envMapTexelToLinear( textureCube( envMap, sampleDirection ) );\
					gl_FragColor = linearToOutputTexel( color );\
				}",

			blending: THREE.CustomBlending,
			premultipliedAlpha: false,
			blendSrc: THREE.OneFactor,
			blendDst: THREE.ZeroFactor,
			blendSrcAlpha: THREE.OneFactor,
			blendDstAlpha: THREE.ZeroFactor,
			blendEquation: THREE.AddEquation

		} );

		return shaderMaterial;

	}

};

// File:examples/js/shaders/CopyShader.js

/**
 * @author alteredq / http://alteredqualia.com/
 *
 * Full-screen textured quad shader
 */

THREE.CopyShader = {

	uniforms: {

		"tDiffuse": { value: null },
		"opacity":  { value: 1.0 }

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

		"uniform float opacity;",

		"uniform sampler2D tDiffuse;",

		"varying vec2 vUv;",

		"void main() {",

			"vec4 texel = texture2D( tDiffuse, vUv );",
			"gl_FragColor = opacity * texel;",

		"}"

	].join( "\n" )

};

// File:examples/js/shaders/CompositeShader.js

/**
 * @author bhouston / http://clara.io
 *
 * Various composite operations
 */

THREE.CompositeShader = {

  defines: {

		"BLENDING": THREE.NoBlending

  },

	uniforms: {

    "tSource": { type: "t", value: null },
    "opacitySource": { type: "f", value: 1.0 },

		"tDestination": { type: "t", value: null },
    "opacityDestination": { type: "f", value: 1.0 }

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

    "uniform sampler2D tSource;",
    "uniform float opacitySource;",

		"uniform sampler2D tDestination;",
    "uniform float opacityDestination;",

		"varying vec2 vUv;",

		"void main() {",

			"vec4 d = opacityDestination * texture2D( tDestination, vUv );",
			"vec4 s = opacitySource * texture2D( tSource, vUv );",

      // all blending modes are implemented assuming premultiplied values

      "#if (BLENDING == " + THREE.NormalBlending + ")",

        "gl_FragColor = d * ( 1.0 - s.a ) + s;",

      "#elif (BLENDING == " + THREE.AdditiveBlending + ")",

        "gl_FragColor = d + s;",

      "#elif (BLENDING == " + THREE.SubtractiveBlending + ")",

        "gl_FragColor = d - s;",

      "#elif (BLENDING == " + THREE.MultiplyBlending + ")",

        "gl_FragColor = d * s;",

      "#else", // THREE.NoBlending

        "gl_FragColor = s;",

      "#endif",

		"}"

	].join( "\n" )

};

// File:examples/js/shaders/GlossyMirrorShader.js

THREE.GlossyMirrorShader = {

	defines: {
		"SPECULAR_MAP": 0,
		"ROUGHNESS_MAP": 0,
		"GLOSSY_REFLECTIONS": 1,
		"REFLECTION_LOD_LEVELS": 4,
		"PERSPECTIVE_CAMERA": 1
	},

	uniforms: {

	 	"metalness": { type: "f", value: 0.0 },

	 	"specularColor": { type: "c", value: new THREE.Color( 0xffffff ) },
		"tSpecular": { type: "t", value: null },

		"tReflection": { type: "t", value: null },
		"tReflection1": { type: "t", value: null },
		"tReflection2": { type: "t", value: null },
		"tReflection3": { type: "t", value: null },
		"tReflection4": { type: "t", value: null },
		"tReflectionDepth": { type: "t", value: null },

		"roughness": { type: "f", value: 0.0 },
	 	"distanceFade": { type: "f", value: 0.01 },
	 	"fresnelStrength": { type: "f", value: 1.0 },

		"reflectionTextureMatrix" : { type: "m4", value: new THREE.Matrix4() },
		"mirrorCameraWorldMatrix": { type: "m4", value: new THREE.Matrix4() },
		"mirrorCameraProjectionMatrix": { type: "m4", value: new THREE.Matrix4() },
		"mirrorCameraInverseProjectionMatrix": { type: "m4", value: new THREE.Matrix4() },
		"mirrorCameraNear": { type: "f", value: 0 },
		"mirrorCameraFar": { type: "f", value: 0 },
		"screenSize": { type: "v2", value: new THREE.Vector2() },
		"mirrorNormal": { type: "v3", value: new THREE.Vector3() },
		"mirrorWorldPosition": { type: "v3", value: new THREE.Vector3() }
	},

	vertexShader: [

		"uniform mat4 reflectionTextureMatrix;",

		"varying vec4 mirrorCoord;",
		"varying vec3 vecPosition;",
		"varying vec3 worldNormal;",
		"varying vec2 vUv;",

		"void main() {",
			"vUv = uv;",
			"vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
			"vec4 worldPosition = modelMatrix * vec4( position, 1.0 );",
			"vecPosition = cameraPosition - worldPosition.xyz;",
			"worldNormal = (modelMatrix * vec4(normal,0.0)).xyz;",
			"mirrorCoord = reflectionTextureMatrix * worldPosition;",

			"gl_Position = projectionMatrix * mvPosition;",

		"}"

	].join( "\n" ),

	blending: THREE.NormalBlending,
	transparent: true,

	fragmentShader: [

		"#include <common>",
		"#include <packing>",
		"#include <bsdfs>",

		"uniform float roughness;",
		"#if ROUGHNESS_MAP == 1",
			"uniform sampler2D tRoughness;",
		"#endif",

		"uniform float metalness;",
		"uniform float distanceFade;",
		"uniform float fresnelStrength;",

		"uniform vec3 specularColor;",
		"#if SPECULAR_MAP == 1",
			"uniform sampler2D tSpecular;",
		"#endif",

		"uniform sampler2D tReflection;",
		"#if GLOSSY_REFLECTIONS == 1",
			"uniform sampler2D tReflection1;",
			"uniform sampler2D tReflection2;",
			"uniform sampler2D tReflection3;",
			"uniform sampler2D tReflection4;",
			"uniform sampler2D tReflectionDepth;",
		"#endif",

		"varying vec3 vecPosition;",
		"varying vec3 worldNormal;",
		"varying vec2 vUv;",

		"varying vec4 mirrorCoord;",
		"uniform mat4 mirrorCameraProjectionMatrix;",
 		"uniform mat4 mirrorCameraInverseProjectionMatrix;",
		"uniform mat4 mirrorCameraWorldMatrix;",
		"uniform float mirrorCameraNear;",
		"uniform float mirrorCameraFar;",
		"uniform vec2 screenSize;",
		"uniform vec3 mirrorNormal;",
		"uniform vec3 mirrorWorldPosition;",

		"#if GLOSSY_REFLECTIONS == 1",

			"float getReflectionDepth() {",

				"return unpackRGBAToDepth( texture2DProj( tReflectionDepth, mirrorCoord ) );",

	 		"}",

			"float getReflectionViewZ( const in float reflectionDepth ) {",
				"#if PERSPECTIVE_CAMERA == 1",
	 				"return perspectiveDepthToViewZ( reflectionDepth, mirrorCameraNear, mirrorCameraFar );",
				"#else",
					"return orthographicDepthToViewZ( reflectionDepth, mirrorCameraNear, mirrorCameraFar );",
				"#endif",
	 		"}",

	 		"vec3 getReflectionViewPosition( const in vec2 screenPosition, const in float reflectionDepth, const in float reflectionViewZ ) {",

	 			"float clipW = mirrorCameraProjectionMatrix[2][3] * reflectionViewZ + mirrorCameraProjectionMatrix[3][3];",
	 			"vec4 clipPosition = vec4( ( vec3( screenPosition, reflectionDepth ) - 0.5 ) * 2.0, 1.0 );",
	 			"clipPosition *= clipW;", // unprojection.
				"return ( mirrorCameraInverseProjectionMatrix * clipPosition ).xyz;",

	 		"}",

		"#endif",

		"vec4 getReflection( const in vec4 mirrorCoord, const in float lodLevel ) {",

			"#if GLOSSY_REFLECTIONS == 0",

				"return texture2DProj( tReflection, mirrorCoord );",

			"#else",

				"vec4 color0, color1;",
				"float alpha;",

				"if( lodLevel < 1.0 ) {",
					"color0 = texture2DProj( tReflection, mirrorCoord );",
					"color1 = texture2DProj( tReflection1, mirrorCoord );",
					"alpha = lodLevel;",
				"}",
				"else if( lodLevel < 2.0) {",
					"color0 = texture2DProj( tReflection1, mirrorCoord );",
					"color1 = texture2DProj( tReflection2, mirrorCoord );",
					"alpha = lodLevel - 1.0;",
				"}",
				"else if( lodLevel < 3.0 ) {",
					"color0 = texture2DProj( tReflection2, mirrorCoord );",
					"color1 = texture2DProj( tReflection3, mirrorCoord );",
					"alpha = lodLevel - 2.0;",
				"}",
				"else {",
					"color0 = texture2DProj( tReflection3, mirrorCoord );",
					"color1 = color0;",
					"alpha = 0.0;",
				"}",

				"return mix( color0, color1, alpha );",

			"#endif",

		"}",

		"void main() {",

			"vec3 specular = specularColor;",
			"#if SPECULAR_MAP == 1",
				"specular *= texture2D( tSpecular, vUv );",
			"#endif",

			"float fade = 1.0;",

			"#if GLOSSY_REFLECTIONS == 1",

				"float localRoughness = roughness;",
				"#if ROUGHNESS_MAP == 1",
					"localRoughness *= texture2D( tRoughness, vUv ).r;",
				"#endif",

				"vec2 screenPosition = gl_FragCoord.xy / screenSize;",
				"float reflectionDepth = getReflectionDepth();",
				"float reflectionViewZ = getReflectionViewZ( reflectionDepth );",

				"vec3 reflectionViewPosition = getReflectionViewPosition( screenPosition, reflectionDepth, reflectionViewZ );",			
				"vec3 reflectionWorldPosition = ( mirrorCameraWorldMatrix * vec4( reflectionViewPosition, 1.0 ) ).xyz;",

				"vec3 closestPointOnMirror = projectOnPlane( reflectionWorldPosition, mirrorWorldPosition, mirrorNormal );",

				"vec3 pointOnMirror = linePlaneIntersect( cameraPosition, normalize( reflectionWorldPosition - cameraPosition ), mirrorWorldPosition, mirrorNormal );",
				"float distance = length( closestPointOnMirror - reflectionWorldPosition );",
			
				"localRoughness = localRoughness * distance * 0.2;",
				"float lodLevel = localRoughness;",

				"fade = 1.0 - smoothstep( 0.0, 1.0, distanceFade * distance * 0.2 );",
			"#else",

				"float lodLevel = 0.0;",

			"#endif",

			"vec4 reflection = getReflection( mirrorCoord, lodLevel );",

			// apply dieletric-conductor model parameterized by metalness parameter.
			"float dotNV = clamp( dot( normalize( worldNormal ), normalize( vecPosition ) ), EPSILON, 1.0 );",
			"specular = mix( vec3( 0.05 ), specular, metalness );",
			// TODO: Invert fresnel.
			"vec3 fresnel;",
			"if( fresnelStrength < 0.0 ) {",
				"fresnel = mix( specular, specular * pow( dotNV, 2.0 ), -fresnelStrength ) * pow( 1.0 - roughness, 2.0 );",
			"} else {",
				"fresnel = mix( specular, F_Schlick( specular, dotNV ), fresnelStrength ) * pow( 1.0 - roughness, 2.0 );",
			"}",
			"gl_FragColor = vec4( reflection.rgb, fresnel * fade * reflection.a );", // fresnel controls alpha


		"}"

		].join( "\n" )

};

// File:examples/js/shaders/SAOShader.js

/**
 * @author bhouston / http://clara.io/
 *
 * Scalable Ambient Occlusion
 *
 */

THREE.ShaderChunk['sao'] = [

"#include <packing>",

"float getDepth( const in vec2 screenPosition ) {",

	"#if DEPTH_PACKING == 1",
		"return unpackRGBAToDepth( texture2D( tDepth, screenPosition ) );",
	"#else",
		"return texture2D( tDepth, screenPosition ).x;",
	"#endif",

"}",

"vec4 setDepth( const in float depth ) {",

	"#if DEPTH_PACKING == 1",
		"return packDepthToRGBA( depth );",
	"#else",
		"return vec4( depth, 0, 0, 0 );",
	"#endif",

"}",

"float getViewZ( const in float depth ) {",

	"#if PERSPECTIVE_CAMERA == 1",
		"return perspectiveDepthToViewZ( depth, cameraNear, cameraFar );",
	"#else",
		"return orthographicDepthToViewZ( depth, cameraNear, cameraFar );",
	"#endif",

"}"

].join( "\n" );

THREE.SAOShader = {

	blending: THREE.NoBlending,

	defines: {
		'NUM_SAMPLES': 13,
		'NUM_RINGS': 7,
		"NORMAL_TEXTURE": 0,
		"DIFFUSE_TEXTURE": 1,
		"DEPTH_PACKING": 1,
		"DEPTH_MIPS": 0,
		"PERSPECTIVE_CAMERA": 1
	},

	extensions: {
		'derivatives': true
	},

	uniforms: {

		"tDepth":       { type: "t", value: null },
		"tDepth1":       { type: "t", value: null },
		"tDepth2":       { type: "t", value: null },
		"tDepth3":       { type: "t", value: null },

		"tDiffuse":     { type: "t", value: null },
		"tNormal":      { type: "t", value: null },
		"size":         { type: "v2", value: new THREE.Vector2( 512, 512 ) },

		"cameraNear":   { type: "f", value: 1 },
		"cameraFar":    { type: "f", value: 100 },
		"cameraProjectionMatrix": { type: "m4", value: new THREE.Matrix4() },
		"cameraInverseProjectionMatrix": { type: "m4", value: new THREE.Matrix4() },

		"intensity":    { type: "f", value: 0.1 },

		"occlusionSphereWorldRadius": { type: "f", value: 100.0 },
		"worldToScreenRatio": { type: "v2", value: new THREE.Vector2( 1, 1 ) },
		"randomSeed":   { type: "f", value: 0.0 }
	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",

			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [


		"#include <common>",

		"varying vec2 vUv;",

		"#if DIFFUSE_TEXTURE == 1",
			"uniform sampler2D tDiffuse;",
		"#endif",

		"#define MAX_MIP_LEVEL 3",

		"uniform sampler2D tDepth;",

		"#if DEPTH_MIPS == 1",
			"uniform sampler2D tDepth1;",
			"uniform sampler2D tDepth2;",
			"uniform sampler2D tDepth3;",
		"#endif",

		"#if NORMAL_TEXTURE == 1",
			"uniform sampler2D tNormal;",
		"#endif",

		"uniform float cameraNear;",
		"uniform float cameraFar;",
		"uniform mat4 cameraProjectionMatrix;",
		"uniform mat4 cameraInverseProjectionMatrix;",

		"uniform float intensity;",
		"uniform float occlusionSphereWorldRadius;",
		"uniform vec2 size;",
		"uniform vec2 worldToScreenRatio;",
		"uniform float randomSeed;",


		"#include <sao>",

		"vec4 getDefaultColor( const in vec2 screenPosition ) {",

			"#if DIFFUSE_TEXTURE == 1",
				"return texture2D( tDiffuse, vUv );",
			"#else",
				"return vec4( 1.0 );",
			"#endif",

		"}",

		"vec3 getViewPosition( const in vec2 screenPosition, const in float depth, const in float viewZ ) {",

			"float clipW = cameraProjectionMatrix[2][3] * viewZ + cameraProjectionMatrix[3][3];",
			"vec4 clipPosition = vec4( ( vec3( screenPosition, depth ) - 0.5 ) * 2.0, 1.0 );",
			"clipPosition *= clipW;", // unprojection.
			"return ( cameraInverseProjectionMatrix * clipPosition ).xyz;",

		"}",

		"vec3 getViewNormal( const in vec3 viewPosition, const in vec2 screenPosition ) {",

			"#if NORMAL_TEXTURE == 1",
				"return -unpackRGBToNormal( texture2D( tNormal, screenPosition ).xyz );",
			"#else",
				"return normalize( cross( dFdx( viewPosition ), dFdy( viewPosition ) ) );",
			"#endif",

		"}",

		"float getDepthMIP( const in vec2 screenPosition, const int mipLevel ) {",

			"vec4 rawDepth;",
			"#if DEPTH_MIPS == 0",
				"rawDepth = texture2D( tDepth, screenPosition );",
			"#else",
				"if( mipLevel == 0 ) {",
					"rawDepth = texture2D( tDepth, screenPosition );",
				"}",
				"else if( mipLevel == 1 ) {",
					"rawDepth = texture2D( tDepth1, screenPosition );",
				"}",
				"else if( mipLevel == 2 ) {",
					"rawDepth = texture2D( tDepth2, screenPosition );",
				"}",
				"else {",
					"rawDepth = texture2D( tDepth3, screenPosition );",
				"}",
			"#endif",

			"#if DEPTH_PACKING == 1",
				"return unpackRGBAToDepth( rawDepth );",
			"#else",
				"return rawDepth.x;",
			"#endif",

		"}",

		"float scaleDividedByCameraFar;",
		"float minResolutionMultipliedByCameraFar;",
		"float errorCorrectionFactor;",

		"float getOcclusion( const in vec3 centerViewPosition, const in vec3 centerViewNormal, const in vec3 sampleViewPosition ) {",

			"vec3 viewDelta = sampleViewPosition - centerViewPosition;",
			"float viewDistance2 = dot( viewDelta, viewDelta );",

			"return max( ( dot( centerViewNormal, viewDelta ) + centerViewPosition.z * 0.001 ) / ( viewDistance2 + 0.0001 ), 0.0 );// * smoothstep( pow2( occlusionSphereWorldRadius ), 0.0, viewDistance2 );",

		"}",

		/*
		"float getOcclusion( const in vec3 centerViewPosition, const in vec3 centerViewNormal, const in vec3 sampleViewPosition ) {",

			"vec3 viewDelta = sampleViewPosition - centerViewPosition;",
			"float viewDistance2 = dot( viewDelta, viewDelta );",

			"return max( pow3( pow2( occlusionSphereWorldRadius ) - viewDistance2 ), 0.0 ) *",
				"max( ( dot( centerViewNormal, viewDelta ) - 0.01 * occlusionSphereWorldRadius ) / ( viewDistance2 + 0.0001 ), 0.0 );",

		"}",*/

		//"const float maximumScreenRadius = 10.0;",

		"int getMipLevel( const in vec2 occlusionSphereScreenRadius ) {",
    		"return int( clamp( floor( log2( length( occlusionSphereScreenRadius * size ) ) - 4.0 ), 0.0, 3.0 ) );",
		"}",

		// moving costly divides into consts
		"const float ANGLE_STEP = PI2 * float( NUM_RINGS ) / float( NUM_SAMPLES );",
		"const float INV_NUM_SAMPLES = 1.0 / float( NUM_SAMPLES );",

		"float getAmbientOcclusion( const in vec3 centerViewPosition ) {",

			// precompute some variables require in getOcclusion.
			"vec3 centerViewNormal = getViewNormal( centerViewPosition, vUv );",

			"vec2 invSize = 1.0 / size;",

			"vec2 occlusionSphereScreenRadius = occlusionSphereWorldRadius * worldToScreenRatio / centerViewPosition.z;",

			// jsfiddle that shows sample pattern: https://jsfiddle.net/a16ff1p7/
			"float random = rand( vUv + randomSeed );",
			"float angle = random * PI2;",
			"float radiusStep = INV_NUM_SAMPLES;",
			"float radius = radiusStep * ( 0.5 + random );",

			"float occlusionSum = 0.0;",

			"for( int i = 0; i < NUM_SAMPLES; i ++ ) {",
				"radius = (float(i) + 0.5) * radiusStep;",
				"vec2 sampleUvOffset = vec2( cos( angle ), sin( angle ) ) * radius * occlusionSphereScreenRadius * 1.0;",

				// round to nearest true sample to avoid misalignments between viewZ and normals, etc.
				"sampleUvOffset = floor( sampleUvOffset * size + vec2( 0.5 ) ) * invSize;",
				"if( sampleUvOffset.x == 0.0 && sampleUvOffset.y == 0.0 ) continue;",

				"angle += ANGLE_STEP;",

				"vec2 sampleUv = vUv + sampleUvOffset;",

				"if( sampleUv.x <= 0.0 || sampleUv.y <= 0.0 || sampleUv.x >= 1.0 || sampleUv.y >= 1.0 ) continue;", // skip points outside of texture.

				//"int depthMipLevel = getMipLevel( radius * occlusionSphereScreenRadius );",
				"float sampleDepth = getDepthMIP( sampleUv, int( 4.0 * radius ) );",
				"if( sampleDepth >= ( 1.0 - EPSILON ) ) {",
					"continue;",
				"}",

				"float sampleViewZ = getViewZ( sampleDepth );",
				"vec3 sampleViewPosition = getViewPosition( sampleUv, sampleDepth, sampleViewZ );",
				"occlusionSum += getOcclusion( centerViewPosition, centerViewNormal, sampleViewPosition );",

			"}",

			"return occlusionSum * intensity * 2.0 * occlusionSphereWorldRadius / ( float( NUM_SAMPLES ) );",
			//"return occlusionSum * intensity * 5.0 / ( float( NUM_SAMPLES ) * pow( occlusionSphereWorldRadius, 6.0 ) );",

		"}",


		"void main() {",

			"float centerDepth = getDepth( vUv );",
			"if( centerDepth >= ( 1.0 - EPSILON ) ) {",
				"discard;",
			"}",

		/*	"float mipDepth = unpackRGBAToDepth( texture2D( tDepth3, vUv ) );",
			"gl_FragColor.xyz = vec3( (centerDepth - mipDepth) * 50.0 + 0.5 );",
			"gl_FragColor.a = 1.0;",
			"return;",*/

			"float centerViewZ = getViewZ( centerDepth );",
			"vec3 viewPosition = getViewPosition( vUv, centerDepth, centerViewZ );",

			"float ambientOcclusion = getAmbientOcclusion( viewPosition );",

			//"gl_FragColor = getDefaultColor( vUv );",

			"gl_FragColor = packDepthToRGBA( centerDepth );",
			"gl_FragColor.x = max( 1.0 - ambientOcclusion, 0.0 );",

		"}"

	].join( "\n" )

};

// source: http://g3d.cs.williams.edu/websvn/filedetails.php?repname=g3d&path=%2FG3D10%2Fdata-files%2Fshader%2FAmbientOcclusion%2FAmbientOcclusion_minify.pix
THREE.SAODepthMinifyShader = {

	blending: THREE.NoBlending,

	defines: {
		"DEPTH_PACKING": 1,
	//	"JITTERED_SAMPLING": 1
	},

	uniforms: {

		"tDepth":	{ type: "t", value: null },
		"cameraNear":   { type: "f", value: 1 },
		"cameraFar":    { type: "f", value: 100 },
		"size": { type: "v2", value: new THREE.Vector2( 256, 256 ) },

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",

			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [


		"#include <common>",
		"#include <packing>",

		"varying vec2 vUv;",

		"uniform sampler2D tDepth;",
		"uniform vec2 size;",
		"uniform float cameraNear;",
		"uniform float cameraFar;",

		"void main() {",

/*		g3d_FragColor.mask = texelFetch(
			CSZ_buffer,
			clamp(
				ssP * 2 + ivec2(ssP.y & 1, ssP.x & 1),
				ivec2(0),
				textureSize(CSZ_buffer, previousMIPNumber) - ivec2(1)),
			previousMIPNumber).mask;

	 }*/

	 		"vec2 uv = vUv;",

		//	"uv += ( round( vec2( rand( vUv * size ), rand( vUv * size + vec2( 0.333, 2.0 ) ) ) ) - 0.5 ) / size;",
			"vec2 invSize = 0.5 / size;",

			// NOTE: no need for depth decoding if nearest interpolation is used.
		/*	"float viewZ = 1.0 / perspectiveDepthToViewZ( unpackRGBAToDepth( texture2D( tDepth, vUv + invSize * vec2( -1.0, -1.0 ) ) ), cameraNear, cameraFar );",
			"viewZ += 1.0 / perspectiveDepthToViewZ( unpackRGBAToDepth( texture2D( tDepth, vUv + invSize * vec2( 1.0, 1.0 ) ) ), cameraNear, cameraFar );",
			"viewZ += 1.0 / perspectiveDepthToViewZ( unpackRGBAToDepth( texture2D( tDepth, vUv + invSize * vec2( -1.0, 1.0 ) ) ), cameraNear, cameraFar );",
			"viewZ += 1.0 / perspectiveDepthToViewZ( unpackRGBAToDepth( texture2D( tDepth, vUv + invSize * vec2( 1.0, -1.0 ) ) ), cameraNear, cameraFar );",
			"viewZ *= 0.25;",
			"gl_FragColor = packDepthToRGBA( viewZToPerspectiveDepth( 1.0 / viewZ, cameraNear, cameraFar ) );",*/
			"float depth = unpackRGBAToDepth( texture2D( tDepth, vUv + invSize * vec2( -1.0, -1.0 ) ) );",
			"depth += unpackRGBAToDepth( texture2D( tDepth, vUv + invSize * vec2( 1.0, 1.0 ) ) );",
			"depth += unpackRGBAToDepth( texture2D( tDepth, vUv + invSize * vec2( -1.0, 1.0 ) ) );",
			"depth += unpackRGBAToDepth( texture2D( tDepth, vUv + invSize * vec2( 1.0, -1.0 ) ) );",
			"depth *= 0.25;",
			"gl_FragColor = packDepthToRGBA( depth );",
		"}"

	].join( "\n" )

};

THREE.SAOBilaterialFilterShader = {

	blending: THREE.NoBlending,

	defines: {
		"PERSPECTIVE_CAMERA": 1,
		"KERNEL_SAMPLE_RADIUS": 4,
	},

	uniforms: {

		"tAODepth":	{ type: "t", value: null },
		"tAONormal":	{ type: "t", value: null },
		"size": { type: "v2", value: new THREE.Vector2( 256, 256 ) },

		"kernelDirection": { type: "v2", value: new THREE.Vector2( 1, 0 ) },

		"cameraNear":   { type: "f", value: 1 },
		"cameraFar":    { type: "f", value: 100 },
		"edgeSharpness":    { type: "f", value: 3 },
		"packOutput":    { type: "f", value: 1 }

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",

			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

		"#include <common>",

		"varying vec2 vUv;",

		"uniform sampler2D tAODepth;",
		"uniform sampler2D tAONormal;",
		"uniform vec2 size;",

		"uniform float cameraNear;",
		"uniform float cameraFar;",
		"uniform float edgeSharpness;",
		"uniform int packOutput;",

		"uniform vec2 kernelDirection;",

		"#include <packing>",

		"float getViewZ( const in float depth ) {",

			"#if PERSPECTIVE_CAMERA == 1",
				"return perspectiveDepthToViewZ( depth, cameraNear, cameraFar );",
			"#else",
				"return orthographicDepthToViewZ( depth, cameraNear, cameraFar );",
			"#endif",

		"}",

		"void addTapInfluence( const in vec2 tapUv, const in vec3 centerNormal, const in float centerViewZ, const in float kernelWeight, inout float aoSum, inout float weightSum ) {",

			"vec4 depthTexel = texture2D( tAODepth, tapUv );",
			"float ao = depthTexel.r;",
			"depthTexel.r = 1.0;",
			"float depth = unpackRGBAToDepth( depthTexel );",

			"if( depth >= ( 1.0 - EPSILON ) ) {",
				"return;",
			"}",

			"float tapViewZ = -getViewZ( depth );",
			"float depthWeight = max(0.0, 1.0 - (edgeSharpness * 20.0) * abs(tapViewZ - centerViewZ));",

			"vec3 normal = unpackRGBToNormal(texture2D(tAONormal, tapUv).rgb);",
			"float normalCloseness = dot(normal, centerNormal);",
			"float k_normal = 4.0;",
			"float normalError = (1.0 - pow4( normalCloseness )) * k_normal;",
			"float normalWeight = max((1.0 - edgeSharpness * normalError), 0.00);",

			"float tapWeight = kernelWeight * ( depthWeight + normalWeight );",

			"aoSum += ao * tapWeight;",
			"weightSum += tapWeight;",
		"}",

		"float normpdf(in float x, in float sigma) {",
			"return 0.39894*exp(-0.5*x*x/(sigma*sigma))/sigma;",
		"}",

		"void main() {",

			"vec4 depthTexel = texture2D( tAODepth, vUv );",
			"float ao = depthTexel.r;",
			"depthTexel.r = 1.0;",
			"float depth = unpackRGBAToDepth( depthTexel );",
			"if( depth >= ( 1.0 - EPSILON ) ) {",
				"discard;",
			"}",

			"float centerViewZ = -getViewZ( depth );",

			"float weightSum = normpdf(0.0, 5.0) + 0.1;",
			"float aoSum = ao * weightSum;",

			"vec2 uvIncrement = ( kernelDirection / size );",

			"vec2 rTapUv = vUv, lTapUv = vUv;",
			"vec3 normalCenter = unpackRGBToNormal(texture2D(tAONormal, vUv).rgb);",

			"for( int i = 1; i <= KERNEL_SAMPLE_RADIUS; i ++ ) {",

				"float kernelWeight = normpdf(float(i), 5.0) + 0.1;",

				"rTapUv += uvIncrement;",
				"addTapInfluence( rTapUv, normalCenter, centerViewZ, kernelWeight, aoSum, weightSum );",

				"lTapUv -= uvIncrement;",
				"addTapInfluence( lTapUv, normalCenter, centerViewZ, kernelWeight, aoSum, weightSum );",

			"}",

			"ao = aoSum / weightSum;",
			"if( packOutput == 1 ) {",
				"gl_FragColor = depthTexel;",
				"gl_FragColor.r = ao;",
			"}",
			"else {",
				"gl_FragColor = vec4( vec3( ao ), 1.0 );",
			"}",

		"}"

	].join( "\n" )

};

// File:examples/js/shaders/BlurShader.js

/**
 * @author bhouston / http://clara.io
 *
 * For a horizontal blur, use X_STEP 1, Y_STEP 0
 * For a vertical blur, use X_STEP 0, Y_STEP 1
 *
 */

THREE.BlurShader = {

	defines: {

		"KERNEL_RADIUS": 4

	},

	uniforms: {

		"tDiffuse":         { type: "t", value: null },
		"size":             { type: "v2", value: new THREE.Vector2( 512, 512 ) },
		"sampleUvOffsets":  { type: "v2v", value: [ new THREE.Vector2( 0, 0 ) ] },
		"sampleWeights":    { type: "1fv", value: [ 1.0 ] },

	},

	vertexShader: [

		"#include <common>",

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",

			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

		"uniform sampler2D tDiffuse;",
		"uniform vec2 size;",

		"uniform vec2 sampleUvOffsets[ KERNEL_RADIUS + 1 ];",
		"uniform float sampleWeights[ KERNEL_RADIUS + 1 ];",

		"varying vec2 vUv;",

		"void main() {",

			"vec2 invSize = 1.0 / size;",

			"float weightSum = sampleWeights[0];",
			"vec4 diffuseSum = texture2D( tDiffuse, vUv ) * weightSum;",

			"for( int i = 1; i <= KERNEL_RADIUS; i ++ ) {",

				"float weight = sampleWeights[i];",
				"vec2 sampleUvOffset = sampleUvOffsets[i] * invSize;",
				"diffuseSum += ( texture2D( tDiffuse, vUv + sampleUvOffset ) + texture2D( tDiffuse, vUv - sampleUvOffset ) ) * weight;",
				"weightSum += 2.0 * weight;",

			"}",

			"gl_FragColor =diffuseSum / weightSum;",

		"}"

	].join( "\n" )

};


THREE.BlurShaderUtils = {

	createSampleWeights: function( kernelRadius, stdDev ) {

		var gaussian = function( x, stdDev ) {
			return Math.exp( - ( x*x ) / ( 2.0 * ( stdDev * stdDev ) ) ) / ( Math.sqrt( 2.0 * Math.PI ) * stdDev );
		};

		var weights = [];

		for( var i = 0; i <= kernelRadius; i ++ ) {
			weights.push( gaussian( i, stdDev ) );
		}

		return weights;
	},

	createSampleOffsets: function( kernelRadius, uvIncrement ) {

		var offsets = [];

		for( var i = 0; i <= kernelRadius; i ++ ) {
			offsets.push( uvIncrement.clone().multiplyScalar( i ) );
		}

		return offsets;

	},

	configure: function( material, kernelRadius, stdDev, uvIncrement ) {

		kernelRadius = kernelRadius | 0;

		if( ( material.defines[ 'KERNEL_RADIUS' ] !== kernelRadius ) || ( material.stdDev != stdDev ) ) {

			material.defines[ 'KERNEL_RADIUS' ] = kernelRadius;
			material.uniforms[ 'sampleUvOffsets' ].value = THREE.BlurShaderUtils.createSampleOffsets( kernelRadius, uvIncrement );
			material.uniforms[ 'sampleWeights' ].value = THREE.BlurShaderUtils.createSampleWeights( kernelRadius, stdDev );

			material.uvIncrement = uvIncrement;
			material.stdDev = stdDev;

			material.needsUpdate = true;
		}

	}

};

// File:examples/js/shaders/LuminosityHighPassShader.js

/**
 * @author bhouston / http://clara.io/
 *
 * Luminosity
 * http://en.wikipedia.org/wiki/Luminosity
 */

THREE.LuminosityHighPassShader = {

  shaderID: "luminosityHighPass",

	uniforms: {

		"tDiffuse": { type: "t", value: null },
		"luminosityThreshold": { type: "f", value: 1.0 },
		"smoothWidth": { type: "f", value: 1.0 },
		"defaultColor": { type: "c", value: new THREE.Color( 0x000000 ) },
		"defaultOpacity":  { type: "f", value: 0.0 }

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",

			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join("\n"),

	fragmentShader: [

		"uniform sampler2D tDiffuse;",
		"uniform vec3 defaultColor;",
		"uniform float defaultOpacity;",
		"uniform float luminosityThreshold;",
		"uniform float smoothWidth;",

		"varying vec2 vUv;",

		"void main() {",

			"vec4 texel = texture2D( tDiffuse, vUv );",

			"vec3 luma = vec3( 0.299, 0.587, 0.114 );",

			"float v = dot( texel.xyz, luma );",

			"vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );",

			"float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );",

			"gl_FragColor = mix( outputColor, texel, alpha );",

		"}"

	].join("\n")

};

// File:examples/js/postprocessing/EffectComposer.js

/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.EffectComposer = function ( renderer, renderTarget ) {

	this.renderer = renderer;

	if ( renderTarget === undefined ) {

		var parameters = {
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			format: THREE.RGBAFormat,
			stencilBuffer: false
		};
		var size = renderer.getSize();
		renderTarget = new THREE.WebGLRenderTarget( size.width, size.height, parameters );
		renderTarget.texture.name = "EffectComposer.rt1";
	}

	this.renderTarget1 = renderTarget;
	this.renderTarget2 = renderTarget.clone();
	this.renderTarget2.texture.name = "EffectComposer.rt2";

	this.writeBuffer = this.renderTarget1;
	this.readBuffer = this.renderTarget2;

	this.passes = [];

	if ( THREE.CopyShader === undefined )
		console.error( "THREE.EffectComposer relies on THREE.CopyShader" );

	this.copyPass = new THREE.ShaderPass( THREE.CopyShader );

};

Object.assign( THREE.EffectComposer.prototype, {

	swapBuffers: function() {

		var tmp = this.readBuffer;
		this.readBuffer = this.writeBuffer;
		this.writeBuffer = tmp;

	},

	addPass: function ( pass ) {

		this.passes.push( pass );

		var size = this.renderer.getSize();
		pass.setSize( size.width, size.height );

	},

	insertPass: function ( pass, index ) {

		this.passes.splice( index, 0, pass );

	},

	render: function ( delta ) {

		var maskActive = false;

		var pass, i, il = this.passes.length;

		for ( i = 0; i < il; i ++ ) {

			pass = this.passes[ i ];

			if ( pass.enabled === false ) continue;

			pass.render( this.renderer, this.writeBuffer, this.readBuffer, delta, maskActive );

			if ( pass.needsSwap ) {

				if ( maskActive ) {

					var context = this.renderer.context;

					context.stencilFunc( context.NOTEQUAL, 1, 0xffffffff );

					this.copyPass.render( this.renderer, this.writeBuffer, this.readBuffer, delta );

					context.stencilFunc( context.EQUAL, 1, 0xffffffff );

				}

				this.swapBuffers();

			}

			if ( THREE.MaskPass !== undefined ) {

				if ( pass instanceof THREE.MaskPass ) {

					maskActive = true;

				} else if ( pass instanceof THREE.ClearMaskPass ) {

					maskActive = false;

				}

			}

		}

	},

	reset: function ( renderTarget ) {

		if ( renderTarget === undefined ) {

			var size = this.renderer.getSize();

			renderTarget = this.renderTarget1.clone();
			renderTarget.setSize( size.width, size.height );

		}

		this.renderTarget1.dispose();
		this.renderTarget2.dispose();
		this.renderTarget1 = renderTarget;
		this.renderTarget2 = renderTarget.clone();

		this.writeBuffer = this.renderTarget1;
		this.readBuffer = this.renderTarget2;

	},

	setSize: function ( width, height ) {

		this.renderTarget1.setSize( width, height );
		this.renderTarget2.setSize( width, height );

		for ( var i = 0; i < this.passes.length; i ++ ) {

			this.passes[i].setSize( width, height );

		}

	}

} );


THREE.Pass = function () {

	// if set to true, the pass is processed by the composer
	this.enabled = true;

	// if set to true, the pass indicates to swap read and write buffer after rendering
	this.needsSwap = true;

	// if set to true, the pass clears its buffer before rendering
	this.clear = false;

	// if set to true, the result of the pass is rendered to screen
	this.renderToScreen = false;

};

Object.assign( THREE.Pass.prototype, {

	setSize: function( width, height ) {},

	render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

		console.error( "THREE.Pass: .render() must be implemented in derived pass." );

	}

} );

// File:examples/js/postprocessing/RenderPass.js

/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.RenderPass = function ( scene, camera, overrideMaterial, clearColor, clearAlpha ) {

	THREE.Pass.call( this );

	this.scene = scene;
	this.camera = camera;

	this.overrideMaterial = overrideMaterial;

	this.clearColor = clearColor;
	this.clearAlpha = ( clearAlpha !== undefined ) ? clearAlpha : 0;

	this.clear = true;
	this.clearDepth = false;
	this.needsSwap = false;

};

THREE.RenderPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: THREE.RenderPass,

	render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

		var oldAutoClear = renderer.autoClear;
		renderer.autoClear = false;

		this.scene.overrideMaterial = this.overrideMaterial;

		var oldClearColor, oldClearAlpha;

		if ( this.clearColor !== undefined ) {

			oldClearColor = renderer.getClearColor();
			oldClearAlpha = renderer.getClearAlpha();

			renderer.setClearColor( this.clearColor, this.clearAlpha );

		}

		if ( this.clearDepth ) {

			renderer.clearDepth();

		}

		renderer.renderOverride( this.overrideMaterial, this.scene, this.camera, this.renderToScreen ? null : readBuffer, this.clear );

		if ( this.clearColor ) {

			renderer.setClearColor( oldClearColor, oldClearAlpha );

		}

		this.scene.overrideMaterial = null;
		renderer.autoClear = oldAutoClear;

	}

} );

// File:examples/js/postprocessing/MaskPass.js

/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.MaskPass = function ( scene, camera ) {

	THREE.Pass.call( this );

	this.scene = scene;
	this.camera = camera;

	this.clear = true;
	this.needsSwap = false;

	this.inverse = false;

};

THREE.MaskPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: THREE.MaskPass,

	render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

		var context = renderer.context;
		var state = renderer.state;

		// don't update color or depth

		state.buffers.color.setMask( false );
		state.buffers.depth.setMask( false );

		// lock buffers

		state.buffers.color.setLocked( true );
		state.buffers.depth.setLocked( true );

		// set up stencil

		var writeValue, clearValue;

		if ( this.inverse ) {

			writeValue = 0;
			clearValue = 1;

		} else {

			writeValue = 1;
			clearValue = 0;

		}

		state.buffers.stencil.setTest( true );
		state.buffers.stencil.setOp( context.REPLACE, context.REPLACE, context.REPLACE );
		state.buffers.stencil.setFunc( context.ALWAYS, writeValue, 0xffffffff );
		state.buffers.stencil.setClear( clearValue );

		// draw into the stencil buffer

		renderer.render( this.scene, this.camera, readBuffer, this.clear );
		renderer.render( this.scene, this.camera, writeBuffer, this.clear );

		// unlock color and depth buffer for subsequent rendering

		state.buffers.color.setLocked( false );
		state.buffers.depth.setLocked( false );

		// only render where stencil is set to 1

		state.buffers.stencil.setFunc( context.EQUAL, 1, 0xffffffff );  // draw if == 1
		state.buffers.stencil.setOp( context.KEEP, context.KEEP, context.KEEP );

	}

} );


THREE.ClearMaskPass = function () {

	THREE.Pass.call( this );

	this.needsSwap = false;

};

THREE.ClearMaskPass.prototype = Object.create( THREE.Pass.prototype );

Object.assign( THREE.ClearMaskPass.prototype, {

	render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

		renderer.state.buffers.stencil.setTest( false );

	}

} );

// File:examples/js/postprocessing/ShaderPass.js

/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.ShaderPass = function ( shader, textureID ) {

	THREE.Pass.call( this );

	this.textureID = ( textureID !== undefined ) ? textureID : "tDiffuse";

	if ( shader instanceof THREE.ShaderMaterial ) {

		this.uniforms = shader.uniforms;

		this.material = shader;

	} else if ( shader ) {

		this.uniforms = THREE.UniformsUtils.clone( shader.uniforms );

		this.material = new THREE.ShaderMaterial( {

			defines: shader.defines || {},
			uniforms: this.uniforms,
			vertexShader: shader.vertexShader,
			fragmentShader: shader.fragmentShader

		} );

	}

	this.camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
	this.scene = new THREE.Scene();

	this.quad = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ), null );
	this.quad.frustumCulled = false; // Avoid getting clipped
	this.scene.add( this.quad );

};

THREE.ShaderPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: THREE.ShaderPass,

	render: function( renderer, writeBuffer, readBuffer, delta, maskActive ) {

		if ( this.uniforms[ this.textureID ] ) {

			this.uniforms[ this.textureID ].value = readBuffer.texture;

		}

		if ( this.renderToScreen ) {

			renderer.renderPass( this.material );

		} else {

			renderer.renderPass( this.material, writeBuffer, this.clear );

		}

	}

} );

// File:examples/js/postprocessing/SAOPass.js

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
	this.downSamplingRatio = 2;
	this.blurKernelSize = (this.downSamplingRatio === 1) ? 8 : 6;
	this.edgeSharpness = 1;

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
	this.normalMaterial.side = this.depthMaterial.side; // both normal and depth materials bot need to render with the same sidedness

	if ( THREE.SAOShader === undefined )	console.error( "THREE.SAOPass relies on THREE.SAOShader" );
	if ( THREE.CopyShader === undefined )	console.error( "THREE.SAOPass relies on THREE.CopyShader" );

	this.depthMinifyMaterial = new THREE.ShaderMaterial( THREE.SAODepthMinifyShader );
	this.depthMinifyMaterial.uniforms = THREE.UniformsUtils.clone( this.depthMinifyMaterial.uniforms );
	this.depthMinifyMaterial.defines = Object.assign( {}, this.depthMinifyMaterial.defines );
	this.depthMinifyMaterial.blending = THREE.NoBlending;

	this.saoMaterial = new THREE.ShaderMaterial( THREE.SAOShader );
	this.saoMaterial.uniforms = THREE.UniformsUtils.clone( this.saoMaterial.uniforms );
	this.saoMaterial.defines = Object.assign( {}, this.saoMaterial.defines );
	this.saoMaterial.defines[ 'DIFFUSE_TEXTURE' ] = 0;
	this.saoMaterial.defines[ 'NORMAL_TEXTURE' ] = this.implicitNormals ? 0 : 1;
	this.saoMaterial.defines[ 'MODE' ] = 2;

	this.bilateralFilterMaterial = new THREE.ShaderMaterial( THREE.SAOBilaterialFilterShader );
	this.bilateralFilterMaterial.uniforms = THREE.UniformsUtils.clone( this.bilateralFilterMaterial.uniforms );
	this.bilateralFilterMaterial.defines = Object.assign( {}, this.bilateralFilterMaterial.defines );
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

	setSize: function ( width, height ) {

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

			this.saoRenderTarget = new THREE.WebGLRenderTarget( width, height,
				{ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat } );
			this.saoRenderTargetFullRes = new THREE.WebGLRenderTarget( readBuffer.width, readBuffer.height,
					{ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat } );
			this.blurIntermediateRenderTarget = new THREE.WebGLRenderTarget( width, height,
				{ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat } );
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

			this.copyMaterial.uniforms[ 'tDiffuse' ].value = readBuffer.texture;
			this.copyMaterial.blending = THREE.NoBlending;

			renderer.renderPass( this.copyMaterial, writeBuffer, true );

		}

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
		if( this.depthMIPs ) {

			this.saoMaterial.uniforms[ "tDepth1" ].value = this.depth1RenderTarget.texture;
			this.saoMaterial.uniforms[ "tDepth2" ].value = this.depth2RenderTarget.texture;
			this.saoMaterial.uniforms[ "tDepth3" ].value = this.depth3RenderTarget.texture;
		}

		var oldClearColor = renderer.getClearColor(), oldClearAlpha = renderer.getClearAlpha();
		renderer.setClearColor( 0xffffff, 1.0 );

		renderer.renderPass( this.saoMaterial, this.saoRenderTarget, true ); // , 0xffffff, 0.0, "sao"

		if( this.blurEnabled ) {

			this.bilateralFilterMaterial.defines[ 'KERNEL_SAMPLE_RADIUS' ] = this.blurKernelSize;
			this.bilateralFilterMaterial.uniforms[ "tAODepth" ].value = this.saoRenderTarget.texture;
			this.bilateralFilterMaterial.uniforms[ "tAONormal" ].value = this.normalRenderTarget.texture;
			this.bilateralFilterMaterial.uniforms[ "kernelDirection" ].value = new THREE.Vector2( 1, 0 );
			this.bilateralFilterMaterial.uniforms[ "packOutput" ].value = 1;
			this.bilateralFilterMaterial.uniforms[ 'edgeSharpness' ].value = this.edgeSharpness;

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
			: this.saoRenderTarget.texture;
			this.copyMaterial.blending = THREE.NoBlending;

			renderer.renderPass( this.copyMaterial, this.renderToScreen ? null : writeBuffer, true );
			return;

		}

		renderer.autoClear = false;

		this.copyMaterial.uniforms[ 'tDiffuse' ].value = this.downSamplingRatio > 1.0 ? this.saoRenderTargetFullRes.texture
		: this.saoRenderTarget.texture;
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
					depth_weights[0] = 1.0 / (0.001 + abs(depth_hires-depth_coarse1));\
					float depth_coarse2 = unpackRGBAToDepth(texture2D(DepthTextureHalfRes, uvOffsets[1]));\
					depth_coarse2 = -perspectiveDepthToViewZ(depth_coarse2, cameraNearFar.x, cameraNearFar.y);\
					depth_weights[1] = 1.0 / (0.001 + abs(depth_hires-depth_coarse2));\
					float depth_coarse3 = unpackRGBAToDepth(texture2D(DepthTextureHalfRes, uvOffsets[2]));\
					depth_coarse3 = -perspectiveDepthToViewZ(depth_coarse3, cameraNearFar.x, cameraNearFar.y);\
					depth_weights[2] = 1.0 / (0.001 + abs(depth_hires-depth_coarse3));\
					float depth_coarse4 = unpackRGBAToDepth(texture2D(DepthTextureHalfRes, uvOffsets[3]));\
					depth_coarse4 = -perspectiveDepthToViewZ(depth_coarse4, cameraNearFar.x, cameraNearFar.y);\
					depth_weights[3] = 1.0 / (0.001 + abs(depth_hires-depth_coarse4));\
					\
					float norm_weights[4];\
					vec3 norm_fullRes = unpackRGBToNormal(texture2D(NormalTextureFullRes, vUv).rgb);\
					vec3 norm_coarse1 = unpackRGBToNormal(texture2D(NormalTextureHalfRes, uvOffsets[0]).rgb);\
					norm_weights[0] = pow(abs(dot(norm_coarse1, norm_fullRes)), 32.0);\
					vec3 norm_coarse2 = unpackRGBToNormal(texture2D(NormalTextureHalfRes, uvOffsets[1]).rgb);\
					norm_weights[1] = pow(abs(dot(norm_coarse2, norm_fullRes)), 32.0);\
					vec3 norm_coarse3 = unpackRGBToNormal(texture2D(NormalTextureHalfRes, uvOffsets[2]).rgb);\
					norm_weights[2] = pow(abs(dot(norm_coarse3, norm_fullRes)), 32.0);\
					vec3 norm_coarse4 = unpackRGBToNormal(texture2D(NormalTextureHalfRes, uvOffsets[3]).rgb);\
					norm_weights[3] = pow(abs(dot(norm_coarse4, norm_fullRes)), 32.0);\
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

// File:examples/js/postprocessing/SSAARenderPass.js

/**
*
* Supersample Anti-Aliasing Render Pass
*
* @author bhouston / http://clara.io/
*
* This manual approach to SSAA re-renders the scene ones for each sample with camera jitter and accumulates the results.
*
* References: https://en.wikipedia.org/wiki/Supersampling
*
*/

THREE.SSAARenderPass = function ( scene, camera, clearColor, clearAlpha ) {

	THREE.Pass.call( this );

	this.scene = scene;
	this.camera = camera;

	this.sampleLevel = 4; // specified as n, where the number of samples is 2^n, so sampleLevel = 4, is 2^4 samples, 16.
	this.unbiased = true;

	this.needsSwap = false;

	// as we need to clear the buffer in this pass, clearColor must be set to something, defaults to black.
	this.clearColor = ( clearColor !== undefined ) ? clearColor : 0x000000;
	this.clearAlpha = ( clearAlpha !== undefined ) ? clearAlpha : 0;

	if ( THREE.CopyShader === undefined ) console.error( "THREE.SSAARenderPass relies on THREE.CopyShader" );

	this.overMaterial = new THREE.ShaderMaterial( THREE.CopyShader );
	this.overMaterial.uniforms = THREE.UniformsUtils.clone( this.overMaterial.uniforms );
	this.overMaterial.blending = THREE.NormalBlending;
	this.overMaterial.premultipliedAlpha = true;
	this.overMaterial.transparent = true;
	this.overMaterial.depthTest = false;
	this.overMaterial.depthWrite = false;

	this.addMaterial = new THREE.ShaderMaterial( THREE.CopyShader );
	this.addMaterial.uniforms = THREE.UniformsUtils.clone( this.addMaterial.uniforms );
	this.addMaterial.blending = THREE.AdditiveBlending;
	this.addMaterial.premultipliedAlpha = true;
	this.addMaterial.transparent = true;
	this.addMaterial.depthTest = false;
	this.addMaterial.depthWrite = false;

	this.camera2 = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
	this.scene2	= new THREE.Scene();
	this.quad2 = new THREE.Mesh( new THREE.PlaneGeometry( 2, 2 ), this.copyMaterial );
	this.quad2.frustumCulled = false; // Avoid getting clipped
	this.scene2.add( this.quad2 );

};

THREE.SSAARenderPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: THREE.SSAARenderPass,

	dispose: function() {

		if ( this.sampleRenderTarget ) {
			this.sampleRenderTarget.dispose();
			this.sampleRenderTarget = null;
		}
		if ( this.accumulateRenderTarget ) {
			this.accumulateRenderTarget.dispose();
			this.accumulateRenderTarget = null;
		}

	},

	setSize: function ( width, height ) {

		if ( this.sampleRenderTarget ) this.sampleRenderTarget.setSize( width, height );
		if ( this.accumulateRenderTarget ) this.accumulateRenderTarget.setSize( width, height );

	},

	render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

		if ( ! this.sampleRenderTarget ) {

			this.sampleRenderTarget = new THREE.WebGLRenderTarget( readBuffer.width, readBuffer.height,
				{ minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat, name: "SSAARenderPass.sample" } );
			this.accumulateRenderTarget = new THREE.WebGLRenderTarget( readBuffer.width, readBuffer.height,
				{ minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat, name: "SSAARenderPass.accumulation" } );

		}

		var jitterOffsets = THREE.SSAARenderPass.JitterVectors[ Math.max( 0, Math.min( this.sampleLevel, 5 ) ) ];

		var autoClear = renderer.autoClear;
		renderer.autoClear = false;

		var oldClearColor = renderer.getClearColor().getHex();
		var oldClearAlpha = renderer.getClearAlpha();

		var baseSampleWeight = 1.0 / jitterOffsets.length;
		var roundingRange = 1 / 32;

		this.addMaterial.uniforms[ "tDiffuse" ].value = this.sampleRenderTarget.texture;


		var width = readBuffer.width, height = readBuffer.height;

		renderer.setClearColor( 0x000000, 0 );

		// render the scene multiple times, each slightly jitter offset from the last and accumulate the results.
		for ( var i = 0; i < jitterOffsets.length; i ++ ) {

			var jitterOffset = jitterOffsets[i];
			if ( this.camera.setViewOffset ) {
				this.camera.setViewOffset( width, height,
					jitterOffset[ 0 ] * 0.0625, jitterOffset[ 1 ] * 0.0625,   // 0.0625 = 1 / 16
					width, height );
			}

			var sampleWeight = baseSampleWeight;
			if( this.unbiased ) {
				// the theory is that equal weights for each sample lead to an accumulation of rounding errors.
				// The following equation varies the sampleWeight per sample so that it is uniformly distributed
				// across a range of values whose rounding errors cancel each other out.
				var uniformCenteredDistribution = ( -0.5 + ( i + 0.5 ) / jitterOffsets.length );
				sampleWeight += roundingRange * uniformCenteredDistribution;
			}

			this.addMaterial.uniforms[ "opacity" ].value = sampleWeight;
			renderer.render( this.scene, this.camera, this.sampleRenderTarget, true );
			renderer.renderPass( this.addMaterial, this.accumulateRenderTarget, ( i === 0 ) );
		}

		if ( this.camera.clearViewOffset ) this.camera.clearViewOffset();

		this.overMaterial.uniforms[ "tDiffuse" ].value = this.accumulateRenderTarget.texture;

		renderer.setClearColor( this.clearColor, this.clearAlpha );
		renderer.renderPass( this.overMaterial, this.renderToScreen ? null : readBuffer, this.clear );

		renderer.autoClear = autoClear;
		renderer.setClearColor( oldClearColor, oldClearAlpha );
	}

} );

// These jitter vectors are specified in integers because it is easier.
// I am assuming a [-8,8) integer grid, but it needs to be mapped onto [-0.5,0.5)
// before being used, thus these integers need to be scaled by 1/16.
//
// Sample patterns reference: https://msdn.microsoft.com/en-us/library/windows/desktop/ff476218%28v=vs.85%29.aspx?f=255&MSPPError=-2147217396
THREE.SSAARenderPass.JitterVectors = [
	[
		[ 0, 0 ]
	],
	[
		[ 4, 4 ], [ - 4, - 4 ]
	],
	[
		[ - 2, - 6 ], [ 6, - 2 ], [ - 6, 2 ], [ 2, 6 ]
	],
	[
		[ 1, - 3 ], [ - 1, 3 ], [ 5, 1 ], [ - 3, - 5 ],
		[ - 5, 5 ], [ - 7, - 1 ], [ 3, 7 ], [ 7, - 7 ]
	],
	[
		[ 1, 1 ], [ - 1, - 3 ], [ - 3, 2 ], [ 4, - 1 ],
		[ - 5, - 2 ], [ 2, 5 ], [ 5, 3 ], [ 3, - 5 ],
		[ - 2, 6 ], [ 0, - 7 ], [ - 4, - 6 ], [ - 6, 4 ],
		[ - 8, 0 ], [ 7, - 4 ], [ 6, 7 ], [ - 7, - 8 ]
	],
	[
		[ - 4, - 7 ], [ - 7, - 5 ], [ - 3, - 5 ], [ - 5, - 4 ],
		[ - 1, - 4 ], [ - 2, - 2 ], [ - 6, - 1 ], [ - 4, 0 ],
		[ - 7, 1 ], [ - 1, 2 ], [ - 6, 3 ], [ - 3, 3 ],
		[ - 7, 6 ], [ - 3, 6 ], [ - 5, 7 ], [ - 1, 7 ],
		[ 5, - 7 ], [ 1, - 6 ], [ 6, - 5 ], [ 4, - 4 ],
		[ 2, - 3 ], [ 7, - 2 ], [ 1, - 1 ], [ 4, - 1 ],
		[ 2, 1 ], [ 6, 2 ], [ 0, 4 ], [ 4, 4 ],
		[ 2, 5 ], [ 7, 5 ], [ 5, 6 ], [ 3, 7 ]
	]
];

// File:examples/js/postprocessing/ClearPass.js

/**
 * @author mrdoob / http://mrdoob.com/
 */

THREE.ClearPass = function ( clearColor, clearAlpha ) {

	THREE.Pass.call( this );

	this.needsSwap = false;

	this.clearColor = ( clearColor !== undefined ) ? clearColor : 0x000000;
	this.clearAlpha = ( clearAlpha !== undefined ) ? clearAlpha : 0;

};

THREE.ClearPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: THREE.ClearPass,

	render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

		var oldClearColor, oldClearAlpha;

		if ( this.clearColor !== undefined ) {

			oldClearColor = renderer.getClearColor().getHex();
			oldClearAlpha = renderer.getClearAlpha();

			renderer.setClearColor( this.clearColor, this.clearAlpha );

		}

		renderer.setRenderTarget( this.renderToScreen ? null : readBuffer );
		renderer.clear();

		if ( this.clearColor ) {

			renderer.setClearColor( oldClearColor, oldClearAlpha );

		}

	}

} );

// File:examples/js/postprocessing/TexturePass.js

/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.TexturePass = function ( map, opacity ) {

	THREE.Pass.call( this );

	if ( THREE.CopyShader === undefined )
		console.error( "THREE.TexturePass relies on THREE.CopyShader" );

	var shader = THREE.CopyShader;

	this.map = map;
	this.opacity = ( opacity !== undefined ) ? opacity : 1.0;

	this.uniforms = THREE.UniformsUtils.clone( shader.uniforms );

	this.material = new THREE.ShaderMaterial( {

		uniforms: this.uniforms,
		vertexShader: shader.vertexShader,
		fragmentShader: shader.fragmentShader,
		depthTest: false,
		depthWrite: false

	} );

	this.needsSwap = false;

	this.camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
	this.scene  = new THREE.Scene();

	this.quad = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ), null );
	this.quad.frustumCulled = false; // Avoid getting clipped
	this.scene.add( this.quad );

};

THREE.TexturePass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: THREE.TexturePass,

	render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

		var oldAutoClear = renderer.autoClear;
		renderer.autoClear = false;

		this.quad.material = this.material;

		this.uniforms[ "opacity" ].value = this.opacity;
		this.uniforms[ "tDiffuse" ].value = this.map;
		this.material.transparent = ( this.opacity < 1.0 );

		renderer.render( this.scene, this.camera, this.renderToScreen ? null : readBuffer, this.clear );

		renderer.autoClear = oldAutoClear;
	}

} );

// File:examples/js/postprocessing/CubeTexturePass.js

/**
 * @author bhouston / http://clara.io/
 */

THREE.CubeTexturePass = function ( camera, envMap, opacity ) {

	THREE.Pass.call( this );

	this.camera = camera;

	this.needsSwap = false;

	this.cubeMaterial = new THREE.MeshCubeMaterial();

	this.cubeMesh = new THREE.Mesh(
		new THREE.BoxBufferGeometry( 10, 10, 10 ),
		this.cubeMaterial
	);

	this.envMap = envMap;
	this.envMapIntensity = 1.0;
	this.opacity = ( opacity !== undefined ) ? opacity : 1.0;
	this.roughness = 0.0;

	this.cubeScene = new THREE.Scene();
	this.cubeCamera = new THREE.PerspectiveCamera();
	this.cubeScene.add( this.cubeMesh );

};

THREE.CubeTexturePass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: THREE.CubeTexturePass,

	render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

		var oldAutoClear = renderer.autoClear;
		renderer.autoClear = false;

		this.cubeCamera.projectionMatrix.copy( this.camera.projectionMatrix );
		this.cubeCamera.quaternion.setFromRotationMatrix( this.camera.matrixWorld );

		if( this.cubeMaterial.envMap != this.envMap ) {
			this.cubeMaterial.envMap = this.envMap;
			this.cubeMaterial.needsUpdate = true;
		}
		this.cubeMaterial.envMapIntensity = this.envMapIntensity;
		this.cubeMaterial.roughness = this.roughness;
		this.cubeMaterial.opacity = this.opacity;
		this.cubeMaterial.transparent = ( this.opacity < 1.0 );

		renderer.render( this.cubeScene, this.cubeCamera, this.renderToScreen ? null : readBuffer, this.clear );

		renderer.autoClear = oldAutoClear;

	}

} );

// File:examples/js/postprocessing/DofPass.js

/**
 * @author spidersharma03 / http://eduperiment.com/
 */

THREE.DofPass = function (resolution, renderScene, renderCamera) {

	THREE.Pass.call( this );

	var resolution = ( resolution !== undefined ) ? resolution : new THREE.Vector2(256, 256);
	// render targets
	this.downSampleRes = new THREE.Vector2(Math.round(resolution.x/2), Math.round(resolution.y/2));

	var pars = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType, format: THREE.RGBAFormat };

	this.renderTargetColorDownSample = new THREE.WebGLRenderTarget( this.downSampleRes.x, this.downSampleRes.y, pars );
	this.renderTargetColorDownSample.texture.generateMipmaps = false;

	this.renderTargetCoCDownSample = new THREE.WebGLRenderTarget( this.downSampleRes.x, this.downSampleRes.y, pars );
	this.renderTargetCoCDownSample.texture.generateMipmaps = false;

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

	this.focalDistance = 10.0;
	this.cameraNear = 0.1;
	this.cameraFar = 100;
	this.NearFarBlurScale = new THREE.Vector2(0.1, 0.5);

	this.downSamplingMaterial = this.getColorDownSamplingMaterial();

	this.cocMaterial = this.getCoCMaterial();
	this.cocMaterial.uniforms[ "NearFarBlurScale" ].value = this.NearFarBlurScale;
	this.cocMaterial.uniforms[ "cameraNearFar" ].value = new THREE.Vector2(renderCamera.near, renderCamera.far);
	this.cocMaterial.uniforms[ "focalDistance" ].value = this.focalDistance;

	this.dilateNearCocMaterial = this.getDilateNearCocMaterial();
	this.dilateNearCocMaterial.uniforms[ "NearFarBlurScale" ].value = this.NearFarBlurScale;

	this.dofBlurType = 1;
	this.dofBlurMaterial = (this.dofBlurType === 0) ? this.getDofBlurCircularMaterial() : this.getDofBlurSeperableMaterial();


	this.dofCombineMaterial = this.getDofCombineMaterial();
	this.dofCombineMaterial.uniforms[ "NearFarBlurScale" ].value = this.NearFarBlurScale;
	this.dofCombineMaterial.uniforms[ "cameraNearFar" ].value = new THREE.Vector2(renderCamera.near, renderCamera.far);
	this.dofCombineMaterial.uniforms[ "focalDistance" ].value = this.focalDistance;

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

THREE.DofPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: THREE.DofPass,

	setSize: function(width, height) {
		this.downSampleRes = new THREE.Vector2(Math.round(width/2), Math.round(height/2));


		var resx = this.downSampleRes.x;
		var resy = this.downSampleRes.y;

		this.renderTargetColorDownSample.setSize( resx, resy );
		this.renderTargetCoCDownSample.setSize( resx, resy );
		this.renderTargetBlurTemp.setSize( resx, resy );
		this.renderTargetDofBlur.setSize( resx, resy );
		this.renderTargetDofBlurTemp.setSize( resx, resy );
		this.renderTargetDofCombine.setSize( width, height );
		this.depthRenderTarget.setSize( width, height );
	},

	changeBlurType: function(blurType) {
		this.dofBlurType = blurType;
		this.dofBlurMaterial = (this.dofBlurType === 0) ? this.getDofBlurCircularMaterial() : this.getDofBlurSeperableMaterial();	},

	render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {


		this.dilateNearCocMaterial.uniforms[ "texSize" ].value = this.downSampleRes;
		this.dofBlurMaterial.uniforms[ "texSize" ].value = this.downSampleRes;
		this.dofCombineMaterial.uniforms[ "texSize" ].value = this.downSampleRes;

		this.cocMaterial.uniforms[ "focalDistance" ].value = this.focalDistance;
		this.cocMaterial.uniforms[ "cameraNearFar" ].value.x = this.cameraNear;
		this.cocMaterial.uniforms[ "cameraNearFar" ].value.y = this.cameraFar;

		this.dofCombineMaterial.uniforms[ "focalDistance" ].value = this.focalDistance;
		this.dofCombineMaterial.uniforms[ "cameraNearFar" ].value.x = this.cameraNear;
		this.dofCombineMaterial.uniforms[ "cameraNearFar" ].value.y = this.cameraFar;


		this.oldClearColor.copy( renderer.getClearColor() );
		this.oldClearAlpha = renderer.getClearAlpha();
		var oldAutoClear = renderer.autoClear;
		renderer.autoClear = true;

		if ( maskActive ) renderer.context.disable( renderer.context.STENCIL_TEST );

		// Render Scene into depth buffer. This is temporary and should not be done here.
		this.renderScene.overrideMaterial = this.depthMaterial;
		renderer.setClearColor(0xffffff, 1);
		renderer.render( this.renderScene, this.renderCamera, this.depthRenderTarget );
		this.renderScene.overrideMaterial = null;

		// 1. Downsample the Original texture, and store coc in the alpha channel
		this.quad.material = this.downSamplingMaterial;
		this.downSamplingMaterial.uniforms[ "colorTexture" ].value = readBuffer.texture;
		renderer.render( this.scene, this.camera, this.renderTargetColorDownSample );

		this.quad.material = this.cocMaterial;
		this.cocMaterial.uniforms[ "depthTexture" ].value = this.depthRenderTarget.texture;
		renderer.render( this.scene, this.camera, this.renderTargetCoCDownSample );

		// 2. Dilate/Blur Near field coc
		this.quad.material = this.dilateNearCocMaterial;
		this.dilateNearCocMaterial.uniforms[ "cocTexture" ].value = this.renderTargetCoCDownSample.texture;
		this.dilateNearCocMaterial.uniforms[ "depthTexture" ].value = this.depthRenderTarget.texture;
		this.dilateNearCocMaterial.uniforms[ "direction" ].value = new THREE.Vector2(1, 0);
		renderer.render( this.scene, this.camera, this.renderTargetBlurTemp );
		this.dilateNearCocMaterial.uniforms[ "cocTexture" ].value = this.renderTargetBlurTemp.texture;
		this.dilateNearCocMaterial.uniforms[ "direction" ].value = new THREE.Vector2(0, 1);
		renderer.render( this.scene, this.camera, this.renderTargetCoCDownSample );

		// 3. Blur Dof
		if( this.dofBlurType === 0 ){
			this.quad.material = this.dofBlurMaterial;
			this.dofBlurMaterial.uniforms[ "cocTexture" ].value = this.renderTargetCoCDownSample.texture;
			this.dofBlurMaterial.uniforms[ "colorTexture" ].value = this.renderTargetDownSample.texture;
			this.dofBlurMaterial.uniforms[ "depthTexture" ].value = this.depthRenderTarget.texture;
			renderer.render( this.scene, this.camera, this.renderTargetDofBlurTemp );
		}
		else {
			this.quad.material = this.dofBlurMaterial;
			this.dofBlurMaterial.uniforms[ "cocTexture" ].value = this.renderTargetCoCDownSample.texture;
			this.dofBlurMaterial.uniforms[ "colorTexture" ].value = this.renderTargetColorDownSample.texture;
			this.dofBlurMaterial.uniforms[ "direction" ].value = new THREE.Vector2(1, 0);
			renderer.render( this.scene, this.camera, this.renderTargetDofBlur );
			this.dofBlurMaterial.uniforms[ "colorTexture" ].value = this.renderTargetDofBlur.texture;
			this.dofBlurMaterial.uniforms[ "direction" ].value = new THREE.Vector2(0, 1);
			renderer.render( this.scene, this.camera, this.renderTargetDofBlurTemp );
		}
		// 4. Dof Combine
		this.quad.material = this.dofCombineMaterial;
		this.dofCombineMaterial.uniforms[ "cocTexture" ].value = this.renderTargetCoCDownSample.texture;
		this.dofCombineMaterial.uniforms[ "colorTexture" ].value = readBuffer.texture;
		this.dofCombineMaterial.uniforms[ "depthTexture" ].value = this.depthRenderTarget.texture;
		this.dofCombineMaterial.uniforms[ "blurTexture" ].value = this.renderTargetDofBlurTemp.texture;
		renderer.render( this.scene, this.camera, this.renderTargetDofCombine );

		// Copy Pass
		this.quad.material = this.materialCopy;
		this.copyUniforms[ "tDiffuse" ].value = this.renderTargetDofCombine.texture;

		if ( maskActive ) renderer.context.enable( renderer.context.STENCIL_TEST );
		renderer.render( this.scene, this.camera, readBuffer );

		renderer.setClearColor( this.oldClearColor, this.oldClearAlpha );
		renderer.autoClear = oldAutoClear;
	},

	getColorDownSamplingMaterial: function() {

		return new THREE.ShaderMaterial( {

			uniforms: {
				"colorTexture": { value: null },
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
				\
				void main() {\n\
					gl_FragColor = texture2D(colorTexture, vUv);\n\
				}"
		} );
	},

	getCoCMaterial: function() {

		return new THREE.ShaderMaterial( {

			uniforms: {
				"depthTexture": { value: null },
				"NearFarBlurScale": { value: new THREE.Vector2( 0.5, 0.5 ) },
				"cameraNearFar": { value: new THREE.Vector2( 0.1, 100 ) },
				"focalDistance": { value: 1.0 }
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
				uniform sampler2D depthTexture;\n\
				uniform vec2 NearFarBlurScale;\
				uniform vec2 cameraNearFar;\
				uniform float focalDistance;\
				const float MAXIMUM_BLUR_SIZE = 8.0;\
				\
				float computeCoc() {\
					vec4 packDepth = texture2D(depthTexture, vUv).rgba;\
					if(packDepth.x == 1.0) return max(NearFarBlurScale.x, NearFarBlurScale.y);\
						float depth = unpackRGBAToDepth(packDepth);\
						depth = -perspectiveDepthToViewZ(depth, cameraNearFar.x, cameraNearFar.y);\
						float coc = (depth - focalDistance)/depth;\
					return (coc > 0.0 ? coc * NearFarBlurScale.y : coc * NearFarBlurScale.x);\
				}\
				\
				void main() {\n\
					gl_FragColor = vec4(0.0, 0.0, 0.0, computeCoc());\n\
				}"
		} );
	},


	getDilateNearCocMaterial: function() {

		return new THREE.ShaderMaterial( {

			uniforms: {
				"cocTexture": { value: null },
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
				uniform sampler2D cocTexture;\n\
				uniform sampler2D depthTexture;\n\
				uniform vec2 direction;\
				uniform vec2 texSize;\
				uniform vec2 NearFarBlurScale;\
				const float MAXIMUM_BLUR_SIZE = 8.0;\
				\
				float expandNear(const in vec2 offset, const in bool isBackground) {\
					float coc = 0.0;\
					vec2 sampleOffsets = MAXIMUM_BLUR_SIZE * offset / 5.0;\
					float coc0 = texture2D(cocTexture, vUv).a;\
					float coc1 = texture2D(cocTexture, vUv - 5.0 * sampleOffsets).a;\
					float coc2 = texture2D(cocTexture, vUv - 4.0 * sampleOffsets).a;\
					float coc3 = texture2D(cocTexture, vUv - 3.0 * sampleOffsets).a;\
					float coc4 = texture2D(cocTexture, vUv - 2.0 * sampleOffsets).a;\
					float coc5 = texture2D(cocTexture, vUv - 1.0 * sampleOffsets).a;\
					float coc6 = texture2D(cocTexture, vUv + 1.0 * sampleOffsets).a;\
					float coc7 = texture2D(cocTexture, vUv + 2.0 * sampleOffsets).a;\
					float coc8 = texture2D(cocTexture, vUv + 3.0 * sampleOffsets).a;\
					float coc9 = texture2D(cocTexture, vUv + 4.0 * sampleOffsets).a;\
					float coc10 = texture2D(cocTexture, vUv + 5.0 * sampleOffsets).a;\
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
					gl_FragColor = vec4(0.0, 0.0, 0.0, coc);\n\
				}"
		} );
	},

	getDofBlurCircularMaterial: function() {

		return new THREE.ShaderMaterial( {

			uniforms: {
				"colorTexture": { value: null },
				"cocTexture": { value: null },
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
				uniform sampler2D cocTexture;\n\
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
					vec4 cocr = texture2D(cocTexture, vUv);\
						\
					float blurDist = MAXIMUM_BLUR_SIZE * coc.a;\
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
				vec4 weightedBlur() { \
					float cocIn = texture2D(cocTexture, vUv).a;\
					float kernelRadius = MAXIMUM_BLUR_SIZE * cocIn;\
					vec2 invSize = 1.0 / texSize;\
					cocIn *= cocIn * cocIn;\
					float centreSpaceWeight = normpdf(0.0, SIGMA) * abs(cocIn);\
					float weightSum = centreSpaceWeight;\
					vec4 centreSample = texture2D(colorTexture, vUv);\
					vec4 diffuseSum = centreSample * weightSum;\
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
							diffuseSum += ( (leftSample * leftCocWeight) + (rightSample * rightCocWeight) ) * spaceWeight;\
							weightSum += (spaceWeight * (leftCocWeight + rightCocWeight));\
					}\
				  return diffuseSum/weightSum;\
				}\
				\
				void main() {\n\
					gl_FragColor = weightedBlur();\n\
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
				"focalDistance" : {value: 20.0 }
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
				uniform float focalDistance;\
				\
				float computeCoc() {\
					vec4 packedDepth = texture2D(depthTexture, vUv);\
					if(packedDepth.x == 1.0) return max(NearFarBlurScale.x, NearFarBlurScale.y);\
						float depth = unpackRGBAToDepth(packedDepth);\
						depth = -perspectiveDepthToViewZ(depth, cameraNearFar.x, cameraNearFar.y);\
						float coc = (depth - focalDistance)/depth;\
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
					vec4 color = mix(texture2D(colorTexture, vUv), blur, vec4(coc));\
					gl_FragColor = color;\n\
				}"
		} );
	}

});

// File:examples/js/postprocessing/UnrealBloomPass.js

/**
 * @author spidersharma / http://eduperiment.com/
 Inspired from Unreal Engine::
 https://docs.unrealengine.com/latest/INT/Engine/Rendering/PostProcessEffects/Bloom/
 */

THREE.UnrealBloomPass = function ( resolution, strength, radius, threshold ) {

	THREE.Pass.call( this );

	this.strength = ( strength !== undefined ) ? strength : 1;
	this.radius = radius;
	this.threshold = threshold;
	this.resolution = ( resolution !== undefined ) ? new THREE.Vector2(resolution.x, resolution.y) : new THREE.Vector2(256, 256);

	// render targets
	var pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
	this.renderTargetsHorizontal = [];
	this.renderTargetsVertical = [];
	this.nMips = 5;
	var resx = Math.round(this.resolution.x/2);
	var resy = Math.round(this.resolution.y/2);

	this.renderTargetBright = new THREE.WebGLRenderTarget( resx, resy, pars );
	this.renderTargetBright.texture.name = "UnrealBloomPass.bright";
	this.renderTargetBright.texture.generateMipmaps = false;

	for( var i=0; i<this.nMips; i++) {

		var renderTarget = new THREE.WebGLRenderTarget( resx, resy, pars );

		renderTarget.texture.name = "UnrealBloomPass.h" + i;
		renderTarget.texture.generateMipmaps = false;

		this.renderTargetsHorizontal.push(renderTarget);

		var renderTarget = new THREE.WebGLRenderTarget( resx, resy, pars );

		renderTarget.texture.name = "UnrealBloomPass.v" + i;
		renderTarget.texture.generateMipmaps = false;

		this.renderTargetsVertical.push(renderTarget);

		resx = Math.round(resx/2);

		resy = Math.round(resy/2);
	}

	// luminosity high pass material

	if ( THREE.LuminosityHighPassShader === undefined )
		console.error( "THREE.UnrealBloomPass relies on THREE.LuminosityHighPassShader" );

	var highPassShader = THREE.LuminosityHighPassShader;
	this.highPassUniforms = THREE.UniformsUtils.clone( highPassShader.uniforms );

	this.highPassUniforms[ "luminosityThreshold" ].value = threshold;
	this.highPassUniforms[ "smoothWidth" ].value = 0.05;

	this.materialHighPassFilter = new THREE.ShaderMaterial( {
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
	this.compositeMaterial.needsUpdate = true;

	var bloomFactors = [1.0, 0.8, 0.6, 0.4, 0.2];
	this.compositeMaterial.uniforms["bloomFactors"].value = bloomFactors;
	this.bloomTintColors = [new THREE.Vector3(1,1,1), new THREE.Vector3(1,1,1), new THREE.Vector3(1,1,1)
												,new THREE.Vector3(1,1,1), new THREE.Vector3(1,1,1)];
	this.compositeMaterial.uniforms["bloomTintColors"].value = this.bloomTintColors;

	// copy material
	if ( THREE.CopyShader === undefined )
		console.error( "THREE.BloomPass relies on THREE.CopyShader" );

	var copyShader = THREE.CopyShader;

	this.copyUniforms = THREE.UniformsUtils.clone( copyShader.uniforms );
	this.copyUniforms[ "opacity" ].value = 1.0;

	this.materialCopy = new THREE.ShaderMaterial( {
		uniforms: this.copyUniforms,
		vertexShader: copyShader.vertexShader,
		fragmentShader: copyShader.fragmentShader,
		blending: THREE.AdditiveBlending,
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
	this.quad.frustumCulled = false; // Avoid getting clipped
	this.scene.add( this.quad );

};

THREE.UnrealBloomPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: THREE.UnrealBloomPass,

	dispose: function() {
		for( var i=0; i< this.renderTargetsHorizontal.length(); i++) {
			this.renderTargetsHorizontal[i].dispose();
		}
		for( var i=0; i< this.renderTargetsVertical.length(); i++) {
			this.renderTargetsVertical[i].dispose();
		}
		this.renderTargetBright.dispose();
	},

	setSize: function ( width, height ) {

		var resx = Math.round(width/2);
		var resy = Math.round(height/2);

		this.renderTargetBright.setSize(resx, resy);

		for( var i=0; i<this.nMips; i++) {

			this.renderTargetsHorizontal[i].setSize(resx, resy);
			this.renderTargetsVertical[i].setSize(resx, resy);

			this.separableBlurMaterials[i].uniforms[ "texSize" ].value = new THREE.Vector2(resx, resy);

			resx = Math.round(resx/2);
			resy = Math.round(resy/2);
		}
	},

	render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

		this.oldClearColor.copy( renderer.getClearColor() );
		this.oldClearAlpha = renderer.getClearAlpha();
		var oldAutoClear = renderer.autoClear;
		renderer.autoClear = false;

		renderer.setClearColor( new THREE.Color( 0, 0, 0 ), 0 );

		if ( maskActive ) renderer.context.disable( renderer.context.STENCIL_TEST );

		// 1. Extract Bright Areas
		this.highPassUniforms[ "tDiffuse" ].value = readBuffer.texture;
		this.highPassUniforms[ "luminosityThreshold" ].value = this.threshold;
		this.quad.material = this.materialHighPassFilter;
		renderer.render( this.scene, this.camera, this.renderTargetBright, true );

		// 2. Blur All the mips progressively
		var inputRenderTarget = this.renderTargetBright;

		for(var i=0; i<this.nMips; i++) {

			this.quad.material = this.separableBlurMaterials[i];

			this.separableBlurMaterials[i].uniforms[ "colorTexture" ].value = inputRenderTarget.texture;

			this.separableBlurMaterials[i].uniforms[ "direction" ].value = THREE.UnrealBloomPass.BlurDirectionX;

			renderer.render( this.scene, this.camera, this.renderTargetsHorizontal[i], true );

			this.separableBlurMaterials[i].uniforms[ "colorTexture" ].value = this.renderTargetsHorizontal[i].texture;

			this.separableBlurMaterials[i].uniforms[ "direction" ].value = THREE.UnrealBloomPass.BlurDirectionY;

			renderer.render( this.scene, this.camera, this.renderTargetsVertical[i], true );

			inputRenderTarget = this.renderTargetsVertical[i];
		}

		// Composite All the mips
		this.quad.material = this.compositeMaterial;
		this.compositeMaterial.uniforms["bloomStrength"].value = this.strength;
		this.compositeMaterial.uniforms["bloomRadius"].value = this.radius;
		this.compositeMaterial.uniforms["bloomTintColors"].value = this.bloomTintColors;
		renderer.render( this.scene, this.camera, this.renderTargetsHorizontal[0], true );

		// Blend it additively over the input texture
		this.quad.material = this.materialCopy;
		this.copyUniforms[ "tDiffuse" ].value = this.renderTargetsHorizontal[0].texture;

		if ( maskActive ) renderer.context.enable( renderer.context.STENCIL_TEST );

		renderer.render( this.scene, this.camera, readBuffer );

		renderer.setClearColor( this.oldClearColor, this.oldClearAlpha );
		renderer.autoClear = oldAutoClear;
	},

	getSeperableBlurMaterial: function(kernelRadius) {

		return new THREE.ShaderMaterial( {

			defines: {
				"KERNEL_RADIUS" : kernelRadius,
				"SIGMA" : kernelRadius
			},

			uniforms: {
				"colorTexture": { value: null },
				"texSize": 				{ value: new THREE.Vector2( 0.5, 0.5 ) },
				"direction": 				{ value: new THREE.Vector2( 0.5, 0.5 ) }
			},

			vertexShader:
				"varying vec2 vUv;\n\
				void main() {\n\
					vUv = uv;\n\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
				}",

			fragmentShader:
				"#include <common>\
				varying vec2 vUv;\n\
				uniform sampler2D colorTexture;\n\
				uniform vec2 texSize;\
				uniform vec2 direction;\
				\
				float gaussianPdf(in float x, in float sigma) {\
					return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;\
				}\
				void main() {\n\
					vec2 invSize = 1.0 / texSize;\
					float fSigma = float(SIGMA);\
					float weightSum = gaussianPdf(0.0, fSigma);\
					vec4 diffuseSum = texture2D( colorTexture, vUv) * weightSum;\
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {\
						float x = float(i);\
						float w = gaussianPdf(x, fSigma);\
						vec2 uvOffset = direction * invSize * x;\
						vec4 sample1 = texture2D( colorTexture, vUv + uvOffset);\
						vec4 sample2 = texture2D( colorTexture, vUv - uvOffset);\
						diffuseSum += (sample1 + sample2) * w;\
						weightSum += 2.0 * w;\
					}\
					gl_FragColor = diffuseSum/weightSum;\n\
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
				"dirtTexture": { value: null },
				"bloomStrength" : { value: 1.0 },
				"bloomFactors" : { value: null },
				"bloomTintColors" : { value: null },
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
				uniform sampler2D dirtTexture;\
				uniform float bloomStrength;\
				uniform float bloomRadius;\
				uniform float bloomFactors[NUM_MIPS];\
				uniform vec3 bloomTintColors[NUM_MIPS];\
				\
				float lerpBloomFactor(const in float factor) { \
					float mirrorFactor = 1.2 - factor;\
					return mix(factor, mirrorFactor, bloomRadius);\
				}\
				\
				void main() {\
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) + \
					 							 lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) + \
												 lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) + \
												 lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) + \
												 lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );\
				}"
		} );
	}

} );

THREE.UnrealBloomPass.BlurDirectionX = new THREE.Vector2( 1.0, 0.0 );
THREE.UnrealBloomPass.BlurDirectionY = new THREE.Vector2( 0.0, 1.0 );

// File:examples/js/GlossyMirror.js

/**
 * @author spidersharma03
 * @author bhouston / Ben Houston / ben@clara.io
 */

THREE.MirrorHelper = function(mirror) {
  this.scene = new THREE.Scene();
  this.cameraOrtho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
  this.scene.add(this.quad);
  this.mirror = mirror;
  this.numMipMaps = 4;


  this.mirrorTextureMipMaps = [];
  this.tempRenderTargets = [];
  var parameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: false };
  var mirrorTexture = mirror.mirrorRenderTarget;

  var width = mirrorTexture.width/2, height = mirrorTexture.height/2;
  for( var i=0; i<this.numMipMaps; i++) {

    var mirrorRenderTarget = new THREE.WebGLRenderTarget( width, height, parameters );
    mirrorRenderTarget.texture.generateMipmaps = false;
    this.mirrorTextureMipMaps.push(mirrorRenderTarget);

    var tempRenderTarget = new THREE.WebGLRenderTarget( width, height, parameters );
    tempRenderTarget.texture.generateMipmaps = false;
    this.tempRenderTargets.push(tempRenderTarget);

    width /= 2; height /= 2;
  }

  this.vBlurMaterial = new THREE.ShaderMaterial( THREE.BlurShader );
  this.vBlurMaterial.side = THREE.DoubleSide;
  this.vBlurMaterial.uniforms[ 'size' ].value.set( mirrorTexture.width/2, mirrorTexture.height/2 );
  this.vBlurMaterial.blending = THREE.NoBlending;
  THREE.BlurShaderUtils.configure( this.vBlurMaterial, 5, 3.0, new THREE.Vector2( 0, 1 ) );

  this.hBlurMaterial = this.vBlurMaterial.clone();
  this.hBlurMaterial.side = THREE.DoubleSide;
  this.hBlurMaterial.uniforms[ 'size' ].value.set( mirrorTexture.width/2, mirrorTexture.height/2 );
  this.hBlurMaterial.blending = THREE.NoBlending;
  THREE.BlurShaderUtils.configure( this.hBlurMaterial, 5, 3.0, new THREE.Vector2( 1, 0 ) );
}


THREE.MirrorHelper.prototype = {

  constructor: THREE.MirrorHelper,


  setSize: function( width, height ) {
	  for( var i=0; i<this.numMipMaps; i++) {
	    width /= 2; height /= 2;
	    this.mirrorTextureMipMaps[i].setSize( width, height );
	    this.tempRenderTargets[i].setSize( width, height );
	  }
  },

  update: function(renderer) {

    var textureIn = this.mirror.mirrorRenderTarget;
    for( var i=0; i<this.numMipMaps; i++) {
      var renderTarget = this.mirrorTextureMipMaps[i];
   	  var tempRenderTarget = this.tempRenderTargets[i];
   
      this.hBlurMaterial.uniforms[ 'size' ].value.set( textureIn.width, textureIn.height );
      this.hBlurMaterial.uniforms[ "tDiffuse" ].value = textureIn.texture;
      this.quad.material = this.hBlurMaterial;
      renderer.render(this.scene, this.cameraOrtho, tempRenderTarget, true);

      this.vBlurMaterial.uniforms[ 'size' ].value.set( tempRenderTarget.width, tempRenderTarget.height );
      this.vBlurMaterial.uniforms[ "tDiffuse" ].value = tempRenderTarget.texture;
      this.quad.material = this.vBlurMaterial;
      renderer.render(this.scene, this.cameraOrtho, renderTarget, true);

      textureIn = renderTarget;
    }
  }
}



THREE.GlossyMirror = function ( options ) {

	THREE.Object3D.call( this );

	this.name = 'mirror_' + this.id;

	options = options || {};

	this.matrixNeedsUpdate = true;

	var width = options.textureWidth !== undefined ? options.textureWidth : 512;
	var height = options.textureHeight !== undefined ? options.textureHeight : 512;

	this.size = new THREE.Vector3( width, height );

	this.localMirrorNormal = options.localMirrorNormal !== undefined ? options.localMirrorNormal : new THREE.Vector3( 0, 0, 1 );

	this.distanceFade = 0.1;
	this.metalness = 0.0;
	this.specularColor = new THREE.Color( 0xffffff );
	this.roughness = 0.0;
	this.fresnelStrength = 1.0;

	this.mirrorPlane = new THREE.Plane();
	this.mirrorWorldPosition = new THREE.Vector3();
	this.cameraWorldPosition = new THREE.Vector3();
	this.rotationMatrix = new THREE.Matrix4();
	this.lookAtPosition = new THREE.Vector3( 0, 0, - 1 );
	this.matrixNeedsUpdate = true;

	// For debug only, show the normal and plane of the mirror
	var debugMode = options.debugMode !== undefined ? options.debugMode : false;

	if ( debugMode ) {

		var arrow = new THREE.ArrowHelper( new THREE.Vector3( 0, 0, 1 ), new THREE.Vector3( 0, 0, 0 ), 10, 0xffff80 );
		var planeGeometry = new THREE.Geometry();
		planeGeometry.vertices.push( new THREE.Vector3( - 10, - 10, 0 ) );
		planeGeometry.vertices.push( new THREE.Vector3( 10, - 10, 0 ) );
		planeGeometry.vertices.push( new THREE.Vector3( 10, 10, 0 ) );
		planeGeometry.vertices.push( new THREE.Vector3( - 10, 10, 0 ) );
		planeGeometry.vertices.push( planeGeometry.vertices[ 0 ] );
		var plane = new THREE.Line( planeGeometry, new THREE.LineBasicMaterial( { color: 0xffff80 } ) );

		this.add( arrow );
		this.add( plane );

	}

	this.reflectionTextureMatrix = new THREE.Matrix4();

	this.mirrorNormal = new THREE.Vector3();
	var parameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: false };

	this.mirrorRenderTarget = new THREE.WebGLRenderTarget( width, height, parameters );
	this.mirrorRenderTarget.texture.name = "GlossyMirror.mirror";
	
	this.material = new THREE.ShaderMaterial( THREE.GlossyMirrorShader );
	this.material.defines = Object.assign( {}, this.material.defines );
	this.material.uniforms = THREE.UniformsUtils.clone( this.material.uniforms );
	this.material.uniforms.tReflection.value = this.mirrorRenderTarget.texture;
	this.material.uniforms.reflectionTextureMatrix.value = this.reflectionTextureMatrix;

	this.mirrorRenderTarget.texture.generateMipmaps = false;

	this.clipPlane = new THREE.Plane( this.localMirrorNormal, 0 );
	this.originalClipPlane = this.clipPlane.clone();
	this.falseClipPlane = this.clipPlane.clone();
	this.falseClipPlane.constant = 10000;

	this.depthMaterial = new THREE.MeshDepthMaterial();
 	this.depthMaterial.depthPacking = THREE.RGBADepthPacking;
 	this.depthMaterial.blending = THREE.NoBlending;
	this.depthMaterial.side = THREE.FrontSide;

	this.depthRenderTarget = new THREE.WebGLRenderTarget( width, height,
 					{ minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat } );
	this.depthRenderTarget.texture.generateMipmaps = false;
	this.depthRenderTarget.texture.name = "GlossyMirror.depth";

	this.material.uniforms.tReflectionDepth.value = this.depthRenderTarget.texture;


  	this.material.uniforms[ 'screenSize' ].value = new THREE.Vector2(width, height);

	this.mirrorHelper = new THREE.MirrorHelper(this);

	this.material.uniforms.tReflection.value = this.mirrorRenderTarget.texture;
	this.material.uniforms.tReflection1.value = this.mirrorHelper.mirrorTextureMipMaps[0].texture;
	this.material.uniforms.tReflection2.value = this.mirrorHelper.mirrorTextureMipMaps[1].texture;
	this.material.uniforms.tReflection3.value = this.mirrorHelper.mirrorTextureMipMaps[2].texture;
	this.material.uniforms.tReflection4.value = this.mirrorHelper.mirrorTextureMipMaps[3].texture;

	this.setSize( width, height );

};

THREE.GlossyMirror.prototype = Object.assign( Object.create( THREE.Object3D.prototype ), {

	constructor: THREE.GlossyMirror,

	setSize: function( width, height ) {

		if( this.size.x !== width || this.size.y !== height ) {

			this.mirrorRenderTarget.setSize( width, height );
			this.depthRenderTarget.setSize( width, height );
			this.mirrorHelper.setSize( width, height );
		 	this.material.uniforms[ 'screenSize' ].value = new THREE.Vector2(width, height);

		 	this.size.set( width, height );
		 	this.matrixNeedsUpdate = true;
		 }

	 	this.matrixNeedsUpdate = true;

	},

	updateReflectionTextureMatrix: function ( camera ) {

		this.updateMatrixWorld();
		camera.updateMatrixWorld();

		this.mirrorWorldPosition.setFromMatrixPosition( this.matrixWorld );
		this.cameraWorldPosition.setFromMatrixPosition( camera.matrixWorld );

		this.rotationMatrix.extractRotation( this.matrixWorld );

		this.mirrorNormal.copy( this.localMirrorNormal );
		this.mirrorNormal.applyMatrix4( this.rotationMatrix );

		var view = this.mirrorWorldPosition.clone().sub( this.cameraWorldPosition );
		view.reflect( this.mirrorNormal ).negate();
		view.add( this.mirrorWorldPosition );

		this.rotationMatrix.extractRotation( camera.matrixWorld );

		this.lookAtPosition.set( 0, 0, - 1 );
		this.lookAtPosition.applyMatrix4( this.rotationMatrix );
		this.lookAtPosition.add( this.cameraWorldPosition );

		var target = this.mirrorWorldPosition.clone().sub( this.lookAtPosition );
		target.reflect( this.mirrorNormal ).negate();
		target.add( this.mirrorWorldPosition );

		this.up.set( 0, - 1, 0 );
		this.up.applyMatrix4( this.rotationMatrix );
		this.up.reflect( this.mirrorNormal ).negate();

		this.mirrorCamera.position.copy( view );
		this.mirrorCamera.up = this.up;
		this.mirrorCamera.lookAt( target );
		this.mirrorCamera.fov = camera.fov;
		this.mirrorCamera.near = camera.near;
		this.mirrorCamera.far = camera.far;
		this.mirrorCamera.aspect = camera.aspect;

		this.mirrorCamera.updateProjectionMatrix();
		this.mirrorCamera.updateMatrixWorld();
		this.mirrorCamera.matrixWorldInverse.getInverse( this.mirrorCamera.matrixWorld );

		// Update the texture matrix
		this.reflectionTextureMatrix.set( 0.5, 0.0, 0.0, 0.5,
								0.0, 0.5, 0.0, 0.5,
								0.0, 0.0, 0.5, 0.5,
								0.0, 0.0, 0.0, 1.0 );
		this.reflectionTextureMatrix.multiply( this.mirrorCamera.projectionMatrix );
		this.reflectionTextureMatrix.multiply( this.mirrorCamera.matrixWorldInverse );

		this.mirrorPlane.setFromNormalAndCoplanarPoint( this.mirrorNormal, this.mirrorWorldPosition );
		this.mirrorPlane.applyMatrix4( this.mirrorCamera.matrixWorldInverse );


		this.material.uniforms[ 'mirrorCameraProjectionMatrix' ].value.copy( this.mirrorCamera.projectionMatrix );
		this.material.uniforms[ 'mirrorCameraInverseProjectionMatrix' ].value.getInverse( this.mirrorCamera.projectionMatrix );

		this.material.uniforms[ 'mirrorCameraWorldMatrix' ].value.copy( camera.matrixWorld );
		this.material.uniforms[ 'mirrorCameraNear' ].value = this.mirrorCamera.near;
		this.material.uniforms[ 'mirrorCameraFar' ].value = this.mirrorCamera.far;

		this.material.uniforms[ 'mirrorNormal' ].value = this.mirrorNormal;
		this.material.uniforms[ 'mirrorWorldPosition' ].value = this.mirrorWorldPosition;
		this.material.transparent = true;
	},

	render: function ( renderer, scene, camera, width, height ) {

		if ( ! camera instanceof THREE.PerspectiveCamera ) console.error( "THREE.GlossyMirror: camera is not a Perspective Camera!" );

		this.setSize( width, height );

		if( ! this.mirrorCamera ) {
			this.mirrorCamera = camera.clone();
			this.mirrorCamera.matrixAutoUpdate = true;

		}


		if ( this.matrixNeedsUpdate ) this.updateReflectionTextureMatrix( camera );

		this.matrixNeedsUpdate = true;

		// Render the mirrored view of the current scene into the target texture


		if(this.clipPlane !== undefined) {

			this.clipPlane.copy(this.originalClipPlane);

			this.clipPlane.applyMatrix4(this.matrixWorld);
			this.clippingPlanes = [this.clipPlane];
		}

		renderer.clippingPlanes = this.clippingPlanes;

		if ( scene !== undefined && scene instanceof THREE.Scene ) {

			// We can't render ourself to ourself
			var visible = this.material.visible;
			this.material.visible = false;

			renderer.render( scene, this.mirrorCamera, this.mirrorRenderTarget, true );

			this.material.visible = visible;

		}
		scene.overrideMaterial = this.depthMaterial;

		var visible = this.material.visible;

		var oldClearColor = renderer.getClearColor(), oldClearAlpha = renderer.getClearAlpha();

		renderer.setClearColor(0xffffff, 1);
		this.material.visible = false;

		renderer.render( scene, this.mirrorCamera, this.depthRenderTarget, true );

		scene.overrideMaterial = null;
		renderer.setClearColor( oldClearColor, oldClearAlpha );


		this.material.visible = visible;
		this.material.uniforms.distanceFade.value = this.distanceFade;
		this.material.uniforms.metalness.value = this.metalness;
		this.material.uniforms.fresnelStrength.value = this.fresnelStrength;
		this.material.uniforms.specularColor.value.copy( this.specularColor );
		this.material.uniforms.roughness.value = this.roughness;

		if(this.clipPlane !== undefined) {

			this.clipPlane.copy(this.falseClipPlane);

		}
		if(this.mirrorHelper !== undefined) {

			this.mirrorHelper.update(renderer);

		}
	}

} );

// File:examples/js/controls/OrbitControls.js

/**
 * @author qiao / https://github.com/qiao
 * @author mrdoob / http://mrdoob.com
 * @author alteredq / http://alteredqualia.com/
 * @author WestLangley / http://github.com/WestLangley
 * @author erich666 / http://erichaines.com
 */

// This set of controls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
//
//    Orbit - left mouse / touch: one finger move
//    Zoom - middle mouse, or mousewheel / touch: two finger spread or squish
//    Pan - right mouse, or arrow keys / touch: three finger swipe

THREE.OrbitControls = function ( object, domElement ) {

	this.object = object;

	this.domElement = ( domElement !== undefined ) ? domElement : document;

	// Set to false to disable this control
	this.enabled = true;

	// "target" sets the location of focus, where the object orbits around
	this.target = new THREE.Vector3();

	// How far you can dolly in and out ( PerspectiveCamera only )
	this.minDistance = 0;
	this.maxDistance = Infinity;

	// How far you can zoom in and out ( OrthographicCamera only )
	this.minZoom = 0;
	this.maxZoom = Infinity;

	// How far you can orbit vertically, upper and lower limits.
	// Range is 0 to Math.PI radians.
	this.minPolarAngle = 0; // radians
	this.maxPolarAngle = Math.PI; // radians

	// How far you can orbit horizontally, upper and lower limits.
	// If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
	this.minAzimuthAngle = - Infinity; // radians
	this.maxAzimuthAngle = Infinity; // radians

	// Set to true to enable damping (inertia)
	// If damping is enabled, you must call controls.update() in your animation loop
	this.enableDamping = false;
	this.dampingFactor = 0.25;

	// This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
	// Set to false to disable zooming
	this.enableZoom = true;
	this.zoomSpeed = 1.0;

	// Set to false to disable rotating
	this.enableRotate = true;
	this.rotateSpeed = 1.0;

	// Set to false to disable panning
	this.enablePan = true;
	this.keyPanSpeed = 7.0;	// pixels moved per arrow key push

	// Set to true to automatically rotate around the target
	// If auto-rotate is enabled, you must call controls.update() in your animation loop
	this.autoRotate = false;
	this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

	// Set to false to disable use of the keys
	this.enableKeys = true;

	// The four arrow keys
	this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };

	// Mouse buttons
	this.mouseButtons = { ORBIT: THREE.MOUSE.LEFT, ZOOM: THREE.MOUSE.MIDDLE, PAN: THREE.MOUSE.RIGHT };

	// for reset
	this.target0 = this.target.clone();
	this.position0 = this.object.position.clone();
	this.zoom0 = this.object.zoom;

	//
	// public methods
	//

	this.getPolarAngle = function () {

		return spherical.phi;

	};

	this.getAzimuthalAngle = function () {

		return spherical.theta;

	};

	this.reset = function () {

		scope.target.copy( scope.target0 );
		scope.object.position.copy( scope.position0 );
		scope.object.zoom = scope.zoom0;

		scope.object.updateProjectionMatrix();
		scope.dispatchEvent( changeEvent );

		scope.update();

		state = STATE.NONE;

	};

	// this method is exposed, but perhaps it would be better if we can make it private...
	this.update = function () {

		var offset = new THREE.Vector3();

		// so camera.up is the orbit axis
		var quat = new THREE.Quaternion().setFromUnitVectors( object.up, new THREE.Vector3( 0, 1, 0 ) );
		var quatInverse = quat.clone().inverse();

		var lastPosition = new THREE.Vector3();
		var lastQuaternion = new THREE.Quaternion();

		return function update() {

			var position = scope.object.position;

			offset.copy( position ).sub( scope.target );

			// rotate offset to "y-axis-is-up" space
			offset.applyQuaternion( quat );

			// angle from z-axis around y-axis
			spherical.setFromVector3( offset );

			if ( scope.autoRotate && state === STATE.NONE ) {

				rotateLeft( getAutoRotationAngle() );

			}

			spherical.theta += sphericalDelta.theta;
			spherical.phi += sphericalDelta.phi;

			// restrict theta to be between desired limits
			spherical.theta = Math.max( scope.minAzimuthAngle, Math.min( scope.maxAzimuthAngle, spherical.theta ) );

			// restrict phi to be between desired limits
			spherical.phi = Math.max( scope.minPolarAngle, Math.min( scope.maxPolarAngle, spherical.phi ) );

			spherical.makeSafe();


			spherical.radius *= scale;

			// restrict radius to be between desired limits
			spherical.radius = Math.max( scope.minDistance, Math.min( scope.maxDistance, spherical.radius ) );

			// move target to panned location
			scope.target.add( panOffset );

			offset.setFromSpherical( spherical );

			// rotate offset back to "camera-up-vector-is-up" space
			offset.applyQuaternion( quatInverse );

			position.copy( scope.target ).add( offset );

			scope.object.lookAt( scope.target );

			if ( scope.enableDamping === true ) {

				sphericalDelta.theta *= ( 1 - scope.dampingFactor );
				sphericalDelta.phi *= ( 1 - scope.dampingFactor );

			} else {

				sphericalDelta.set( 0, 0, 0 );

			}

			scale = 1;
			panOffset.set( 0, 0, 0 );

			// update condition is:
			// min(camera displacement, camera rotation in radians)^2 > EPS
			// using small-angle approximation cos(x/2) = 1 - x^2 / 8

			if ( zoomChanged ||
				lastPosition.distanceToSquared( scope.object.position ) > EPS ||
				8 * ( 1 - lastQuaternion.dot( scope.object.quaternion ) ) > EPS ) {

				scope.dispatchEvent( changeEvent );

				lastPosition.copy( scope.object.position );
				lastQuaternion.copy( scope.object.quaternion );
				zoomChanged = false;

				return true;

			}

			return false;

		};

	}();

	this.dispose = function () {

		scope.domElement.removeEventListener( 'contextmenu', onContextMenu, false );
		scope.domElement.removeEventListener( 'mousedown', onMouseDown, false );
		scope.domElement.removeEventListener( 'wheel', onMouseWheel, false );

		scope.domElement.removeEventListener( 'touchstart', onTouchStart, false );
		scope.domElement.removeEventListener( 'touchend', onTouchEnd, false );
		scope.domElement.removeEventListener( 'touchmove', onTouchMove, false );

		document.removeEventListener( 'mousemove', onMouseMove, false );
		document.removeEventListener( 'mouseup', onMouseUp, false );

		window.removeEventListener( 'keydown', onKeyDown, false );

		//scope.dispatchEvent( { type: 'dispose' } ); // should this be added here?

	};

	//
	// internals
	//

	var scope = this;

	var changeEvent = { type: 'change' };
	var startEvent = { type: 'start' };
	var endEvent = { type: 'end' };

	var STATE = { NONE: - 1, ROTATE: 0, DOLLY: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_DOLLY: 4, TOUCH_PAN: 5 };

	var state = STATE.NONE;

	var EPS = 0.000001;

	// current position in spherical coordinates
	var spherical = new THREE.Spherical();
	var sphericalDelta = new THREE.Spherical();

	var scale = 1;
	var panOffset = new THREE.Vector3();
	var zoomChanged = false;

	var rotateStart = new THREE.Vector2();
	var rotateEnd = new THREE.Vector2();
	var rotateDelta = new THREE.Vector2();

	var panStart = new THREE.Vector2();
	var panEnd = new THREE.Vector2();
	var panDelta = new THREE.Vector2();

	var dollyStart = new THREE.Vector2();
	var dollyEnd = new THREE.Vector2();
	var dollyDelta = new THREE.Vector2();

	function getAutoRotationAngle() {

		return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;

	}

	function getZoomScale() {

		return Math.pow( 0.95, scope.zoomSpeed );

	}

	function rotateLeft( angle ) {

		sphericalDelta.theta -= angle;

	}

	function rotateUp( angle ) {

		sphericalDelta.phi -= angle;

	}

	var panLeft = function () {

		var v = new THREE.Vector3();

		return function panLeft( distance, objectMatrix ) {

			v.setFromMatrixColumn( objectMatrix, 0 ); // get X column of objectMatrix
			v.multiplyScalar( - distance );

			panOffset.add( v );

		};

	}();

	var panUp = function () {

		var v = new THREE.Vector3();

		return function panUp( distance, objectMatrix ) {

			v.setFromMatrixColumn( objectMatrix, 1 ); // get Y column of objectMatrix
			v.multiplyScalar( distance );

			panOffset.add( v );

		};

	}();

	// deltaX and deltaY are in pixels; right and down are positive
	var pan = function () {

		var offset = new THREE.Vector3();

		return function pan( deltaX, deltaY ) {

			var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

			if ( scope.object instanceof THREE.PerspectiveCamera ) {

				// perspective
				var position = scope.object.position;
				offset.copy( position ).sub( scope.target );
				var targetDistance = offset.length();

				// half of the fov is center to top of screen
				targetDistance *= Math.tan( ( scope.object.fov / 2 ) * Math.PI / 180.0 );

				// we actually don't use screenWidth, since perspective camera is fixed to screen height
				panLeft( 2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix );
				panUp( 2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix );

			} else if ( scope.object instanceof THREE.OrthographicCamera ) {

				// orthographic
				panLeft( deltaX * ( scope.object.right - scope.object.left ) / scope.object.zoom / element.clientWidth, scope.object.matrix );
				panUp( deltaY * ( scope.object.top - scope.object.bottom ) / scope.object.zoom / element.clientHeight, scope.object.matrix );

			} else {

				// camera neither orthographic nor perspective
				console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.' );
				scope.enablePan = false;

			}

		};

	}();

	function dollyIn( dollyScale ) {

		if ( scope.object instanceof THREE.PerspectiveCamera ) {

			scale /= dollyScale;

		} else if ( scope.object instanceof THREE.OrthographicCamera ) {

			scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom * dollyScale ) );
			scope.object.updateProjectionMatrix();
			zoomChanged = true;

		} else {

			console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
			scope.enableZoom = false;

		}

	}

	function dollyOut( dollyScale ) {

		if ( scope.object instanceof THREE.PerspectiveCamera ) {

			scale *= dollyScale;

		} else if ( scope.object instanceof THREE.OrthographicCamera ) {

			scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom / dollyScale ) );
			scope.object.updateProjectionMatrix();
			zoomChanged = true;

		} else {

			console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
			scope.enableZoom = false;

		}

	}

	//
	// event callbacks - update the object state
	//

	function handleMouseDownRotate( event ) {

		//console.log( 'handleMouseDownRotate' );

		rotateStart.set( event.clientX, event.clientY );

	}

	function handleMouseDownDolly( event ) {

		//console.log( 'handleMouseDownDolly' );

		dollyStart.set( event.clientX, event.clientY );

	}

	function handleMouseDownPan( event ) {

		//console.log( 'handleMouseDownPan' );

		panStart.set( event.clientX, event.clientY );

	}

	function handleMouseMoveRotate( event ) {

		//console.log( 'handleMouseMoveRotate' );

		rotateEnd.set( event.clientX, event.clientY );
		rotateDelta.subVectors( rotateEnd, rotateStart );

		var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

		// rotating across whole screen goes 360 degrees around
		rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientWidth * scope.rotateSpeed );

		// rotating up and down along whole screen attempts to go 360, but limited to 180
		rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight * scope.rotateSpeed );

		rotateStart.copy( rotateEnd );

		scope.update();

	}

	function handleMouseMoveDolly( event ) {

		//console.log( 'handleMouseMoveDolly' );

		dollyEnd.set( event.clientX, event.clientY );

		dollyDelta.subVectors( dollyEnd, dollyStart );

		if ( dollyDelta.y > 0 ) {

			dollyIn( getZoomScale() );

		} else if ( dollyDelta.y < 0 ) {

			dollyOut( getZoomScale() );

		}

		dollyStart.copy( dollyEnd );

		scope.update();

	}

	function handleMouseMovePan( event ) {

		//console.log( 'handleMouseMovePan' );

		panEnd.set( event.clientX, event.clientY );

		panDelta.subVectors( panEnd, panStart );

		pan( panDelta.x, panDelta.y );

		panStart.copy( panEnd );

		scope.update();

	}

	function handleMouseUp( event ) {

		// console.log( 'handleMouseUp' );

	}

	function handleMouseWheel( event ) {

		// console.log( 'handleMouseWheel' );

		if ( event.deltaY < 0 ) {

			dollyOut( getZoomScale() );

		} else if ( event.deltaY > 0 ) {

			dollyIn( getZoomScale() );

		}

		scope.update();

	}

	function handleKeyDown( event ) {

		//console.log( 'handleKeyDown' );

		switch ( event.keyCode ) {

			case scope.keys.UP:
				pan( 0, scope.keyPanSpeed );
				scope.update();
				break;

			case scope.keys.BOTTOM:
				pan( 0, - scope.keyPanSpeed );
				scope.update();
				break;

			case scope.keys.LEFT:
				pan( scope.keyPanSpeed, 0 );
				scope.update();
				break;

			case scope.keys.RIGHT:
				pan( - scope.keyPanSpeed, 0 );
				scope.update();
				break;

		}

	}

	function handleTouchStartRotate( event ) {

		//console.log( 'handleTouchStartRotate' );

		rotateStart.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );

	}

	function handleTouchStartDolly( event ) {

		//console.log( 'handleTouchStartDolly' );

		var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
		var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;

		var distance = Math.sqrt( dx * dx + dy * dy );

		dollyStart.set( 0, distance );

	}

	function handleTouchStartPan( event ) {

		//console.log( 'handleTouchStartPan' );

		panStart.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );

	}

	function handleTouchMoveRotate( event ) {

		//console.log( 'handleTouchMoveRotate' );

		rotateEnd.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
		rotateDelta.subVectors( rotateEnd, rotateStart );

		var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

		// rotating across whole screen goes 360 degrees around
		rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientWidth * scope.rotateSpeed );

		// rotating up and down along whole screen attempts to go 360, but limited to 180
		rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight * scope.rotateSpeed );

		rotateStart.copy( rotateEnd );

		scope.update();

	}

	function handleTouchMoveDolly( event ) {

		//console.log( 'handleTouchMoveDolly' );

		var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
		var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;

		var distance = Math.sqrt( dx * dx + dy * dy );

		dollyEnd.set( 0, distance );

		dollyDelta.subVectors( dollyEnd, dollyStart );

		if ( dollyDelta.y > 0 ) {

			dollyOut( getZoomScale() );

		} else if ( dollyDelta.y < 0 ) {

			dollyIn( getZoomScale() );

		}

		dollyStart.copy( dollyEnd );

		scope.update();

	}

	function handleTouchMovePan( event ) {

		//console.log( 'handleTouchMovePan' );

		panEnd.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );

		panDelta.subVectors( panEnd, panStart );

		pan( panDelta.x, panDelta.y );

		panStart.copy( panEnd );

		scope.update();

	}

	function handleTouchEnd( event ) {

		//console.log( 'handleTouchEnd' );

	}

	//
	// event handlers - FSM: listen for events and reset state
	//

	function onMouseDown( event ) {

		if ( scope.enabled === false ) return;

		event.preventDefault();

		if ( event.button === scope.mouseButtons.ORBIT ) {

			if ( scope.enableRotate === false ) return;

			handleMouseDownRotate( event );

			state = STATE.ROTATE;

		} else if ( event.button === scope.mouseButtons.ZOOM ) {

			if ( scope.enableZoom === false ) return;

			handleMouseDownDolly( event );

			state = STATE.DOLLY;

		} else if ( event.button === scope.mouseButtons.PAN ) {

			if ( scope.enablePan === false ) return;

			handleMouseDownPan( event );

			state = STATE.PAN;

		}

		if ( state !== STATE.NONE ) {

			document.addEventListener( 'mousemove', onMouseMove, false );
			document.addEventListener( 'mouseup', onMouseUp, false );

			scope.dispatchEvent( startEvent );

		}

	}

	function onMouseMove( event ) {

		if ( scope.enabled === false ) return;

		event.preventDefault();

		if ( state === STATE.ROTATE ) {

			if ( scope.enableRotate === false ) return;

			handleMouseMoveRotate( event );

		} else if ( state === STATE.DOLLY ) {

			if ( scope.enableZoom === false ) return;

			handleMouseMoveDolly( event );

		} else if ( state === STATE.PAN ) {

			if ( scope.enablePan === false ) return;

			handleMouseMovePan( event );

		}

	}

	function onMouseUp( event ) {

		if ( scope.enabled === false ) return;

		handleMouseUp( event );

		document.removeEventListener( 'mousemove', onMouseMove, false );
		document.removeEventListener( 'mouseup', onMouseUp, false );

		scope.dispatchEvent( endEvent );

		state = STATE.NONE;

	}

	function onMouseWheel( event ) {

		if ( scope.enabled === false || scope.enableZoom === false || ( state !== STATE.NONE && state !== STATE.ROTATE ) ) return;

		event.preventDefault();
		event.stopPropagation();

		handleMouseWheel( event );

		scope.dispatchEvent( startEvent ); // not sure why these are here...
		scope.dispatchEvent( endEvent );

	}

	function onKeyDown( event ) {

		if ( scope.enabled === false || scope.enableKeys === false || scope.enablePan === false ) return;

		handleKeyDown( event );

	}

	function onTouchStart( event ) {

		if ( scope.enabled === false ) return;

		switch ( event.touches.length ) {

			case 1:	// one-fingered touch: rotate

				if ( scope.enableRotate === false ) return;

				handleTouchStartRotate( event );

				state = STATE.TOUCH_ROTATE;

				break;

			case 2:	// two-fingered touch: dolly

				if ( scope.enableZoom === false ) return;

				handleTouchStartDolly( event );

				state = STATE.TOUCH_DOLLY;

				break;

			case 3: // three-fingered touch: pan

				if ( scope.enablePan === false ) return;

				handleTouchStartPan( event );

				state = STATE.TOUCH_PAN;

				break;

			default:

				state = STATE.NONE;

		}

		if ( state !== STATE.NONE ) {

			scope.dispatchEvent( startEvent );

		}

	}

	function onTouchMove( event ) {

		if ( scope.enabled === false ) return;

		event.preventDefault();
		event.stopPropagation();

		switch ( event.touches.length ) {

			case 1: // one-fingered touch: rotate

				if ( scope.enableRotate === false ) return;
				if ( state !== STATE.TOUCH_ROTATE ) return; // is this needed?...

				handleTouchMoveRotate( event );

				break;

			case 2: // two-fingered touch: dolly

				if ( scope.enableZoom === false ) return;
				if ( state !== STATE.TOUCH_DOLLY ) return; // is this needed?...

				handleTouchMoveDolly( event );

				break;

			case 3: // three-fingered touch: pan

				if ( scope.enablePan === false ) return;
				if ( state !== STATE.TOUCH_PAN ) return; // is this needed?...

				handleTouchMovePan( event );

				break;

			default:

				state = STATE.NONE;

		}

	}

	function onTouchEnd( event ) {

		if ( scope.enabled === false ) return;

		handleTouchEnd( event );

		scope.dispatchEvent( endEvent );

		state = STATE.NONE;

	}

	function onContextMenu( event ) {

		event.preventDefault();

	}

	//

	scope.domElement.addEventListener( 'contextmenu', onContextMenu, false );

	scope.domElement.addEventListener( 'mousedown', onMouseDown, false );
	scope.domElement.addEventListener( 'wheel', onMouseWheel, false );

	scope.domElement.addEventListener( 'touchstart', onTouchStart, false );
	scope.domElement.addEventListener( 'touchend', onTouchEnd, false );
	scope.domElement.addEventListener( 'touchmove', onTouchMove, false );

	window.addEventListener( 'keydown', onKeyDown, false );

	// force an update at start

	this.update();

};

THREE.OrbitControls.prototype = Object.create( THREE.EventDispatcher.prototype );
THREE.OrbitControls.prototype.constructor = THREE.OrbitControls;

Object.defineProperties( THREE.OrbitControls.prototype, {

	center: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .center has been renamed to .target' );
			return this.target;

		}

	},

	// backward compatibility

	noZoom: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.' );
			return ! this.enableZoom;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.' );
			this.enableZoom = ! value;

		}

	},

	noRotate: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.' );
			return ! this.enableRotate;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.' );
			this.enableRotate = ! value;

		}

	},

	noPan: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.' );
			return ! this.enablePan;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.' );
			this.enablePan = ! value;

		}

	},

	noKeys: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.' );
			return ! this.enableKeys;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.' );
			this.enableKeys = ! value;

		}

	},

	staticMoving: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.' );
			return ! this.enableDamping;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.' );
			this.enableDamping = ! value;

		}

	},

	dynamicDampingFactor: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.' );
			return this.dampingFactor;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.' );
			this.dampingFactor = value;

		}

	}

} );

// File:examples/js/ColorToJsonOverride.js

//override the toJSON function to return serialization to its previous state
THREE.Color.prototype.toJSON = function() {
  return { r: this.r, g: this.g, b: this.b };
}

// File:examples/js/cameras/CombinedCamera.js

/**
 *	@author zz85 / http://twitter.com/blurspline / http://www.lab4games.net/zz85/blog
 *
 *		A general perpose camera, for setting FOV, Lens Focal Length,
 *		and switching between perspective and orthographic views easily.
 *		Use this only if you do not wish to manage
 *		both a Orthographic and Perspective Camera
 *
 */


THREE.CombinedCamera = function ( width, height, fov, near, far) {

	THREE.Camera.call( this );
	// perspective
	this.fov = fov;
	this.far = far;
	this.near = near;
	//orthographic
	this.left = - width / 2;
	this.right = width / 2;
	this.top = height / 2;
	this.bottom = - height / 2;

	this.aspect =  width / height;
	this.zoom = 1;
	this.view = null;
	this.hyperfocusOffset = 0;
	this.hyperfocusScale = 0.5;
	// We could also handle the projectionMatrix internally, but just wanted to test nested camera objects

	this.cameraO = new THREE.OrthographicCamera( this.left, this.right, this.top, this.bottom, this.near, this.far );
	this.cameraP = new THREE.PerspectiveCamera( this.fov, this.aspect, this.near, this.far );

	this.toPerspective();

};

THREE.CombinedCamera.prototype = Object.create( THREE.Camera.prototype );
THREE.CombinedCamera.prototype.constructor = THREE.CombinedCamera;

THREE.CombinedCamera.prototype.toPerspective = function () {

	// Switches to the Perspective Camera

	this.cameraP.near = this.near;
	this.cameraP.far = this.far;
	this.cameraP.aspect = this.aspect;
	this.cameraP.fov =  this.fov;
	this.cameraP.zoom = this.zoom;
	this.cameraP.view = this.view;

	this.cameraP.updateProjectionMatrix();

	this.projectionMatrix = this.cameraP.projectionMatrix;

	this.inPerspectiveMode = true;
	this.inOrthographicMode = false;

};

THREE.CombinedCamera.prototype.toOrthographic = function () {

	// Switches to the Orthographic camera estimating viewport from Perspective

	var fov = this.fov;
	var aspect = this.aspect;

	var halfHeight = Math.tan( fov * Math.PI / 180 / 2 ) * (this.hyperfocusOffset + this.hyperfocusScale * ( this.near + this.far ));
	var halfWidth = halfHeight * aspect;

	this.cameraO.near = this.near;
	this.cameraO.far = this.far;
	this.cameraO.left = - halfWidth;
	this.cameraO.right = halfWidth;
	this.cameraO.top = halfHeight;
	this.cameraO.bottom = - halfHeight;

	this.cameraO.zoom = this.zoom;
	this.cameraO.view = this.view;

	this.cameraO.updateProjectionMatrix();

	this.projectionMatrix = this.cameraO.projectionMatrix;

	this.inPerspectiveMode = false;
	this.inOrthographicMode = true;

};


THREE.CombinedCamera.prototype.setSize = function( width, height ) {

	this.aspect = width / height;
	this.left = - width / 2;
	this.right = width / 2;
	this.top = height / 2;
	this.bottom = - height / 2;

};


THREE.CombinedCamera.prototype.setFov = function( fov ) {

	this.fov = fov;

	if ( this.inPerspectiveMode ) {

		this.toPerspective();

	} else {

		this.toOrthographic();

	}

};

THREE.CombinedCamera.prototype.copy = function ( source ) {

	THREE.Camera.prototype.copy.call( this, source );

	this.fov = source.fov;
	this.far = source.far;
	this.near = source.near;

	this.left = source.left;
	this.right = source.right;
	this.top = source.top;
	this.bottom = source.bottom;

	this.zoom = source.zoom;
	this.view = source.view === null ? null : Object.assign( {}, source.view );
	this.aspect = source.aspect;
	this.hyperfocusOffset = source.hyperfocusOffset;
	this.hyperfocusScale = source.hyperfocusScale;

	this.cameraO = source.cameraO.copy();
	this.cameraP = source.cameraP.copy();

	this.inOrthographicMode = source.inOrthographicMode;
	this.inPerspectiveMode = source.inPerspectiveMode;

	return this;

};

THREE.CombinedCamera.prototype.setViewOffset = function( fullWidth, fullHeight, x, y, width, height ) {

	this.view = {
		fullWidth: fullWidth,
		fullHeight: fullHeight,
		offsetX: x,
		offsetY: y,
		width: width,
		height: height
	};

	if ( this.inPerspectiveMode ) {

		this.aspect = fullWidth / fullHeight;

		this.toPerspective();

	} else {

		this.toOrthographic();

	}

};

THREE.CombinedCamera.prototype.clearViewOffset = function() {

	this.view = null;
	this.updateProjectionMatrix();

};
// For maintaining similar API with PerspectiveCamera

THREE.CombinedCamera.prototype.updateProjectionMatrix = function() {

	if ( this.inPerspectiveMode ) {

		this.toPerspective();

	} else {

		this.toPerspective();
		this.toOrthographic();

	}

};

/*
* Uses Focal Length (in mm) to estimate and set FOV
* 35mm (full frame) camera is used if frame size is not specified;
* Formula based on http://www.bobatkins.com/photography/technical/field_of_view.html
*/
THREE.CombinedCamera.prototype.setLens = function ( focalLength, filmGauge ) {

	if ( filmGauge === undefined ) filmGauge = 35;

	var vExtentSlope = 0.5 * filmGauge /
			( focalLength * Math.max( this.cameraP.aspect, 1 ) );

	var fov = THREE.Math.RAD2DEG * 2 * Math.atan( vExtentSlope );

	this.setFov( fov );

	return fov;

};


THREE.CombinedCamera.prototype.setZoom = function( zoom ) {

	this.zoom = zoom;

	if ( this.inPerspectiveMode ) {

		this.toPerspective();

	} else {

		this.toOrthographic();

	}

};

THREE.CombinedCamera.prototype.toFrontView = function() {

	this.rotation.x = 0;
	this.rotation.y = 0;
	this.rotation.z = 0;

	this.position.x = 0;
	this.position.y = 0;
	this.position.z = -15;
	// should we be modifing the matrix instead?

};

THREE.CombinedCamera.prototype.toBackView = function() {

	this.rotation.x = 0;
	this.rotation.y = Math.PI;
	this.rotation.z = 0;

	this.position.x = 0;
	this.position.y = 0;
	this.position.z = 15;

};

THREE.CombinedCamera.prototype.toLeftView = function() {

	this.rotation.x = 0;
	this.rotation.y = - Math.PI / 2;
	this.rotation.z = 0;

	this.position.x = -15;
	this.position.y = 0;
	this.position.z = 0;

};

THREE.CombinedCamera.prototype.toRightView = function() {

	this.rotation.x = 0;
	this.rotation.y = Math.PI / 2;
	this.rotation.z = 0;

	this.position.x = 15;
	this.position.y = 0;
	this.position.z = 0;

};

THREE.CombinedCamera.prototype.toTopView = function() {

	this.rotation.x = - Math.PI / 2;
	this.rotation.y = 0;
	this.rotation.z = 0;

	this.position.x = 0;
	this.position.y = 15;
	this.position.z = 0;

};

THREE.CombinedCamera.prototype.toBottomView = function() {

	this.rotation.x = Math.PI / 2;
	this.rotation.y = 0;
	this.rotation.z = 0;

	this.position.x = 0;
	this.position.y = -15;
	this.position.z = 0;

};

THREE.CombinedCamera.prototype.toPerspectiveView = function() {

	this.rotation.x = - Math.PI / 4;
	this.rotation.y = - Math.PI / 4;
	this.rotation.z = 0;

	this.position.x = 4;
	this.position.y = 4;
	this.position.z = 4;

};


module.exports = THREE;
