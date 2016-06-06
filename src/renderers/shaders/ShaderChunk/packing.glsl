vec3 packNormalToRGB( const in vec3 normal ) {
  return normalize( normal ) * 0.5 + 0.5;
}

vec3 unpackRGBToNormal( const in vec3 rgb ) {
  return 1.0 - 2.0 * rgb.xyz;
}

/*const highp float PackUpscale = 256. / 255.; // fraction -> 0..1 (including 1)
const highp float UnpackDownscale = 255. / 256.; // 0..1 -> fraction (excluding 1)

const highp vec3 PackFactors = vec3( 256. * 256. * 256., 256. * 256.,  256. );
const highp vec4 UnpackFactors = UnpackDownscale / vec4( PackFactors, 1. );

const highp float ShiftRight8 = 1. / 256.;
*/

vec4 packDepthToRGBA( const in highp float v ) {

  const highp vec4 bit_shift = vec4( 256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0 );
  const highp vec4 bit_mask = vec4( 0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0 );
  highp vec4 res = mod( v * bit_shift * vec4( 255 ), vec4( 256 ) ) / vec4( 255 ); // vec4 res = fract( depth * bit_shift );",
  res -= res.xxyz * bit_mask;
  return res;
  
/* 	vec4 r = vec4( fract( v * PackFactors ), v );
	r.yzw -= r.xyz * ShiftRight8; // tidy overflow
	return r * PackUpscale;*/
  

}

float unpackRGBAToDepth( const in vec4 v ) {

  const highp vec4 bit_shift = vec4( 1.0 / ( 256.0 * 256.0 * 256.0 ), 1.0 / ( 256.0 * 256.0 ), 1.0 / 256.0, 1.0 );
	return dot( v, bit_shift );

  //return dot( v, UnpackFactors );

}

// NOTE: viewZ/eyeZ is < 0 when in front of the camera per OpenGL conventions

float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
  return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float linearClipZ, const in float near, const in float far ) {
  return linearClipZ * ( near - far ) - near;
}

float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
  return (( near + viewZ ) * far ) / (( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float invClipZ, const in float near, const in float far ) {
  return ( near * far ) / ( ( far - near ) * invClipZ - far );
}
