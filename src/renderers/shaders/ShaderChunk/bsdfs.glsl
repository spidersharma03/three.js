float punctualLightIntensityToIrradianceFactor( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {

		if( decayExponent > 0.0 ) {

#if defined ( PHYSICALLY_CORRECT_LIGHTS )

			// based upon Frostbite 3 Moving to Physically-based Rendering
			// page 32, equation 26: E[window1]
			// http://www.frostbite.com/wp-content/uploads/2014/11/course_notes_moving_frostbite_to_pbr_v2.pdf
			// this is intended to be used on spot and point lights who are represented as luminous intensity
			// but who must be converted to luminous irradiance for surface lighting calculation
			float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
			float maxDistanceCutoffFactor = pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
			return distanceFalloff * maxDistanceCutoffFactor;

#else

			return pow( saturate( -lightDistance / cutoffDistance + 1.0 ), decayExponent );

#endif

		}

		return 1.0;
}

vec3 BRDF_Diffuse_Lambert( const in vec3 diffuseColor ) {

	return RECIPROCAL_PI * diffuseColor;

} // validated


vec3 F_Schlick( const in vec3 specularColor, const in float dotLH ) {

	// Original approximation by Christophe Schlick '94
	//;float fresnel = pow( 1.0 - dotLH, 5.0 );

	// Optimized variant (presented by Epic at SIGGRAPH '13)
	float fresnel = exp2( ( -5.55473 * dotLH - 6.98316 ) * dotLH );

	return ( 1.0 - specularColor ) * fresnel + specularColor;

} // validated


// Microfacet Models for Refraction through Rough Surfaces - equation (34)
// http://graphicrants.blogspot.com/2013/08/specular-brdf-reference.html
// alpha is "roughness squared" in Disney’s reparameterization
float G_GGX_Smith( const in float alpha, const in float dotNL, const in float dotNV ) {

	// geometry term = G(l)⋅G(v) / 4(n⋅l)(n⋅v)

	float a2 = pow2( alpha );

	float gl = dotNL + sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	float gv = dotNV + sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );

	return 1.0 / ( gl * gv );

} // validated

// from page 12, listing 2 of http://www.frostbite.com/wp-content/uploads/2014/11/course_notes_moving_frostbite_to_pbr_v2.pdf
float G_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {

	float a2 = pow2( alpha );

	// dotNL and dotNV are explicitly swapped. This is not a mistake.
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );

	return 0.5 / max( gv + gl, EPSILON );
}



// Microfacet Models for Refraction through Rough Surfaces - equation (33)
// http://graphicrants.blogspot.com/2013/08/specular-brdf-reference.html
// alpha is "roughness squared" in Disney’s reparameterization
float D_GGX( const in float alpha, const in float dotNH ) {

	float a2 = pow2( alpha );

	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0; // avoid alpha = 0 with dotNH = 1

	return RECIPROCAL_PI * a2 / pow2( denom );

}


// GGX Distribution, Schlick Fresnel, GGX-Smith Visibility
vec3 BRDF_Specular_GGX( const in IncidentLight incidentLight, const in GeometricContext geometry, const in vec3 specularColor, const in float roughness ) {

	float alpha = pow2( roughness ); // UE4's roughness

	vec3 halfDir = normalize( incidentLight.direction + geometry.viewDir );

	float dotNL = saturate( dot( geometry.normal, incidentLight.direction ) );
	float dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );
	float dotNH = saturate( dot( geometry.normal, halfDir ) );
	float dotLH = saturate( dot( incidentLight.direction, halfDir ) );

	vec3 F = F_Schlick( specularColor, dotLH );

	float G = G_GGX_SmithCorrelated( alpha, dotNL, dotNV );

	float D = D_GGX( alpha, dotNH );

	return F * ( G * D );

} // validated

//
// Rect Area Light BRDF Approximations
//

// Area light computation code adapted from:
// http://blog.selfshadow.com/sandbox/ltc.html
//
// Based on paper:
// Real-Time Polygonal-Light Shading with Linearly Transformed Cosines
// By: Eric Heitz, Jonathan Dupuy, Stephen Hill and David Neubelt
// https://eheitzresearch.wordpress.com/415-2/

vec2 ltcTextureCoords( const in GeometricContext geometry, const in float roughness ) {

	const float LUT_SIZE  = 64.0;
	const float LUT_SCALE = (LUT_SIZE - 1.0)/LUT_SIZE;
	const float LUT_BIAS  = 0.5/LUT_SIZE;

	vec3 N = geometry.normal;
	vec3 V = geometry.viewDir;
	vec3 P = geometry.position;

	// view angle on surface determines which LTC BRDF values we use
	float theta = acos( dot( N, V ) );

	// Parameterization of texture:
	// sqrt(roughness) -> [0,1]
	// theta -> [0, PI/2]
	vec2 uv = vec2(
		sqrt( saturate( roughness ) ),
		saturate( theta / ( 0.5 * PI ) ) );

	// Ensure we don't have nonlinearities at the look-up table's edges
	// see: http://http.developer.nvidia.com/GPUGems2/gpugems2_chapter24.html
	//      "Shader Analysis" section
	uv = uv * LUT_SCALE + LUT_BIAS;

	return uv;

}

void clipQuadToHorizon( inout vec3 L[5], out int n ) {

	// detect clipping config
	int config = 0;
	if ( L[0].z > 0.0 ) config += 1;
	if ( L[1].z > 0.0 ) config += 2;
	if ( L[2].z > 0.0 ) config += 4;
	if ( L[3].z > 0.0 ) config += 8;

	// clip
	n = 0;

	if ( config == 0 ) {

		// clip all

	} else if ( config == 1 ) {

		// V1 clip V2 V3 V4
		n = 3;
		L[1] = -L[1].z * L[0] + L[0].z * L[1];
		L[2] = -L[3].z * L[0] + L[0].z * L[3];

	} else if ( config == 2 ) {

		// V2 clip V1 V3 V4
		n = 3;
		L[0] = -L[0].z * L[1] + L[1].z * L[0];
		L[2] = -L[2].z * L[1] + L[1].z * L[2];

	} else if ( config == 3 ) {

		// V1 V2 clip V3 V4
		n = 4;
		L[2] = -L[2].z * L[1] + L[1].z * L[2];
		L[3] = -L[3].z * L[0] + L[0].z * L[3];

	} else if ( config == 4 ) {

		// V3 clip V1 V2 V4
		n = 3;
		L[0] = -L[3].z * L[2] + L[2].z * L[3];
		L[1] = -L[1].z * L[2] + L[2].z * L[1];

	} else if ( config == 5 ) {

		// V1 V3 clip V2 V4) impossible
		n = 0;

	} else if ( config == 6 ) {

		// V2 V3 clip V1 V4
		n = 4;
		L[0] = -L[0].z * L[1] + L[1].z * L[0];
		L[3] = -L[3].z * L[2] + L[2].z * L[3];

	} else if ( config == 7 ) {

		// V1 V2 V3 clip V4
		n = 5;
		L[4] = -L[3].z * L[0] + L[0].z * L[3];
		L[3] = -L[3].z * L[2] + L[2].z * L[3];

	} else if ( config == 8 ) {

		// V4 clip V1 V2 V3
		n = 3;
		L[0] = -L[0].z * L[3] + L[3].z * L[0];
		L[1] = -L[2].z * L[3] + L[3].z * L[2];
		L[2] =  L[3];

	} else if ( config == 9 ) {

		// V1 V4 clip V2 V3
		n = 4;
		L[1] = -L[1].z * L[0] + L[0].z * L[1];
		L[2] = -L[2].z * L[3] + L[3].z * L[2];

	} else if ( config == 10 ) {

		// V2 V4 clip V1 V3) impossible
		n = 0;

	} else if ( config == 11 ) {

		// V1 V2 V4 clip V3
		n = 5;
		L[4] = L[3];
		L[3] = -L[2].z * L[3] + L[3].z * L[2];
		L[2] = -L[2].z * L[1] + L[1].z * L[2];

	} else if ( config == 12 ) {

		// V3 V4 clip V1 V2
		n = 4;
		L[1] = -L[1].z * L[2] + L[2].z * L[1];
		L[0] = -L[0].z * L[3] + L[3].z * L[0];

	} else if ( config == 13 ) {

		// V1 V3 V4 clip V2
		n = 5;
		L[4] = L[3];
		L[3] = L[2];
		L[2] = -L[1].z * L[2] + L[2].z * L[1];
		L[1] = -L[1].z * L[0] + L[0].z * L[1];

	} else if ( config == 14 ) {

		// V2 V3 V4 clip V1
		n = 5;
		L[4] = -L[0].z * L[3] + L[3].z * L[0];
		L[0] = -L[0].z * L[1] + L[1].z * L[0];

	} else if ( config == 15 ) {

		// V1 V2 V3 V4
		n = 4;

	}

	if ( n == 3 )
		L[3] = L[0];
	if ( n == 4 )
		L[4] = L[0];

}

// Equation (11) of "Real-Time Polygonal-Light Shading with Linearly Transformed Cosines"
float integrateLtcBrdfOverRectEdge( vec3 v1, vec3 v2 ) {

	float cosTheta = dot( v1, v2 );
	float theta = acos( cosTheta );
	float res = cross( v1, v2 ).z * ( ( theta > 0.001 ) ? theta / sin( theta ) : 1.0 );

	return res;

}

void initRectPoints( const in vec3 pos, const in vec3 halfWidth, const in vec3 halfHeight, out vec3 rectPoints[4] ) {

	rectPoints[0] = pos - halfWidth - halfHeight;
	rectPoints[1] = pos + halfWidth - halfHeight;
	rectPoints[2] = pos + halfWidth + halfHeight;
	rectPoints[3] = pos - halfWidth + halfHeight;

}

vec3 FetchDiffuseFilteredTexture(const in sampler2D areaTexture, vec3 p1_, vec3 p2_, vec3 p3_, vec3 p4_)
{
    // area light plane basis
    vec3 V1 = p2_ - p1_;
    vec3 V2 = p4_ - p1_;
    vec3 planeOrtho = cross(V1, V2);
    float planeAreaSquared = dot(planeOrtho, planeOrtho);
    float planeDistxPlaneArea = dot(planeOrtho, p1_);
    // orthonormal projection of (0,0,0) in area light space
    vec3 P = planeDistxPlaneArea * planeOrtho / planeAreaSquared - p1_;

    // find tex coords of P
    float dot_V1_V2 = dot(V1,V2);
    float inv_dot_V1_V1 = 1.0 / dot(V1, V1);
    vec3 V2_ = V2 - V1 * dot_V1_V2 * inv_dot_V1_V1;
    vec2 Puv;
    Puv.y = dot(V2_, P) / dot(V2_, V2_);
    Puv.x = dot(V1, P)*inv_dot_V1_V1 - dot_V1_V2*inv_dot_V1_V1*Puv.y ;

    // LOD
    float d = abs(planeDistxPlaneArea) / pow(planeAreaSquared, 0.75);

    return texture2DLodEXT(areaTexture, Puv, log(1.0*2048.0*d)/log(3.0) ).rgb;
}

vec3 integrateLtcBrdfOverRect( const in GeometricContext geometry, const in mat3 brdfMat, const in vec3 rectPoints[4], const in sampler2D areaTexture ) {

	vec3 N = geometry.normal;
	vec3 V = geometry.viewDir;
	vec3 P = geometry.position;

	// construct orthonormal basis around N
	vec3 T1, T2;
	T1 = normalize(V - N * dot( V, N ));
	// TODO (abelnation): I had to negate this cross product to get proper light.  Curious why sample code worked without negation
	T2 = - cross( N, T1 );

	// rotate area light in (T1, T2, N) basis
	mat3 brdfWrtSurface = brdfMat * transpose( mat3( T1, T2, N ) );

	// transformed rect relative to surface point
	vec3 clippedRect[5];
	clippedRect[0] = brdfWrtSurface * ( rectPoints[0] - P );
	clippedRect[1] = brdfWrtSurface * ( rectPoints[1] - P );
	clippedRect[2] = brdfWrtSurface * ( rectPoints[2] - P );
	clippedRect[3] = brdfWrtSurface * ( rectPoints[3] - P );

	vec3 texColor = vec3(1.0);//FetchDiffuseFilteredTexture(areaTexture, clippedRect[0], clippedRect[1], clippedRect[2], clippedRect[3]);

	// clip light rect to horizon, resulting in at most 5 points
	// we do this because we are integrating the BRDF over the hemisphere centered on the surface points normal
	int n;
	clipQuadToHorizon(clippedRect, n);

	// light is completely below horizon
	if ( n == 0 )
		return vec3( 0, 0, 0 );

	// project clipped rect onto sphere
	clippedRect[0] = normalize( clippedRect[0] );
	clippedRect[1] = normalize( clippedRect[1] );
	clippedRect[2] = normalize( clippedRect[2] );
	clippedRect[3] = normalize( clippedRect[3] );
	clippedRect[4] = normalize( clippedRect[4] );

	// integrate
	// simplified integration only needs to be evaluated for each edge in the polygon
	float sum = 0.0;
	sum += integrateLtcBrdfOverRectEdge( clippedRect[0], clippedRect[1] );
	sum += integrateLtcBrdfOverRectEdge( clippedRect[1], clippedRect[2] );
	sum += integrateLtcBrdfOverRectEdge( clippedRect[2], clippedRect[3] );
	if (n >= 4)
		sum += integrateLtcBrdfOverRectEdge( clippedRect[3], clippedRect[4] );
	if (n == 5)
		sum += integrateLtcBrdfOverRectEdge( clippedRect[4], clippedRect[0] );

	// TODO (abelnation): two-sided area light
	// sum = twoSided ? abs(sum) : max(0.0, sum);
	sum = max( 0.0, sum );
	// sum = abs( sum );

	vec3 Lo_i = vec3( sum, sum, sum );

	return Lo_i * texColor;

}

vec3 Rect_Area_Light_Specular_Reflectance(
		const in GeometricContext geometry,
		const in vec3 lightPos, const in vec3 lightHalfWidth, const in vec3 lightHalfHeight,
		const in float roughness,
		const in sampler2D ltcMat, const in sampler2D ltcMag, const in sampler2D areaTexture ) {

	vec3 rectPoints[4];
	initRectPoints( lightPos, lightHalfWidth, lightHalfHeight, rectPoints );

	vec2 uv = ltcTextureCoords( geometry, roughness );

	vec4 brdfLtcApproxParams, t;

	brdfLtcApproxParams = texture2D( ltcMat, uv );
	t = texture2D( ltcMat, uv );

	float brdfLtcScalar = texture2D( ltcMag, uv ).a;

	// inv(M) matrix referenced by equation (6) in paper
	mat3 brdfLtcApproxMat = mat3(
		vec3(   1,   0, t.y ),
		vec3(   0, t.z,   0 ),
		vec3( t.w,   0, t.x )
	);

	vec3 specularReflectance = integrateLtcBrdfOverRect( geometry, brdfLtcApproxMat, rectPoints, areaTexture );
	specularReflectance *= brdfLtcScalar;

	return specularReflectance;

}

vec3 Rect_Area_Light_Diffuse_Reflectance(
		const in GeometricContext geometry,
		const in vec3 lightPos, const in vec3 lightHalfWidth, const in vec3 lightHalfHeight, const in sampler2D areaTexture ) {

	vec3 rectPoints[4];
	initRectPoints( lightPos, lightHalfWidth, lightHalfHeight, rectPoints );

	mat3 diffuseBrdfMat = mat3(1);
	vec3 diffuseReflectance = integrateLtcBrdfOverRect( geometry, diffuseBrdfMat, rectPoints, areaTexture );

	return diffuseReflectance;

}

void Rect_Area_Light_Diffuse_Blender(
		const in GeometricContext geometry,
		const in vec3 lightPos, const in vec3 lightHalfWidth, const in vec3 lightHalfHeight, const in sampler2D areaTexture, float shininess,
		inout vec3 diffuse, inout vec3 specular ) {

	vec3 normal = geometry.normal;
	vec3 viewDirection  = geometry.viewDir;
	vec3 vertexPosition = geometry.position;

	float w = length(lightHalfWidth);
	float h = length(lightHalfHeight);

	vec3 areaLightRight = lightHalfWidth/w;
	vec3 areaLightUp = lightHalfHeight/h;

	vec3 lightNormal = normalize( cross(lightHalfWidth, lightHalfHeight));
	//vec3 areaDiffuseTerm = vec3(0.0);
	float dotProd = dot ( vertexPosition - lightPos , lightNormal );
	if ( dotProd > 0.0 ) {
		vec3 proj = projectOnPlane( vertexPosition, lightPos, lightNormal );
		vec3 dir = proj - lightPos;
		vec2 diagonal = vec2( dot( dir, areaLightRight ), dot( dir, areaLightUp ) );
		vec2 nearest2D = vec2( clamp( diagonal.x, -w, w ), clamp( diagonal.y, -h, h ) );
		vec3 nearestPointInside = lightPos + ( areaLightRight * nearest2D.x + areaLightUp * nearest2D.y );
		vec3 lightDir = normalize( nearestPointInside - vertexPosition );
		float NdotL = max( dot( lightNormal, -lightDir ), 0.0 );
		float NdotL2 = max( dot( normal, lightDir ) * 0.5 + 0.5, 0.0 );
		vec3 areaDiffuseWeight = vec3( ( NdotL2 * NdotL ) );
		float dist = distance( vertexPosition, nearestPointInside );
		float attenuation = 1.0/( 0.0 + dist );
	  diffuse = areaDiffuseWeight * attenuation;

		float d = distance( vertexPosition, nearestPointInside );
		vec2 co = ( diagonal.xy + vec2( w, h ) ) / ( 2.0 * vec2( w, h ) );
		//co.x = 1.0 - co.x;
		vec4 diff = vec4( 0.0 );
		if ( dotProd < 0.0 ) {
			diff = vec4( 0.0 );
		} else {
			float lod = max( pow( d, 0.1 ), 0.0 ) * 6.0;
			vec4 t00 = texture2DLodEXT( areaTexture, co, lod);
			vec4 t01 = texture2DLodEXT( areaTexture, co, lod + 1.0);
			diff = mix(t00, t01, 0.5);
		}
		//diffuse *= diff.xyz;

		vec3 R = reflect( normalize( -vertexPosition ), normal );
		vec3 E = linePlaneIntersect( vertexPosition, R, lightPos, lightNormal );
		float specAngle = dot( R, lightNormal );

		if( specAngle > 0.0 ) {
			vec3 dirSpec = E - lightPos;
			vec2 dirSpec2D = vec2( dot( dirSpec, areaLightRight ), dot( dirSpec, areaLightUp ) );
			vec2 nearestSpec2D = vec2( clamp( dirSpec2D.x, -w, w ), clamp( dirSpec2D.y, -h, h ) );
			float specFactor = 1.0 - clamp( length( nearestSpec2D - dirSpec2D ) * 0.05 * shininess, 0.0, 1.0 );
			vec3 areaSpecularWeight = specFactor * specAngle * areaDiffuseWeight;
			vec3 areaSpecularTerm = areaSpecularWeight * attenuation;
			specular += areaSpecularTerm;

			if ( false ) {
				float hard = 16.0;
				float gloss = 16.0;
				vec3 specPlane = lightPos + ( areaLightRight * dirSpec2D.x + areaLightUp * dirSpec2D.y );
				float dist = max( distance( vertexPosition, specPlane ), 0.0 );
				float d = ( ( 1.0 / hard ) / 2.0 ) * ( dist / gloss );
				w = max( w, 0.0 );
				h = max( h, 0.0 );
				vec2 co = dirSpec2D / ( d + 1.0 );
				co /= 2.0 * vec2( w, h );
				co = co + vec2( 0.5 );
				co.y = 1.0 - co.y;
				float lod = ( 2.0 / hard * max( dist, 0.0 ) );
				vec4 t00 = texture2DLodEXT( areaTexture, co, lod );
				vec4 t01 = texture2DLodEXT( areaTexture, co, lod + 1.0 );
				vec4 spec = mix( t00, t01, 0.5 );
				specular *= spec.xyz;
			}
		}
	}
}

vec3 Rect_Area_Light_Diffuse_FB(
		const in GeometricContext geometry,
		const in vec3 lightPos, const in vec3 lightHalfWidth, const in vec3 lightHalfHeight, inout float solidAngle ) {

	vec3 normal = geometry.normal;
	vec3 viewDirection  = geometry.viewDir;
	vec3 vertexPosition = geometry.position;

	vec3 lightNormal = normalize( cross(lightHalfWidth, lightHalfHeight));

	vec3 areaDiffuseTerm = vec3(0.0);

	if ( dot ( vertexPosition - lightPos , lightNormal ) > 0.0 ) {
		vec3 p0 = lightPos + lightHalfWidth + lightHalfHeight ;
		vec3 p1 = lightPos - lightHalfWidth + lightHalfHeight ;
		vec3 p2 = lightPos - lightHalfWidth - lightHalfHeight ;
		vec3 p3 = lightPos + lightHalfWidth - lightHalfHeight ;

	  solidAngle = rectangleSolidAngle ( vertexPosition , p0 , p1 , p2 , p3 );
		//float solidAngle = rightPyramidSolidAngle( length( lightPos - vertexPosition ), length(lightHalfHeight), length(lightHalfWidth));

		float illuminance = solidAngle * 0.2 * (
		clamp ( dot( normalize ( p0 - vertexPosition ) , normal ), 0.0, 1.0 ) +
		clamp ( dot( normalize ( p1 - vertexPosition ) , normal ), 0.0, 1.0 )+
		clamp ( dot( normalize ( p2 - vertexPosition ) , normal ), 0.0, 1.0 )+
		clamp ( dot( normalize ( p3 - vertexPosition ) , normal ), 0.0, 1.0 )+
		clamp ( dot( normalize ( lightPos - vertexPosition ) , normal ), 0.0, 1.0 ) );
		areaDiffuseTerm = vec3(illuminance);
	}
	return areaDiffuseTerm;
}

vec3 Rect_Area_Light_Diffuse_Drobot(
		const in GeometricContext geometry,
		const in vec3 lightPos, const in vec3 lightHalfWidth, const in vec3 lightHalfHeight, const in sampler2D areaTexture ) {

	vec3 normal = geometry.normal;
	vec3 viewDirection  = geometry.viewDir;
	vec3 vertexPosition = geometry.position;

	vec3 lightNormal = normalize( cross(lightHalfWidth, lightHalfHeight));

	vec3 areaDiffuseTerm = vec3(0.0);
	float dotProd = dot ( vertexPosition - lightPos , lightNormal );

	if ( dotProd > 0.0 ) {
 		float clampCosAngle = 0.001 + clamp ( dot ( normal , lightNormal ), 0.0, 1.0 );
 		// clamp d0 to the positive hemisphere of surface normal
 		vec3 d0 = normalize ( - lightNormal + normal * clampCosAngle );
 		// clamp d1 to the negative hemisphere of light plane normal
 		vec3 d1 = normalize ( normal - lightNormal * clampCosAngle );
 		vec3 dh = normalize ( d0 + d1 );
		vec3 proj = rayPlaneIntersect( vertexPosition, dh, lightPos, lightNormal );
		vec3 dir = proj - lightPos;
		float w = length(lightHalfWidth);
		float h = length(lightHalfHeight);
		vec3 areaLightRight = lightHalfWidth/w;
		vec3 areaLightUp = lightHalfHeight/h;
		vec2 diagonal = vec2( dot( dir, areaLightRight ), dot( dir, areaLightUp ) );
		vec2 nearest2D = vec2( clamp( diagonal.x, -w, w ), clamp( diagonal.y, -h, h ) );
		vec3 nearestPointInside = lightPos + ( areaLightRight * nearest2D.x + areaLightUp * nearest2D.y );

		vec3 p0 = lightPos + lightHalfWidth + lightHalfHeight ;
		vec3 p1 = lightPos - lightHalfWidth + lightHalfHeight ;
		vec3 p2 = lightPos - lightHalfWidth - lightHalfHeight ;
		vec3 p3 = lightPos + lightHalfWidth - lightHalfHeight ;

 		float solidAngle = rectangleSolidAngle ( vertexPosition , p0 , p1 , p2 , p3 );
		//float solidAngle = rightPyramidSolidAngle( length( lightPos - vertexPosition ), w, h);

 		vec3 unormLightVector = nearestPointInside - vertexPosition ;
		float d = length(unormLightVector);
 		vec3 L = unormLightVector/d;

 		float illuminance =  solidAngle * clamp ( dot(normal, L), 0.0, 1.0);
		areaDiffuseTerm = vec3(illuminance);

		/*vec2 co = ( diagonal.xy + vec2( w, h ) ) / ( 2.0 * vec2( w, h ) );
		//co.x = 1.0 - co.x;
		vec4 diff = vec4( 0.0 );

		float lod = max( pow( d, 0.1 ), 0.0 ) * 6.0;
		vec4 t00 = texture2DLodEXT( areaTexture, co, lod);
		vec4 t01 = texture2DLodEXT( areaTexture, co, lod + 1.0);
		diff = mix(t00, t01, 0.5);

		areaDiffuseTerm *= diff.xyz;*/
	}
	return areaDiffuseTerm;
}

vec3 Rect_Area_Light_Specular_RepresentativePoint(
		const in GeometricContext geometry,
		const in vec3 lightPos, const in vec3 lightHalfWidth, const in vec3 lightHalfHeight, const in sampler2D areaTexture, float shininess ) {

		vec3 normal = geometry.normal;
		vec3 viewDirection  = geometry.viewDir;
		vec3 vertexPosition = geometry.position;
		vec3 lightNormal = normalize( cross(lightHalfWidth, lightHalfHeight));

		//vec3 viewReflection = reflect( viewDirection, normal );
		vec3 viewReflection = reflect( viewDirection, normal );

		vec3 reflectionLightPlaneIntersection = linePlaneIntersect( vertexPosition, viewReflection, lightPos, lightNormal );

		float specAngle = dot( viewReflection, lightNormal );

		vec3 mrp = vec3(0.0);

		if ( specAngle > 0.0 ) {

			vec3 dirSpec = reflectionLightPlaneIntersection - lightPos;
			float w = length(lightHalfWidth);
			float h = length(lightHalfHeight);
			vec3 areaLightRight = lightHalfWidth/w;
			vec3 areaLightUp = lightHalfHeight/h;
			vec2 dirSpec2D = vec2( dot( dirSpec, areaLightRight ), dot( dirSpec, areaLightUp ) );
			vec2 nearestSpec2D = vec2( clamp( dirSpec2D.x, -w, w ), clamp( dirSpec2D.y, -h, h ) );
			mrp = lightPos + ( areaLightRight * nearestSpec2D.x + areaLightUp * nearestSpec2D.y );

		}

		return mrp;
}

vec3 getSpecularDominantDirArea(vec3 N, vec3 R, float roughness)
{
	// Simple linear approximation
	float lerpFactor = (1.0 - roughness);

	return normalize(mix(N, R, lerpFactor));
}

vec3 Rect_Area_Light_Specular_RepresentativePointAccurate(
		const in GeometricContext geometry,
		const in vec3 lightPos, const in vec3 lightHalfWidth, const in vec3 lightHalfHeight, const in sampler2D areaTexture, float roughness ) {

		vec3 normal = geometry.normal;
		vec3 viewDirection  = geometry.viewDir;
		vec3 vertexPosition = geometry.position;
		vec3 lightNormal = normalize( cross(lightHalfWidth, lightHalfHeight));

		//vec3 viewReflection = reflect( viewDirection, normal );
		vec3 viewReflection = normalize(reflect( viewDirection, normal ));
		//viewReflection = getSpecularDominantDirArea(normal, viewReflection, roughness );

		vec3 p0 = lightPos + lightHalfWidth + lightHalfHeight - vertexPosition ;
		vec3 p1 = lightPos - lightHalfWidth + lightHalfHeight - vertexPosition;
		vec3 p2 = lightPos - lightHalfWidth - lightHalfHeight - vertexPosition;
		vec3 p3 = lightPos + lightHalfWidth - lightHalfHeight - vertexPosition;

		//float traced = Trace_rectangle(vertexPosition, viewReflection, p0, p1, p2, p3);

		vec3 mrp = vec3(0.0);

		vec3 normals[4];
		vec3 vv[5];

		vv[0] = p0;
		vv[1] = p1;
		vv[2] = p2;
		vv[3] = p3;
		vv[4] = p0;

		normals[0] = normalize(cross(p0, p1));
		normals[1] = normalize(cross(p1, p2));
		normals[2] = normalize(cross(p2, p3));
		normals[3] = normalize(cross(p3, p0));

		float NdotR = 100000.0;
		vec3 v1, v2;
		vec3 nmin;
		for( int i=0; i< 4; i++) {
			float dotProd = dot( normals[i], viewReflection);
			if( dotProd < NdotR ) {
				v2 = vv[i];
				v1 = vv[i+1];
				nmin = normals[i];
				NdotR = dotProd;
				if( i == 3) {
					v2 = vv[3];
					v1 = vv[4];
				}
			}
		}


		if( dot(viewReflection, nmin) >= 0.0 ) {
			return linePlaneIntersect( vertexPosition, viewReflection, lightPos, lightNormal );

			return normalize(viewReflection);
		} else {
			vec3 dir;
			vec3 rproj = viewReflection - nmin * dot( nmin, viewReflection);
			vec3 cross1 = cross( rproj, v1 );
			vec3 cross2 = cross( v2, rproj );
			if( dot(cross1, viewReflection ) < 0.0 ) {
				dir = normalize(v1);
			}
			else if( dot(cross2, viewReflection ) < 0.0 ) {
				dir = normalize(v2);
			} else {
				dir = normalize(rproj);
				//dir = normalize(lightPos - vertexPosition);
			}
			//return normalize( lightPos - vertexPosition);
			return linePlaneIntersect( vertexPosition, dir, lightPos, lightNormal );
		}
		/*if ( traced > 0.0 ) {

			mrp = linePlaneIntersect( vertexPosition, viewReflection, lightPos, lightNormal );

		} else {
			return lightPos;
			vec3 tracedPlane = linePlaneIntersect( vertexPosition, viewReflection, lightPos, lightNormal );

			// Then find the closest point along the edges of the rectangle (edge = segment)
			vec3 PC[4];

			PC[0] = ClosestPointOnSegment(p0, p1, tracedPlane);
			PC[1] = ClosestPointOnSegment(p1, p2, tracedPlane);
			PC[2] = ClosestPointOnSegment(p2, p3, tracedPlane);
			PC[3] = ClosestPointOnSegment(p3, p0, tracedPlane);

			float dist[4];

			dist[0] = distance(PC[0], tracedPlane);
			dist[1] = distance(PC[1], tracedPlane);
			dist[2] = distance(PC[2], tracedPlane);
			dist[3] = distance(PC[3], tracedPlane);

			vec3 min_ = PC[0];
			float minDist = dist[0];
			for (int iLoop = 1; iLoop < 4; iLoop++)
			{
				if (dist[iLoop] < minDist)
				{
					minDist = dist[iLoop];
					min_ = PC[iLoop];
				}
			}

			mrp = min_;
		}*/

		//return mrp;
}
// End RectArea BRDF


// ref: https://www.unrealengine.com/blog/physically-based-shading-on-mobile - environmentBRDF for GGX on mobile
vec3 BRDF_Specular_GGX_Environment( const in GeometricContext geometry, const in vec3 specularColor, const in float roughness ) {

	float dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );

	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );

	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );

	vec4 r = roughness * c0 + c1;

	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;

	vec2 AB = vec2( -1.04, 1.04 ) * a004 + r.zw;

	return specularColor * AB.x + AB.y;

} // validated


float G_BlinnPhong_Implicit( /* const in float dotNL, const in float dotNV */ ) {

	// geometry term is (n dot l)(n dot v) / 4(n dot l)(n dot v)
	return 0.25;

}

float D_BlinnPhong( const in float shininess, const in float dotNH ) {

	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );

}

vec3 BRDF_Specular_BlinnPhong( const in IncidentLight incidentLight, const in GeometricContext geometry, const in vec3 specularColor, const in float shininess ) {

	vec3 halfDir = normalize( incidentLight.direction + geometry.viewDir );

	//float dotNL = saturate( dot( geometry.normal, incidentLight.direction ) );
	//float dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );
	float dotNH = saturate( dot( geometry.normal, halfDir ) );
	float dotLH = saturate( dot( incidentLight.direction, halfDir ) );

	vec3 F = F_Schlick( specularColor, dotLH );

	float G = G_BlinnPhong_Implicit( /* dotNL, dotNV */ );

	float D = D_BlinnPhong( shininess, dotNH );

	return F * ( G * D );

} // validated

// source: http://simonstechblog.blogspot.ca/2011/12/microfacet-brdf.html
float GGXRoughnessToBlinnExponent( const in float ggxRoughness ) {
	return ( 2.0 / pow2( ggxRoughness + 0.0001 ) - 2.0 );
}

float BlinnExponentToGGXRoughness( const in float blinnExponent ) {
	return sqrt( 2.0 / ( blinnExponent + 2.0 ) );
}
