function FilteredESM( scene, camera, light ) {
  this.scene = scene;
  this.camera = camera;
  this.light = light;

  this.sceneOrtho = new THREE.Scene();
  this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -0.001, 1000);
  var geometry = new THREE.PlaneGeometry( 2, 2, 1, 1 );
  var material = new THREE.MeshBasicMaterial( {color: 0xffffff, side: THREE.DoubleSide} );
  var plane = new THREE.Mesh( geometry, material );
  this.sceneOrtho.add(plane);

  this.lightCamera = new THREE.PerspectiveCamera( 80, window.innerWidth / window.innerHeight, 1, 1000 );

  var shadowMapWidth  = 1024;
  var shadowMapHeight = 1024;
  var params = { format: THREE.RGBAFormat, type: THREE.FloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter};
  this.shadowDepthMap = new THREE.WebGLRenderTarget(shadowMapWidth, shadowMapHeight, params);
  this.shadowDepthMapTemp = new THREE.WebGLRenderTarget(shadowMapWidth, shadowMapHeight, params);
  this.shadowDepthMap.generateMipmaps = false;
  this.shadowDepthMapTemp.generateMipmaps = false;

  this.depthMaterial      = this.getShadowDepthWriteMaterial();

  this.shadowFilterMaterial = this.getShadowFilterMaterial();
  this.shadowFilterMaterial.uniforms["shadowMapSize"].value = new THREE.Vector2(shadowMapWidth, shadowMapHeight);
  this.VERTICAL_DIRECTION = new THREE.Vector2(0, 1);
  this.HORIZONTAL_DIRECTION = new THREE.Vector2(1, 0);

  this.finalPassMaterial = this.getFinalPassMaterial();
  this.finalPassMaterial.uniforms["windowSize"].value = new THREE.Vector2(window.innerWidth, window.innerHeight);
  this.finalPassMaterial.uniforms["shadowMap"].value = this.shadowDepthMap;
}

FilteredESM.prototype = {

  constructor: FilteredESM,

  render: function( renderer ) {
    // 1. Render depth to shadow map
    this.renderShadowDepthMap( renderer, this.light, this.shadowDepthMap );

    // 2. Filter
    this.filterShadowDepthMap( renderer );

    // Final Pass
    renderer.setClearColor( 0xaaaaaa );

    this.lightCamera.matrixWorldInverse.getInverse( this.lightCamera.matrixWorld );
    // compute shadow matrix
    var shadowMatrix = this.light.shadow.matrix;
    shadowMatrix.set(
      0.5, 0.0, 0.0, 0.5,
      0.0, 0.5, 0.0, 0.5,
      0.0, 0.0, 0.5, 0.5,
      0.0, 0.0, 0.0, 1.0
    );
    shadowMatrix.multiply( this.lightCamera.projectionMatrix );
    shadowMatrix.multiply( this.lightCamera.matrixWorldInverse );
    var matrix = this.finalPassMaterial.uniforms["shadowMatrix"].value;
    matrix.copy(shadowMatrix);

    // this.finalPassMaterial.uniforms["shadowBuffer"].value = this.getShadowBuffer();
    this.finalPassMaterial.uniforms["lightPosition"].value = this.light.position;
    this.scene.overrideMaterial = this.finalPassMaterial;
    renderer.render( this.scene, this.camera, null, true );
    this.scene.overrideMaterial = null;
  },
  // Render shadow map of a light
  renderShadowDepthMap: function( renderer, light, shadowDepthMap ) {
    var lightPosition = light.position;
    this.lightCamera.position.copy(lightPosition);
    this.lightCamera.lookAt(light.target.position);
    // this.lightCamera.lookAt(light.target.position);
    this.lightCamera.updateMatrixWorld();
    this.scene.overrideMaterial = this.depthMaterial;
    renderer.render( this.scene, this.lightCamera, shadowDepthMap, true);
    this.scene.overrideMaterial = null;
  },

  filterShadowDepthMap: function( renderer ) {
    // return;
    this.sceneOrtho.overrideMaterial = this.shadowFilterMaterial;
    this.shadowFilterMaterial.uniforms["direction"].value = this.VERTICAL_DIRECTION;
    this.shadowFilterMaterial.uniforms["shadowMap"].value = this.shadowDepthMap;
    renderer.render( this.sceneOrtho, this.orthoCamera, this.shadowDepthMapTemp, true);
    this.shadowFilterMaterial.uniforms["direction"].value = this.HORIZONTAL_DIRECTION;
    this.shadowFilterMaterial.uniforms["shadowMap"].value = this.shadowDepthMapTemp;
    renderer.render( this.sceneOrtho, this.orthoCamera, this.shadowDepthMap, true);
    this.sceneOrtho.overrideMaterial = null;
  },

  getShadowDepthWriteMaterial: function( ) {
    return new THREE.ShaderMaterial( {

			uniforms: {
			},

      vertexShader: "varying vec4 viewPosition;\
      void main() {\
        viewPosition = modelViewMatrix * vec4(position, 1.0 );\
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
      }",

      fragmentShader: "#include <packing>\
        varying vec4 viewPosition;\
        void main() {\
          const float nearPlane = 1.0;\
          const float farPlane = 1000.0;\
          gl_FragColor = vec4( (viewPosition.z + nearPlane)/(nearPlane - farPlane) );\
        }",
    } );
  },

  getShadowFilterMaterial: function( ) {
    return new THREE.ShaderMaterial( {

			uniforms: {
        "shadowMap" : { value: null },
        "shadowMapSize" : { value: new THREE.Vector2() },
        "direction" : { value : new THREE.Vector2() }
			},

      vertexShader: "varying vec2 vUv;\
      void main() {\
        vUv = uv;\
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\
      }",

      fragmentShader: "#include <packing>\
        varying vec2 vUv;\
        uniform sampler2D shadowMap;\
        uniform vec2 shadowMapSize;\
        uniform vec2 direction;\
        const int KERNEL_WIDTH = 3;\
        const float SIGMA = float(KERNEL_WIDTH);\
        \
        float gaussianPdf(in float x, in float sigma) {\
					return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;\
				}\
        \
        float log_space_average(float w0, float d1, float w1, float d2) {\
        	return d1 + log(w0 + (w1 * exp(d2 - d1)));\
        }\
        \
        float BoxBlur() {\
        	float v, B, B2;\
        	float w = 1.0/float(2*KERNEL_WIDTH + 1);\
          vec2 invSize = 1.0/shadowMapSize;\
          vec2 delta = invSize * direction;\
          vec2 offset = invSize * direction * float(-KERNEL_WIDTH);\
        	B = (texture2D(shadowMap, vUv + offset).r);\
          offset += delta;\
        	B2 = (texture2D(shadowMap, vUv + offset).r);\
        	v = log_space_average(w, B, w, B2);\
          \
        	for(int i = -KERNEL_WIDTH + 2; i <= KERNEL_WIDTH; i++) {\
            offset += delta;\
        		B = (texture2D(shadowMap, vUv + offset).r);\
        		v = log_space_average(1.0, v, w, B);\
        	}\
        	return v;\
        }\
        \
        float GaussianBlur() {\
        	float v, B, B2;\
        	float w = 1.0/float(2*KERNEL_WIDTH + 1);\
          vec2 invSize = 1.0/shadowMapSize;\
          vec2 delta = invSize * direction;\
          vec2 offset = invSize * direction * float(-KERNEL_WIDTH);\
          float w1 = gaussianPdf(float(KERNEL_WIDTH), SIGMA);\
        	B = (texture2D(shadowMap, vUv + offset).r);\
          offset += delta;\
        	B2 = (texture2D(shadowMap, vUv + offset).r);\
          float w2 = gaussianPdf(float(KERNEL_WIDTH-1), SIGMA);\
        	v = log_space_average(w1, B, w2, B2);\
          \
        	for(int i = -KERNEL_WIDTH + 2; i <= KERNEL_WIDTH; i++) {\
            offset += delta;\
            float w3 = gaussianPdf(float(i), SIGMA);\
        		B = (texture2D(shadowMap, vUv + offset).r);\
        		v = log_space_average(1.0, v, w3, B);\
        	}\
        	return v;\
        }\
        \
        void main() {\
          float sum = BoxBlur();\
          gl_FragColor = vec4( sum );\
        }",
    } );
  },

  getFinalPassMaterial: function() {
    return new THREE.ShaderMaterial( {

			uniforms: {
        "shadowMap" : { value: null },
        "windowSize"   : { value: null },
        "shadowMatrix": { value: new THREE.Matrix4() },
        "lightPosition": { value: new THREE.Vector3() }
			},

      vertexShader: "varying vec3 normalEyeSpace;\
      varying vec3 lightVector;\
      varying vec4 shadowCoord;\
      uniform vec3 lightPosition;\
      uniform mat4 shadowMatrix;\
      void main() {\
        vec4 worldPosition = modelMatrix * vec4( position, 1.0 );\
        shadowCoord = shadowMatrix * worldPosition;\
        normalEyeSpace = normalize(normalMatrix * normal);\
        vec3 lightPositionEyeSpace = (viewMatrix * vec4(lightPosition, 1.0)).xyz;\
        lightVector = lightPositionEyeSpace - (modelViewMatrix * vec4( position, 1.0 )).xyz;\
        lightVector = normalize(lightVector);\
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\
      }",

      fragmentShader: "#include <packing>\
        varying vec3 normalEyeSpace;\
        varying vec3 lightVector;\
        varying vec4 shadowCoord;\
        uniform vec2 windowSize;\
        uniform sampler2D shadowMap;\
        void main() {\
          const float nearPlane = 1.0;\
          const float farPlane = 1000.0;\
          float lightDepth = shadowCoord.z + 2.0*farPlane*nearPlane/(farPlane - nearPlane);\
		      lightDepth *= -((farPlane - nearPlane)/(farPlane + nearPlane));\
          float lightDist = -lightDepth;\
          vec2 shadowCoord2d = shadowCoord.xy/shadowCoord.w;\
          float NdotL = max(dot( normalize(normalEyeSpace), normalize(lightVector)), 0.0);\
          float bias = tan(acos(NdotL));\
          bias = clamp(bias, 0.0, 0.001);\
          float shadowDepth = (texture2D( shadowMap, shadowCoord2d )).r + bias;\
          shadowDepth = shadowDepth * ( farPlane - nearPlane ) + nearPlane;\
          const float c = 0.5;\
          float shadowValue = step( lightDist, shadowDepth );\
 			    shadowValue = min(exp(-c*(lightDist - shadowDepth)), 1.0);\
          gl_FragColor = vec4(NdotL * shadowValue);\
        }",
    } );
  }
}
