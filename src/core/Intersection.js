/**
 * @author bhouston / http://exocortex.com
 */

THREE.Intersection = function ( point, distance, elementIndex, subElementLocation, object ) {

	// No validation is being done purposely.

	this.point = point || new THREE.Vector3();
	this.distance = distance || Infinity;
	this.elementIndex = elementIndex || -1;
	this.subElementLocation = subElementLocation || new THREE.Vector2();
	this.object = object;
	
};

THREE.Intersection.prototype = {

	constructor: THREE.Intersection,

	set: function ( point, distance, elementIndex, subElementLocation, object ) {

		this.point = point;
		this.distance = distance;
		this.elementIndex = elementIndex;
		this.subElementLocation = subElementLocation;
		this.object = object;

		return this;

	},

	copy: function ( intersection ) {

		this.point.copy( intersection.point );
		this.distance.copy = intersection.distance;
		this.elementIndex = intersection.elementIndex;
		this.subElementLocation.copy( intersection.subElementLocation );
		this.object = intersection.object;

		return this;

	},

	empty: function () {

		return ( this.distance == Infinity );

	},

	equals: function ( intersection ) {

		return (
			intersection.point.equals( this.point ) &&
			( intersection.distance === this.distance ) &&
			( intersection.elementIndex === this.elementIndex ) &&
			intersection.subElementLocation.equals( this.subElementLocation ) &&
			( intersection.object === this.object )
			);

	},

	clone: function () {

		return new THREE.Intersection().copy( this );

	}

};
