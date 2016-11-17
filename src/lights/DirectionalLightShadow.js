import { LightShadow } from './LightShadow';
import { OrthographicCamera } from '../cameras/OrthographicCamera';
import { Vector3 } from '../math/Vector3';

/**
 * @author mrdoob / http://mrdoob.com/
 * @author bhouston / http://clara.io
 */

function DirectionalLightShadow( light ) {

	var frustrumWidth = 300;
	this.spreadAngle = 0.0;
	this.cameraParams = new Vector3( 2*frustrumWidth, 0.5, 1000 );
	LightShadow.call( this, new OrthographicCamera( - frustrumWidth, frustrumWidth, frustrumWidth, - frustrumWidth, this.cameraParams.y, this.cameraParams.z ) );

}

DirectionalLightShadow.prototype = Object.assign( Object.create( LightShadow.prototype ), {

	constructor: DirectionalLightShadow

} );

DirectionalLightShadow.prototype.update = function ( light ) {

	var camera = this.camera;
	var frustrumWidth = Math.abs(camera.left - camera.right);
	if ( this.cameraParams.x !== frustrumWidth || this.cameraParams.y !== camera.near || this.cameraParams.z !== camera.far ) {

		this.cameraParams.x = frustrumWidth;
		this.cameraParams.y = camera.near;
		this.cameraParams.z = camera.far;
	}

};

export { DirectionalLightShadow };
