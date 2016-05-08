/**
 * Uniforms library for shared webgl shaders
 */

THREE.UniformsLib = {

	common: {

		"diffuse": { type: "c", value: new THREE.Color( 0xeeeeee ) },
		"opacity": { type: "1f", value: 1.0 },

		"map": { type: "t", value: null },
		"mapUVTransformParams": { type: "v4", value: new THREE.Vector4( 0, 0, 1, 1 ) },
		"mapTexelTransformParams": { type: "v2", value: new THREE.Vector2( 1, 0 ) },
		"offsetRepeat": { type: "v4", value: new THREE.Vector4( 0, 0, 1, 1 ) },

		"specularMap": { type: "t", value: null },
		"specularMapUVTransformParams": { type: "v4", value: new THREE.Vector4( 0, 0, 1, 1 ) },
		"specularMapTexelTransformParams": { type: "v2", value: new THREE.Vector2( 1, 0 ) },

		"alphaMap": { type: "t", value: null },
		"alphaMapUVTransformParams": { type: "v4", value: new THREE.Vector4( 0, 0, 1, 1 ) },
		"alphaMapTexelTransformParams": { type: "v2", value: new THREE.Vector2( 1, 0 ) },

		"envMap": { type: "t", value: null },
		"flipEnvMap": { type: "1f", value: - 1 },
		"reflectivity": { type: "1f", value: 1.0 },
		"refractionRatio": { type: "1f", value: 0.98 }

	},

	aomap: {

		"aoMap": { type: "t", value: null },
		"aoMapUVTransformParams": { type: "v4", value: new THREE.Vector4( 0, 0, 1, 1 ) },
		"aoMapTexelTransformParams": { type: "v2", value: new THREE.Vector2( 1, 0 ) },
		"aoMapIntensity": { type: "1f", value: 1 }

	},

	lightmap: {

		"lightMap": { type: "t", value: null },
		"lightMapUVTransformParams": { type: "v4", value: new THREE.Vector4( 0, 0, 1, 1 ) },
		"lightMapTexelTransformParams": { type: "v2", value: new THREE.Vector2( 1, 0 ) },
		"lightMapIntensity": { type: "1f", value: 1 }

	},

	emissivemap: {

		"emissiveMap": { type: "t", value: null },
		"emissiveMapUVTransformParams": { type: "v4", value: new THREE.Vector4( 0, 0, 1, 1 ) },
		"emissiveMapTexelTransformParams": { type: "v2", value: new THREE.Vector2( 1, 0 ) }

	},

	bumpmap: {

		"bumpMap": { type: "t", value: null },
		"bumpScale": { type: "1f", value: 1 }
		"bumpMapUVTransformParams": { type: "v4", value: new THREE.Vector4( 0, 0, 1, 1 ) },
		"bumpMapTexelTransformParams": { type: "v2", value: new THREE.Vector2( 1, 0 ) }

	},

	normalmap: {

		"normalMap": { type: "t", value: null },
		"normalScale": { type: "v2", value: new THREE.Vector2( 1, 1 ) }, // for backwards compatibility
		"normalMapUVTransformParams": { type: "v4", value: new THREE.Vector4( 0, 0, 1, 1 ) },
		"normalMapTexelTransformParams": { type: "v2", value: new THREE.Vector2( 1, 0 ) }

	},

	displacementmap: {

		"displacementMap": { type: "t", value: null },
		"displacementScale": { type: "1f", value: 1 }, // for backwards compatibility
		"displacementBias": { type: "1f", value: 0 }, // for backwards compatibility
		"displacementMapUVTransformParams": { type: "v4", value: new THREE.Vector4( 0, 0, 1, 1 ) },
		"displacementMapTexelTransformParams": { type: "v2", value: new THREE.Vector2( 1, 0 ) }

	},

	roughnessmap: {

		"roughnessMap": { type: "t", value: null },
		"roughnessMapUVTransformParams": { type: "v4", value: new THREE.Vector4( 0, 0, 1, 1 ) },
		"roughnessMapTexelTransformParams": { type: "v2", value: new THREE.Vector2( 1, 0 ) }

	},

	metalnessmap: {

		"metalnessMap": { type: "t", value: null },
		"metalnessMapUVTransformParams": { type: "v4", value: new THREE.Vector4( 0, 0, 1, 1 ) },
		"metalnessMapTexelTransformParams": { type: "v2", value: new THREE.Vector2( 1, 0 ) }

	},

	fog: {

		"fogDensity": { type: "1f", value: 0.00025 },
		"fogNear": { type: "1f", value: 1 },
		"fogFar": { type: "1f", value: 2000 },
		"fogColor": { type: "c", value: new THREE.Color( 0xffffff ) }

	},

	lights: {

		"ambientLightColor": { type: "3fv", value: [] },

		"directionalLights": { type: "sa", value: [], properties: {
			"direction": { type: "v3" },
			"color": { type: "c" },

			"shadow": { type: "1i" },
			"shadowBias": { type: "1f" },
			"shadowRadius": { type: "1f" },
			"shadowMapSize": { type: "v2" }
		} },

		"directionalShadowMap": { type: "tv", value: [] },
		"directionalShadowMatrix": { type: "m4v", value: [] },

		"spotLights": { type: "sa", value: [], properties: {
			"color": { type: "c" },
			"position": { type: "v3" },
			"direction": { type: "v3" },
			"distance": { type: "1f" },
			"coneCos": { type: "1f" },
			"penumbraCos": { type: "1f" },
			"decay": { type: "1f" },

			"shadow": { type: "1i" },
			"shadowBias": { type: "1f" },
			"shadowRadius": { type: "1f" },
			"shadowMapSize": { type: "v2" }
		} },

		"spotShadowMap": { type: "tv", value: [] },
		"spotShadowMatrix": { type: "m4v", value: [] },

		"pointLights": { type: "sa", value: [], properties: {
			"color": { type: "c" },
			"position": { type: "v3" },
			"decay": { type: "1f" },
			"distance": { type: "1f" },

			"shadow": { type: "1i" },
			"shadowBias": { type: "1f" },
			"shadowRadius": { type: "1f" },
			"shadowMapSize": { type: "v2" }
		} },

		"pointShadowMap": { type: "tv", value: [] },
		"pointShadowMatrix": { type: "m4v", value: [] },

		"hemisphereLights": { type: "sa", value: [], properties: {
			"direction": { type: "v3" },
			"skyColor": { type: "c" },
			"groundColor": { type: "c" }
		} }

	},

	points: {

		"diffuse": { type: "c", value: new THREE.Color( 0xeeeeee ) },
		"opacity": { type: "1f", value: 1.0 },
		"size": { type: "1f", value: 1.0 },
		"scale": { type: "1f", value: 1.0 },
		"map": { type: "t", value: null },
		"offsetRepeat": { type: "v4", value: new THREE.Vector4( 0, 0, 1, 1 ) }

	}

};
