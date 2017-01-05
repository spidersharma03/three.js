#if NUM_CLIPPING_PLANES > 0

	#if ! defined( VARYING_VVIEWPOSITION )
		varying vec3 vViewPosition;
		#define VARYING_VVIEWPOSITION 1
	#endif

	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];

#endif
