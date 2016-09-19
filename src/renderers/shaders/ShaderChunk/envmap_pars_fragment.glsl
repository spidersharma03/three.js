#if defined( USE_ENVMAP ) || defined( PHYSICAL )
	uniform float reflectivity;
	uniform float envMapIntenstiy;
#endif

#ifdef USE_ENVMAP

	#if ! defined( PHYSICAL ) && ( defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) )
		varying vec3 vWorldPosition;
	#endif

	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
		uniform sampler2D envMapProbe1;
		uniform sampler2D envMapProbe2;
		uniform sampler2D envMapProbe3;
	#endif
	uniform float flipEnvMap;

	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( PHYSICAL )
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif

#endif
