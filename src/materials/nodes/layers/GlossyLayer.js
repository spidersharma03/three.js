/**
 * @author bhouston / http://clara.io/
 *
 */

THREE.GlossyLayerNode = function ( parameters ) {

	THREE.Layer.call( this );

	this.type = 'GlossyLayerNode';

	this.reflectionColor = new THREE.Color( 0xffffff );
	this.transmissionColor = new THREE.Color( 0xffffff );
	this.microfacetModel = null;
	this.fresnel = null;

	this.setValues( parameters );

};

THREE.GlossyLayerNode.prototype = Object.create( THREE.Node.prototype );
THREE.GlossyLayerNode.prototype.constructor = THREE.GlossyLayerNode;

THREE.GlossyLayerNode.prototype.copy = function ( source ) {

	THREE.Node.prototype.copy.call( this, source );

	this.reflectionColor.copy( source.reflectionColor );
	this.transmissionColor.copy( source.transmissionColor );
	this.microfacetModel = source.microfacetModel;
	this.fresnel = source.fresnel;

	return this;

};
