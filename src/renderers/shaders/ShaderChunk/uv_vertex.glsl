#if defined( USE_MAP ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( USE_SPECULARMAP ) || defined( USE_ALPHAMAP ) || defined( USE_EMISSIVEMAP ) || defined( USE_ROUGHNESSMAP ) || defined( USE_METALNESSMAP ) || defined( USE_FALLOFFMAP ) || defined( USE_FALLOFFALPHAMAP )

	vUv = uv * offsetRepeat.zw + offsetRepeat.xy;

#endif