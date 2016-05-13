/**
 * @author bhouston / http://clara.io/
 *
 * Multi-Sample Anti-aliasing shader - for blending together sample buffers
 */

THREE.ModulateShader = {

	shaderID: "modulate",

	uniforms: {

		"tForeground": { type: "t", value: null },
    "tBackground": { type: "t", value: null },

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( '\n' ),

	fragmentShader: [

		"varying vec2 vUv;",

		"uniform sampler2D tForeground;",
    "uniform sampler2D tBackground;",

		"void main() {",

			"vec4 foreground = texture2D( tForeground, vUv );",
      "vec4 background = texture2D( tBackground, vUv );",

			"gl_FragColor = foreground * background;",

		"}"

	].join( '\n' )

};
