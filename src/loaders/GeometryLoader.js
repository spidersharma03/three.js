/**
 * @author mrdoob / http://mrdoob.com/
 */

THREE.GeometryLoader = function ( manager ) {

	this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;

};

THREE.GeometryLoader.prototype = {

	constructor: THREE.GeometryLoader,

	load: function ( url, onLoad, onProgress, onError ) {

		var scope = this;

		var loader = new THREE.XHRLoader( this.manager );
		loader.setCrossOrigin( this.crossOrigin );
		loader.load( url, function ( text ) {

			onLoad( scope.parse( JSON.parse( text ) ) );

		}, onProgress, onError );

	},

	setCrossOrigin: function ( value ) {

		this.crossOrigin = value;

	},

	parse: function ( json ) {

		var geometry = new THREE.Geometry();

		geometry.name = json.name || geometry.name;

		float scale = 1.0;
		
		THREE.JSONLoader.parseModel( geometry, json, scale );		
		THREE.JSONLoader.parseSkinBonesAnimation( geometry, json );
		THREE.JSONLoader.parseMorphing( geometry, json, 1.0 );

		var boundingSphere = json.boundingSphere;

		if ( boundingSphere !== undefined ) {

			var center = new THREE.Vector3();

			if ( boundingSphere.center !== undefined ) {

				center.fromArray( boundingSphere.center );

			}

			geometry.boundingSphere = new THREE.Sphere( center, boundingSphere.radius );

		}

		return geometry;

	}

};
