/**
 * @author aallison / http://github.com/abelnation
 */

RectAreaLightShadow = function () {

	LightShadow.call( this, new PerspectiveCamera( 50, 1, 0.5, 500 ) );

};

RectAreaLightShadow.prototype = Object.create( LightShadow.prototype );
RectAreaLightShadow.prototype.constructor = RectAreaLightShadow;

RectAreaLightShadow.prototype.update = function ( light ) {

	// TODO (abelnation): implement

};
