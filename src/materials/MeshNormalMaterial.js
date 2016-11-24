import { Material } from './Material';
import { Color } from '../math/Color';

/**
 * @author mrdoob / http://mrdoob.com/
 *
 * parameters = {
 *  opacity: <float>,
 *
 *  wireframe: <boolean>,
 *  wireframeLinewidth: <float>
 * }
 */

function MeshNormalMaterial( parameters ) {

	Material.call( this, parameters );

	this.type = 'MeshNormalMaterial';

	this.wireframe = false;
	this.wireframeLinewidth = 1;

	this.fog = false;
	this.lights = false;
	this.morphTargets = false;

	// default normal is facing the camera.
	this.clearColor = new Color( 0.5, 0.5, 1.0 );
	this.clearAlpha = 1.0;

	this.setValues( parameters );

}

MeshNormalMaterial.prototype = Object.create( Material.prototype );
MeshNormalMaterial.prototype.constructor = MeshNormalMaterial;

MeshNormalMaterial.prototype.isMeshNormalMaterial = true;

MeshNormalMaterial.prototype.copy = function ( source ) {

	Material.prototype.copy.call( this, source );

	this.wireframe = source.wireframe;
	this.wireframeLinewidth = source.wireframeLinewidth;

	this.clearColor = source.clearColor;
	this.clearAlpha = source.clearAlpha;

	return this;

};


export { MeshNormalMaterial };
