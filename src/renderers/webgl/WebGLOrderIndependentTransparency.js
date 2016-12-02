import { WebGLRenderTarget } from '../WebGLRenderTarget'
import { WebGLExtensions } from './WebGLExtensions'
import { Scene } from '../../scenes/Scene'
import { OrthographicCamera } from '../../cameras/OrthographicCamera'
import { Vector2 } from '../../math/Vector2'
import { ShaderMaterial } from '../../materials/ShaderMaterial'
import { PlaneBufferGeometry } from '../../geometries/PlaneBufferGeometry'
import { Mesh } from '../../objects/Mesh'

function WebGLOrderIndependentTransparency( renderer ) {
  var extensions = new WebGLExtensions();
  var params = { };
  var floatFragmentTextures = !! extensions.get( 'OES_texture_half_float' );
  if( floatFragmentTextures ) {
    params.type = FloatType;
  }
  else {
    var halfFloatFragmentTextures = !! extensions.get( 'OES_texture_float' );
    if( halfFloatFragmentTextures ) {
      params.type = HalfFloatType;
    } else {
      console.error("OIT Needs either Float or Half Float texture support");
    }
  }
  this.accumulateRT = new WebGLRenderTarget(w, h, params);
  this.revealageRT   = new WebGLRenderTarget(params);

  this.scene = new Scene();
  this.orthoCamera = new OrthographicCamera(-1, 1, 1, -1, -0.01, 100);

  var quad = new PlaneBufferGeometry(2, 2);
  var material = mergePassMaterial();
  material.uniforms["accumulationTexture"] = this.accumulateRT.value;
  material.uniforms["revealageTexture"] = this.revealageRT.value;

  var quadMesh = new Mesh(this.quad, material);
  this.scene.add( quadMesh );

  function mergePassMaterial() {
    return new ShaderMaterial( {
      uniforms : {
        "accumulationTexture" : { value : null },
        "revealageTexture" : { value : null },
        "mapSize"          : { value : new Vector2() }
      },

      vertexShader: "varying vec2 vUv;\n\
      void main() {\n\
        vUv = uv;\n\
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
      }",

      fragmentShader: "varying vec2 vUv;\
      uniform sampler2D accumulationTexture;\
      uniform sampler2D revealageTexture;\
      uniform vec2 mapSize;\
      void main() { \
        vec4 accumulationColor = texture2D( accumulationTexture, vUv );\
        float revealage = texture2D( revealageTexture, vUv ).r;\
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0 );\
      }\
      "

    });
  }
}

WebGLOrderIndependentTransparency.prototype = {
  constructor: WebGLOrderIndependentTransparency,

  setSize: function(width, height) {
    this.accumulateRT.setSize( width, height );
    this.revealageRT.setSize( width, height );
  },

  mergePass: function( renderer ) {
    renderer.render( this.scene, this.orthoCamera );
  }
}
