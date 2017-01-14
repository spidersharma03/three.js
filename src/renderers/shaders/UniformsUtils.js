/**
 * Uniform Utilities
 */

var UniformsUtils = {

	merge: function ( uniforms ) {

		var merged = {};

		for ( var u = 0; u < uniforms.length; u ++ ) {

			var tmp = this.clone( uniforms[ u ] );

			for ( var p in tmp ) {

				merged[ p ] = tmp[ p ];

			}

		}

		return merged;

	},

	clone: function ( uniforms_src ) {

		var uniforms_dst = {};

		for ( var u in uniforms_src ) {

			uniforms_dst[ u ] = UniformsUtils.cloneParameters( uniforms_src[ u ] );

		}

		return uniforms_dst;

	},


	cloneParameters: function ( parameters_src ) {

		var parameters_dst = {}

		for ( var p in parameters_src ) {

			parameters_dst[ p ] = UniformsUtils.cloneParameter( parameters_src[ p ] );

		}

		return parameters_dst;

	},

	cloneParameter: function ( parameter_src ) {

		if ( parameter_src && ( parameter_src.isColor ||
			parameter_src.isMatrix3 || parameter_src.isMatrix4 ||
			parameter_src.isVector2 || parameter_src.isVector3 || parameter_src.isVector4 ||
			parameter_src.isTexture ) ) {

			return parameter_src.clone();

		} else if ( Array.isArray( parameter_src ) ) {

			return parameter_src.slice();

		} else {

			return parameter_src;

		}

	}

};


export { UniformsUtils };
