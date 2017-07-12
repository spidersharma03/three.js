uniform vec3 ambientLightColor;

vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {

	vec3 irradiance = ambientLightColor;

	#ifndef PHYSICALLY_CORRECT_LIGHTS

		irradiance *= PI;

	#endif

	return irradiance;

}

#if NUM_DIR_LIGHTS > 0

	struct DirectionalLight {
		vec3 direction;
		vec3 color;

		int shadow;
		float shadowBias;
		float spreadAngle;
		vec2 shadowMapSize;
		vec3 shadowCameraParams;
	};

	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];

	void getDirectionalDirectLightIrradiance( const in DirectionalLight directionalLight, const in GeometricContext geometry, out IncidentLight directLight ) {

		directLight.color = directionalLight.color;
		directLight.direction = directionalLight.direction;
		directLight.visible = true;

	}

#endif


#if NUM_POINT_LIGHTS > 0

	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;

		int shadow;
		float shadowBias;
		float shadowRadius;
		vec2 shadowMapSize;
	};

	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];

	// directLight is an out parameter as having it as a return value caused compiler errors on some devices
	void getPointDirectLightIrradiance( const in PointLight pointLight, const in GeometricContext geometry, out IncidentLight directLight ) {

		vec3 lVector = pointLight.position - geometry.position;
		float lightDistance = length( lVector );
		directLight.direction = lVector / lightDistance;


		directLight.color = pointLight.color;
		directLight.color *= punctualLightIntensityToIrradianceFactor( lightDistance, pointLight.distance, pointLight.decay );
		directLight.visible = ( directLight.color != vec3( 0.0 ) );

	}

#endif


#if NUM_SPOT_LIGHTS > 0

	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;

		int shadow;
		float shadowBias;
		float shadowRadius;
		vec2 shadowMapSize;
		vec3 shadowCameraParams;
	};

	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];

	// directLight is an out parameter as having it as a return value caused compiler errors on some devices
	void getSpotDirectLightIrradiance( const in SpotLight spotLight, const in GeometricContext geometry, out IncidentLight directLight  ) {

		vec3 lVector = spotLight.position - geometry.position;
		float lightDistance = length( lVector );
		directLight.direction = lVector / lightDistance;

		float angleCos = dot( directLight.direction, spotLight.direction );

		if ( angleCos > spotLight.coneCos ) {

			float spotEffect = smoothstep( spotLight.coneCos, spotLight.penumbraCos, angleCos );

			directLight.color = spotLight.color;
			directLight.color *= spotEffect * punctualLightIntensityToIrradianceFactor( lightDistance, spotLight.distance, spotLight.decay );
			directLight.visible = true;

		} else {

			directLight.color = vec3( 0.0 );
			directLight.visible = false;

		}
	}

#endif


#if NUM_RECT_AREA_LIGHTS > 0

	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};

	// Pre-computed values of LinearTransformedCosine approximation of BRDF
	// BRDF approximation Texture is 64x64
	uniform sampler2D ltcMat; // RGBA Float
	uniform sampler2D ltcMag; // Alpha Float (only has w component)

	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];

#endif


#if NUM_HEMI_LIGHTS > 0

	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};

	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];

	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in GeometricContext geometry ) {

		float dotNL = dot( geometry.normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;

		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );

		#ifndef PHYSICALLY_CORRECT_LIGHTS

			irradiance *= PI;

		#endif

		return irradiance;

	}

#endif


#if defined( USE_ENVMAP ) && defined( PHYSICAL )

	vec3 getLightProbeIndirectIrradiance( /*const in SpecularLightProbe specularLightProbe,*/ const in GeometricContext geometry, const in int maxMIPLevel ) {

		vec3 worldNormal = inverseTransformDirection( geometry.normal, viewMatrix );

		#ifdef ENVMAP_TYPE_CUBE

			vec3 queryVec = vec3( flipEnvMap * worldNormal.x, worldNormal.yz );

			// TODO: replace with properly filtered cubemaps and access the irradiance LOD level, be it the last LOD level
			// of a specular cubemap, or just the default level of a specially created irradiance cubemap.

			#ifdef TEXTURE_LOD_EXT

				vec4 envMapColor = textureCubeLodEXT( envMap, vec3(-queryVec.x, queryVec.y, queryVec.z), float( 5 ) );

			#else

				// force the bias high to get the last LOD level as it is the most blurred.
				vec4 envMapColor = textureCube( envMap, queryVec, float( maxMIPLevel ) );

			#endif

			envMapColor.rgb = envMapTexelToLinear( envMapColor ).rgb;

		#elif defined( ENVMAP_TYPE_CUBE_UV )

			vec3 queryVec = vec3( flipEnvMap * worldNormal.x, worldNormal.yz );
			vec4 envMapColor = textureCubeUV( queryVec, queryVec, 5.0 );

		#else

			vec4 envMapColor = vec4( 0.0 );

		#endif

		return PI * envMapColor.rgb * envMapIntensity;

	}

	// taken from here: http://casual-effects.blogspot.ca/2011/08/plausible-environment-lighting-in-two.html
	float getSpecularMIPLevel( const in float blinnShininessExponent, const in int maxMIPLevel ) {

		//float envMapWidth = pow( 2.0, maxMIPLevelScalar );
		//float desiredMIPLevel = log2( envMapWidth * sqrt( 3.0 ) ) - 0.5 * log2( pow2( blinnShininessExponent ) + 1.0 );

		float maxMIPLevelScalar = float( maxMIPLevel );
		float desiredMIPLevel = maxMIPLevelScalar - 0.79248 - 0.5 * log2( pow2( blinnShininessExponent ) + 1.0 );

		// clamp to allowable LOD ranges.
		return clamp( desiredMIPLevel, 0.0, maxMIPLevelScalar );

	}

#if !defined( ENVMAP_TYPE_CUBE_UV )

	#define CubeTextureSize (256.0)
	#define cubeUV_maxLods2 (log2(CubeTextureSize) - 2.0)
	#define cubeUV_maxLods3 (log2(CubeTextureSize) - 3.0)
	#define cubeUV_rangeClamp (exp2((cubeUV_maxLods2 - 1.0) * 2.0))

	vec2 getUVFromDirection(vec3 direction) {
		vec3 absDirection = abs(direction);
		vec3 r;
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
		if( face == 0) {
			r = vec3(direction.x, -direction.z, direction.y);
		}
		else if( face == 1) {
			r = vec3(direction.y, direction.x, direction.z);
		}
		else if( face == 2) {
			r = vec3(direction.z, direction.x, direction.y);
		}
		else if( face == 3) {
			r = vec3(direction.x, direction.z, direction.y);
		}
		else if( face == 4) {
			r = vec3(direction.y, direction.x, -direction.z);
		}
		else {
			r = vec3(direction.z, -direction.x, direction.y);
		}
		//r = normalize(r);
		vec2 s = ( r.yz / abs( r.x ) + vec2( 1.0 ) ) * 0.5;
		return s;
	}

	vec2 MipLevelInfo( vec3 vec ) {
		const float scaleFactor = CubeTextureSize/8.0;
		//vec2 uv = getUVFromDirection( vec );
		vec3 dx = dFdx( vec ) * scaleFactor;
		vec3 dy = dFdy( vec ) * scaleFactor;
		float d = max( dot( dx, dx ), dot( dy, dy ) );
		// Clamp the value to the max mip level counts. hard coded to 6 mips
		d = max(d, 1.0);
		float mipLevel = 0.5 * log2(d);
		return vec2(floor(mipLevel), fract(mipLevel));
	}

#endif

	vec3 getLightProbeIndirectRadiance( /*const in SpecularLightProbe specularLightProbe,*/ const in GeometricContext geometry, const in float blinnShininessExponent, const in int maxMIPLevel ) {

		#ifdef ENVMAP_MODE_REFLECTION

			vec3 reflectVec = reflect( -geometry.viewDir, geometry.normal );

		#else

			vec3 reflectVec = refract( -geometry.viewDir, geometry.normal, refractionRatio );

		#endif

		reflectVec = inverseTransformDirection( reflectVec, viewMatrix );

		#ifdef ENVMAP_TYPE_CUBE

			vec3 queryReflectVec = vec3( flipEnvMap * reflectVec.x, reflectVec.yz );

			#ifdef TEXTURE_LOD_EXT

				float specularMIPLevel = getSpecularMIPLevel( blinnShininessExponent, 5 );

				queryReflectVec.x *= -1.0;

				float roughness = BlinnExponentToGGXRoughness( blinnShininessExponent );
				vec2 mipInfo = MipLevelInfo(queryReflectVec);
				float r1 = floor(specularMIPLevel + mipInfo.x);
				float r2 = r1 + 1.0;
				r1 = min( r1, cubeUV_maxLods3);
				r2 = min( r2, cubeUV_maxLods3);

				const vec4 c1 = vec4(1.0, 0.0, 0.0, 1.0);
				const vec4 c2 = vec4(0.0, 0.0, 1.0, 1.0);
				const vec4 c3 = vec4(0.0, 1.0, 0.0, 1.0);
				const vec4 c4 = vec4(1.0, 1.0, 0.0, 1.0);
				const vec4 c5 = vec4(1.0, 0.0, 1.0, 1.0);
				const vec4 c6 = vec4(0.0, 0.0, 0.0, 1.0);

				vec4 envMapColor = vec4(0.0);

				if( r1 <= 1.0 )
					envMapColor = mix(c1, c2, mipInfo.y);
				else if( r1 > 1.0 && r1 <= 2.0 )
					envMapColor = mix(c2, c3, mipInfo.y);
				else if( r1 > 2.0 && r1 <= 3.0 )
					envMapColor = mix(c3, c4, mipInfo.y);
				else if( r1 > 3.0 && r1 <= 4.0 )
					envMapColor = mix(c4, c5, mipInfo.y);
				else if( r1 > 4.0 && r1 <= 5.0 )
					envMapColor = mix(c5, c6, mipInfo.y);
				else
					envMapColor = vec4(0.0, 0.0, 0.0, 1.0);

				vec4 envMapColor1 = textureCubeLodEXT( envMap, queryReflectVec, r1 );
				vec4 envMapColor2 = textureCubeLodEXT( envMap, queryReflectVec, r2 );
			  envMapColor = mix( envMapColor1, envMapColor2, mipInfo.y );

			#else

				float specularMIPLevel = getSpecularMIPLevel( blinnShininessExponent, maxMIPLevel );

				vec4 envMapColor = textureCube( envMap, queryReflectVec, specularMIPLevel );

			#endif

			envMapColor.rgb = envMapTexelToLinear( envMapColor ).rgb;

		#elif defined( ENVMAP_TYPE_CUBE_UV )
			vec3 worldNormal = inverseTransformDirection( geometry.normal, viewMatrix );
			vec3 queryReflectVec = vec3( flipEnvMap * reflectVec.x, reflectVec.yz );
			float specularMIPLevel = getSpecularMIPLevel( blinnShininessExponent, 5 );// 5 is hard coded for cube texture size of 256.
			vec4 envMapColor = textureCubeUV(queryReflectVec, specularMIPLevel);

		#elif defined( ENVMAP_TYPE_EQUIREC )

			vec2 sampleUV;
			sampleUV.y = saturate( reflectVec.y * 0.5 + 0.5 );
			sampleUV.x = atan( reflectVec.z, reflectVec.x ) * RECIPROCAL_PI2 + 0.5;

			#ifdef TEXTURE_LOD_EXT

				vec4 envMapColor = texture2DLodEXT( envMap, sampleUV, specularMIPLevel );

			#else

				vec4 envMapColor = texture2D( envMap, sampleUV, specularMIPLevel );

			#endif

			envMapColor.rgb = envMapTexelToLinear( envMapColor ).rgb;

		#elif defined( ENVMAP_TYPE_SPHERE )

			vec3 reflectView = normalize( ( viewMatrix * vec4( reflectVec, 0.0 ) ).xyz + vec3( 0.0,0.0,1.0 ) );

			#ifdef TEXTURE_LOD_EXT

				vec4 envMapColor = texture2DLodEXT( envMap, reflectView.xy * 0.5 + 0.5, specularMIPLevel );

			#else

				vec4 envMapColor = texture2D( envMap, reflectView.xy * 0.5 + 0.5, specularMIPLevel );

			#endif

			envMapColor.rgb = envMapTexelToLinear( envMapColor ).rgb;

		#endif

		return envMapColor.rgb * envMapIntensity;

	}

#endif
