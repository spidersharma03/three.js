/**
 * @author mrdoob / http://mrdoob.com/
 */

THREE.SpotLightShadow = function () {

	this.cameraFovNearFar = new THREE.Vector3( 50 * THREE.Math.DEG2RAD, 0.5, 500 );
	THREE.LightShadow.call( this, new THREE.PerspectiveCamera( this.cameraFovNearFar.x * THREE.Math.RAD2DEG * 2, 1, this.cameraFovNearFar.y, this.cameraFovNearFar.z ) );

};

THREE.SpotLightShadow.prototype = Object.assign( Object.create( THREE.LightShadow.prototype ), {

	constructor: THREE.SpotLightShadow,

	update: function ( light ) {

		var fov = THREE.Math.RAD2DEG * 2 * light.angle;
		var aspect = this.mapSize.width / this.mapSize.height;
		var far = light.distance || 500;

		var camera = this.camera;

		if ( fov !== camera.fov || aspect !== camera.aspect || far !== camera.far ) {

			camera.fov = fov;
			camera.aspect = aspect;
			camera.far = far;
			camera.updateProjectionMatrix();

		}

		this.cameraFovNearFar.x = light.angle;
		this.cameraFovNearFar.y = camera.near;
		this.cameraFovNearFar.z = camera.far;

	}

} );
