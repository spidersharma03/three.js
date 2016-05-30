/**
 * @author mrdoob / http://mrdoob.com/
 */

THREE.SpotLightShadow = function () {

	this.cameraNearFar = new THREE.Vector3( 50 * THREE.Math.DEG2RAD, 0.5, 500 );
	THREE.LightShadow.call( this, new THREE.PerspectiveCamera( this.cameraNearFar.x * THREE.Math.RAD2DEG, 1, this.cameraNearFar.y, this.cameraNearFar.z ) );

};

THREE.SpotLightShadow.prototype = Object.assign( Object.create( THREE.LightShadow.prototype ), {

	constructor: THREE.SpotLightShadow,

	update: function ( light ) {

		var fov = THREE.Math.RAD2DEG * 2 * light.angle;
		var aspect = this.mapSize.width / this.mapSize.height;
		var far = light.distance || 500;

		this.cameraNearFar.x = fov * THREE.Math.DEG2RAD;
		this.cameraNearFar.z = far;

		var camera = this.camera;

		if ( fov !== camera.fov || aspect !== camera.aspect || far !== camera.far ) {

			camera.fov = fov;
			camera.aspect = aspect;
			camera.far = far;
			camera.updateProjectionMatrix();

		}

	}

} );
