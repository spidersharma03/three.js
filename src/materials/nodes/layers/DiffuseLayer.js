/**
 * @author bhouston / http://clara.io/
 *
 */

THREE.DiffuseLayerNode = function ( parameters ) {

	THREE.Layer.call( this );

	this.type = 'GlossyLayerNode';

	this.reflectionColor = new THREE.Color( 0xffffff );
	this.transmissionColor = new THREE.Color( 0xffffff );
	this.roughness = 0.0;
	this.sheenColor = new THREE.Color( 0x000000 );

	this.setValues( parameters );

};

THREE.DiffuseLayerNode.prototype = Object.create( THREE.Node.prototype );
THREE.DiffuseLayerNode.prototype.constructor = THREE.DiffuseLayerNode;

THREE.DiffuseLayerNode.prototype.copy = function ( source ) {

	THREE.Node.prototype.copy.call( this, source );

	this.reflectionColor.copy( source.reflectionColor );
	this.transmissionColor.copy( source.transmissionColor );
	this.roughness = source.roughness;
	this.sheenColor.copy( source.sheenColor );

	return this;

};
