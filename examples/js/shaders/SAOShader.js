/**
 * @author bhouston / http://clara.io/
 *
 * Scaleable Ambient Obscurance
 *
 * based on:
 *  - https://gist.github.com/fisch0920/6770311
 *  - http://graphics.cs.williams.edu/papers/SAOHPG12/McGuire12SAO-talk.pdf
 */

THREE.SAOShader = {

  shaderID: "soa",

  defines: {
    'NUM_SAMPLES': 8,  // must match number of msaaOffsets
    'NUM_RINGS': 3,
    'NUM_SAMPLES_HQ': 16,
    'NUM_RINGS_HQ': 5,
  },

  uniforms: {

    "tDepth": { type: "t", value: null },
    "tNormal": { type: "t", value: null },
    "tDiffuse": { type: "t", value: null },
    "scale":   { type: "f", value: 24 },
    "intensity":   { type: "f", value: 1.0 },
    "bias":   { type: "f", value: 0.1 },
    "randomSeed":   { type: "f", value: 0.0 },
    "sampleRadiusPixels":   { type: "f", value: 15.0 },
    "msaaOffsets": { type: "v2v", value: [ new THREE.Vector2(0,0) ] },
    "highQuality": { type: "i", value: 0 },
    "zNear":   { type: "f", value: 1.0 },
    "zFar":   { type: "f", value: 1000.0 },
    "viewportResolution":   { type: "v2", value: new THREE.Vector2( 256, 256 ) },
    "projMatrix": { type: "m4", value: new THREE.Matrix4() },
    "projMatrixInv": { type: "m4", value: new THREE.Matrix4() }

  },

  vertexShader: [

    "varying vec2 vUv;",

    "void main() {",

      "vUv = uv;",
      "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

    "}"

  ].join("\n"),

  fragmentShader: [

    // total number of samples at each fragment",
    "#extension GL_OES_standard_derivatives : enable",

    "#define PI    3.14159",
    "#define PI2   6.28318",
    "#define MIN_RESOLUTION         0.0002",

    "varying vec2 vUv;",

    "uniform sampler2D tDepth;",
    "uniform sampler2D tNormal;",
    "uniform sampler2D tDiffuse;",


//    "uniform int totalSamples;",
//    "uniform int totalRings;",

    "uniform mat4 projMatrix;",
    "uniform mat4 projMatrixInv;",

    "uniform float scale;",
    "uniform float intensity;",
    "uniform float bias;",
    "uniform float sampleRadiusPixels;",
    "uniform float zNear;",
    "uniform float zFar;",
    "uniform float randomSeed;",
    "uniform int highQuality;",
    "uniform vec2 viewportResolution;",
    "uniform vec2 msaaOffsets[NUM_SAMPLES];",

    // RGBA depth

    "float unpackDepth( const in vec4 rgba_depth ) {",
      "const vec4 bit_shift = vec4( 1.0 / ( 256.0 * 256.0 * 256.0 ), 1.0 / ( 256.0 * 256.0 ), 1.0 / 256.0, 1.0 );",
      "float depth = dot( rgba_depth, bit_shift );",
      "return depth;",
    "}",

    "vec3 unpackNormal( const in vec4 rgba_normal ) {",
      "return - ( rgba_normal.xyz * 2.0 - vec3( 1.0 ) );",
    "}",


    "float getViewSpaceZ(float depth) {",
    "#ifdef LINEAR_DEPTH_BUFFER",
    "    return zNear + (zFar - zNear) * depth;",
    "#else",
    "    return ( zFar * zNear ) / ( depth * ( zNear - zFar ) + zFar );",
    "#endif",
    "}",

    "vec3 getViewSpacePosition(vec2 screenSpacePosition ) {",
    "   float depth = unpackDepth( texture2D( tDepth, screenSpacePosition ) );",
    "   float viewSpaceZ = getViewSpaceZ( depth );",
    "   float w = projMatrix[2][3] * viewSpaceZ + projMatrix[3][3];",
    "   vec3 clipPos = ( vec3( screenSpacePosition, depth ) - 0.5 ) * 2.0;",
    "   return ( projMatrixInv * vec4( w * clipPos.xyz, w ) ).xyz;",
    "}",

   "vec3 getViewSpaceNormal( vec2 vUv ) {",
    "    return normalize( unpackNormal( texture2D( tNormal, vUv ) ) );",
    "}",

    "vec3 getViewSpaceNormalFromDepth(vec3 viewSpacePosition ) {",
    "    return normalize( cross(dFdy(viewSpacePosition), dFdx(viewSpacePosition)) );",
    "}",

    "float square(float a) {",
    "    return a*a;",
    "}",

   "float getOcclusion( vec3 viewSpacePosition, vec3 viewSpaceNormal, vec3 viewSpacePositionOffset ) {",
      "vec3 viewSpaceDelta = viewSpacePositionOffset - viewSpacePosition;",
      "float viewSpaceDistance = length( viewSpaceDelta );",

      "float distance = scale * viewSpaceDistance / zFar;",
      "return intensity * max(0.0, (dot(viewSpaceNormal, viewSpaceDelta) - MIN_RESOLUTION * zFar) / viewSpaceDistance - bias) / (1.0 + square( viewSpaceDistance ) );",
    "}",

    "highp float rand(vec2 co) {",
      "highp float a = 12.9898;",
      "highp float b = 78.233;",
      "highp float c = 43758.5453;",
      "highp float dt= dot(co.xy + vec2( randomSeed ),vec2(a,b));",
      "highp float sn= mod(dt,3.14159265359);",
      "return fract(sin(sn) * c);",
    "}",


    //return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    "float basicPattern( vec3 viewSpacePosition ) {",
      "vec3 viewSpaceNormal  = getViewSpaceNormal( vUv );",

      "float random = rand( vUv );",

      "vec2 radius = vec2( sampleRadiusPixels ) / viewportResolution;",
      "float numSamples = float( NUM_SAMPLES );",
      "float numRings = float( NUM_RINGS );",
      "float alphaStep = 1.0 / numSamples;",

      // jsfiddle that shows sample pattern: https://jsfiddle.net/a16ff1p7/

      "float occlusionSum = 0.0;",
      "float alpha = 0.0;",
      "float weight = 0.0;",

      "for( int i = 0; i < NUM_SAMPLES; i ++ ) {",
        "float angle = PI2 * ( numRings * alpha + random );",
        "vec2 currentRadius = radius * ( 0.1 + alpha * 0.9 );",
        "vec2 offset = vec2( cos(angle), sin(angle) ) * currentRadius;",
        "alpha += alphaStep;",

        "vec3 viewSpacePositionOffset = getViewSpacePosition( vUv + offset );",
        "if( viewSpacePositionOffset.z >= zFar ) {",
          "continue;",
        "}",
        "occlusionSum += getOcclusion( viewSpacePosition, viewSpaceNormal, viewSpacePositionOffset );",
        "weight += 1.0;",
      "}",
      "if( weight == 0.0 ) return 0.0;",
      "return occlusionSum / weight;",
    "}",

    "float jitterPattern() {",
      "float random = rand( vUv );",

      "vec2 radius = vec2( sampleRadiusPixels ) / viewportResolution;",
      "float numSamples = float( NUM_SAMPLES_HQ );",
      "float numRings = float( NUM_RINGS_HQ );",
      "float alphaStep = 1.0 / numSamples;",

      // jsfiddle that shows sample pattern: https://jsfiddle.net/a16ff1p7/

      "float occlusionSum = 0.0;",
      "float alpha = 0.0;",
      "float weight = 0.0;",

      "for( int i = 0; i < NUM_SAMPLES_HQ; i ++ ) {",
        "float angle = PI2 * ( numRings * alpha + random );",
        "vec2 currentRadius = radius * ( 0.1 + alpha * 0.9 );",
        "vec2 offset = vec2( cos(angle), sin(angle) ) * currentRadius;",
        "vec2 vUvJitter = vUv;",
        "alpha += alphaStep;",
        "vUvJitter += 1.25 * msaaOffsets[ i ] / viewportResolution;",
        "vec3 viewSpacePosition = getViewSpacePosition( vUvJitter );",
        "if( viewSpacePosition.z >= zFar ) {",
          "continue;",
        "}",
        "vec3 viewSpacePositionOffset = getViewSpacePosition( vUvJitter + offset );",
        "if( viewSpacePositionOffset.z >= zFar ) {",
          "continue;",
        "}",
       //"vec3 viewSpaceNormal  = getViewSpaceNormal( vUv );",
        "vec3 viewSpaceNormal = getViewSpaceNormal( vUvJitter );",
        "occlusionSum += getOcclusion( viewSpacePosition, viewSpaceNormal, viewSpacePositionOffset );",
        "weight += 1.0;",
      "}",
      "if( weight == 0.0 ) return 0.0;",
      "return occlusionSum / weight;",
    "}",

    "void main() {",

    "  vec4 color = texture2D( tDiffuse, vUv );",
    "  vec3 viewSpacePosition = getViewSpacePosition( vUv );",

    "  if( viewSpacePosition.z >= zFar ) {",
    "   gl_FragColor = color;",
    "   return;",
    "  }",

        "float occlusion = 0.0;",
        "if( highQuality == 1 ) {",
          "occlusion = jitterPattern();",
        "}",
        "else {",
          "occlusion = basicPattern( viewSpacePosition );",
        "}",

        "gl_FragColor = color * vec4( vec3( 1.0 - occlusion ), 1.0 );",
    "}"

  ].join('\n')

}
