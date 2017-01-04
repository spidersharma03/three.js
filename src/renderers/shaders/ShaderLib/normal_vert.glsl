#define NORMAL

#if defined( FLAT_SHADED  ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP )

	#if ! defined( VARYING_VVIEWPOSITION )
   		varying vec3 vViewPosition;
   		#define VARYING_VVIEWPOSITION 1
   #endif

#endif

#ifndef FLAT_SHADED

	varying vec3 vNormal;

#endif

#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
	
void main() {

	#include <uv_vertex>

	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>

#ifndef FLAT_SHADED // Normal computed with derivatives when FLAT_SHADED

	vNormal = normalize( transformedNormal );

#endif

	#include <begin_vertex>
	#include <displacementmap_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>

#if defined( FLAT_SHADED  ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP )

	vViewPosition = - mvPosition.xyz;

#endif

}
