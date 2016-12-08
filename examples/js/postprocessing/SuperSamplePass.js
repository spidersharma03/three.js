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
        vec4 color = color2 * ( frameCount - 1.0 ) + color1;\
        gl_FragColor = vec4(vec3(color.rgb/frameCount),1.0);\
      }\
      "
    });
  }
  this.scene = new THREE.Scene();
  this.orthoCamera1 = new THREE.OrthographicCamera(-1, 1, 1, -1, -0.01, 1000);
  this.orthoCamera2 = new THREE.OrthographicCamera(-1, 1, 1, -1, -0.01, 1000);
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

  perturbProjectionMatrix: function( sampleNumber ) {
    var projectionMatrix = this.orthoCamera1.projectionMatrix;
    var sample;
    var N = sampleNumber;
    N = sampleNumber % (this.supersamplePositions.length);
    sample = this.supersamplePositions[N];

    var w = window.innerWidth; var h = window.innerHeight;
    // sample.x = 0.5*Math.random() - 0.5;
    // sample.y = 0.5*Math.random() - 0.5;
    var scale = 0.01;
    // this.orthoCamera1.setViewOffset(w, h, (2*sample.x-1) * scale, (2*sample.y-1) * scale, w, h);
    // var matrix = this.orthoCamera1.projectionMatrix;
    // var te = matrix.elements;

		// te[ 0 ] = 2 * w;	te[ 4 ] = 0;	te[ 8 ] = 0;	te[ 12 ] = - x;
		// te[ 1 ] = 0;	te[ 5 ] = 2 * h;	te[ 9 ] = 0;	te[ 13 ] = - y;
		// te[ 2 ] = 0;	te[ 6 ] = 0;	te[ 10 ] = - 2 * p;	te[ 14 ] = - z;
		// te[ 3 ] = 0;	te[ 7 ] = 0;	te[ 11 ] = 0;	te[ 15 ] = 1;
    // te[8] += sample.x;
    // te[9] += sample.y;
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
    this.superSampleMaterial.uniforms["sstextureRT1"].value = readBuffer.texture;
    this.superSampleMaterial.uniforms["sstextureRT2"].value = this.sstextureRT.texture;
    this.superSampleMaterial.uniforms["frameCount"].value = this.frameCount;

    this.scene.overrideMaterial = this.superSampleMaterial;
    renderer.render( this.scene, this.orthoCamera1, writeBuffer, true );
    this.scene.overrideMaterial = null;

    this.copyUniforms["tDiffuse"].value = writeBuffer;
    this.copyUniforms["opacity"].value = 1;
    this.scene.overrideMaterial = this.copyMaterial;
    renderer.render( this.scene, this.orthoCamera2, this.sstextureRT, true );
    this.copyUniforms["tDiffuse"].value = this.sstextureRT;
    renderer.render( this.scene, this.orthoCamera2 );
    this.scene.overrideMaterial = null;

    renderer.setClearColor( this.oldClearColor, this.oldClearAlpha );
		renderer.autoClear = oldAutoClear;
    // if ( this.orthoCamera1.setViewOffset ) this.orthoCamera1.clearViewOffset();
  }

});
