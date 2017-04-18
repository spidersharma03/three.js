/**
 * @author abelnation / http://github.com/abelnation
 * @author Mugen87 / http://github.com/Mugen87
 */

import { Object3D } from '../core/Object3D';
import { Vector3 } from '../math/Vector3';
import { Mesh } from '../objects/Mesh';
import { MeshBasicMaterial } from '../materials/MeshBasicMaterial';
import { BufferGeometry } from '../core/BufferGeometry';
import { BufferAttribute } from '../core/BufferAttribute';

function RectAreaLightHelper( light ) {

	Object3D.call( this );

	this.light = light;
	this.light.updateMatrixWorld();

	var material = new THREE.MeshBasicMaterial({color: 0xffffff});

	this.rootTube = new THREE.Object3D();
	var geometry = new THREE.CylinderGeometry( 0.5, 0.5, 1.0, 32 );
	var sphereGeometry = new THREE.SphereGeometry( 0.5, 32, 32 );
	var cylinder = new THREE.Mesh( geometry, material );
	var cap1Mesh = new THREE.Mesh( sphereGeometry, material );
	var cap2Mesh = new THREE.Mesh( sphereGeometry, material );
	cap1Mesh.position.y = 0.5;
	cap2Mesh.position.y = -0.5;
	this.rootTube.add(cylinder);
	this.rootTube.add(cap1Mesh);
	this.rootTube.add(cap2Mesh);
	this.rootTube.rotation.z = Math.PI/2;

	this.rootSphere = new THREE.Object3D();
	var sphMesh = new THREE.Mesh( sphereGeometry, material );
	this.rootSphere.add(sphMesh);

	this.rootDisk = new THREE.Object3D();
	var diskGeometry = new THREE.CylinderGeometry( 0.5, 0.5, 0.01, 32 );
	var diskMesh = new THREE.Mesh( diskGeometry, material );
	this.rootDisk.add(diskMesh);
	this.rootDisk.rotation.x = Math.PI/2;

	var materialFront = new MeshBasicMaterial( {
		color: light.color,
		fog: false
	} );

	var materialBack = new MeshBasicMaterial( {
		color: light.color,
		fog: false,
		wireframe: true
	} );

	var geometry = new BufferGeometry();

	geometry.addAttribute( 'position', new BufferAttribute( new Float32Array( 6 * 3 ), 3 ) );
	geometry.addAttribute( 'uv', new BufferAttribute( new Float32Array( 6 * 2 ), 2 ) );

	// shows the "front" of the light, e.g. where light comes from

	this.rootRect = new THREE.Object3D();
	this.rootRect.add( new Mesh( geometry, materialFront ) );

	// shows the "back" of the light, which does not emit light

	this.rootRect.add( new Mesh( geometry, materialBack ) );
	this.shapeAdded = false;
	this.currentShapeType = -1;

	this.update();

}

RectAreaLightHelper.prototype = Object.create( Object3D.prototype );
RectAreaLightHelper.prototype.constructor = RectAreaLightHelper;

RectAreaLightHelper.prototype.dispose = function () {

	this.children[ 0 ].geometry.dispose();
	this.children[ 0 ].material.dispose();
	this.children[ 1 ].geometry.dispose();
	this.children[ 1 ].material.dispose();

};

RectAreaLightHelper.prototype.updateLightShape = function() {

	var shapeType = this.light.shapeType;

	if( shapeType === this.currentShapeType )
		return;

	this.currentShapeType = shapeType;

	switch (shapeType) {
		case 0:
			this.remove( this.children[0]);
			this.add( this.rootRect );
			break;
		case 1:
			this.remove( this.children[0]);
			this.add( this.rootSphere );
			break;
		case 2:
			this.remove( this.children[0]);
			this.add( this.rootDisk );
			break;
		case 3:
			this.remove( this.children[0]);
			this.add( this.rootTube );
			break;
		default:
	}
},

RectAreaLightHelper.prototype.update = function () {

	var vector1 = new Vector3();
	var vector2 = new Vector3();
	var added = false;

	return function update() {

		this.updateLightShape();

		if( this.light.shapeType === 1 ) {
				var scale = this.light.height;
				this.rootSphere.scale.set(scale, scale, scale);
				this.rootSphere.children[0].material.color.copy( this.light.color ).multiplyScalar( this.light.intensity );
		}
		else if( this.light.shapeType === 2 ) {
				var scale = this.light.height;
				this.rootDisk.scale.set(scale, 1, scale);

				if ( this.light.target ) {

					vector1.setFromMatrixPosition( this.light.matrixWorld );
					vector2.setFromMatrixPosition( this.light.target.matrixWorld );

					var lookVec = vector2.clone().sub( vector1 );
					this.rootDisk.lookAt( lookVec );
					this.rootDisk.children[0].material.color.copy( this.light.color ).multiplyScalar( this.light.intensity );
				}
		}
		else if( this.light.shapeType === 3 ) {
				var scaley = this.light.width;
				var scalex = this.light.height;
				this.rootTube.children[0].scale.set(scalex, scaley, scalex);
				this.rootTube.children[1].scale.set(scalex, scalex, scalex);
				this.rootTube.children[2].scale.set(scalex, scalex, scalex);
				this.rootTube.children[1].position.set(0, scaley/2, 0);
				this.rootTube.children[2].position.set(0, -scaley/2, 0);

				if ( this.light.target ) {

					vector1.setFromMatrixPosition( this.light.matrixWorld );
					vector2.setFromMatrixPosition( this.light.target.matrixWorld );

					var lookVec = vector2.clone().sub( vector1 );
					this.rootTube.lookAt( lookVec );
				}
		}
		else {
				var mesh1 = this.rootRect.children[ 0 ];
				var mesh2 = this.rootRect.children[ 1 ];

				if ( this.light.target ) {

					vector1.setFromMatrixPosition( this.light.matrixWorld );
					vector2.setFromMatrixPosition( this.light.target.matrixWorld );

					var lookVec = vector2.clone().sub( vector1 );
					mesh1.lookAt( lookVec );
					mesh2.lookAt( lookVec );

				}

				// update materials
				var size = 1;//this.light.width * this.light.height/4;
				mesh1.material.color.copy( this.light.color ).multiplyScalar( this.light.intensity/size );
				mesh2.material.color.copy( this.light.color ).multiplyScalar( this.light.intensity/size );

				// calculate new dimensions of the helper
				var hx = this.light.width * 0.5;
				var hy = this.light.height * 0.5;

				// because the buffer attribute is shared over both geometries, we only have to update once
				var position = mesh1.geometry.getAttribute( 'position' );
				var array = position.array;
				var uvs = mesh1.geometry.getAttribute( 'uv' );
				var arrayUv = uvs.array;

				// first face

				array[  0 ] =   hx; array[  1 ] = - hy; array[  2 ] = 0;
				array[  3 ] =   hx; array[  4 ] =   hy; array[  5 ] = 0;
				array[  6 ] = - hx; array[  7 ] =   hy; array[  8 ] = 0;

				arrayUv[  0 ] =   1.0; arrayUv[  1 ] = 0.0;
				arrayUv[  2 ] =   1.0; arrayUv[  3 ] = 1.0;
				arrayUv[  4 ] =   0.0; arrayUv[  5 ] = 1.0;

				// second face

				array[  9 ] = - hx; array[ 10 ] =   hy; array[ 11 ] = 0;
				array[ 12 ] = - hx; array[ 13 ] = - hy; array[ 14 ] = 0;
				array[ 15 ] =   hx; array[ 16 ] = - hy; array[ 17 ] = 0;

				arrayUv[  6 ] =   0.0; arrayUv[  7 ] = 1.0;
				arrayUv[  8 ] =   0.0; arrayUv[  9 ] = 0.0;
				arrayUv[  10 ] =  1.0; arrayUv[  11 ] = 0.0;

				position.needsUpdate = true;
				uvs.needsUpdate = true;
		}
	};

}();

export { RectAreaLightHelper };
