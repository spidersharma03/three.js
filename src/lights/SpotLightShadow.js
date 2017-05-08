import { LightShadow } from './LightShadow';
import { _Math } from '../math/Math';
import { PerspectiveCamera } from '../cameras/PerspectiveCamera';
import { Vector3 } from '../math/Vector3';

/**
 * @author mrdoob / http://mrdoob.com/
 */

function SpotLightShadow() {

	LightShadow.call( this, new PerspectiveCamera() );

}

SpotLightShadow.prototype = Object.assign( Object.create( LightShadow.prototype ), {

	constructor: SpotLightShadow,

	isSpotLightShadow: true,

	update: function ( light ) {

		var fov = _Math.RAD2DEG * 2 * light.angle;
		var aspect = this.mapSize.width / this.mapSize.height;
		var far = light.distance || 500;

		var camera = this.camera;

		camera.fov = fov;
		camera.aspect = aspect;
		camera.far = far;
		camera.updateProjectionMatrix();

	}

} );

export { SpotLightShadow };
