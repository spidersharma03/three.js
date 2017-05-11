/**
 * @author mrdoob / http://mrdoob.com
 * @author stewdio / http://stewd.io
 */

THREE.VRController = function ( id, index ) {

	THREE.Object3D.call( this );

	var scope = this;
	var gamepad;

	var axes = [ 0, 0 ];
	var thumbpadIsPressed = false;
	var triggerIsPressed = false;
	var gripsArePressed = false;
	var menuIsPressed = false;
	if ( index === undefined ) index = 0;
	function findGamepad( id ) {

		// Iterate across gamepads as Vive Controllers may not be
		// in position 0 and 1.

		var gamepads = navigator.getGamepads();

		for ( var i = 0, j = 0; i < 4; i ++ ) {

			var gamepad = gamepads[ i ];

			if ( gamepad && gamepad.id === id ) {

				if ( j === index ) return gamepad;

				j ++;

			}

		}

	}

	this.matrixAutoUpdate = false;
	this.standingMatrix = new THREE.Matrix4();

	this.getGamepad = function () {

		return gamepad;

	};

	this.getButtonState = function ( button ) {

		if ( button === 'thumbpad' ) return thumbpadIsPressed;
		if ( button === 'trigger' ) return triggerIsPressed;
		if ( button === 'grips' ) return gripsArePressed;
		if ( button === 'menu' ) return menuIsPressed;

	};

	this.update = function () {

		gamepad = findGamepad( id, index );

		if ( gamepad !== undefined && gamepad.pose ) {

			//  Position and orientation.

			var pose = gamepad.pose;
			if(gamepad.pose.position !== null){
 				scope.position.fromArray( pose.position );
 			} else {
 	          	scope.position.fromArray( [0, 1, 0.5] );
            }
 
            if(gamepad.pose.orientation !== null){
 				scope.quaternion.fromArray( pose.orientation );
 			} else {
 				scope.quaternion.set(0,0,0,1);
 			}
 			scope.matrix.compose( scope.position, scope.quaternion, scope.scale );
			scope.matrix.multiplyMatrices( scope.standingMatrix, scope.matrix );
			scope.matrix.decompose( scope.position, scope.quaternion, scope.scale );
			scope.matrixWorldNeedsUpdate = true;
			scope.visible = true;

		} else {

			scope.visible = false;

		}

		//  Thumbpad and Buttons.
		if( gamepad ){

			if ( gamepad.axes && (axes[ 0 ] !== gamepad.axes[ 0 ] || axes[ 1 ] !== gamepad.axes[ 1 ]) ) {

				axes[ 0 ] = gamepad.axes[ 0 ]; //  X axis: -1 = Left, +1 = Right.
				axes[ 1 ] = gamepad.axes[ 1 ]; //  Y axis: -1 = Bottom, +1 = Top.
				scope.dispatchEvent( { type: 'axischanged', axes: axes } );

			}

			if ( gamepad.buttons[ 0 ] && thumbpadIsPressed !== gamepad.buttons[ 0 ].pressed ) {

				thumbpadIsPressed = gamepad.buttons[ 0 ].pressed;
				var event = new Event( thumbpadIsPressed ? 'thumbpaddown' : 'thumbpadup');
				//window.dispatchEvent( { type: thumbpadIsPressed ? 'thumbpaddown' : 'thumbpadup' } );
				window.dispatchEvent(event);
			}

			if ( gamepad.buttons[ 1 ] && triggerIsPressed !== gamepad.buttons[ 1 ].pressed ) {

				triggerIsPressed = gamepad.buttons[ 1 ].pressed;
				//scope.dispatchEvent( { type: triggerIsPressed ? 'triggerdown' : 'triggerup' } );
				var event = new Event( triggerIsPressed ? 'triggerdown' : 'triggerup');
				window.dispatchEvent(event);

			}

			if ( gamepad.buttons[ 2 ] && gripsArePressed !== gamepad.buttons[ 2 ].pressed ) {

				gripsArePressed = gamepad.buttons[ 2 ].pressed;
				//scope.dispatchEvent( { type: gripsArePressed ? 'gripsdown' : 'gripsup' } );
				var event = new Event( gripsArePressed ? 'gripsdown' : 'gripsup');
				window.dispatchEvent(event);

			}

			if ( gamepad.buttons[ 3 ] && menuIsPressed !== gamepad.buttons[ 3 ].pressed ) {

				menuIsPressed = gamepad.buttons[ 3 ].pressed;
				//scope.dispatchEvent( { type: menuIsPressed ? 'menudown' : 'menuup' } );
				var event = new Event( menuIsPressed ? 'menudown' : 'menuup' );
				window.dispatchEvent(event);

			}

	    }
	};

};

THREE.VRController.prototype = Object.create( THREE.Object3D.prototype );
THREE.VRController.prototype.constructor = THREE.VRController;
