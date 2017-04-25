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

  var nearPlane = 1;
  var farPlane = 100;
  this.lightCamera = new THREE.PerspectiveCamera( 80, window.innerWidth / window.innerHeight, nearPlane, farPlane );

  var shadowMapWidth  = 1024;
  var shadowMapHeight = 1024;
  var params = { format: THREE.RGBAFormat, type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter};
  this.shadowDepthMap = new THREE.WebGLRenderTarget(shadowMapWidth, shadowMapHeight, params);
  this.shadowDepthMapTemp = new THREE.WebGLRenderTarget(shadowMapWidth, shadowMapHeight, params);
  this.shadowDepthMap.generateMipmaps = false;
  this.shadowDepthMapTemp.generateMipmaps = false;

  var params = { format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter};
  this.shadowBuffer     = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, params);
  this.shadowBufferTemp = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, params);

  this.depthMaterial      = this.getShadowDepthWriteMaterial();
  this.depthMaterial.uniforms["nearFarPlanes"].value = new THREE.Vector2(nearPlane, farPlane);

  this.shadowFilterMaterial = this.getShadowFilterMaterial();
  this.shadowFilterMaterial.uniforms["shadowMapSize"].value = new THREE.Vector2(shadowMapWidth, shadowMapHeight);
  this.VERTICAL_DIRECTION = new THREE.Vector2(0, 1);
  this.HORIZONTAL_DIRECTION = new THREE.Vector2(1, 0);
  this.shadowFilterMaterial.defines["KERNEL_WIDTH"] = 3;

  this.accumulatePassMaterial = this.getAccumulatePassMaterial();
  this.accumulatePassMaterial.uniforms["shadowMapSize"].value = new THREE.Vector2(shadowMapWidth, shadowMapHeight);
  this.accumulatePassMaterial.uniforms["windowSize"].value = new THREE.Vector2(window.innerWidth, window.innerHeight);
  this.accumulatePassMaterial.uniforms["shadowMap"].value = this.shadowDepthMap;
  this.accumulatePassMaterial.uniforms["nearFarPlanes"].value = new THREE.Vector2(nearPlane, farPlane);

  this.finalPassMaterial = this.getFinalPassMaterial();
  this.finalPassMaterial.uniforms["windowSize"].value = new THREE.Vector2(window.innerWidth, window.innerHeight);
  this.accumulatePassMaterial.uniforms["shadowBuffer"].value = this.getShadowBuffer();

  this.frameCount = 0;
  this.poissonSampler = new PoissonDiskGenerator(70, -1);
  this.lightPositionSamples = this.poissonSampler.generatePoints();
  this.lightPositionSamples = this.poissonSampler.shuffle(this.lightPositionSamples);
  this.currentLightSample = new THREE.Vector3();
  this.lightOrientation   = new THREE.Vector3(0, -1, 0);
  this.lightTarget = new THREE.Vector3();
  this.accumulatePassMaterial.uniforms["maxSamples"].value = this.lightPositionSamples.length;
  this.arealightSize = 4;

  this.profiler = new THREE.WebGLProfiler(renderer);
}

FilteredESM.prototype = {

  constructor: FilteredESM,

  getShadowBuffer: function() {
   return this.frameCount %2 === 0 ? this.shadowBufferTemp : this.shadowBuffer;
  },

  sampleLight: function( light, sampleNumber ) {
    var lightWorldMatrix = light.matrixWorld;
    if( sampleNumber < this.lightPositionSamples.length ) {
      var sample = this.lightPositionSamples[sampleNumber];
      this.currentLightSample.x = sample.x * this.arealightSize;
      this.currentLightSample.y = 0.0;
      this.currentLightSample.z = sample.y * this.arealightSize;
    } else {
      var sample = this.lightPositionSamples[0];
      this.currentLightSample.x = sample.x * this.arealightSize;
      this.currentLightSample.y = 0.0;
      this.currentLightSample.z = sample.y * this.arealightSize;
    }
    this.currentLightSample.applyMatrix4(lightWorldMatrix);
    this.lightOrientation.set(0, -1, 0);
    this.lightOrientation.transformDirection(lightWorldMatrix);
    return this.currentLightSample;
  },

  render: function( renderer ) {

    this.profiler.start();

    this.frameCount = this.frameCount >= this.lightPositionSamples.length ? this.lightPositionSamples.length : this.frameCount;

    this.frameCount++;
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
    var matrix = this.accumulatePassMaterial.uniforms["shadowMatrix"].value;
    matrix.copy(shadowMatrix);

    this.accumulatePassMaterial.uniforms["currentFrameCount"].value = this.frameCount;
    var currentShadowReadTarget = (this.frameCount % 2 == 0) ? this.shadowBuffer : this.shadowBufferTemp;
    this.accumulatePassMaterial.uniforms["shadowBuffer"].value = currentShadowReadTarget;

    this.accumulatePassMaterial.uniforms["lightPosition"].value = this.light.position;
    this.scene.overrideMaterial = this.accumulatePassMaterial;

    var currentShadowWriteTarget = (this.frameCount % 2 == 0) ? this.shadowBufferTemp : this.shadowBuffer;

    renderer.render( this.scene, this.camera, currentShadowWriteTarget, true);
    this.scene.overrideMaterial = null;

    this.finalPassMaterial.uniforms["shadowBuffer"].value = this.shadowBuffer;
    this.finalPassMaterial.uniforms["lightPosition"].value = this.light.position;
    this.scene.overrideMaterial = this.finalPassMaterial;
    renderer.render( this.scene, this.camera, null, true );
    this.scene.overrideMaterial = null;

    this.profiler.end();

    if(this.profiler.available()) {
      this.time = this.profiler.value();
    }
  },
  // Render shadow map of a light
  renderShadowDepthMap: function( renderer, light, shadowDepthMap ) {
    var lightPosition = this.sampleLight( light, this.frameCount - 1);
    this.lightCamera.position.copy(lightPosition);
    this.lightTarget.copy(lightPosition);
    this.lightTarget.addScaledVector(this.lightOrientation, 1000);
    this.lightCamera.lookAt(this.lightTarget);
    // this.lightCamera.lookAt(light.target.position);
    this.lightCamera.updateMatrixWorld();
    this.scene.overrideMaterial = this.depthMaterial;
    renderer.render( this.scene, this.lightCamera, shadowDepthMap, true);
    this.scene.overrideMaterial = null;
  },

  filterShadowDepthMap: function( renderer ) {
    return;
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
        "nearFarPlanes" : { value: new THREE.Vector2() }
			},

      vertexShader: "varying vec4 viewPosition;\
      void main() {\
        viewPosition = modelViewMatrix * vec4(position, 1.0 );\
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
      }",

      fragmentShader: "#include <packing>\
        varying vec4 viewPosition;\
        uniform vec2 nearFarPlanes;\
        void main() {\
          gl_FragColor = vec4( (viewPosition.z + nearFarPlanes.x)/(nearFarPlanes.x - nearFarPlanes.y) );\
        }",
    } );
  },

  getShadowFilterMaterial: function( ) {
    return new THREE.ShaderMaterial( {
      defines: {
        "KERNEL_WIDTH" : 1
      },

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
        const float SIGMA = float(KERNEL_WIDTH);\
        \
        float gaussianPdf(in float x, in float sigma) {\
					return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma * 1.0;\
				}\
        \
        float log_space_average(float w0, float d1, float w1, float d2) {\
        	return d1 + log(w0 + (w1 * exp(d2 - d1)));\
        }\
        \
        float gaussianNorm() {\
          float norm = 0.0;\
          for( int i=-KERNEL_WIDTH; i<=KERNEL_WIDTH; i++) {\
            norm += gaussianPdf(float(i), SIGMA);\
          }\
          return norm;\
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
          float gaussNorm = gaussianNorm();\
          vec2 offset = invSize * direction * float(-KERNEL_WIDTH);\
          float w1 = gaussianPdf(float(KERNEL_WIDTH), SIGMA)/gaussNorm;\
        	B = texture2D(shadowMap, vUv + offset).r;\
          offset += delta;\
        	B2 = (texture2D(shadowMap, vUv + offset).r);\
          float w2 = gaussianPdf(float(KERNEL_WIDTH-1), SIGMA)/gaussNorm;\
        	v = log_space_average(w1, B, w2, B2);\
          \
        	for(int i = -KERNEL_WIDTH + 2; i <= KERNEL_WIDTH; i++) {\
            offset += delta;\
            float w3 = gaussianPdf(float(i), SIGMA)/gaussNorm;\
        		B = texture2D(shadowMap, vUv + offset).r;\
        		v = log_space_average(1.0, v, w3, B);\
        	}\
        	return v;\
        }\
        \
        void main() {\
          float sum = GaussianBlur();\
          gl_FragColor = vec4( sum );\
        }",
    } );
  },

  getAccumulatePassMaterial: function() {
    return new THREE.ShaderMaterial( {

			uniforms: {
        "shadowMap" : { value: null },
        "shadowBuffer" : { value: null },
        "windowSize"   : { value: null },
        "shadowMapSize": { value: null },
        "shadowMatrix": { value: new THREE.Matrix4() },
        "lightPosition": { value: new THREE.Vector3() },
        "nearFarPlanes" : { value: new THREE.Vector2() },
        "currentFrameCount" : { value: 0 },
        "maxSamples" : { value: 0}
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
        uniform vec2 shadowMapSize;\
        uniform sampler2D shadowMap;\
        uniform sampler2D shadowBuffer;\
        uniform vec2 nearFarPlanes;\
        uniform float currentFrameCount;\
        uniform float maxSamples;\
        \
        float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {\
      		float shadowDepth = texture2D( depths, uv ).r + 0.015;\
          shadowDepth = shadowDepth * ( nearFarPlanes.y - nearFarPlanes.x ) + nearFarPlanes.x;\
          return step( compare, shadowDepth );\
      	}\
        \
        float texture2DShadowLerp( sampler2D depths, vec2 size, vec2 uv, float compare ) {\
      		const vec2 offset = vec2( 0.0, 1.0 );\
      		vec2 texelSize = vec2( 1.0 ) / size;\
      		vec2 centroidUV = floor( uv * size + 0.5 ) / size;\
      		float lb = texture2DCompare( depths, centroidUV + texelSize * offset.xx, compare );\
      		float lt = texture2DCompare( depths, centroidUV + texelSize * offset.xy, compare );\
      		float rb = texture2DCompare( depths, centroidUV + texelSize * offset.yx, compare );\
      		float rt = texture2DCompare( depths, centroidUV + texelSize * offset.yy, compare );\
      		vec2 f = fract( uv * size + 0.5 );\
      		float a = mix( lb, lt, f.y );\
      		float b = mix( rb, rt, f.y );\
      		float c = mix( a, b, f.x );\
      		return c;\
      	}\
        \
        void main() {\
          float lightDepth = shadowCoord.z + 2.0*nearFarPlanes.y*nearFarPlanes.x/(nearFarPlanes.y - nearFarPlanes.x);\
		      lightDepth *= -((nearFarPlanes.y - nearFarPlanes.x)/(nearFarPlanes.y + nearFarPlanes.x));\
          float lightDist = -lightDepth;\
          vec2 shadowCoord2d = shadowCoord.xy/shadowCoord.w;\
          const int mode = 1;\
          const float shadowRadius = 4.0;\
          float shadowValue = 0.0;\
          if( mode == 0 )\
            shadowValue = texture2DCompare(shadowMap, shadowCoord2d, lightDist);\
          else if( mode == 1 ) {\
            vec2 texelSize = vec2( 1.0 ) / shadowMapSize;\
      			float dx0 = - texelSize.x * shadowRadius;\
      			float dy0 = - texelSize.y * shadowRadius;\
      			float dx1 = + texelSize.x * shadowRadius;\
      			float dy1 = + texelSize.y * shadowRadius;\
            shadowValue = ( \
      				texture2DCompare( shadowMap, shadowCoord2d + vec2( dx0, dy0 ), lightDist ) +\
      				texture2DCompare( shadowMap, shadowCoord2d + vec2( 0.0, dy0 ), lightDist ) +\
      				texture2DCompare( shadowMap, shadowCoord2d + vec2( dx1, dy0 ), lightDist ) +\
      				texture2DCompare( shadowMap, shadowCoord2d + vec2( dx0, 0.0 ), lightDist ) +\
      				texture2DCompare( shadowMap, shadowCoord2d, lightDist ) +\
      				texture2DCompare( shadowMap, shadowCoord2d + vec2( dx1, 0.0 ), lightDist ) +\
      				texture2DCompare( shadowMap, shadowCoord2d + vec2( dx0, dy1 ), lightDist ) +\
      				texture2DCompare( shadowMap, shadowCoord2d + vec2( 0.0, dy1 ), lightDist ) +\
      				texture2DCompare( shadowMap, shadowCoord2d + vec2( dx1, dy1 ), lightDist )\
      			) * ( 1.0 / 9.0 );\
          }\
          else {\
            vec2 texelSize = vec2( 1.0 ) / shadowMapSize;\
       			float dx0 = - texelSize.x * shadowRadius;\
       			float dy0 = - texelSize.y * shadowRadius;\
       			float dx1 = + texelSize.x * shadowRadius;\
       			float dy1 = + texelSize.y * shadowRadius;\
       			shadowValue = (\
       				texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord2d + vec2( dx0, dy0 ), lightDist ) +\
       				texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord2d + vec2( 0.0, dy0 ), lightDist ) +\
       				texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord2d + vec2( dx1, dy0 ), lightDist ) +\
       				texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord2d + vec2( dx0, 0.0 ), lightDist ) +\
       				texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord2d, lightDist ) +\
       				texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord2d + vec2( dx1, 0.0 ), lightDist ) +\
       				texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord2d + vec2( dx0, dy1 ), lightDist ) +\
       				texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord2d + vec2( 0.0, dy1 ), lightDist ) +\
       				texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord2d + vec2( dx1, dy1 ), lightDist )\
       			) * ( 1.0 / 9.0 );\
          }\
          \
          float prevShadow = unpackRGBAToDepth(texture2D( shadowBuffer, gl_FragCoord.xy/windowSize ));\
          if(currentFrameCount > maxSamples){\
            shadowValue = prevShadow;\
          }\
          float newShadowValue = (currentFrameCount - 1.0) * prevShadow + shadowValue;\
          newShadowValue /= currentFrameCount;\
          \
          gl_FragColor = packDepthToRGBA(newShadowValue);\
        }",
    } );
  },

  getFinalPassMaterial: function() {
    return new THREE.ShaderMaterial( {

    			uniforms: {
            "shadowBuffer" : { value: null },
            "windowSize"   : { value: null },
            "lightPosition": { value: new THREE.Vector3() }
    			},

          vertexShader: "varying vec3 normalEyeSpace;\
          varying vec3 lightVector;\
          uniform vec3 lightPosition;\
          void main() {\
            normalEyeSpace = normalize(normalMatrix * normal);\
            vec3 lightPositionEyeSpace = (viewMatrix * vec4(lightPosition, 1.0)).xyz;\
            lightVector = lightPositionEyeSpace - (modelViewMatrix * vec4( position, 1.0 )).xyz;\
            lightVector = normalize(lightVector);\
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
          }",

          fragmentShader: "#include <packing>\
            varying vec3 normalEyeSpace;\
            varying vec3 lightVector;\
            uniform vec2 windowSize;\
            uniform sampler2D shadowBuffer;\
            void main() {\
              float NdotL = max(dot( normalize(normalEyeSpace), normalize(lightVector)), 0.0);\
              float shadowValue = unpackRGBAToDepth(texture2D( shadowBuffer, gl_FragCoord.xy/windowSize));\
              gl_FragColor = vec4(shadowValue * NdotL);\
            }",
        } );
  }
}
