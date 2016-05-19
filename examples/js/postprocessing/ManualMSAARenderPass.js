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

THREE.ManualMSAARenderPass = function ( scene, camera ) {

	THREE.Pass.call( this );

	this.scene = scene;
	this.camera = camera;

	this.sampleLevel = 4; // specified as n, where the number of samples is 2^n, so sampleLevel = 4, is 2^4 samples, 16.
	this.unbiased = true;

	if ( THREE.CopyShader === undefined ) console.error( "THREE.ManualMSAARenderPass relies on THREE.CopyShader" );

	this.copyMaterial = new THREE.ShaderMaterial( THREE.CopyShader );
	this.copyMaterial.uniforms = THREE.UniformsUtils.clone( this.copyMaterial.uniforms );
	this.copyMaterial.blending = THREE.AdditiveBlending;
	this.copyMaterial.premultipliedAlpha = true;
	this.copyMaterial.transparent = true;
	this.copyMaterial.depthTest = false;
	this.copyMaterial.depthWrite = false;

};

THREE.ManualMSAARenderPass.prototype = Object.create( THREE.Pass.prototype );

Object.assign( THREE.ManualMSAARenderPass.prototype, {

	dispose: function() {

		if ( this.sampleRenderTarget ) {

			this.sampleRenderTarget.dispose();
			this.sampleRenderTarget = null;

		}

	},

	setSize: function ( width, height ) {

		if ( this.sampleRenderTarget )	this.sampleRenderTarget.setSize( width, height );

	},

	render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

		if ( ! this.sampleRenderTarget ) {

			this.sampleRenderTarget = new THREE.WebGLRenderTarget( readBuffer.width, readBuffer.height,
				{ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat } );

		}

		var jitterOffsets = THREE.ManualMSAARenderPass.JitterVectors[ Math.max( 0, Math.min( this.sampleLevel, 5 ) ) ];

		var autoClear = renderer.autoClear;
		renderer.autoClear = false;

		var baseSampleWeight = 1.0 / jitterOffsets.length;
		var roundingRange = 1 / 32;
		this.copyMaterial.uniforms[ "tDiffuse" ].value = this.sampleRenderTarget.texture;

		var width = readBuffer.width, height = readBuffer.height;

		// render the scene multiple times, each slightly jitter offset from the last and accumulate the results.
		for ( var i = 0; i < jitterOffsets.length; i ++ ) {

			var jitterOffset = jitterOffsets[i];
			if ( this.camera.setViewOffset ) {
				this.camera.setViewOffset( width, height,
					jitterOffset[ 0 ] * 0.0625, jitterOffset[ 1 ] * 0.0625,   // 0.0625 = 1 / 16
					width, height );
			}

			var sampleWeight = baseSampleWeight;
			if( this.unbiased ) {
				// the theory is that equal weights for each sample lead to an accumulation of rounding errors.
				// The following equation varies the sampleWeight per sample so that it is uniformly distributed
				// across a range of values whose rounding errors cancel each other out.
				var uniformCenteredDistribution = ( -0.5 + ( i + 0.5 ) / jitterOffsets.length );
				sampleWeight += roundingRange * uniformCenteredDistribution;
			}

			this.copyMaterial.uniforms[ "opacity" ].value = sampleWeight;

			renderer.render( this.scene, this.camera, this.sampleRenderTarget, true );
			renderer.renderPass( this.copyMaterial, writeBuffer, (i === 0) );

		}

		if ( this.camera.clearViewOffset ) this.camera.clearViewOffset();

		renderer.autoClear = autoClear;

	},

} );

// These jitter vectors are specified in integers because it is easier.
// I am assuming a [-8,8) integer grid, but it needs to be mapped onto [-0.5,0.5)
// before being used, thus these integers need to be scaled by 1/16.
//
// Sample patterns reference: https://msdn.microsoft.com/en-us/library/windows/desktop/ff476218%28v=vs.85%29.aspx?f=255&MSPPError=-2147217396
THREE.ManualMSAARenderPass.JitterVectors = [
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
