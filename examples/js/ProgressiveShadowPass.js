function ProgressiveShadowPass( scene, camera, light ) {
  this.scene = scene;
  this.camera = camera;

  this.light = light;
  this.lightCamera = new THREE.PerspectiveCamera( 80, window.innerWidth / window.innerHeight, 1, 1000 );

  var shadowMapWidth  = 1024;
  var shadowMapHeight = 1024;
  var params = { format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter};
  this.shadowDepthMap   = new THREE.WebGLRenderTarget(shadowMapWidth, shadowMapHeight, params);
  var params = { format: THREE.RGBAFormat, type: THREE.FloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter};
  this.shadowBuffer     = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, params);
  this.shadowBufferTemp = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, params);

  this.depthMaterial      = this.getShadowDepthWriteMaterial();
  this.accumulateMaterial = this.getShadowBufferAccumulationMaterial();
  this.accumulateMaterial.uniforms["shadowMapSize"].value = new THREE.Vector2(shadowMapWidth, shadowMapHeight);
  this.accumulateMaterial.uniforms["windowSize"].value = new THREE.Vector2(window.innerWidth, window.innerHeight);
  this.accumulateMaterial.uniforms["shadowMap"].value = this.shadowDepthMap;
  this.accumulateMaterial.uniforms["shadowBuffer"].value = this.shadowBuffer;

  this.frameCount = 0;
  this.poissonSampler = new PoissonDiskGenerator(500, -1);
  this.lightPositionSamples = this.poissonSampler.generatePoints();
  this.currentLightSample = new THREE.Vector3();
  this.lightOrientation   = new THREE.Vector3(0, -1, 0);
  this.lightTarget = new THREE.Vector3();
  this.accumulateMaterial.uniforms["maxSamples"].value = this.lightPositionSamples.length;
  this.arealightSize = 4;
}

ProgressiveShadowPass.prototype = {

  constructor: ProgressiveShadowPass,

  render: function( renderer ) {
    this.frameCount++;
    this.frameCount = this.frameCount >= this.lightPositionSamples.length ? this.lightPositionSamples.length : this.frameCount;
    // 1. Render depth to shadow map
    this.renderShadowDepthMap( renderer, this.light );
    // 2. Accumulate
    this.accumulateShadowBuffer( renderer, this.light );
  },

  sampleLight: function( sampleNumber ) {
    var lightWorldMatrix = this.light.matrixWorld;
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
  // Render shadow map of a light
  renderShadowDepthMap: function( renderer, light ) {
    var lightPosition = this.sampleLight( this.frameCount - 1);
    this.lightCamera.position.copy(lightPosition);
    this.lightTarget.copy(lightPosition);
    this.lightTarget.addScaledVector(this.lightOrientation, 1000);
    this.lightCamera.lookAt(this.lightTarget);
    // this.lightCamera.lookAt(light.target.position);
    this.lightCamera.updateMatrixWorld();
    this.scene.overrideMaterial = this.depthMaterial;
    renderer.render( this.scene, this.lightCamera, this.shadowDepthMap, true);
    this.scene.overrideMaterial = null;
  },

  // Compare the shadow map and accumulate in shadowbuffer
  accumulateShadowBuffer: function( renderer, light ) {
    this.lightCamera.matrixWorldInverse.getInverse( this.lightCamera.matrixWorld );
    // compute shadow matrix

    var shadowMatrix = light.shadow.matrix;
    shadowMatrix.set(
      0.5, 0.0, 0.0, 0.5,
      0.0, 0.5, 0.0, 0.5,
      0.0, 0.0, 0.5, 0.5,
      0.0, 0.0, 0.0, 1.0
    );

    shadowMatrix.multiply( this.lightCamera.projectionMatrix );
    shadowMatrix.multiply( this.lightCamera.matrixWorldInverse );

    var matrix = this.accumulateMaterial.uniforms["shadowMatrix"].value;
    matrix.copy(shadowMatrix);
    this.accumulateMaterial.uniforms["currentFrameCount"].value = this.frameCount;
    var currentShadowReadTarget = (this.frameCount % 2 == 0) ? this.shadowBuffer : this.shadowBufferTemp;
    this.accumulateMaterial.uniforms["shadowBuffer"].value = currentShadowReadTarget;

    this.scene.overrideMaterial = this.accumulateMaterial;

    var currentShadowWriteTarget = (this.frameCount % 2 == 0) ? this.shadowBufferTemp : this.shadowBuffer;

    renderer.render( this.scene, this.camera, currentShadowWriteTarget, true);

    this.scene.overrideMaterial = null;
  },

  getShadowBuffer: function() {
    return this.frameCount %2 === 0 ? this.shadowBufferTemp : this.shadowBuffer;
  },

  getShadowDepthWriteMaterial: function( ) {
    return new THREE.ShaderMaterial( {

			uniforms: {
			},

      vertexShader: "void main() {\
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
      }",

      fragmentShader: "#include <packing>\
        void main() {\
          gl_FragColor = packDepthToRGBA( gl_FragCoord.z );\
        }",
    } );
  },

  getShadowBufferAccumulationMaterial: function() {
    return new THREE.ShaderMaterial( {

      defines: {
        "SHADOWMAP_TYPE": 1
      },

      uniforms: {
        "shadowBuffer" : { value: null },
        "shadowMap"    : { value: null },
        "shadowMapSize": { value: new THREE.Vector2() },
        "windowSize"   : { value: new THREE.Vector2() },
        "currentFrameCount" : { value: 0 },
        "shadowMatrix" : { value: new THREE.Matrix4() },
        "maxSamples"   : { value: 0 }
      },

      vertexShader: "varying vec4 shadowCoord;\
        uniform mat4 shadowMatrix;\
        void main() {\
          vec4 worldPosition = modelMatrix * vec4( position, 1.0 );\
          shadowCoord = shadowMatrix * worldPosition;\
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\
        }",

      fragmentShader: "#include <packing>\
        uniform sampler2D shadowBuffer;\
        uniform sampler2D shadowMap;\
        uniform vec2 shadowMapSize;\
        uniform vec2 windowSize;\
        uniform float maxSamples;\
        uniform float currentFrameCount;\
        varying vec4 shadowCoord;\
        \
        float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {\
        \
      		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );\
        \
      	}\
        \
      	float texture2DShadowLerp( sampler2D depths, vec2 size, vec2 uv, float compare ) {\
          \
      		const vec2 offset = vec2( 0.0, 1.0 );\
          \
      		vec2 texelSize = vec2( 1.0 ) / size;\
      		vec2 centroidUV = floor( uv * size + 0.5 ) / size;\
          \
      		float lb = texture2DCompare( depths, centroidUV + texelSize * offset.xx, compare );\
      		float lt = texture2DCompare( depths, centroidUV + texelSize * offset.xy, compare );\
      		float rb = texture2DCompare( depths, centroidUV + texelSize * offset.yx, compare );\
      		float rt = texture2DCompare( depths, centroidUV + texelSize * offset.yy, compare );\
          \
      		vec2 f = fract( uv * size + 0.5 );\
      		float a = mix( lb, lt, f.y );\
      		float b = mix( rb, rt, f.y );\
      		float c = mix( a, b, f.x );\
      		return c;\
      	}\
        \
        float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord ) {\
          shadowCoord.xyz /= shadowCoord.w;\
          shadowCoord.z += shadowBias;\
          bvec4 inFrustumVec = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );\
          bool inFrustum = all( inFrustumVec );\
          bvec2 frustumTestVec = bvec2( inFrustum, shadowCoord.z <= 1.0 );\
          bool frustumTest = all( frustumTestVec );\
          if ( frustumTest ) {\
          if(false) {\
            vec2 texelSize = vec2( 1.0 ) / shadowMapSize;\
            float dx0 = - texelSize.x * shadowRadius;\
            float dy0 = - texelSize.y * shadowRadius;\
            float dx1 = + texelSize.x * shadowRadius;\
            float dy1 = + texelSize.y * shadowRadius;\
            return (\
              texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +\
              texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +\
              texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +\
              texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +\
              texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +\
              texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +\
              texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +\
              texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +\
              texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )\
            ) * ( 1.0 / 9.0 );\
          } else {\
            vec2 texelSize = vec2( 1.0 ) / shadowMapSize;\
            float dx0 = - texelSize.x * shadowRadius;\
            float dy0 = - texelSize.y * shadowRadius;\
            float dx1 = + texelSize.x * shadowRadius;\
            float dy1 = + texelSize.y * shadowRadius;\
            return ( \
              texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) + \
              texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) + \
              texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) + \
              texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) + \
              texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy, shadowCoord.z ) + \
              texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) + \
              texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) + \
              texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) + \
              texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )\
            ) * ( 1.0 / 9.0 );\
          }\
        }\
        \
          return 1.0;\
        \
        }\
        \
        void main() {\
          float currentShadow = getShadow( shadowMap, shadowMapSize, -0.0001, 2.0, shadowCoord);\
          float prevShadow = texture2D( shadowBuffer, gl_FragCoord.xy/windowSize ).r;\
          if(currentFrameCount > maxSamples){\
            currentShadow = prevShadow;\
          }\
          float newShadowValue = (currentFrameCount - 1.0) * prevShadow + currentShadow;\
          newShadowValue /= currentFrameCount;\
          gl_FragColor = vec4( newShadowValue  );\
        }",
    } );
  },

  getFinalPassMaterial: function() {

  }
}
