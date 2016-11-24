import { LightShadow } from './LightShadow';
import { _Math } from '../math/Math';
import { PerspectiveCamera } from '../cameras/PerspectiveCamera';
import { Vector3 } from '../math/Vector3';

/**
 * @author mrdoob / http://mrdoob.com/
 */

function SpotLightShadow() {

	var fov = 50;
	this.cameraParams = new Vector3( fov, 10.5, 1000 );
	LightShadow.call( this, new PerspectiveCamera( this.cameraParams.x, 1, this.cameraParams.y, this.cameraParams.z ) );

}

SpotLightShadow.prototype = Object.assign( Object.create( LightShadow.prototype ), {

	constructor: SpotLightShadow,

	isSpotLightShadow: true,

	update: function ( light ) {

		var fov = _Math.RAD2DEG * 2 * light.angle;
		var aspect = this.mapSize.width / this.mapSize.height;
		var far = light.distance || 500;

		var camera = this.camera;

		this.cameraParams.x = fov * _Math.DEG2RAD;
		this.cameraParams.y = light.shadow.camera.near;
		this.cameraParams.z = far;

		camera.fov = fov;
		camera.aspect = aspect;
		camera.far = far;
		camera.updateProjectionMatrix();

	}

} );

export { SpotLightShadow };
