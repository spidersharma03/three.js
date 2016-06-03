/**
 *
 * Converts a lat lon map to a cube map
 *
 * @author Prashant Sharm spidersharma03
 */

THREE.LatLonToCubeMapConverter = function(latlonMap) {
	this.latlonMap = latlonMap;
	this.scene = new THREE.Scene();
	this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

	var size = THREE.Math.nearestPowerOfTwo(this.latlonMap.image.width/4);//this.latlonMap.image.width/4;
	var params = {
		format: this.latlonMap.format,
		magFilter: this.latlonMap.magFilter,
		minFilter: this.latlonMap.minFilter,
		type: this.latlonMap.type,
		generateMipmaps: this.latlonMap.generateMipmaps,
		anisotropy: this.latlonMap.anisotropy,
		encoding: this.latlonMap.encoding
	 };
	this.renderTarget = new THREE.WebGLRenderTargetCube( size, size, params );
	this.shader = this.getShader();
	this.shader.uniforms[ 'tLatLonMap' ].value = this.latlonMap;
	this.shader.uniforms[ 'mapSize' ].value = size;
	this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.shader);
  this.scene.add(this.quad);
};

THREE.LatLonToCubeMapConverter.prototype = {

	constructor : THREE.LatLonToCubeMapConverter,

  renderToCubeMap : function(renderer) {

		for ( var i = 0; i < 6; i ++ ) {
			this.renderToCubeMapTargetFace( renderer, this.renderTarget, i );
		}
		return this.renderTarget;
  },

	renderToCubeMapTargetFace: function( renderer, renderTarget, faceIndex ) {

		renderTarget.activeCubeFace = faceIndex;
		this.shader.uniforms[ 'faceIndex' ].value = faceIndex;
		renderer.render( this.scene, this.camera, renderTarget, true );

	},

  getShader: function() {

		return new THREE.ShaderMaterial( {

			uniforms: {
				"faceIndex": { type: 'i', value: 0 },
				"mapSize": { type: 'f', value: 0.5 },
				"tLatLonMap": { type: 't', value: null },
			},

			vertexShader:
				"varying vec2 vUv;\n\
				void main() {\n\
					vUv = uv;\n\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
				}",

			fragmentShader:
				"#include <common>\n\
				#define INV_PI (1.0/PI)\n\
				varying vec2 vUv;\n\
				uniform int faceIndex;\n\
				uniform sampler2D tLatLonMap;\n\
				uniform float mapSize;\n\
				\n\
				void main() {\n\
					vec3 sampleDirection;\n\
					vec2 uv = vUv*2.0 - 1.0;\n\
					uv.y *= -1.0;\n\
					float offset = 0.5/mapSize;\n\
					const float a = -1.0;\n\
					const float b = 1.0;\n\
					float c = -1.0 + offset;\n\
					float d = 1.0 - offset;\n\
					uv.x = (uv.x - a) * d * 0.5 - (uv.x - b) * c * 0.5;\n\
					uv.y = (uv.y - a) * d * 0.5 - (uv.y - b) * c * 0.5;\n\
					if (faceIndex==0) {\n\
						sampleDirection = vec3(1.0, -uv.y, -uv.x);\n\
					} else if (faceIndex==1) {\n\
						sampleDirection = vec3(-1.0, -uv.y, uv.x);\n\
					} else if (faceIndex==3) {\n\
						sampleDirection = vec3(uv.x, 1.0, uv.y);\n\
					} else if (faceIndex==2) {\n\
						sampleDirection = vec3(uv.x, -1.0, -uv.y);\n\
					} else if (faceIndex==4) {\n\
						sampleDirection = vec3(uv.x, -uv.y, 1.0);\n\
					} else {\n\
						sampleDirection = vec3(-uv.x, -uv.y, -1.0);\n\
					}\n\
					sampleDirection = normalize(sampleDirection);\n\
					float u_theta = acos(sampleDirection.y) * INV_PI;\n\
					float v_phi = (atan(sampleDirection.z, sampleDirection.x) + PI) * 0.5 * INV_PI;\n\
					gl_FragColor = texture2D(tLatLonMap, vec2(v_phi, u_theta));\n\
				}",
			blending: THREE.CustomBlending,
			blendSrc: THREE.OneFactor,
			blendDst: THREE.ZeroFactor,
			blendSrcAlpha: THREE.OneFactor,
			blendDstAlpha: THREE.ZeroFactor,
			blendEquation: THREE.AddEquation
		} );
	}

}
