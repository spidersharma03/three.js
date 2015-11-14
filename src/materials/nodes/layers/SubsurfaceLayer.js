/**
 * @author bhouston / http://clara.io/
 *
 */

THREE.SubsurfaceLayer = function ( parameters ) {

	THREE.Layer.call( this );

	this.type = 'SubsurfaceLayer';

	this.emissiveColor = new THREE.Color( 0x000000 );
	this.absorptionColor = new THREE.Color( 0x000000 );
	this.scatteringColor = new THREE.Color( 0x000000 );
	this.phaseFunction = 0.0;

	this.setValues( parameters );

};

THREE.SubsurfaceLayer.prototype = Object.create( THREE.Node.prototype );
THREE.SubsurfaceLayer.prototype.constructor = THREE.SubsurfaceLayer;

THREE.SubsurfaceLayer.prototype.copy = function ( source ) {

	THREE.Node.prototype.copy.call( this, source );

	this.emissiveColor.copy( source.emissiveColor );
	this.absorptionColor.copy( source.absorptionColor );
	this.scatteringColor.copy( source.scatteringColor );
	this.phaseFunction = source.phaseFunction;

	return this;

};
