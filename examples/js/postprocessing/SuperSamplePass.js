THREE.SuperSamplePass = function() {

  THREE.Pass.call( this );

  function getSuperSampleMaterial(){
    return new THREE.ShaderMaterial({
      uniforms:{
        "sstextureRT1": { type: 't', value: null },
        "sstextureRT2": { type: 't', value: null },
        "frameCount":  { type: 'f', value: 0}
      },

      vertexShader: "varying vec2 vUv;\
      void main() {\
        vUv = uv;\
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\
      }",

      fragmentShader: "varying vec2 vUv;\
      uniform sampler2D sstextureRT1;\
      uniform sampler2D sstextureRT2;\
      uniform float frameCount;\
      void main() {\
        vec4 color1 = texture2D(sstextureRT1, vUv);\
        vec4 color2 = texture2D(sstextureRT2, vUv);\
        vec4 color;\
        const float n1 = 16.0;\
        const float n2 = 150.0;\
        if( frameCount > n2 || frameCount < n1 ) {\
          float N = frameCount < n1 ? frameCount : frameCount - n2;\
          color = color2 * ( N - 1.0 ) + color1;\
          color.rgb /= N;\
        }\
        else {\
          color = color2;\
        }\
        gl_FragColor = vec4(color.rgb,1.0);\
      }\
      "
    });
  }
  this.scene = new THREE.Scene();
  this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -0.01, 1000);
  this.superSampleMaterial = getSuperSampleMaterial();
  var quad = new THREE.PlaneGeometry( 2, 2 );
  var quadMesh = new THREE.Mesh( quad, this.superSampleMaterial );
  this.scene.add( quadMesh );
  this.frameCount = 0;
  this.oldClearColor = new THREE.Color();
	this.oldClearAlpha = 1;
  this.poissonSampler = new PoissonDiskGenerator(100, -1, false, false);
  this.supersamplePositions = this.poissonSampler.generatePoints();
  this.needsSwap = false;
  if ( THREE.CopyShader === undefined ) console.error( "THREE.SuperSamplePass relies on THREE.CopyShader" );

	var copyShader = THREE.CopyShader;
	this.copyUniforms = THREE.UniformsUtils.clone( copyShader.uniforms );

	this.copyMaterial = new THREE.ShaderMaterial(	{
		uniforms: this.copyUniforms,
		vertexShader: copyShader.vertexShader,
		fragmentShader: copyShader.fragmentShader,
	} );

  var w = window.innerWidth; var h = window.innerHeight;
  var params = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
  this.sstextureRT = new THREE.WebGLRenderTarget( w, h, params );
}


THREE.SuperSamplePass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {
  constructor: THREE.SuperSamplePass,

  dispose: function() {
		this.sstextureRT.dispose();
	},

	setSize: function ( width, height ) {

		var resx = Math.round(width/2);
		var resy = Math.round(height/2);

		// this.sstextureRT.setSize(resx, resy);
	},

  render: function( renderer, writeBuffer, readBuffer, delta, maskActive ) {
    this.frameCount++;
    this.oldClearColor.copy( renderer.getClearColor() );
		this.oldClearAlpha = renderer.getClearAlpha();
		var oldAutoClear = renderer.autoClear;
		renderer.autoClear = false;

		renderer.setClearColor( new THREE.Color( 0, 0, 0 ), 0 );
    this.superSampleMaterial.uniforms["sstextureRT1"].value = readBuffer.texture;
    this.superSampleMaterial.uniforms["sstextureRT2"].value = this.sstextureRT.texture;
    this.superSampleMaterial.uniforms["frameCount"].value = this.frameCount;

    this.scene.overrideMaterial = this.superSampleMaterial;
    renderer.render( this.scene, this.orthoCamera, writeBuffer, true );
    this.scene.overrideMaterial = null;

    this.copyUniforms["tDiffuse"].value = writeBuffer;
    this.copyUniforms["opacity"].value = 1;
    this.scene.overrideMaterial = this.copyMaterial;
    renderer.render( this.scene, this.orthoCamera, this.sstextureRT, true );
    this.copyUniforms["tDiffuse"].value = this.sstextureRT;
    renderer.render( this.scene, this.orthoCamera );
    this.scene.overrideMaterial = null;

    renderer.setClearColor( this.oldClearColor, this.oldClearAlpha );
		renderer.autoClear = oldAutoClear;
  }

});
