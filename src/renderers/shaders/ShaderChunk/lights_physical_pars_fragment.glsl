struct PhysicalMaterial {

	vec3	diffuseColor;
	float	specularRoughness;
	vec3	specularColor;

	#ifndef STANDARD
		float clearCoat;
		float clearCoatRoughness;
	#endif

};

#define MAXIMUM_SPECULAR_COEFFICIENT 0.16
#define DEFAULT_SPECULAR_COEFFICIENT 0.04

void RE_Direct_Physical( const in IncidentLight directLight, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {

	float dotNL = saturate( dot( geometry.normal, directLight.direction ) );

	vec3 irradiance = dotNL * directLight.color;

	#ifndef PHYSICALLY_CORRECT_LIGHTS

		irradiance *= PI; // punctual light

	#endif

	vec3 specularRadiance = irradiance * BRDF_Specular_GGX( directLight, geometry, material.specularColor, material.specularRoughness );
	vec3 diffuseRadiance = irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );

	#ifndef STANDARD

		float layerAttention;
		vec3 clearCoatSpecularRadiance = irradiance * BRDF_ClearCoat_GGX( directLight, geometry, material.clearCoat, material.clearCoatRoughness, layerAttention );

		specularRadiance = mix( specularRadiance, clearCoatSpecularRadiance, layerAttention );
		diffuseRadiance = mix( diffuseRadiance, vec3( 0.0 ), layerAttention );

	#endif

	reflectedLight.directSpecular += specularRadiance;
	reflectedLight.directDiffuse += diffuseRadiance;


}

void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {

	vec3 diffuseRadiance = irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );

	#ifndef STANDARD

		diffuseRadiance = mix( diffuseRadiance, vec3( 0.0 ), material.clearCoat );

	#endif

	reflectedLight.indirectDiffuse += diffuseRadiance;

}

void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 clearCoatRadiance, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {

	vec3 specularRadiance = radiance * BRDF_Specular_GGX_Environment( geometry, material.specularColor, material.specularRoughness );

	#ifndef STANDARD

		float layerAttention;
		vec3 clearCoatSpecularRadiance = clearCoatRadiance * BRDF_ClearCoat_GGX_Environment( geometry, material.clearCoat, material.clearCoatRoughness, layerAttention );

		specularRadiance = mix( specularRadiance, clearCoatSpecularRadiance, layerAttention );

	#endif

	reflectedLight.indirectSpecular += specularRadiance;

}

#define RE_Direct				RE_Direct_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical

#define Material_BlinnShininessExponent( material )   GGXRoughnessToBlinnExponent( material.specularRoughness )
#define Material_ClearCoat_BlinnShininessExponent( material )   GGXRoughnessToBlinnExponent( material.clearCoatRoughness )

// ref: http://www.frostbite.com/wp-content/uploads/2014/11/course_notes_moving_frostbite_to_pbr_v2.pdf
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {

	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );

}
