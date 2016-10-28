/**
 * Uniform Utilities
 */

THREE.UniformsUtils = {

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

	cloneDefines: function ( defines_src ) {

		var defines_dst = {};

		for ( var u in defines_src ) {

			defines_dst[ u ] = this.cloneValue( defines_src[ u ] );

		}

		return defines_dst;

	},


	clone: function ( uniforms_src ) {

		var uniforms_dst = {};

		for ( var u in uniforms_src ) {

			uniforms_dst[ u ] = {};

			for ( var p in uniforms_src[ u ] ) {

				uniforms_dst[ u ][ p ] = THREE.UniformsUtils.cloneValue( uniforms_src[ u ][ p ] );

			}

		}

		return uniforms_dst;

	},

	cloneValue: function( parameter_src ) {

		if ( parameter_src instanceof THREE.Color ||
			 parameter_src instanceof THREE.Vector2 ||
			 parameter_src instanceof THREE.Vector3 ||
			 parameter_src instanceof THREE.Vector4 ||
			 parameter_src instanceof THREE.Matrix3 ||
			 parameter_src instanceof THREE.Matrix4 ||
			 parameter_src instanceof THREE.Texture ) {

			return parameter_src.clone();

		} else if ( Array.isArray( parameter_src ) ) {

			return parameter_src.slice();

		} else {

			return parameter_src;

		}
	}

};
