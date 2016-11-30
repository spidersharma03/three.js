/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.BloomPass = function ( strength, kernelSize, sigma, resolution ) {

	THREE.Pass.call( this );

	strength = ( strength !== undefined ) ? strength : 1;
	kernelSize = ( kernelSize !== undefined ) ? kernelSize : 25;
	sigma = ( sigma !== undefined ) ? sigma : 4.0;
	resolution = ( resolution !== undefined ) ? resolution : 256;

	// render targets

	var pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };

	this.renderTargetX = new THREE.WebGLRenderTarget( resolution, resolution, pars );
	this.renderTargetY = new THREE.WebGLRenderTarget( resolution, resolution, pars );

	// copy material

	if ( THREE.CopyShader === undefined )
		console.error( "THREE.BloomPass relies on THREE.CopyShader" );

	var copyShader = THREE.CopyShader;

	this.copyUniforms = Object.assign( {}, copyShader.uniforms );

	this.copyUniforms[ "opacity" ] = new THREE.Uniform( strength );

	this.materialCopy = new THREE.ShaderMaterial( {

		uniforms: this.copyUniforms,
		vertexShader: copyShader.vertexShader,
		fragmentShader: copyShader.fragmentShader,
		blending: THREE.AdditiveBlending,
		transparent: true

	} );

	// convolution material

	if ( THREE.ConvolutionShader === undefined )
		console.error( "THREE.BloomPass relies on THREE.ConvolutionShader" );

	var convolutionShader = THREE.ConvolutionShader;

	this.convolutionUniforms = Object.assign( {}, convolutionShader.uniforms );

	this.convolutionUniforms[ "uImageIncrement" ] = new THREE.Uniform( THREE.BloomPass.blurX );
	this.convolutionUniforms[ "cKernel" ] = new THREE.Uniform( THREE.ConvolutionShader.buildKernel( sigma ) );

	this.materialConvolution = new THREE.ShaderMaterial( {

		uniforms: this.convolutionUniforms,
		vertexShader:  convolutionShader.vertexShader,
		fragmentShader: convolutionShader.fragmentShader,
		defines: {
			"KERNEL_SIZE_FLOAT": kernelSize.toFixed( 1 ),
			"KERNEL_SIZE_INT": kernelSize.toFixed( 0 )
		}

	} );

	this.needsSwap = false;

};

THREE.BloomPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: THREE.BloomPass,

	render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

		if ( maskActive ) renderer.context.disable( renderer.context.STENCIL_TEST );

		// Render quad with blured scene into texture (convolution pass 1)


		this.convolutionUniforms[ "tDiffuse" ] = new THREE.Uniform( readBuffer.texture );
		this.convolutionUniforms[ "uImageIncrement" ] = new THREE.Uniform( THREE.BloomPass.blurX );


		renderer.renderPass( this.materialConvolution, this.renderTargetX, true );


		// Render quad with blured scene into texture (convolution pass 2)

		this.convolutionUniforms[ "tDiffuse" ] = new THREE.Uniform( this.renderTargetX.texture );
		this.convolutionUniforms[ "uImageIncrement" ] = new THREE.Uniform( THREE.BloomPass.blurY );

		renderer.renderPass( this.materialConvolution, this.renderTargetY, true );

		// Render original scene with superimposed blur to texture

		this.copyUniforms[ "tDiffuse" ] = new THREE.Uniform( this.renderTargetY.texture );


		if ( maskActive ) renderer.context.enable( renderer.context.STENCIL_TEST );

		renderer.renderPass( this.materialCopy, readBuffer, this.clear );

	}

} );

THREE.BloomPass.blurX = new THREE.Vector2( 0.001953125, 0.0 );
THREE.BloomPass.blurY = new THREE.Vector2( 0.0, 0.001953125 );
