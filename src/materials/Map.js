/**
 * @author Ben Houston / bhouston / http://clara.io
 *
 */

THREE.Map = function ( name, uvChannel, uvTransform, texelTransform ) {

  this.name = name || "unnamed";

  this.texture = null;

  this.uvChannel = uvChannel || 0;

  this.uvTransform = uvTransform || false;
  this.uvOffset = new THREE.Vector2( 0, 0 );
  this.uvRepeat = new THREE.Vector2( 1.0, 1.0 );
  //this.uvRotation = 0;  - not implemented because offset/repeat fix in a vec4 uniform, rotation doesn't.

  this.texelTransform = uvTransform || false;
  this.texelScale = 1.0;
  this.texelOffset = 0.0;
  this.texelInvert = false;

};

THREE.Map.prototype = {

  constructor: THREE.Map,

  copy: function ( source ) {

    this.name = source.name;

  	this.texture = source.texture;

    this.uvChannel = source.uvChannel;

    this.uvTransform = source.uvTransform;
    this.uvOffset = source.uvOffset;
    this.uvRepeat = source.uvRepeat;
    //this.uvRotation = source.uvRotation;

    this.texelTransform = source.texelTransform;
    this.texelScale = source.texelScale;
    this.texelOffset = source.texelOffset;
    this.texelInvert = source.texelInvert;

  	return this;

  },

  // bakes all the input texel parameters into just two.
  getFlattenedTexelTransform: function( optionalTexelTransform ) {
      var texelTransform = optionalTexelTransform || {};
      if( this.texelInvert ) {
        texelTransform.texelScale = -this.texelScale;
        texelTransform.texelOffset = this.texelScale + this.texelOffset;
      }
      else {
        texelTransform.texelScale = this.texelScale;
        texelTransform.texelOffset = this.texelOffset;
      }
      return texelTransform;
  }

};

THREE.Map.SupportedMapNames = [
	'map', 'lightMap', 'aoMap', 'emissiveMap', 'specularMap', 'bumpMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'displacementMap'
];
THREE.Map.SupportedMapSlotNames = [];
THREE.Map.SupportedMapUVNames = [];
THREE.Map.SupportedMapTexelNames = [];

for( var i = 0; i < THREE.Map.SupportedMapNames.length; i ++ ) {
  var name = THREE.Map.SupportedMapNames [i];
  THREE.Map.SupportedMapSlotNames.push( name + 'Slot' );
  THREE.Map.SupportedMapUVNames.push( name + 'UVTransformParams' );
  THREE.Map.SupportedMapTexelNames.push( name + 'TexelTransformParams' );
}