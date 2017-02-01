float roughnessFactor = roughness;

#ifdef USE_ROUGHNESSMAP

	#if defined( TEXTURE_SLOTS )
		vec2 roughnessUv = roughnessMapUV();
	#else
		vec2 roughnessUv = vUv;
	#endif

	vec4 texelRoughness = roughnessMapTexelTransform( texture2D( roughnessMap, roughnessUv ) );

	// reads channel G, intended to be used with a combined OcclusionRoughnessMetallic (RGB) texture
	roughnessFactor *= texelRoughness.g;

#endif
