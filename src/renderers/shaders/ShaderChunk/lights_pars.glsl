uniform vec3 ambientLightColor;

struct AABB {
	vec3 min;
	vec3 max;
};
const float roomlength = 100.0;
const float platformWidth = 25.0;
const float platformHeight = 30.0;
const AABB proxy1 = AABB(vec3(-75.0, 0.0, -roomlength * 0.5), vec3(75.0, platformHeight, -roomlength * 0.5 + platformWidth));
const AABB proxy2 = AABB(vec3(-75.0, 0.0, roomlength * 0.5 - platformWidth), vec3(75.0, platformHeight, roomlength * 0.5));
const AABB probeAABB1 = AABB(vec3(-75.0, 0.0, -50.0), vec3(75.0, 100.0, 50.0));

const vec3 probe1Pos = vec3(0.0, 15.0, 0.0);
const vec3 probe2Pos = vec3(0.0, 50.0, 0.0);

struct Ray {
    vec3 origin;
    vec3 direction;
    vec3 inv_direction;
};

Ray makeRay(in vec3 origin, in vec3 direction) {
    return Ray(origin, direction, vec3(1.0) / direction);
}

bool intersection(const in AABB aabb, const in Ray r, inout vec3 hitPoint) {
    float tx1 = (aabb.min.x - r.origin.x)*r.inv_direction.x;
    float tx2 = (aabb.max.x - r.origin.x)*r.inv_direction.x;

    float tmin = min(tx1, tx2);
    float tmax = max(tx1, tx2);

    float ty1 = (aabb.min.y - r.origin.y) * r.inv_direction.y;
    float ty2 = (aabb.max.y - r.origin.y) * r.inv_direction.y;

    tmin = max(tmin, min(ty1, ty2));
    tmax = min(tmax, max(ty1, ty2));

		float tz1 = (aabb.min.z - r.origin.z) * r.inv_direction.z;
    float tz2 = (aabb.max.z - r.origin.z) * r.inv_direction.z;

    tmin = max(tmin, min(tz1, tz2));
    tmax = min(tmax, max(tz1, tz2));

    if( tmax >= tmin && tmin > 0.0 ) {
			hitPoint = r.origin + tmin * r.direction;
			return true;
		}
		return false;
}

bool closestProbe( const in vec3 position, const in vec3 normal ) {
	vec3 d1 = probe1Pos - position;
	vec3 d2 = probe2Pos - position;
	float dot1 = dot(normal, d1);
	float dot2 = dot(normal, d2);
	return false;
	return dot(d1, d1) < dot(d2, d2) && dot1 > 0.0 && dot2 > 0.0;
}

vec3 cubeMapProject(vec3 nrdir, vec3 vPositionW, inout float distance, inout vec3 hitPoint ) {
		const float epsilon = 0.01;
		Ray ray = makeRay(vPositionW, nrdir);
		vec3 p1 = vec3(100000.0, 100000.0, 100000.0);
		vec3 p2 = vec3(100000.0, 100000.0, 100000.0);
		bool bRes1 = intersection(proxy1, ray, p1);
		bool bRes2 = intersection(proxy2, ray, p2);
		hitPoint = vec3(100000.0, 100000.0, 100000.0);

		if(bRes1 || bRes2) {
			vec3 d1 = p1 - vPositionW;
			vec3 d2 = p2 - vPositionW;
			hitPoint = dot(d1, d1) < dot( d2, d2) ? p1 : p2;
			//return vec3(0.0);
		}

    vec3 rbmax = (probeAABB1.max - vPositionW) / nrdir;
    vec3 rbmin = (probeAABB1.min - vPositionW) / nrdir;

    vec3 rbminmax = max(rbmin, rbmax);
    //rbminmax.x = nrdir.x>0.0? rbmax.x : rbmin.x;
    //rbminmax.y = nrdir.y>0.0? rbmax.y : rbmin.y;
    //rbminmax.z = nrdir.z>0.0? rbmax.z : rbmin.z;

    float fa = min(min(rbminmax.x, rbminmax.y), rbminmax.z);

		vec3 d1 = hitPoint - vPositionW;
    vec3 posonbox = vPositionW + nrdir * fa;
		//hitPoint = posonbox;
		vec3 d2 = posonbox - vPositionW;
		hitPoint = dot(d1, d1) < dot( d2, d2) ? hitPoint : posonbox;
		//distance = length(posonbox - vPositionW);

		//vec3 outDir = (posonbox - probe1Pos);

    return vec3(0.0);
}

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
		directLight.direction = normalize( lVector );

		float lightDistance = length( lVector );

		if ( testLightInRange( lightDistance, pointLight.distance ) ) {

			directLight.color = pointLight.color;
			directLight.color *= punctualLightIntensityToIrradianceFactor( lightDistance, pointLight.distance, pointLight.decay );

			directLight.visible = true;

		} else {

			directLight.color = vec3( 0.0 );
			directLight.visible = false;

		}

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
		directLight.direction = normalize( lVector );

		float lightDistance = length( lVector );
		float angleCos = dot( directLight.direction, spotLight.direction );

		if ( all( bvec2( angleCos > spotLight.coneCos, testLightInRange( lightDistance, spotLight.distance ) ) ) ) {

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

		#ifdef DOUBLE_SIDED

			float flipNormal = ( float( gl_FrontFacing ) * 2.0 - 1.0 );

		#else

			float flipNormal = 1.0;

		#endif

		vec3 worldNormal = inverseTransformDirection( geometry.normal, viewMatrix );

		#ifdef ENVMAP_TYPE_CUBE

			vec3 queryVec = flipNormal * vec3( flipEnvMap * worldNormal.x, worldNormal.yz );

			// TODO: replace with properly filtered cubemaps and access the irradiance LOD level, be it the last LOD level
			// of a specular cubemap, or just the default level of a specially created irradiance cubemap.

			#ifdef TEXTURE_LOD_EXT

				vec4 envMapColor = textureCubeLodEXT( envMap, queryVec, float( maxMIPLevel ) );

			#else

				// force the bias high to get the last LOD level as it is the most blurred.
				vec4 envMapColor = textureCube( envMap, queryVec, float( maxMIPLevel ) );

			#endif

			envMapColor.rgb = envMapTexelToLinear( envMapColor ).rgb;

		#elif defined( ENVMAP_TYPE_CUBE_UV )
			float distance = 0.0;
			vec3 hitPoint;
			worldNormal = cubeMapProject(worldNormal, vertexWorldPosition, distance, hitPoint);
			vec3 queryVec = flipNormal * vec3( flipEnvMap * worldNormal.x, worldNormal.yz );
			vec4 envMapColor = textureCubeUV( envMapProbe1, queryVec, 1.0 );

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

	vec3 getLightProbeIndirectRadiance( /*const in SpecularLightProbe specularLightProbe,*/ const in GeometricContext geometry, const in float blinnShininessExponent, const in int maxMIPLevel ) {

		#ifdef ENVMAP_MODE_REFLECTION

			vec3 reflectVec = reflect( -geometry.viewDir, geometry.normal );

		#else

			vec3 reflectVec = refract( -geometry.viewDir, geometry.normal, refractionRatio );

		#endif

		#ifdef DOUBLE_SIDED

			float flipNormal = ( float( gl_FrontFacing ) * 2.0 - 1.0 );

		#else

			float flipNormal = 1.0;

		#endif

		reflectVec = inverseTransformDirection( reflectVec, viewMatrix );

		float specularMIPLevel = getSpecularMIPLevel( blinnShininessExponent, maxMIPLevel );

		#ifdef ENVMAP_TYPE_CUBE

			vec3 queryReflectVec = flipNormal * vec3( flipEnvMap * reflectVec.x, reflectVec.yz );

			#ifdef TEXTURE_LOD_EXT

				vec4 envMapColor = textureCubeLodEXT( envMap, queryReflectVec, specularMIPLevel );

			#else

				vec4 envMapColor = textureCube( envMap, queryReflectVec, specularMIPLevel );

			#endif

			envMapColor.rgb = envMapTexelToLinear( envMapColor ).rgb;

		#elif defined( ENVMAP_TYPE_CUBE_UV )
			float distance = 0.0;
			vec3 hitPoint;
			vec3 worldNormal = inverseTransformDirection( geometry.normal, viewMatrix );

			cubeMapProject(reflectVec, vertexWorldPosition, distance, hitPoint);
			float baseRoughness = BlinnExponentToGGXRoughness(blinnShininessExponent);

			vec4 envMapColor;

			if( closestProbe( hitPoint, worldNormal ) ) {
			  reflectVec = normalize( hitPoint - probe1Pos );
				float distanceFn = length(hitPoint - vertexWorldPosition)/20.0;
				float newRoughness = clamp(baseRoughness * distanceFn, 0.0, baseRoughness);
				newRoughness = mix(newRoughness, baseRoughness, baseRoughness);
				vec3 queryReflectVec = flipNormal * vec3( flipEnvMap * reflectVec.x, reflectVec.yz );
				envMapColor = textureCubeUV(envMap, queryReflectVec, baseRoughness);
			}
			else {
			  reflectVec = normalize( hitPoint - probe2Pos );
				float distanceFn = length(hitPoint - vertexWorldPosition)/100.0;
				float newRoughness = clamp(baseRoughness * distanceFn, 0.0, baseRoughness);
				newRoughness = mix(newRoughness, baseRoughness, baseRoughness);
				vec3 queryReflectVec = flipNormal * vec3( flipEnvMap * reflectVec.x, reflectVec.yz );
				envMapColor = textureCubeUV(envMapProbe1, queryReflectVec, baseRoughness * distanceFn);
			}

		#elif defined( ENVMAP_TYPE_EQUIREC )

			vec2 sampleUV;
			sampleUV.y = saturate( flipNormal * reflectVec.y * 0.5 + 0.5 );
			sampleUV.x = atan( flipNormal * reflectVec.z, flipNormal * reflectVec.x ) * RECIPROCAL_PI2 + 0.5;

			#ifdef TEXTURE_LOD_EXT

				vec4 envMapColor = texture2DLodEXT( envMap, sampleUV, specularMIPLevel );

			#else

				vec4 envMapColor = texture2D( envMap, sampleUV, specularMIPLevel );

			#endif

			envMapColor.rgb = envMapTexelToLinear( envMapColor ).rgb;

		#elif defined( ENVMAP_TYPE_SPHERE )

			vec3 reflectView = flipNormal * normalize((viewMatrix * vec4( reflectVec, 0.0 )).xyz + vec3(0.0,0.0,1.0));

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
