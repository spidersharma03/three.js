#ifdef USE_FALLOFFALPHAMAP

#if defined( TEXTURE_SLOTS )
	vec2 falloffAlphaUv = falloffAlphaMapUV();
#else
	vec2 falloffAlphaUv = vUv;
#endif

	falloffDiffuseColor.a *= falloffAlphaMapTexelTransform( texture2D( falloffAlphaMap, falloffAlphaUv ) ).g;

#endif
