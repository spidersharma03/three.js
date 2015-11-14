/**
 * @author bhouston / http://clara.io/
 *
 */

THREE.EmissiveLayer = function ( parameters ) {

	THREE.Layer.call( this );

	this.type = 'EmissiveLayer';

	this.emissiveColor = new THREE.Color( 0x000000 );

	this.setValues( parameters );

};

THREE.EmissiveLayer.prototype = Object.create( THREE.Node.prototype );
THREE.EmissiveLayer.prototype.constructor = THREE.EmissiveLayer;

THREE.EmissiveLayer.prototype.copy = function ( source ) {

	THREE.Node.prototype.copy.call( this, source );

	this.emissiveColor.copy( source.emissiveColor );

	return this;

};
