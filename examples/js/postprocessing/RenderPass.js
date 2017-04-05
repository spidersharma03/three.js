/**
 * @author alteredq / http://alteredqualia.com/
 * @author bhouston / http://clara.io/
 */

THREE.RenderPass = function ( scene, camera, overrideMaterial, clearColor, clearAlpha ) {

	THREE.Pass.call( this );

	this.scene = scene;
	this.camera = camera;

	this.renderOver = false;

	this.overrideMaterial = overrideMaterial;

	this.clearColor = clearColor;
	this.clearAlpha = ( clearAlpha !== undefined ) ? clearAlpha : 0;

	this.clear = true;
	this.clearDepth = false;
	this.needsSwap = false;

	if ( THREE.CopyShader === undefined ) console.error( "THREE.SSAARenderPass relies on THREE.CopyShader" );

	this.overMaterial = new THREE.ShaderMaterial( THREE.CopyShader );
	this.overMaterial.uniforms = THREE.UniformsUtils.clone( this.overMaterial.uniforms );
	this.overMaterial.blending = THREE.NormalBlending;
	this.overMaterial.premultipliedAlpha = true;
	this.overMaterial.transparent = true;
	this.overMaterial.depthTest = false;
	this.overMaterial.depthWrite = false;

	this.camera2 = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
	this.scene2	= new THREE.Scene();
	this.quad2 = new THREE.Mesh( new THREE.PlaneGeometry( 2, 2 ), this.copyMaterial );
	this.quad2.frustumCulled = false; // Avoid getting clipped
	this.scene2.add( this.quad2 );
	
};



THREE.RenderPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: THREE.RenderPass,

	render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

		var oldAutoClear = renderer.autoClear;
		renderer.autoClear = false;

		this.scene.overrideMaterial = this.overrideMaterial;

		var oldClearColor, oldClearAlpha;
		oldClearColor = renderer.getClearColor();
		oldClearAlpha = renderer.getClearAlpha();

		if ( this.clearDepth ) {

			renderer.clearDepth();

		}
	
		if( this.renderOver ) {

			renderer.setClearColor( 0x000000, 0 );
			renderer.renderOverride( this.overrideMaterial, this.scene, this.camera, writeBuffer, true );

			this.overMaterial.uniforms[ 'tDiffuse' ].value = writeBuffer.texture;

			if ( this.clearColor !== undefined ) {
	
				renderer.setClearColor( this.clearColor, this.clearAlpha );

			}

			renderer.renderOverride( this.overMaterial, this.scene2, this.camera2, this.renderToScreen ? null : readBuffer, this.clear );
		}
		else {

			if ( this.clearColor !== undefined ) {
	
				renderer.setClearColor( this.clearColor, this.clearAlpha );

			}
			renderer.renderOverride( this.overrideMaterial, this.scene, this.camera, this.renderToScreen ? null : readBuffer, this.clear );

		}


		if ( this.clearColor ) {

			renderer.setClearColor( oldClearColor, oldClearAlpha );

		}

		this.scene.overrideMaterial = null;
		renderer.autoClear = oldAutoClear;

	}

} );