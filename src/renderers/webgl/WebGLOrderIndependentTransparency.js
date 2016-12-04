import { WebGLRenderTarget } from '../WebGLRenderTarget'
import { WebGLExtensions } from './WebGLExtensions'
import { Scene } from '../../scenes/Scene'
import { OrthographicCamera } from '../../cameras/OrthographicCamera'
import { Vector2 } from '../../math/Vector2'
import { ShaderMaterial } from '../../materials/ShaderMaterial'
import { PlaneBufferGeometry } from '../../geometries/PlaneBufferGeometry'
import { Mesh } from '../../objects/Mesh'
import { FloatType, HalfFloatType, CustomBlending, AddEquation, OneFactor, ZeroFactor, SrcAlphaFactor, OneMinusSrcAlphaFactor } from '../../constants'

function WebGLOrderIndependentTransparency( gl ) {
  var extensions = new WebGLExtensions( gl );
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
  this.accumulateRT = new WebGLRenderTarget(0, 0, params);
  this.revealageRT   = new WebGLRenderTarget(0, 0, params);

  this.scene = new Scene();
  this.orthoCamera = new OrthographicCamera(-1, 1, 1, -1, -0.01, 100);

  var quad = new PlaneBufferGeometry(2, 2);
  var material = mergePassMaterial();
  material.blending = CustomBlending;
  material.blendEquation = AddEquation;
  material.blendSrc = OneMinusSrcAlphaFactor;
  material.blendDst = SrcAlphaFactor;
  material.blendEquationAlpha = AddEquation;
  material.blendSrcAlpha = OneMinusSrcAlphaFactor;
  material.blendDstAlpha = SrcAlphaFactor;
  material.premultipliedAlpha = true;

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
  this.blendFactorsMap = [];
  this.PASS_TYPE_ACCUM = 0;
  this.PASS_TYPE_REVEALAGE = 1;
  this.PASS_TYPE_COMBINE = 2;
  this.BlendStates = [];
  this.BlendStates[this.PASS_TYPE_ACCUM] = { blending:CustomBlending, blendEquation:AddEquation,
    blendSrc:OneFactor, blendDst:OneFactor, blendEquationAlpha:AddEquation,
    blendSrcAlpha:OneFactor, blendDstAlpha:OneFactor, premultipliedAlpha:true };
  this.BlendStates[this.PASS_TYPE_REVEALAGE] = { blending:CustomBlending, blendEquation:AddEquation,
    blendSrc:ZeroFactor, blendDst:OneMinusSrcAlphaFactor, blendEquationAlpha:AddEquation,
    blendSrcAlpha:ZeroFactor, blendDstAlpha:OneMinusSrcAlphaFactor, premultipliedAlpha:true };
  this.BlendStates[this.PASS_TYPE_COMBINE] = { blending:CustomBlending, blendEquation:AddEquation,
    blendSrc:OneMinusSrcAlphaFactor, blendDst:SrcAlphaFactor, blendEquationAlpha:AddEquation,
    blendSrcAlpha:OneMinusSrcAlphaFactor, blendDstAlpha:SrcAlphaFactor, premultipliedAlpha:true };
}

WebGLOrderIndependentTransparency.prototype = {
  constructor: WebGLOrderIndependentTransparency,

  setSize: function(width, height) {
    this.accumulateRT.setSize( width, height );
    this.revealageRT.setSize( width, height );
  },

  mergePass: function( renderer ) {
    renderer.render( this.scene, this.orthoCamera );
  },

  renderTransparentObjects: function( transparentObjects, scene, camera, renderer ) {
    renderer.setClearColor( 0x000000, 0);
    renderer.setRenderTarget(this.accumulateRT);
    this.changeBlendState( transparentObjects, this.PASS_TYPE_ACCUM );
    renderer.renderObjects( transparentObjects, scene, camera );

    renderer.setClearColor( 0xffffff, 1);
    renderer.setRenderTarget(this.revealageRT);
    this.changeBlendState( transparentObjects, this.oitManager.PASS_TYPE_REVEALAGE );
    renderer.renderObjects( transparentObjects, scene, camera );
    this.oitManager.restoreBlendState( transparentObjects );

    renderer.setRenderTarget(null);
    this.mergePass();
  },

  changeBlendState: function( transparentList, passType ) {
    if( passType === undefined || ( (passType !== this.PASS_TYPE_ACCUM) ||  (passType !== this.PASS_TYPE_REVEALAGE) ) ) {
      console.log("Invalid passType");
      return;
    }

    this.blendFactorsMap = [];
    var newBlendState = this.BlendStates[passType];
    for ( var i = 0, l = transparentList.length; i < l; i ++ ) {

      var renderItem = transparentList[ i ];
      var material = renderItem.material;
      var blendState = { blending:material.blending, blendEquation:material.blendEquation,
        blendSrc:material.blendSrc, blendDst:material.blendDst, blendEquationAlpha:material.blendEquationAlpha,
        blendSrcAlpha:material.blendSrcAlpha, blendDstAlpha:material.blendDstAlpha, premultipliedAlpha:material.premultipliedAlpha,
        needsUpdate:material.needsUpdate
      };
      this.blendFactorsMap[material] = blendState;
      material.blending = newBlendState.blending;
      material.blendEquation = newBlendState.blendEquation;
      material.blendSrc = newBlendState.blendSrc;
      material.blendDst = newBlendState.blendDst;
      material.blendEquationAlpha = newBlendState.blendEquationAlpha;
      material.blendSrcAlpha = newBlendState.blendSrcAlpha;
      material.blendDstAlpha = newBlendState.blendDstAlpha;
      material.premultipliedAlpha = newBlendState.premultipliedAlpha;
      material.needsUpdate = true;
    }
  },

  restoreBlendState: function( transparentList ) {
    for ( var i = 0, l = transparentList.length; i < l; i ++ ) {

      var renderItem = transparentList[ i ];
      var material = renderItem.material;
      var originalBlendState = this.blendFactorsMap[material];
      material.blending = originalBlendState.blending;
      material.blendEquation = originalBlendState.blendEquation;
      material.blendSrc = originalBlendState.blendSrc;
      material.blendDst = originalBlendState.blendDst;
      material.blendEquationAlpha = originalBlendState.blendEquationAlpha;
      material.blendSrcAlpha = originalBlendState.blendSrcAlpha;
      material.blendDstAlpha = originalBlendState.blendDstAlpha;
      material.premultipliedAlpha = originalBlendState.premultipliedAlpha;
      material.needsUpdate = originalBlendState.needsUpdate;
    }
  }
}

export { WebGLOrderIndependentTransparency };
