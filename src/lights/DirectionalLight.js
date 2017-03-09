import { Light } from './Light';
import { DirectionalLightShadow } from './DirectionalLightShadow';
import { Object3D } from '../core/Object3D';
import { Box3 } from '../math/Box3';
import { Vector3 } from '../math/Vector3';
/**
 * @author mrdoob / http://mrdoob.com/
 * @author alteredq / http://alteredqualia.com/
 */

function DirectionalLight( color, intensity ) {

	Light.call( this, color, intensity );

	this.type = 'DirectionalLight';

	this.position.copy( Object3D.DefaultUp );
	this.updateMatrix();

	this.target = new Object3D();
	this.autoShadow = false;
	this.shadow = new DirectionalLightShadow();

}

DirectionalLight.prototype = Object.assign( Object.create( Light.prototype ), {

	constructor: DirectionalLight,

	isDirectionalLight: true,

	copy: function ( source ) {

		Light.prototype.copy.call( this, source );

		this.target = source.target.clone();

		this.shadow = source.shadow.clone();

		return this;

	}

} );

DirectionalLight.prototype.createAutoShadow = function ( scene ) {

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
    var size = distance * Math.sin(angle) + boundingSphere.radius;
    var far = angle > (Math.PI / 2) ? 0 : distance * Math.cos(angle) + boundingSphere.radius;
    var near = (far === 0 || (far - boundingSphere.radius * 2) < 0 )? 0.01 : far - boundingSphere.radius * 2;

    this.shadow.camera.left = -size;
    this.shadow.camera.right = size;
    this.shadow.camera.top = size;
    this.shadow.camera.bottom = -size;
    this.shadow.camera.far = far;
    this.shadow.camera.near = near;
    this.shadow.camera.updateProjectionMatrix();
}

export { DirectionalLight };
