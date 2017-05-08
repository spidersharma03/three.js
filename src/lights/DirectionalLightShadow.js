import { LightShadow } from './LightShadow';
import { OrthographicCamera } from '../cameras/OrthographicCamera';
import { Vector3 } from '../math/Vector3';

/**
 * @author mrdoob / http://mrdoob.com/
 * @author bhouston / http://clara.io
 */

function DirectionalLightShadow( ) {

	LightShadow.call( this, new OrthographicCamera() );

	this.spreadAngle = 0.0;

}

DirectionalLightShadow.prototype = Object.assign( Object.create( LightShadow.prototype ), {

	constructor: DirectionalLightShadow,

	isDirectionalLightShadow: true,

	copy: function ( source ) {

		LightShadow.prototype.copy.call( this, source );

		this.spreadAngle = source.spreadAngle;

		return this;

	},

	update: function ( light ) {

		this.camera.updateProjectionMatrix();

	}

} );


export { DirectionalLightShadow };
