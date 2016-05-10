THREE.MirrorHelper = function(mirror) {
  this.scene = new THREE.Scene();
  this.cameraOrtho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
  this.scene.add(this.quad);
  this.mirror = mirror;
  this.numMipMaps = 4;

  this.mirrorTextureMipMaps = [];
  this.tempRenderTargets = [];
  var parameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBFormat, stencilBuffer: false };
  var mirrorTexture = mirror.texture;
  var width = mirrorTexture.width/2, height = mirrorTexture.height/2;
  for( var i=0; i<this.numMipMaps; i++) {
    var renderTarget = new THREE.WebGLRenderTarget( width, height, parameters );
    renderTarget.generateMipmaps = false;
    this.mirrorTextureMipMaps.push(renderTarget);
    width /= 2; height /= 2;
  }

  width = mirrorTexture.width/2; height = mirrorTexture.height/2;
  for( var i=0; i<this.numMipMaps; i++) {
    var renderTarget = new THREE.WebGLRenderTarget( width, height, parameters );
    renderTarget.generateMipmaps = false;
    this.tempRenderTargets.push(renderTarget);
    width /= 2; height /= 2;
  }

  this.vBlurMaterial = new THREE.ShaderMaterial( THREE.BlurShader );
  this.vBlurMaterial.side = THREE.DoubleSide;
  this.vBlurMaterial.uniforms[ 'size' ].value.set( mirrorTexture.width/2, mirrorTexture.height/2 );
  this.vBlurMaterial.blending = THREE.NoBlending;
  THREE.BlurShaderUtils.configure( this.vBlurMaterial, 5, 3.0, new THREE.Vector2( 0, 1 ) );

  this.hBlurMaterial = this.vBlurMaterial.clone();
  this.hBlurMaterial.side = THREE.DoubleSide;
  this.hBlurMaterial.uniforms[ 'size' ].value.set( mirrorTexture.width/2, mirrorTexture.height/2 );
  this.hBlurMaterial.blending = THREE.NoBlending;
  THREE.BlurShaderUtils.configure( this.hBlurMaterial, 5, 3.0, new THREE.Vector2( 1, 0 ) );
}


THREE.MirrorHelper.prototype = {

  constructor: THREE.MirrorHelper,

  update: function(renderer) {

    var textureIn = this.mirror.texture;
    for( var i=0; i<this.numMipMaps; i++) {
      var renderTarget = this.mirrorTextureMipMaps[i];
      var tempRenderTarget = this.tempRenderTargets[i];

      this.hBlurMaterial.uniforms[ 'size' ].value.set( textureIn.width, textureIn.height );
      this.hBlurMaterial.uniforms[ "tDiffuse" ].value = textureIn;
      this.quad.material = this.hBlurMaterial;
      renderer.render(this.scene, this.cameraOrtho, tempRenderTarget, true);

      this.vBlurMaterial.uniforms[ 'size' ].value.set( tempRenderTarget.width, tempRenderTarget.height );
      this.vBlurMaterial.uniforms[ "tDiffuse" ].value = tempRenderTarget;
      this.quad.material = this.vBlurMaterial;
      renderer.render(this.scene, this.cameraOrtho, renderTarget, true);

      textureIn = renderTarget;
    }
  }
}
