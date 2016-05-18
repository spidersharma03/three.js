/**
*
* Manual Multi-Sample Anti-Aliasing Render Pass
*
* @author bhouston / http://clara.io/
*
* This manual approach to MSAA re-renders the scene ones for each sample with camera jitter and accumulates the results.
*
* References: https://en.wikipedia.org/wiki/Multisample_anti-aliasing
*
*/

THREE.MSAAEffect = function ( renderer, beautyRenderTarget, optionalBuffers ) {

	optionalBuffers = optionalBuffers || {};
	var width = beautyRenderTarget.width, height = beautyRenderTarget.height;

	this.sampleLevel = 1;

	this.beautyRenderTarget = beautyRenderTarget; // not owned by MSAAEffect
  this.sampleRenderTarget = optionalBuffers.sampleRenderTarget || new THREE.WebGLRenderTarget( width, height, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat }  );

	this.setSize( width, height );

};

THREE.MSAAEffect.prototype = {

	constructor: THREE.MSAAEffect,

	dispose: function() {

		if ( this.sampleRenderTarget ) {
			this.sampleRenderTarget.dispose();
			this.sampleRenderTarget = null;
		}

	},


	setSize: function ( width, height ) {

		this.sampleRenderTarget.setSize( width, height );

	},

	renderPass: function( renderer, scene, camera ) {

		var autoClear = renderer.autoClear;
		renderer.autoClear = true;

		var jitterOffsets = THREE.MSAAEffect.JitterVectors[ Math.max( 0, Math.min( this.sampleLevel, 5 ) ) ];
		var width = this.sampleRenderTarget.width, height = this.sampleRenderTarget.height;

		var jitterSum = 0;

		// render the scene multiple times, each slightly jitter offset from the last and accumulate the results.
		for ( var i = 0; i < jitterOffsets.length; i ++ ) {

			// only jitters perspective cameras.	TODO: add support for jittering orthogonal cameras
			var jitterOffset = jitterOffsets[ i ];
			if ( camera.setViewOffset ) {
				camera.setViewOffset( width, height,
					jitterOffset[ 0 ] * 0.0625, jitterOffset[ 1 ] * 0.0625,   // 0.0625 = 1 / 16
					width, height );
			}

			renderer.render( scene, camera, this.sampleRenderTarget, true, 'msaa: sample #' + i );

			var blendWeight = 1.0 / jitterOffsets.length;

			//console.log( 'writeBuffer', writeBuffer, 'readBuffer', readBuffer );
			if( i < ( jitterOffsets.length - 1 ) ) {
				var jitter = ( ( i / ( jitterOffsets.length - 1 )) * 2.0 - 1.0 ) * ( Math.PI * 0.1 / jitterOffsets.length );
				jitterSum += jitter;
				blendWeight += jitter;
			}
			else {
				blendWeight = 1.0 - jitterSum;
			}

			THREE.EffectRenderer.renderCopy( renderer, this.sampleRenderTarget.texture, blendWeight, THREE.AdditiveBlending,
				this.beautyRenderTarget, ( i === 0 ) ? renderer.getClearColor() : undefined, ( i === 0 ) ? renderer.getClearAlpha() : undefined,
				'msaa: composite #' + i );

		}

		// reset jitter to nothing.	TODO: add support for orthogonal cameras
		if ( camera.view ) camera.view = null;
		renderer.autoClear = autoClear;

	}

};

// These jitter vectors are specified in integers because it is easier.
// I am assuming a [-8,8) integer grid, but it needs to be mapped onto [-0.5,0.5)
// before being used, thus these integers need to be scaled by 1/16.
//
// Sample patterns reference: https://msdn.microsoft.com/en-us/library/windows/desktop/ff476218%28v=vs.85%29.aspx?f=255&MSPPError=-2147217396
THREE.MSAAEffect.JitterVectors = [
	[
		[ 0, 0 ]
	],
	[
		[ 4, 4 ], [ - 4, - 4 ]
	],
	[
		[ - 2, - 6 ], [ 6, - 2 ], [ - 6, 2 ], [ 2, 6 ]
	],
	[
		[ 1, - 3 ], [ - 1, 3 ], [ 5, 1 ], [ - 3, - 5 ],
		[ - 5, 5 ], [ - 7, - 1 ], [ 3, 7 ], [ 7, - 7 ]
	],
	[
		[ 1, 1 ], [ - 1, - 3 ], [ - 3, 2 ], [ 4, - 1 ],
		[ - 5, - 2 ], [ 2, 5 ], [ 5, 3 ], [ 3, - 5 ],
		[ - 2, 6 ], [ 0, - 7 ], [ - 4, - 6 ], [ - 6, 4 ],
		[ - 8, 0 ], [ 7, - 4 ], [ 6, 7 ], [ - 7, - 8 ]
	],
	[
		[ - 4, - 7 ], [ - 7, - 5 ], [ - 3, - 5 ], [ - 5, - 4 ],
		[ - 1, - 4 ], [ - 2, - 2 ], [ - 6, - 1 ], [ - 4, 0 ],
		[ - 7, 1 ], [ - 1, 2 ], [ - 6, 3 ], [ - 3, 3 ],
		[ - 7, 6 ], [ - 3, 6 ], [ - 5, 7 ], [ - 1, 7 ],
		[ 5, - 7 ], [ 1, - 6 ], [ 6, - 5 ], [ 4, - 4 ],
		[ 2, - 3 ], [ 7, - 2 ], [ 1, - 1 ], [ 4, - 1 ],
		[ 2, 1 ], [ 6, 2 ], [ 0, 4 ], [ 4, 4 ],
		[ 2, 5 ], [ 7, 5 ], [ 5, 6 ], [ 3, 7 ]
	]
];
