import { WebGLRenderTarget } from '../WebGLRenderTarget'
import { WebGLExtensions } from './WebGLExtensions'
import { Scene } from '../../scenes/Scene'
import { OrthographicCamera } from '../../cameras/OrthographicCamera'
import { Vector2 } from '../../math/Vector2'
import { ShaderMaterial } from '../../materials/ShaderMaterial'
import { PlaneBufferGeometry } from '../../geometries/PlaneBufferGeometry'
import { Mesh } from '../../objects/Mesh'
import { FloatType, HalfFloatType, UnsignedByteType, CustomBlending, AddEquation, SubtractEquation, OneFactor, ZeroFactor, SrcAlphaFactor, OneMinusSrcAlphaFactor, PaintersTransperancy, OrderIndependentTransperancy } from '../../constants'

function WebGLOITManager( gl ) {
  var extensions = new WebGLExtensions( gl );
  var params = { };
  var halfFloatFragmentTextures = !! extensions.get( 'OES_texture_half_float' );
  if( halfFloatFragmentTextures ) {
    params.type = HalfFloatType;
  }
  else {
    var floatFragmentTextures = !! extensions.get( 'OES_texture_float' );
    if( floatFragmentTextures ) {
      params.type = FloatType;
    } else {
      console.error("OIT Needs either Float or Half Float texture support");
    }
  }
  this.opaqueRT     = new WebGLRenderTarget(0, 0, {type: UnsignedByteType});
  this.accumulateRT = new WebGLRenderTarget(0, 0, params);
  this.revealageRT  = new WebGLRenderTarget(0, 0, {type: UnsignedByteType});
  this.depthTexture = new THREE.DepthTexture();

  this.opaqueRT.depthTexture = this.depthTexture;
  this.accumulateRT.depthTexture = this.depthTexture;
  this.revealageRT.depthTexture = this.depthTexture;

  this.scene = new Scene();
  this.orthoCamera = new OrthographicCamera(-1, 1, 1, -1, -0.01, 100);

  var quad = new PlaneBufferGeometry(2, 2);

  function mergePassMaterial() {
    return new ShaderMaterial( {
      uniforms : {
        "accumulationTexture" : { value : null },
        "revealageTexture" : { value : null },
        "opaqueTexture" : { value : null }
      },

      vertexShader: "varying vec2 vUv;\n\
      void main() {\n\
        vUv = uv;\n\
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
      }",

      fragmentShader: "varying vec2 vUv;\
      uniform sampler2D opaqueTexture;\
      uniform sampler2D accumulationTexture;\
      uniform sampler2D revealageTexture;\
      void main() { \
        vec4 accumulationColor = texture2D( accumulationTexture, vUv );\
        vec4 revealage = texture2D( revealageTexture, vUv );\
        vec4 opaqueColor = texture2D( opaqueTexture, vUv );\
        vec3 transparentColor = pow(vec3(accumulationColor.rgb / max(accumulationColor.a, 1e-5)), vec3(1.0));\
        vec3 finalColor = opaqueColor.rgb * revealage.r + (1.0 - revealage.r) * transparentColor;\
        gl_FragColor = vec4( finalColor, 1.0 );\
      }\
      "
    });
  };

  this.material = mergePassMaterial();

  this.material.uniforms["accumulationTexture"].value = this.accumulateRT.texture;
  this.material.uniforms["revealageTexture"].value = this.revealageRT.texture;
  this.material.uniforms["opaqueTexture"].value = this.opaqueRT.texture;

  var quadMesh = new Mesh( quad, this.material);
  this.scene.add( quadMesh );

  this.blendFactorsMap = [];
  this.PASS_TYPE_ACCUM = 0;
  this.PASS_TYPE_REVEALAGE = 1;
  this.BlendStates = [];
  this.BlendStates[this.PASS_TYPE_ACCUM] = { blending:CustomBlending, blendEquation:AddEquation,
    blendSrc:OneFactor, blendDst:OneFactor, blendEquationAlpha:AddEquation,
    blendSrcAlpha:OneFactor, blendDstAlpha:OneFactor, premultipliedAlpha:false };
  this.BlendStates[this.PASS_TYPE_REVEALAGE] = { blending:CustomBlending, blendEquation:AddEquation,
    blendSrc:ZeroFactor, blendDst:OneMinusSrcAlphaFactor, blendEquationAlpha:AddEquation,
    blendSrcAlpha:ZeroFactor, blendDstAlpha:OneMinusSrcAlphaFactor, premultipliedAlpha:false };
}

WebGLOITManager.prototype = {
  constructor: WebGLOITManager,

  setSize: function(width, height) {
    this.opaqueRT.setSize( width, height );
    this.accumulateRT.setSize( width, height );
    this.revealageRT.setSize( width, height );
  },

  mergePass: function( renderer ) {
    renderer.render( this.scene, this.orthoCamera );
  },

  render: function( opaqueObjects, transparentObjects, scene, camera, renderObjects, renderer ) {
    if( transparentObjects.length === 0 ) {
      renderObjects( opaqueObjects, scene, camera );
      return;
    }

    renderer.setRenderTarget(this.opaqueRT);
    renderer.clear(true, true, false);
    renderObjects( opaqueObjects, scene, camera );

    renderer.setRenderTarget(this.accumulateRT);
    renderer.oitMode = 0;
    this.changeBlendState( transparentObjects, this.PASS_TYPE_ACCUM );
    renderer.setClearColor( 0xff0000, 0);
    renderer.clear(true, false, false);
    renderObjects( transparentObjects, scene, camera );

    renderer.setRenderTarget(this.revealageRT);
    renderer.oitMode = 1;
    this.changeBlendState( transparentObjects, this.PASS_TYPE_REVEALAGE );
    renderer.setClearColor( 0xffffff, 1);
    renderer.clear(true, false, false);
    renderObjects( transparentObjects, scene, camera );

    this.restoreBlendState( transparentObjects );

    renderer.transparency = PaintersTransperancy; // Required, or else there is an infinite recursion
    renderer.setRenderTarget(null);
    var autoClear = renderer.autoClear;
    renderer.autoClear = false;
    this.mergePass( renderer );
    renderer.autoClear = autoClear;
    renderer.transparency = OrderIndependentTransperancy;
    renderer.oitMode = 2;
  },

  changeBlendState: function( transparentList, passType ) {
    if( passType === undefined || ( (passType !== this.PASS_TYPE_ACCUM) &&  (passType !== this.PASS_TYPE_REVEALAGE) ) ) {
      console.log("WebGLOrderIndependentTransparency::Invalid passType");
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
        needsUpdate:material.needsUpdate, depthWrite: material.depthWrite, depthTest: material.depthTest
      };
      this.blendFactorsMap[material.uuid] = blendState;
      material.blending = newBlendState.blending;
      material.blendEquation = newBlendState.blendEquation;
      material.blendSrc = newBlendState.blendSrc;
      material.blendDst = newBlendState.blendDst;
      material.blendEquationAlpha = newBlendState.blendEquationAlpha;
      material.blendSrcAlpha = newBlendState.blendSrcAlpha;
      material.blendDstAlpha = newBlendState.blendDstAlpha;
      material.premultipliedAlpha = newBlendState.premultipliedAlpha;
      material.depthWrite = false;
      material.depthTest  = true;

      material.needsUpdate = true;
    }
  },

  restoreBlendState: function( transparentList ) {
    for ( var i = 0, l = transparentList.length; i < l; i ++ ) {

      var renderItem = transparentList[ i ];
      var material = renderItem.material;
      var originalBlendState = this.blendFactorsMap[material.uuid];
      material.blending = originalBlendState.blending;
      material.blendEquation = originalBlendState.blendEquation;
      material.blendSrc = originalBlendState.blendSrc;
      material.blendDst = originalBlendState.blendDst;
      material.blendEquationAlpha = originalBlendState.blendEquationAlpha;
      material.blendSrcAlpha = originalBlendState.blendSrcAlpha;
      material.blendDstAlpha = originalBlendState.blendDstAlpha;
      material.premultipliedAlpha = originalBlendState.premultipliedAlpha;
      material.needsUpdate = originalBlendState.needsUpdate;
      material.depthWrite = originalBlendState.depthWrite;
      material.depthTest  = originalBlendState.depthTest;
      material.needsUpdate = true;
    }
  }
}

export { WebGLOITManager };
