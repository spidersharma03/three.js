varying vec3 vViewPosition;

#ifndef FLAT_SHADED

	varying vec3 vNormal;

#endif


struct BlinnPhongMaterial {

	vec3	diffuseColor;
	vec3	specularColor;
	float	specularShininess;
	float	specularStrength;

};

#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_BlinnPhong( const in RectAreaLight rectAreaLight, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {

		vec3 matDiffColor = material.diffuseColor;
		vec3 matSpecColor = material.specularColor;
		vec3 lightColor   = rectAreaLight.color;

		float roughness = BlinnExponentToGGXRoughness( material.specularShininess );

		// Evaluate Lighting Equation
		vec3 spec = Rect_Area_Light_Specular_Reflectance(
				geometry,
				rectAreaLight.position, rectAreaLight.halfWidth, rectAreaLight.halfHeight,
				roughness,
				ltcMat, ltcMag );
		vec3 diff = Rect_Area_Light_Diffuse_Reflectance(
				geometry,
				rectAreaLight.position, rectAreaLight.halfWidth, rectAreaLight.halfHeight );

		// TODO (abelnation): note why division by 2PI is necessary
		reflectedLight.directSpecular += lightColor * matSpecColor * spec / PI2;
		//reflectedLight.directDiffuse  += lightColor * matDiffColor * diff;

	}

	void RE_Direct_RectAreaNew_BlinnPhong( const in RectAreaLight rectAreaLight, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {

		vec3 matDiffColor = material.diffuseColor;
		vec3 matSpecColor = material.specularColor;
		vec3 lightColor   = rectAreaLight.color;
		float shininess = material.specularShininess;

		float roughness = BlinnExponentToGGXRoughness( material.specularShininess );

		// Evaluate Lighting Equation
		vec3 spec = vec3(0.0);
		vec3 diff = vec3(0.0);
		diff = Rect_Area_Light_Diffuse_FB(
				geometry,
				rectAreaLight.position, rectAreaLight.halfWidth, rectAreaLight.halfHeight );

		vec3 representativePoint = Rect_Area_Light_Specular_RepresentativePoint( geometry, rectAreaLight.position, rectAreaLight.halfWidth, rectAreaLight.halfHeight, rectAreaTexture[0], shininess );
		float ld = length(representativePoint);
		vec3 lightDir = rectAreaLight.position + representativePoint - geometry.position;
		IncidentLight light;
		light.direction = normalize(lightDir);
		vec3 brdfValue = BRDF_Specular_BlinnPhong( light, geometry, material.specularColor, material.specularShininess ) * material.specularStrength;
		vec3 lightNormal = normalize( cross(rectAreaLight.halfWidth, rectAreaLight.halfHeight));

		vec3 viewReflection = reflect( geometry.viewDir, geometry.normal );
		brdfValue = vec3( pow( dot(viewReflection, light.direction), material.specularShininess ) );
		float specFactor = 1.0 - clamp( ld * 0.000005 * material.specularShininess, 0.0, 1.0 );
		brdfValue *= specFactor;
		float specAngle = dot( viewReflection, lightNormal );

		if ( specAngle > 0.0 )
			reflectedLight.directSpecular += lightColor * matSpecColor * brdfValue;

		reflectedLight.directDiffuse  += lightColor * matDiffColor * diff;

		/*Rect_Area_Light_Diffuse_Blender(geometry, rectAreaLight.position,
		rectAreaLight.halfWidth, rectAreaLight.halfHeight, rectAreaTexture[0], shininess, diff, spec);

		reflectedLight.directSpecular += lightColor * matDiffColor * spec;
		reflectedLight.directDiffuse  += lightColor * matDiffColor * diff;*/

	}
#endif

void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {

	#ifdef TOON

		vec3 irradiance = getGradientIrradiance( geometry.normal, directLight.direction ) * directLight.color;

	#else

		float dotNL = saturate( dot( geometry.normal, directLight.direction ) );
		vec3 irradiance = dotNL * directLight.color;

	#endif

	#ifndef PHYSICALLY_CORRECT_LIGHTS

		irradiance *= PI; // punctual light

	#endif

	reflectedLight.directDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_Specular_BlinnPhong( directLight, geometry, material.specularColor, material.specularShininess ) * material.specularStrength;

}

void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {

	reflectedLight.indirectDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );

}

#define RE_Direct				RE_Direct_BlinnPhong
#define RE_Direct_RectArea		RE_Direct_RectAreaNew_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong

#define Material_LightProbeLOD( material )	(0)
