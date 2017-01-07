#define NORMAL

uniform float opacity;

#if defined( FLAT_SHADED  ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP )

	#if ! defined( VARYING_VVIEWPOSITION )
		varying vec3 vViewPosition;
		#define VARYING_VVIEWPOSITION 1
	#endif

#endif

#ifndef FLAT_SHADED

	varying vec3 vNormal;

#endif

#include <packing>
#include <uv_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	#include <clipping_planes_fragment>
	#include <normal_flip>
	#include <normal_fragment>

   	gl_FragColor = vec4( packNormalToRGB( vNormal * flipNormal ), opacity );

	#include <logdepthbuf_fragment>

}
