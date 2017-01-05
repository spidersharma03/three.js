#if NUM_CLIPPING_PLANES > 0 && ! defined( PHYSICAL ) && ! defined( PHONG )
	#if ! defined( VARYING_VVIEWPOSITION )
    	varying vec3 vViewPosition;
    	#define VARYING_VVIEWPOSITION 1
    #endif
#endif
