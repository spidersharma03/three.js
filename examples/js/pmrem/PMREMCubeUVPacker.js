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
	var width = cubeTextureLods[ 0 ].width * 4;
	var height = cubeTextureLods[ 0 ].width * 2;

	var sourceTexture = cubeTextureLods[ 0 ].texture;
	var params = {
		format: sourceTexture.format,
		magFilter: sourceTexture.magFilter,
		minFilter: sourceTexture.minFilter,
		type: sourceTexture.type,
		generateMipmaps: false,//sourceTexture.generateMipmaps,
		anisotropy: 0,//sourceTexture.anisotropy,
		encoding: sourceTexture.encoding
	};

	if( sourceTexture.encoding === THREE.RGBM16Encoding ) {
		params.magFilter = THREE.LinearFilter;
		params.minFilter = THREE.LinearFilter;
	}

	this.CubeUVRenderTarget = new THREE.WebGLRenderTarget( width, width, params );
	this.CubeUVRenderTarget.texture.mapping = THREE.CubeUVReflectionMapping;
	this.camera = new THREE.OrthographicCamera( 0, 1024, 0, 1024, 0.0, 1000 );

	this.scene = new THREE.Scene();
	this.scene.add( this.camera );

	this.objects = [];
	var textureResolution = new THREE.Vector2( width, height );
	size = cubeTextureLods[ 0 ].width;

	var offset2 = 0;
	var c = 4.0;
	this.numLods = Math.log( cubeTextureLods[ 0 ].width ) / Math.log( 2 ) - 2; // IE11 doesn't support Math.log2
	for ( var cubeIndex = 0; cubeIndex < this.numLods; cubeIndex ++ ) {

		// origin of the cube
		var cubeOffset = new THREE.Vector2( 0.0, 0.0 );

		// which set of maps to use.
		var cubeScale = Math.pow( 0.5, cubeIndex );
		cubeOffset.y = 1024 - 1024 * cubeScale;

		for ( var faceIndex = 0; faceIndex < 6; faceIndex ++ ) {
		
			// resolve faceIndex to a particular map
			var faceOffset = new THREE.Vector2( 256 * faceIndex, 0.0 );	
			if( faceIndex >= 3 ) { // adjust to second row
				faceOffset.add( new THREE.Vector2( -256 * 3, 256 ) );
			}

			// 6 Cube Faces
			var material = this.getShader();
			material.uniforms[ 'envMap' ].value = this.cubeLods[ cubeIndex ].texture;
			material.envMap = this.cubeLods[ cubeIndex ].texture;
			material.uniforms[ 'faceIndex' ].value = faceIndex;
			material.uniforms[ 'mapSize' ].value = size;
			var color = material.uniforms[ 'testColor' ].value;
			var planeMesh = new THREE.Mesh( new THREE.PlaneGeometry( cubeScale * 256, cubeScale * 256, 0 ), material );
			planeMesh.position.x = cubeOffset.x + ( faceOffset.x + 128 ) * cubeScale;
			planeMesh.position.y = cubeOffset.y + ( faceOffset.y + 128 ) * cubeScale;
			//console.log( 'planeMesh.position', planeMesh.position );
			planeMesh.material.side = THREE.DoubleSide;
			this.scene.add( planeMesh );
			this.objects.push( planeMesh );

		}

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
