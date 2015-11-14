/**
 * @author bhouston / http://clara.io/
 *
 */

THREE.DielectricFresnel = function ( parameters ) {

	THREE.Node.call( this );

	this.type = 'DielectricFresnel';

	this.ior = 1.5;
	 
	this.setValues( parameters );

};


THREE.DielectricFresnel.prototype = Object.create( THREE.Node.prototype );
THREE.DielectricFresnel.prototype.constructor = THREE.DielectricFresnel;

THREE.DielectricFresnel.prototype.copy = function ( source ) {

	THREE.Node.prototype.copy.call( this, source );

	this.ior = source.ior;

	return this;

};
