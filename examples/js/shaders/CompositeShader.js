/**
 * @author bhouston / http://clara.io
 *
 * Various composite operations
 */

THREE.CompositeShader = {

  defines: {

		"BLENDING": THREE.NoBlending

  },

	uniforms: {

    "tSource": { type: "t", value: null },
    "opacitySource": { type: "f", value: 1.0 },

		"tDestination": { type: "t", value: null },
    "opacityDestination": { type: "f", value: 1.0 }

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

    "uniform sampler2D tSource;",
    "uniform float opacitySource;",

		"uniform sampler2D tDestination;",
    "uniform float opacityDestination;",

		"varying vec2 vUv;",

		"void main() {",

			"vec4 d = opacityDestination * texture2D( tDestination, vUv );",
			"vec4 s = opacitySource * texture2D( tSource, vUv );",

      // all blending modes are implemented assuming premultiplied values

      "#if (BLENDING == " + THREE.NormalBlending + ")",

        "gl_FragColor = d * ( 1.0 - s.a ) + s;",

      "#elif (BLENDING == " + THREE.AdditiveBlending + ")",

        "gl_FragColor = d + s;",

      "#elif (BLENDING == " + THREE.SubtractiveBlending + ")",

        "gl_FragColor = d - s;",

      "#elif (BLENDING == " + THREE.MultiplyBlending + ")",

        "gl_FragColor = d * s;",

      "#else", // THREE.NoBlending

        "gl_FragColor = s;",

      "#endif",

		"}"

	].join( "\n" )

};
