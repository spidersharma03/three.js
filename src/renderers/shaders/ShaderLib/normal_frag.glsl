#define NORMAL

uniform float opacity;

#if defined( FLAT_SHADED  ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP )

	varying vec3 vViewPosition;

#endif

#ifndef FLAT_SHADED

	varying vec3 vNormal;

#endif

#include <packing>
#include <uv_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>

void main() {

	#include <clipping_planes_fragment>
	#include <normal_flip>

   	gl_FragColor = vec4( packNormalToRGB( vNormal * flipNormal ), opacity );

	#include <logdepthbuf_fragment>
	#include <normal_fragment>

	#include <premultiplied_alpha_fragment>
	#include <encodings_fragment>

}
