varying vec3 vWorldPosition;

#include <common>
#include <clipping_planes_pars_vertex>

#if NUM_CLIPPING_PLANES == 0
 	varying vec3 vViewPosition;
#endif

void main() {

	vWorldPosition = transformDirection( position, modelMatrix );

	#include <begin_vertex>
	#include <project_vertex>
	#include <clipping_planes_vertex>

	vViewPosition = - mvPosition.xyz;

}
