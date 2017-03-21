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

	this.add( new Mesh( geometry, materialFront ) );

	// shows the "back" of the light, which does not emit light

	this.add( new Mesh( geometry, materialBack ) );

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

RectAreaLightHelper.prototype.update = function () {

	var vector1 = new Vector3();
	var vector2 = new Vector3();

	return function update() {

		var mesh1 = this.children[ 0 ];
		var mesh2 = this.children[ 1 ];

		if ( this.light.target ) {

			vector1.setFromMatrixPosition( this.light.matrixWorld );
			vector2.setFromMatrixPosition( this.light.target.matrixWorld );

			var lookVec = vector2.clone().sub( vector1 );
			mesh1.lookAt( lookVec );
			mesh2.lookAt( lookVec );

		}

		// update materials
		var size = this.light.width * this.light.height/4;
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

	};

}();

export { RectAreaLightHelper };
