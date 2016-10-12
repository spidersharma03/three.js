#ifdef USE_FALLOFFMAP

#if defined( TEXTURE_SLOTS )
	vec2 falloffMapUv = falloffMapUV();
#else
	vec2 falloffMapUv = vUv;
#endif

	vec4 falloffTexelColor = texture2D( falloffMap, falloffMapUv );

	falloffTexelColor = falloffMapTexelTransform( falloffMapTexelToLinear( falloffTexelColor ) );
	falloffDiffuseColor *= falloffTexelColor;

#endif
