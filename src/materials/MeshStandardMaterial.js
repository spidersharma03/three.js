import { Material } from './Material';
import { Map } from './Map';
import { Vector2 } from '../math/Vector2';
import { Color } from '../math/Color';

/**
 * @author WestLangley / http://github.com/WestLangley
 * @author Ben Houston / bhouston / http://clara.io
 *
 * parameters = {
 *  color: <hex>,
 *  roughness: <float>,
 *  metalness: <float>,
 *  opacity: <float>,
 *
 *  map: new THREE.Texture( <Image> ),
 *
 *  lightMap: new THREE.Texture( <Image> ),
 *  lightMapIntensity: <float>
 *
 *  aoMap: new THREE.Texture( <Image> ),
 *  aoMapIntensity: <float>
 *
 *  emissive: <hex>,
 *  emissiveIntensity: <float>
 *  emissiveMap: new THREE.Texture( <Image> ),
 *
 *  bumpMap: new THREE.Texture( <Image> ),
 *  bumpScale: <float>,
 *
 *  normalMap: new THREE.Texture( <Image> ),
 *  normalScale: <Vector2>,
 *
 *  displacementMap: new THREE.Texture( <Image> ),
 *  displacementScale: <float>,
 *  displacementBias: <float>,
 *
 *  roughnessMap: new THREE.Texture( <Image> ),
 *
 *  metalnessMap: new THREE.Texture( <Image> ),
 *
 *  alphaMap: new THREE.Texture( <Image> ),
 *
 *  envMap: new THREE.CubeTexture( [posx, negx, posy, negy, posz, negz] ),
 *  envMapIntensity: <float>
 *
 *  refractionRatio: <float>,
 *
 *  wireframe: <boolean>,
 *  wireframeLinewidth: <float>,
 *
 *  skinning: <bool>,
 *  morphTargets: <bool>,
 *  morphNormals: <bool>
 * }
 */

function MeshStandardMaterial( parameters ) {

	Material.call( this );

	this.defines = { 'STANDARD': '' };

	this.type = 'MeshStandardMaterial';

	this.color = new Color( 0xffffff ); // diffuse
	//this.map = null;
	this.mapSlot = new Map( "map", 0, false, false );

	this.reflectivity = 0.5;

	this.roughness = 0.5;
	//this.roughnessMap = null;
	this.roughnessMapSlot = new Map( "roughnessMap", 0, false, false );

	this.metalness = 0.5;
	//this.metalnessMap = null;
	this.metalnessMapSlot = new Map( "metalnessMap", 0, false, false );

	this.emissive = new Color( 0x000000 );
	this.emissiveIntensity = 1.0;
	//this.emissiveMap = null;
	this.emissiveMapSlot = new Map( "emissiveMap", 0, false, false );

	//this.bumpMap = null;
	//this.bumpScale = 1;
	this.bumpMapSlot = new Map( "bumpMap", 0, false, true );

	//this.normalMap = null;
	this.normalScale = new Vector2( 1, 1 );
	this.normalMapSlot = new Map( "normalMap", 0, false, false );

	//this.displacementMap = null;
	//this.displacementScale = 1;
	//this.displacementBias = 0;
	this.displacementMapSlot = new Map( "displacementMap", 0, false, true );

	//this.lightMap = null;
	//this.lightMapIntensity = 1.0;
	this.lightMapSlot = new Map( "lightMap", 1, false, true );

	//this.aoMap = null;
	this.aoMapIntensity = 1.0;
	this.aoMapSlot = new Map( "aoMap", 1, false, true );

	//this.alphaMap = null;
	this.alphaMapSlot = new Map( "alphaMap", 0, false, false );

	this.envMap = null;
	this.envMapIntensity = 1.0;

	this.refractionRatio = 0.98;

	this.wireframe = false;
	this.wireframeLinewidth = 1;
	this.wireframeLinecap = 'round';
	this.wireframeLinejoin = 'round';

	this.skinning = false;
	this.morphTargets = false;
	this.morphNormals = false;

	this.setValues( parameters );

}

MeshStandardMaterial.prototype = Object.create( Material.prototype );
MeshStandardMaterial.prototype.constructor = MeshStandardMaterial;

MeshStandardMaterial.prototype.isMeshStandardMaterial = true;

var closure = function () {
	var propertyMappings = {
		"map": {
		  get: function() {
				return this.mapSlot.texture;
		  },
			set: function( value ) {
				this.mapSlot.texture = value;
			}
		},
		"lightMap": {
		  get: function() {
				return this.lightMapSlot.texture;
		  },
			set: function( value ) {
				this.lightMapSlot.texture = value;
			}
		},
		"lightMapIntensity": {
		  get: function() {
				return this.lightMapSlot.texelScale;
		  },
			set: function( value ) {
				this.lightMapSlot.texelTransform = true;
				this.lightMapSlot.texelScale = value;
			}
		},
		"aoMap": {
		  get: function() {
				return this.aoMapSlot.texture;
		  },
			set: function( value ) {
				this.aoMapSlot.texture = value;
			}
		},
		"emissiveMap": {
		  get: function() {
				return this.emissiveMapSlot.texture;
		  },
			set: function( value ) {
				this.emissiveMapSlot.texture = value;
			}
		},
		"bumpMap": {
		  get: function() {
				return this.bumpMapSlot.texture;
		  },
			set: function( value ) {
				this.bumpMapSlot.texture = value;
			}
		},
		"bumpScale": {
		  get: function() {
				return this.bumpMapSlot.texelScale;
		  },
			set: function( value ) {
				this.bumpMapSlot.texelTransform = true;
				this.bumpMapSlot.texelScale = value;
			}
		},
		"normalMap": {
		  get: function() {
				return this.normalMapSlot.texture;
		  },
			set: function( value ) {
				this.normalMapSlot.texture = value;
			}
		},
		"displacementMap": {
		  get: function() {
				return this.displacementMapSlot.texture;
		  },
			set: function( value ) {
				this.displacementMapSlot.texture = value;
			}
		},
		"displacementScale": {
		  get: function() {
				return this.displacementMapSlot.texelScale;
		  },
			set: function( value ) {
				this.displacementMapSlot.texelTransform = true;
				this.displacementMapSlot.texelScale = value;
			}
		},
		"displacementBias": {
		  get: function() {
				return this.displacementMapSlot.texelOffset;
		  },
			set: function( value ) {
				this.displacementMapSlot.texelTransform = true;
				this.displacementMapSlot.texelOffset = value;
			}
		},
		"roughnessMap": {
		  get: function() {
				return this.roughnessMapSlot.texture;
		  },
			set: function( value ) {
				this.roughnessMapSlot.texture = value;
			}
		},
		"metalnessMap": {
		  get: function() {
				return this.metalnessMapSlot.texture;
		  },
			set: function( value ) {
				this.metalnessMapSlot.texture = value;
			}
		},
		"alphaMap": {
		  get: function() {
				return this.alphaMapSlot.texture;
		  },
			set: function( value ) {
				this.alphaMapSlot.texture = value;
			}
		}
	};
	for( var propertyName in propertyMappings ) {
		Object.defineProperty( MeshStandardMaterial.prototype, propertyName, propertyMappings[ propertyName ] );
	}
}();

MeshStandardMaterial.prototype.copy = function ( source ) {

	Material.prototype.copy.call( this, source );

	this.defines = { 'STANDARD': '' };

	this.color.copy( source.color );
	this.mapSlot.copy( source.mapSlot );

	this.reflectivity = source.reflectivity;

	this.roughness = source.roughness;
	this.roughnessMapSlot.copy( source.roughnessMapSlot );

	this.metalness = source.metalness;
	this.metalnessMapSlot.copy( source.metalnessMapSlot );

	this.lightMapSlot.copy( source.lightMapSlot );

	this.aoMapIntensity = source.aoMapIntensity;
	this.aoMapSlot.copy( source.aoMapSlot );

	this.emissive.copy( source.emissive );
	this.emissiveIntensity = source.emissiveIntensity;
	this.emissiveMapSlot.copy( source.emissiveMapSlot );

	this.bumpMapSlot.copy( source.bumpMapSlot );

	this.normalScale.copy( source.normalScale );
	this.normalMapSlot.copy( source.normalMapSlot );

	this.displacementMapSlot.copy( source.displacementMapSlot );

	this.alphaMapSlot.copy( source.alphaMapSlot );

	this.envMap = source.envMap;
	this.envMapIntensity = source.envMapIntensity;

	this.refractionRatio = source.refractionRatio;

	this.wireframe = source.wireframe;
	this.wireframeLinewidth = source.wireframeLinewidth;
	this.wireframeLinecap = source.wireframeLinecap;
	this.wireframeLinejoin = source.wireframeLinejoin;

	this.skinning = source.skinning;
	this.morphTargets = source.morphTargets;
	this.morphNormals = source.morphNormals;

	return this;

};


export { MeshStandardMaterial };
