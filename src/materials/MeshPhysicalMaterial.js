import { MeshStandardMaterial } from './MeshStandardMaterial';
import { Map } from './Map';

/**
 * @author WestLangley / http://github.com/WestLangley
 *
 * parameters = {
 *  reflectivity: <float>
 * }
 */

function MeshPhysicalMaterial( parameters ) {

	MeshStandardMaterial.call( this );

	this.defines = { 'PHYSICAL': '' };

	this.type = 'MeshPhysicalMaterial';

	this.reflectivity = 0.5; // maps to F0 = 0.04

	this.falloff = false;
	this.falloffColor = new THREE.Color( 0xffffff );
	this.falloffMapSlot = new THREE.Map( "falloffMap", 0, false, false );
	this.falloffOpacity = 1.0;
	this.falloffAlphaMapSlot = new THREE.Map( "falloffAlphaMap", 0, false, false );

	this.clearCoat = 0.0;
	this.clearCoatRoughness = 0.0;

	this.setValues( parameters );

}

MeshPhysicalMaterial.prototype = Object.create( MeshStandardMaterial.prototype );
MeshPhysicalMaterial.prototype.constructor = MeshPhysicalMaterial;

MeshPhysicalMaterial.prototype.isMeshPhysicalMaterial = true;


var closure = function () {
	var propertyMappings = {
		"falloffMap": {
		  get: function() {
				return this.falloffMapSlot.texture;
		  },
			set: function( value ) {
				this.falloffMapSlot.texture = value;
			}
		},
		"falloffAlphaMap": {
		  get: function() {
				return this.falloffAlphaMapSlot.texture;
		  },
			set: function( value ) {
				this.falloffAlphaMapSlot.texture = value;
			}
		}
	};
	for( var propertyName in propertyMappings ) {
		Object.defineProperty( MeshPhysicalMaterial.prototype, propertyName, propertyMappings[ propertyName ] );
	}
}();

MeshPhysicalMaterial.prototype.copy = function ( source ) {

	MeshStandardMaterial.prototype.copy.call( this, source );

	this.defines = { 'PHYSICAL': '' };

	this.reflectivity = source.reflectivity;

	this.falloff = source.falloff;
	this.falloffColor.copy( source.falloffColor );
	this.falloffMapSlot.copy( source.falloffMapSlot );
	this.falloffOpacity = source.falloffOpacity;
	this.falloffAlphaMapSlot.copy( source.falloffAlphaMapSlot );

	this.clearCoat = source.clearCoat;
	this.clearCoatRoughness = source.clearCoatRoughness;

	return this;

};


export { MeshPhysicalMaterial };
