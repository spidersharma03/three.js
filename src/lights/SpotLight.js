import { Light } from './Light';
import { SpotLightShadow } from './SpotLightShadow';
import { Object3D } from '../core/Object3D';
import { Box3 } from '../math/Box3';
import { Vector3 } from '../math/Vector3';
/**
 * @author alteredq / http://alteredqualia.com/
 */

function SpotLight( color, intensity, distance, angle, penumbra, decay ) {

	Light.call( this, color, intensity );

	this.type = 'SpotLight';

	this.position.copy( Object3D.DefaultUp );
	this.updateMatrix();

	this.target = new Object3D();
	this.autoShadow = false;

	Object.defineProperty( this, 'power', {
		get: function () {
			// intensity = power per solid angle.
			// ref: equation (17) from http://www.frostbite.com/wp-content/uploads/2014/11/course_notes_moving_frostbite_to_pbr.pdf
			return this.intensity * Math.PI;
		},
		set: function ( power ) {
			// intensity = power per solid angle.
			// ref: equation (17) from http://www.frostbite.com/wp-content/uploads/2014/11/course_notes_moving_frostbite_to_pbr.pdf
			this.intensity = power / Math.PI;
		}
	} );

	this.distance = ( distance !== undefined ) ? distance : 0;
	this.angle = ( angle !== undefined ) ? angle : Math.PI / 3;
	this.penumbra = ( penumbra !== undefined ) ? penumbra : 0;
	this.decay = ( decay !== undefined ) ? decay : 1;	// for physically correct lights, should be 2.

	this.shadow = new SpotLightShadow();

}

SpotLight.prototype = Object.assign( Object.create( Light.prototype ), {

	constructor: SpotLight,

	isSpotLight: true,

	copy: function ( source ) {

		Light.prototype.copy.call( this, source );

		this.distance = source.distance;
		this.angle = source.angle;
		this.penumbra = source.penumbra;
		this.decay = source.decay;

		this.target = source.target.clone();

		this.shadow = source.shadow.clone();

		return this;

	}

} );

SpotLight.prototype.createAutoShadow = function ( scene ) {

	if (!scene) return;

	var position = this.position;
	var targetPosition = this.target.position;

  	const box = new Box3();
  	const result = new Box3();
  	result.makeEmpty();
	scene.traverseVisible(function(object) {

		if( object.isMesh ) {

		    var geometry = object.geometry;

		    if (geometry.boundingBox === null) {
		      geometry.computeBoundingBox();
		    }

		    if (geometry.boundingBox.isEmpty() === false) {
		      box.copy(geometry.boundingBox);
		      object.matrix.compose(object.position, object.quaternion, object.scale);
		      object.updateMatrixWorld(true);
		      box.applyMatrix4(object.matrixWorld);
		      result.union(box);

			}

		}

	});
	var boundingSphere = result.getBoundingSphere();
    var vector1 = new Vector3().subVectors( targetPosition, position );
    if (this.children[0] && this.children[0].uuid === this.target.uuid) {
    	vector1 =  new Vector3(0, 0, -1).applyQuaternion(this.quaternion);
    }
    var vector2 = new Vector3().subVectors( boundingSphere.center, position );
    var distance = boundingSphere.center.distanceTo(position);
    var angle = vector1.angleTo(vector2);
    var far = angle > (Math.PI / 2) ? 0 : distance * Math.cos(angle) + boundingSphere.radius;
    var near = (far === 0 || (far - boundingSphere.radius * 2) < 0 )? 0.01 : far - boundingSphere.radius * 2;
    this.distance = far;
    this.shadow.camera.far = far;
    this.shadow.camera.near = near;
    this.shadow.camera.updateProjectionMatrix();
}

export { SpotLight };
