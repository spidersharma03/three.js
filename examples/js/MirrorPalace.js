function MirrorPalace( scene, params ) {
  var roomRadius = 90;
  var roomHeight = 130;
  var domHeight = roomHeight/3;
  this.roomRoot = new THREE.Object3D();
  var material1 = new THREE.MeshStandardMaterial( {color: 0xffff00} );
  material1.shading = THREE.FlatShading;
  material1.side = THREE.DoubleSide;
  var material2 = new THREE.MeshStandardMaterial( {color: 0x00ff00} );
  material2.shading = THREE.FlatShading;
  material2.side = THREE.DoubleSide;

  var geometry = new THREE.CylinderGeometry( roomRadius, roomRadius, roomHeight, 32, 1, true );
  var cylinder = new THREE.Mesh( geometry, material1 );
  this.roomRoot.add( cylinder );

  var domRoot = new THREE.Object3D();
  domRoot.position.y = roomHeight/2;
  var geometry = new THREE.SphereGeometry( 1, 32, 32, 0, 2*Math.PI, 0, Math.PI/2 );
  var sphere = new THREE.Mesh( geometry, material2 );
  domRoot.add( sphere );
  domRoot.scale.x = roomRadius;
  domRoot.scale.y = domHeight;
  domRoot.scale.z = roomRadius;
  this.roomRoot.add( domRoot );

  var geometry = new THREE.CylinderGeometry( roomRadius, roomRadius, 1, 32, 32 );
  var cylinder = new THREE.Mesh( geometry, material1 );
  cylinder.position.y = -roomHeight/2;
  this.roomRoot.add( cylinder );

  this.cubeCamera = new THREE.CubeCamera(0.01, 100, 1024);
}

MirrorPalace.prototype = {
  constructor: MirrorPalace,

  prepareNormalsCubeMap: function( scene, renderer) {
      this.cubeCamera.updateCubeMap(renderer, scene);
      // this.material.uniforms["tCubeMap"].value = this.cubeCamera.renderTarget;
  },

  update: function( renderer, scene ) {

  },

  getPalaceMaterial: function() {

		return new THREE.ShaderMaterial( {

			defines: {
				"RAY_BOUNCE_COUNT": 3,
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
        uniform vec3 roomDim;\
				\n\
        bool intersectGround() {\
          return false;\
        }\
        \
        bool intersectDom() {\
          return false;\
        }\
        \
        bool intersectRoom() {\
          return false;\
        }\
        \
        bool interscetRoomShape() {\
          return false;\
        }\
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
					gl_FragColor = linearToOutputTexel( vec4( 1.0 ) );\n\
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
