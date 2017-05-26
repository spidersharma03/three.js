#ifdef ENVMAP_TYPE_CUBE_UV

#define cubeUV_textureSize (1024.0)

int getFaceFromDirection(vec3 direction) {
	vec3 absDirection = abs(direction);
	int face = -1;
	if( absDirection.x > absDirection.z ) {
		if(absDirection.x > absDirection.y )
			face = direction.x > 0.0 ? 0 : 3;
		else
			face = direction.y > 0.0 ? 1 : 4;
	}
	else {
		if(absDirection.z > absDirection.y )
			face = direction.z > 0.0 ? 2 : 5;
		else
			face = direction.y > 0.0 ? 1 : 4;
	}
	return face;
}
#define cubeUV_rangeClamp (exp2((6.0 - 1.0) * 2.0))

vec2 MipLevelInfo( vec3 vec ) {
	vec3 dx = dFdx( vec ) * 128.0;
	vec3 dy = dFdy( vec ) * 128.0;
	float d = max( dot( dx, dx ), dot( dy, dy ) );
	d = pow( d, 0.5);
	// Clamp the value to the max mip level counts. hard coded to 6 mips
	d = clamp(d, 1.0, cubeUV_rangeClamp);
	float mipLevel = 0.5 * log2(d);
	return vec2(floor(mipLevel), fract(mipLevel));
}

#define cubeUV_rcpTextureSize (1.0 / cubeUV_textureSize)

vec2 getCubeUV(vec3 direction, float roughnessLevel) {
	float a = 8.0 * cubeUV_rcpTextureSize;

	float exp2_roughness = exp2( roughnessLevel );
	float rcp_exp2_roughness = 1.0 / exp2_roughness;
	float powScale = exp2_roughness;
	float scale = rcp_exp2_roughness * 0.25;

	vec3 r;
	vec2 offset;
	int face = getFaceFromDirection(direction);

	float rcpPowScale = 1.0 / powScale;

	if( face == 0) {
		r = vec3(direction.x, -direction.z, direction.y);
		offset = vec2(0.0,0.75 * rcpPowScale);
	}
	else if( face == 1) {
		r = vec3(direction.y, direction.x, direction.z);
		offset = vec2(scale, 0.75 * rcpPowScale);
	}
	else if( face == 2) {
		r = vec3(direction.z, direction.x, direction.y);
		offset = vec2(2.0*scale, 0.75 * rcpPowScale);
	}
	else if( face == 3) {
		r = vec3(direction.x, direction.z, direction.y);
		offset = vec2(0.0,0.5 * rcpPowScale);
	}
	else if( face == 4) {
		r = vec3(direction.y, direction.x, -direction.z);
		offset = vec2(scale, 0.5 * rcpPowScale);
	}
	else {
		r = vec3(direction.z, -direction.x, direction.y);
		offset = vec2(2.0*scale, 0.5 * rcpPowScale);
	}
	r = normalize(r);
	float texelOffset = 0.5 * cubeUV_rcpTextureSize;
	vec2 s = ( r.yz / abs( r.x ) + vec2( 1.0 ) ) * 0.5;
	vec2 base = offset + vec2( texelOffset );
	return base + s * ( scale - 2.0 * texelOffset );
}

#define cubeUV_maxLods3 (log2(cubeUV_textureSize*0.25) - 3.0)

vec4 textureCubeUV(vec3 reflectedDirection, float roughnessVal ) {
	float r1 = floor(roughnessVal);
	float r2 = r1 + 1.0;
	vec2 mipInfo = MipLevelInfo(reflectedDirection);
	float s = mipInfo.y;

	// round to nearest mipmap if we are not interpolating.
	r1 += mipInfo.x;
	r2 = r1 + 1.0;
	r1 = min( r1, cubeUV_maxLods3);
	r2 = min( r2, cubeUV_maxLods3);

	// Tri linear interpolation.
	vec2 uv_10 = getCubeUV(reflectedDirection, r1);
	vec4 color10 = envMapTexelToLinear(texture2D(envMap, uv_10));

	vec2 uv_20 = getCubeUV(reflectedDirection, r2);
	vec4 color20 = envMapTexelToLinear(texture2D(envMap, uv_20));

	vec4 result = mix(color10, color20, s);

	/*const vec4 red = vec4(1.0, 0.0, 0.0, 1.0);
	const vec4 green = vec4(0.0, 1.0, 0.0, 1.0);
	const vec4 blue = vec4(0.0, 0.0, 1.0, 1.0);
	const vec4 yellow = vec4(1.0, 1.0, 0.0, 1.0);
	const vec4 pink = vec4(1.0, 0.0, 1.0, 1.0);
	const vec4 black = vec4(0.0, 0.0, 0.0, 1.0);

	if( r1 == 0.0 )
		return mix(red, green, s);
	else if( r1 == 1.0 )
		return mix(green, blue, s);
	else if( r1 == 2.0 )
		return mix(blue, yellow, s);
	else if( r1 == 3.0 )
		return mix(yellow, pink, s);
	else if( r1 == 4.0 )
		return mix(pink, black, s);
	else
		return vec4(0.0, 0.0, 0.0, 1.0);*/
	//return vec4(vec3(r1), 1.0);
	return vec4(result.rgb, 1.0);
}

#endif
