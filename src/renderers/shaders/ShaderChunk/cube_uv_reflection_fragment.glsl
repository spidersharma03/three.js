#ifdef ENVMAP_TYPE_CUBE_UV


int getFaceIndexAndUvFromDirection(vec3 direction, out vec2 faceUv) {
	vec3 absDirection = abs(direction); 

	int faceIndex = -1;
	vec3 faceDirection;
	
	if( absDirection.x > absDirection.z ) {
		if(absDirection.x > absDirection.y ) {
			if( direction.x > 0.0 ) {
				faceIndex = 0;
				faceDirection = vec3(direction.x, -direction.z, direction.y);	
			}
			else {
				faceIndex = 3;
				faceDirection = vec3(direction.x, direction.z, direction.y);
			}
		}
		else {
			if( direction.y > 0.0 ) {
				faceIndex = 1;
				faceDirection = vec3(direction.y, direction.x, direction.z);		
			}
			else {
				faceIndex = 4;
				faceDirection = vec3(direction.y, direction.x, -direction.z);
			}
		}
	}
	else {
		if(absDirection.z > absDirection.y ) {
			if( direction.z > 0.0 ) {
				faceIndex = 2;
				faceDirection = vec3(direction.z, direction.x, direction.y);
			}
			else {
				faceIndex = 5;
				faceDirection = vec3(direction.z, -direction.x, direction.y);
			}
		}
		else {
			if( direction.y > 0.0 ) {
				faceIndex = 1;
				faceDirection = vec3(direction.y, direction.x, direction.z);		
			}
			else {
				faceIndex = 4;
				faceDirection = vec3(direction.y, direction.x, -direction.z);
			}
		}
	}

	faceDirection = normalize( faceDirection );
	faceUv = ( faceDirection.yz / abs( faceDirection.x ) + vec2( 1.0 ) ) * 0.5;

	return faceIndex;
}

vec2 getCubeUV2(vec3 direction, float roughnessLevel) {
	vec2 faceUv;
	int faceIndex = getFaceIndexAndUvFromDirection(direction, faceUv);

	// adjust faceUv to fit within a cube face, rather than extending beyond the edge:
	faceUv = ( ( faceUv * 255.0 + 0.5 ) / 1024.0 );

	// resolve faceIndex to a particular map
	vec2 faceOffset = vec2( 0.25 * float( faceIndex ), 0.25 );	
	if( faceIndex >= 3 ) { // adjust to second row
		faceOffset += vec2( -0.75, -0.25 );
	}

	// origin of the cube
	vec2 cubeOffset = vec2( 0.0, 0.5 );

	// which set of maps to use.
	float cubeScale = pow( 0.5, roughnessLevel );

	return ( cubeOffset + faceOffset + faceUv ) * cubeScale;
}

#define cubeUV_textureSize (1024.0)
#define cubeUV_maxLods3 (log2(cubeUV_textureSize*0.25) - 3.0)

vec4 textureCubeUV(vec3 reflectedDirection, float roughness ) {
	float roughnessVal = roughness * cubeUV_maxLods3;
	float r1 = floor(roughnessVal);
	float r2 = r1 + 1.0;
	float t = fract(roughnessVal);

	// Tri linear interpolation.
	vec2 uv_10 = getCubeUV2(reflectedDirection, r1);
	vec4 color10 = envMapTexelToLinear(texture2D(envMap, uv_10));

	vec2 uv_20 = getCubeUV2(reflectedDirection, r2);
	vec4 color20 = envMapTexelToLinear(texture2D(envMap, uv_20));

	vec4 result = mix(color10, color20, t);

	return vec4(result.rgb, 1.0);
}

#endif
