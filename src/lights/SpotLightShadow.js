/**
 * @author mrdoob / http://mrdoob.com/
 */

THREE.SpotLightShadow = function () {
	var fov = 50;
	this.cameraParams = new THREE.Vector3( fov, 10.5, 1000 );
	THREE.LightShadow.call( this, new THREE.PerspectiveCamera( this.cameraParams.x, 1, this.cameraParams.y, this.cameraParams.z ) );

};

THREE.SpotLightShadow.prototype = Object.assign( Object.create( THREE.LightShadow.prototype ), {

	constructor: THREE.SpotLightShadow,

	update: function ( light ) {

		var fov = THREE.Math.RAD2DEG * 2 * light.angle;
		var aspect = this.mapSize.width / this.mapSize.height;
		var far = light.distance || 500;

		var camera = this.camera;

		this.cameraParams.x = fov * THREE.Math.DEG2RAD;
		this.cameraParams.y = light.shadow.camera.near;
		this.cameraParams.z = far;

		camera.fov = fov;
		camera.aspect = aspect;
		camera.far = far;
		camera.updateProjectionMatrix();

	}

} );
