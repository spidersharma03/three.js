//
// This is a template that can be used to light a material, it uses pluggable RenderEquations (RE)
//   for specific lighting scenarios.
//
// Instructions for use:
//  - Ensure that both RE_Direct, RE_IndirectDiffuse and RE_IndirectSpecular are defined
//  - If you have defined an RE_IndirectSpecular, you need to also provide a Material_LightProbeLOD. <---- ???
//  - Create a material parameter that is to be passed as the third parameter to your lighting functions.
//
// TODO:
//  - Add area light support.
//  - Add sphere light support.
//  - Add diffuse light probe (irradiance cubemap) support.
//

GeometricContext geometry;

geometry.position = - vViewPosition;
geometry.worldPosition = - vViewPosition;
geometry.normal = normal;
geometry.viewDir = normalize( vViewPosition );

IncidentLight directLight;

#ifdef USE_SHADOWMAP
	initShadows();
#endif

#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )

	PointLight pointLight;

	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {

		pointLight = pointLights[ i ];

		getPointDirectLightIrradiance( pointLight, geometry, directLight );

		#ifdef USE_SHADOWMAP
		directLight.color *= all( bvec2( pointLight.shadow, directLight.visible ) ) ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ] ) : 1.0;
		#endif

		RE_Direct( directLight, geometry, material, reflectedLight );

	}

#endif

#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )

	SpotLight spotLight;

	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {

		spotLight = spotLights[ i ];

		getSpotDirectLightIrradiance( spotLight, geometry, directLight );

		#if defined( USE_ENVMAP )
			float aoValue = 1.0 - min(texture2D( envMapProbe2, gl_FragCoord.xy/vec2(1280.0, 647.0)).r, 1.0);
			float shadowValue = unpackRGBAToDepth(texture2D( envMapProbe1, gl_FragCoord.xy/vec2(1280.0, 647.0)));
			directLight.color = vec3(shadowValue);
		#endif

		#ifdef USE_SHADOWMAP
		directLight.color *= all( bvec2( spotLight.shadow, directLight.visible ) ) ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowBias, spotLight.shadowRadius, 0.0, spotLight.shadowCameraParams, vSpotShadowCoord[ i ], 1 ) : 1.0;
		#endif

		RE_Direct( directLight, geometry, material, reflectedLight );

	}

#endif

#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )

	DirectionalLight directionalLight;

	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {

		directionalLight = directionalLights[ i ];

		getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );

		#ifdef USE_SHADOWMAP
		directLight.color *= all( bvec2( directionalLight.shadow, directLight.visible ) ) ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowBias, 0.0, directionalLight.spreadAngle, directionalLight.shadowCameraParams, vDirectionalShadowCoord[ i ], 0 ) : 1.0;
		#endif

		RE_Direct( directLight, geometry, material, reflectedLight );

	}

#endif

#if defined( RE_IndirectDiffuse )

	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );

	#ifdef USE_LIGHTMAP

		vec3 lightMapIrradiance = texture2D( lightMap, vUv2 ).xyz * lightMapIntensity;

		#ifndef PHYSICALLY_CORRECT_LIGHTS

			lightMapIrradiance *= PI; // factor of PI should not be present; included here to prevent breakage

		#endif

		irradiance += lightMapIrradiance;

	#endif

	#if ( NUM_HEMI_LIGHTS > 0 )

		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {

			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry );

		}

	#endif

	#if defined( USE_ENVMAP ) && defined( PHYSICAL ) && defined( ENVMAP_TYPE_CUBE_UV )

		// TODO, replace 8 with the real maxMIPLevel
	 	irradiance += getLightProbeIndirectIrradiance( /*lightProbe,*/ geometry, 8 ) * aoValue;

	#endif

	RE_IndirectDiffuse( irradiance, geometry, material, reflectedLight );

#endif

#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )

	// TODO, replace 8 with the real maxMIPLevel
	vec3 radiance = getLightProbeIndirectRadiance( /*specularLightProbe,*/ geometry, Material_BlinnShininessExponent( material ), 8 ) * aoValue;

	RE_IndirectSpecular( radiance, geometry, material, reflectedLight );

#endif
