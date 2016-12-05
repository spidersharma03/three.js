THREE.SuperSamplePass = function() {

  THREE.Pass.call( this );

  function getSuperSampleMaterial(){
    return new THREE.ShaderMaterial({
      uniforms:{
        "sstextureRT1": { type: 't', value: null },
        "sstextureRT2": { type: 't', value: null },
        "frameCount:":  { type: 'f', value: 0}
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
        gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );\
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

  perturbProjectionMatrix: function( sampleNumber ) {
    var projectionMatrix = this.orthoCamera.projectionMatrix;
    var sample;
    var N = sampleNumber;
    N = sampleNumber % (this.supersamplePositions.length);
    sample = this.supersamplePositions[N];

    var w = window.innerWidth; var h = window.innerHeight;
    // sample.multiplyScalar(0.9);
    // sample.x = 0.5*Math.random() - 0.5;
    // sample.y = 0.5*Math.random() - 0.5;
    this.orthoCamera.setViewOffset(w, h, sample.x, sample.y, w, h);
    // this.camera.updateProjectionMatrix();
  },

  render: function( renderer, writeBuffer, readBuffer, delta, maskActive ) {
    // this.perturbProjectionMatrix( this.frameCount );
    this.frameCount++;
    this.oldClearColor.copy( renderer.getClearColor() );
		this.oldClearAlpha = renderer.getClearAlpha();
		var oldAutoClear = renderer.autoClear;
		renderer.autoClear = false;

		renderer.setClearColor( new THREE.Color( 0, 0, 0 ), 0 );

    if( this.sstextureRT === undefined ) {
      var size = renderer.getSize();
      this.sstextureRT = new THREE.WebGLRenderTarget( size.x, size.y );
    }
    this.superSampleMaterial.uniforms["sstextureRT1"].value = readBuffer.texture;
    this.superSampleMaterial.uniforms["sstextureRT2"].value = this.sstextureRT.texture;

    renderer.render( this.scene, this.orthoCamera, writeBuffer );

    renderer.setClearColor( this.oldClearColor, this.oldClearAlpha );
		renderer.autoClear = oldAutoClear;
    if ( this.orthoCamera.setViewOffset ) this.orthoCamera.clearViewOffset();
  }

});
