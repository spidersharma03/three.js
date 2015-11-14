/**
 * @author bhouston / http://clara.io/
 *
 */

THREE.TrowbridgeReitzMicrofacetModel = function ( parameters ) {

	THREE.Layer.call( this );

	this.type = 'TrowbridgeReitzMicrofacetModel';

	this.roughness = 0.0;
	this.anisotropy = 0.0;
	this.anisotropyRotation = 0.0;
	this.anisotropyTangent = null;

	this.setValues( parameters );

};

THREE.TrowbridgeReitzMicrofacetModel.prototype = Object.create( THREE.Node.prototype );
THREE.TrowbridgeReitzMicrofacetModel.prototype.constructor = THREE.TrowbridgeReitzMicrofacetModel;

THREE.TrowbridgeReitzMicrofacetModel.prototype.copy = function ( source ) {

	THREE.Node.prototype.copy.call( this, source );

	this.roughness = source.roughness;
	this.anisotropy = source.anisotropy;
	this.anisotropyRotation = source.anisotropyRotation;
	this.anisotropyTangent = source.anisotropyTangent;


	return this;

};
