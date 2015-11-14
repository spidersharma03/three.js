/**
 * @author bhouston / http://clara.io/
 *
 */

THREE.ConductiveFresnel = function ( parameters ) {

	THREE.Node.call( this );

	this.type = 'ConductiveFresnel';

	this.iorColor = new THREE.Color( 1.5, 1.5, 1.5 );
	this.kappaColor = new THREE.Color( 1.5, 1.5, 1.5 );
	 
	this.setValues( parameters );

};


THREE.ConductiveFresnel.prototype = Object.create( THREE.Node.prototype );
THREE.ConductiveFresnel.prototype.constructor = THREE.ConductiveFresnel;

THREE.ConductiveFresnel.prototype.copy = function ( source ) {

	THREE.Node.prototype.copy.call( this, source );

	this.iorColor = source.iorColor;
	this.kappaColor = source.kappaColor;

	return this;

};
