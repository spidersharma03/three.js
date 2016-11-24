import { Vector4 } from '../../math/Vector4';
import { Color } from '../../math/Color';
import { Vector2 } from '../../math/Vector2';
import { DataTexture } from '../../textures/DataTexture';

/**
 * Uniforms library for shared webgl shaders
 */

var UniformsLib = {

	common: {

		diffuse: { value: new Color( 0xeeeeee ) },
		opacity: { value: 1.0 },

		"map": { value: null },
		"mapUVTransformParams": { value: new Vector4( 0, 0, 1, 1 ) },
		"mapTexelTransformParams": { value: new Vector2( 1, 0 ) },
		"offsetRepeat": { value: new Vector4( 0, 0, 1, 1 ) },

		"specularMap": { value: null },
		"specularMapUVTransformParams": { value: new Vector4( 0, 0, 1, 1 ) },
		"specularMapTexelTransformParams": { value: new Vector2( 1, 0 ) },

		"alphaMap": { value: null },
		"alphaMapUVTransformParams": { value: new Vector4( 0, 0, 1, 1 ) },
		"alphaMapTexelTransformParams": { value: new Vector2( 1, 0 ) },

		envMap: { value: null },
		flipEnvMap: { value: - 1 },
		reflectivity: { value: 1.0 },
		refractionRatio: { value: 0.98 }

	},

	aomap: {

		"aoMap": { value: null },
		"aoMapUVTransformParams": { value: new Vector4( 0, 0, 1, 1 ) },
		"aoMapTexelTransformParams": { value: new Vector2( 1, 0 ) },
		"aoMapIntensity": { value: 1 }

	},

	lightmap: {

		"lightMap": { value: null },
		"lightMapUVTransformParams": { value: new Vector4( 0, 0, 1, 1 ) },
		"lightMapTexelTransformParams": { value: new Vector2( 1, 0 ) },
		"lightMapIntensity": { value: 1 }

	},

	emissivemap: {

		"emissiveMap": { value: null },
		"emissiveMapUVTransformParams": { value: new Vector4( 0, 0, 1, 1 ) },
		"emissiveMapTexelTransformParams": { value: new Vector2( 1, 0 ) }

	},

	bumpmap: {

		"bumpMap": { value: null },
		"bumpScale": { value: 1 },
		"bumpMapUVTransformParams": { value: new Vector4( 0, 0, 1, 1 ) },
		"bumpMapTexelTransformParams": { value: new Vector2( 1, 0 ) }

	},

	normalmap: {

		"normalMap": { value: null },
		"normalScale": { value: new Vector2( 1, 1 ) }, // for backwards compatibility
		"normalMapUVTransformParams": { value: new Vector4( 0, 0, 1, 1 ) },
		"normalMapTexelTransformParams": { value: new Vector2( 1, 0 ) }

	},

	displacementmap: {

		"displacementMap": { value: null },
		"displacementScale": { value: 1 }, // for backwards compatibility
		"displacementBias": { value: 0 }, // for backwards compatibility
		"displacementMapUVTransformParams": { value: new Vector4( 0, 0, 1, 1 ) },
		"displacementMapTexelTransformParams": { value: new Vector2( 1, 0 ) }

	},


	falloffmap: {

		"falloffMap": { value: null },
		"falloffMapUVTransformParams": { value: new Vector4( 0, 0, 1, 1 ) },
		"falloffMapTexelTransformParams": { value: new Vector2( 1, 0 ) }

	},

	falloffalphamap: {

		"falloffAlphaMap": { value: null },
		"falloffAlphaMapUVTransformParams": { value: new Vector4( 0, 0, 1, 1 ) },
		"falloffAlphaMapTexelTransformParams": { value: new Vector2( 1, 0 ) }

	},

	roughnessmap: {

		"roughnessMap": { value: null },
		"roughnessMapUVTransformParams": { value: new Vector4( 0, 0, 1, 1 ) },
		"roughnessMapTexelTransformParams": { value: new Vector2( 1, 0 ) }

	},

	metalnessmap: {

		"metalnessMap": { value: null },
		"metalnessMapUVTransformParams": { value: new Vector4( 0, 0, 1, 1 ) },
		"metalnessMapTexelTransformParams": { value: new Vector2( 1, 0 ) }

	},

	fog: {

		fogDensity: { value: 0.00025 },
		fogNear: { value: 1 },
		fogFar: { value: 2000 },
		fogColor: { value: new Color( 0xffffff ) }

	},

	lights: {

		ambientLightColor: { value: [] },

		directionalLights: { value: [], properties: {
			direction: {},
			color: {},

			shadow: {},
			shadowBias: {},
			shadowRadius: {},
			shadowMapSize: {},
			shadowSpreadAngle: {},
			shadowCameraParams: {}
		} },

		directionalShadowMap: { value: [] },
		directionalShadowMatrix: { value: [] },

		spotLights: { value: [], properties: {
			color: {},
			position: {},
			direction: {},
			distance: {},
			coneCos: {},
			penumbraCos: {},
			decay: {},

			shadow: {},
			shadowBias: {},
			shadowRadius: {},
			shadowMapSize: {},
			shadowCameraParams: {}
		} },

		spotShadowMap: { value: [] },
		spotShadowMatrix: { value: [] },

		pointLights: { value: [], properties: {
			color: {},
			position: {},
			decay: {},
			distance: {},

			shadow: {},
			shadowBias: {},
			shadowRadius: {},
			shadowMapSize: {}
		} },

		pointShadowMap: { value: [] },
		pointShadowMatrix: { value: [] },

		hemisphereLights: { value: [], properties: {
			direction: {},
			skyColor: {},
			groundColor: {}
		} },

        // TODO (abelnation): RectAreaLight BRDF data needs to be moved from example to main src
        rectAreaLights: { value: [], properties: {
            color: {},
            position: {},
            width: {},
            height: {},
        } }

	},

	points: {

		diffuse: { value: new Color( 0xeeeeee ) },
		opacity: { value: 1.0 },
		size: { value: 1.0 },
		scale: { value: 1.0 },
		map: { value: null },
		offsetRepeat: { value: new Vector4( 0, 0, 1, 1 ) }

	}

};

export { UniformsLib };
