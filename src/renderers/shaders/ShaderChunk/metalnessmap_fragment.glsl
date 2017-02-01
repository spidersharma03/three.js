float metalnessFactor = metalness;

#ifdef USE_METALNESSMAP

	#if defined( TEXTURE_SLOTS )
		vec2 metalnessUv = metalnessMapUV();
	#else
		vec2 metalnessUv = vUv;
	#endif

	vec4 texelMetalness = metalnessMapTexelTransform( texture2D( metalnessMap, metalnessUv ) );

	// reads channel B, intended to be used with a combined OcclusionRoughnessMetallic (RGB) texture
	metalnessFactor *= texelMetalness.b;

#endif
