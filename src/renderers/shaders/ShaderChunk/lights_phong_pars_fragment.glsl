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
				roughness * roughness,
				ltcMat, ltcMag, rectAreaTexture[0] );
		vec3 diff = Rect_Area_Light_Diffuse_Reflectance(
				geometry,
				rectAreaLight.position, rectAreaLight.halfWidth, rectAreaLight.halfHeight, rectAreaTexture[0] );

		// TODO (abelnation): note why division by 2PI is necessary
		reflectedLight.directSpecular += lightColor * matSpecColor * spec / PI2;
		reflectedLight.directDiffuse  += lightColor * matDiffColor * diff / PI2;

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
		float solidAngle = 1.0;
		diff = Rect_Area_Light_Diffuse_FB(
				geometry,
				rectAreaLight.position, rectAreaLight.halfWidth, rectAreaLight.halfHeight, solidAngle );

		float alpha = roughness * roughness;
		float alphaPrime	= clamp( solidAngle + alpha, 0.0, 1.0 );

		vec3 representativePoint = Rect_Area_Light_Specular_RepresentativePointAccurate( geometry, rectAreaLight.position, rectAreaLight.halfWidth, rectAreaLight.halfHeight, rectAreaTexture[0], roughness );
		vec3 lightDir = representativePoint - geometry.position;
		IncidentLight light;
		light.direction = normalize(lightDir);
		vec3 brdfValue = BRDF_Specular_GGX( light, geometry, material.specularColor, roughness ) * material.specularStrength;
		vec3 lightNormal = normalize( cross(rectAreaLight.halfWidth, rectAreaLight.halfHeight));

		//vec3 viewReflection = reflect( geometry.viewDir, geometry.normal );
		//brdfValue = vec3( pow( dot(viewReflection, light.direction), material.specularShininess ) );
		//float specFactor = 1.0 - clamp( ld * 0.000005 * material.specularShininess, 0.0, 1.0 );
		//brdfValue *= specFactor;
		//float specAngle = dot( viewReflection, lightNormal );

		//if ( specAngle > 0.0 )
			reflectedLight.directSpecular += lightColor * matSpecColor * brdfValue * diff * alphaPrime * alphaPrime/PI2;

		reflectedLight.directDiffuse  += lightColor * matDiffColor * diff/PI2;

		/*Rect_Area_Light_Diffuse_Blender(geometry, rectAreaLight.position,
		rectAreaLight.halfWidth, rectAreaLight.halfHeight, rectAreaTexture[0], shininess, diff, spec);

		reflectedLight.directSpecular += lightColor * matDiffColor * spec;
		reflectedLight.directDiffuse  += lightColor * matDiffColor * diff;*/

	}

	void RE_Direct_Sphere_BlinnPhong( const in RectAreaLight rectAreaLight, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {

		vec3 matDiffColor = material.diffuseColor;
		vec3 matSpecColor = material.specularColor;
		vec3 lightColor   = rectAreaLight.color;
		float shininess = material.specularShininess;

		float roughness = BlinnExponentToGGXRoughness( material.specularShininess );
		vec3 vertexPosition = geometry.position;
		vec3 normal = geometry.normal;
		vec3 viewDirection = geometry.viewDir;
		vec3 lightPos = rectAreaLight.position;
		float lightRadius = length(rectAreaLight.halfWidth);
		vec3 viewReflection = reflect( viewDirection, normal );

		// Evaluate Lighting Equation.
		vec3 L = lightPos - vertexPosition;
		vec3 centerToRay	= dot( L, viewReflection ) * viewReflection - L;
		vec3 closestPoint	= L + centerToRay * clamp( lightRadius / length( centerToRay ), 0.0, 1.0 );
		vec3 l	= normalize( closestPoint );
		float NdotL	= clamp( dot( normal, l ), 0.0, 1.0 );
		float distL		= length( L );
		float alpha		= roughness * roughness;
		float alphaPrime	= clamp( lightRadius / ( distL * 2.0 ) + alpha, 0.0, 1.0 );

		IncidentLight light;
		light.direction = l;
		vec3 brdfValue = BRDF_Specular_GGX( light, geometry, material.specularColor, roughness ) * material.specularStrength;
		brdfValue *= alphaPrime * alphaPrime;

		reflectedLight.directSpecular += lightColor * matSpecColor * brdfValue * NdotL;
		reflectedLight.directDiffuse  += lightColor * matDiffColor * NdotL/PI;
	}

	void RE_Direct_Tube_BlinnPhong( const in RectAreaLight rectAreaLight, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {

		vec3 matDiffColor = material.diffuseColor;
		vec3 matSpecColor = material.specularColor;
		vec3 lightColor   = rectAreaLight.color;
		float shininess = material.specularShininess;

		float roughness = BlinnExponentToGGXRoughness( material.specularShininess );
		vec3 vertexPosition = geometry.position;
		vec3 normal = geometry.normal;
		vec3 viewDirection = geometry.viewDir;
		vec3 lightPos = rectAreaLight.position;
		float lightRadius = length(rectAreaLight.halfHeight);

		vec3 viewReflection = reflect( viewDirection, normal );
		vec3 tubeStart = lightPos - rectAreaLight.halfWidth * 0.5;
		vec3 tubeEnd = lightPos + rectAreaLight.halfWidth * 0.5;

		vec3 L0			= tubeStart - vertexPosition;
		vec3 L1			= tubeEnd - vertexPosition;
		float distL0	= length( L0 );
		float distL1	= length( L1 );

		float NoL0		= dot( L0, normal ) / ( 2.0 * distL0 );
		float NoL1		= dot( L1, normal ) / ( 2.0 * distL1 );
		float NdotL	= ( 2.0 * clamp( NoL0 + NoL1, 0.0, 1.0 ) )/ ( distL0 * distL1 + dot( L0, L1 ) + 2.0 );

		vec3 Ld			= L1 - L0;
		float RoL0		= dot( viewReflection, L0 );
		float RoLd		= dot( viewReflection, Ld );
		float L0oLd 	= dot( L0, Ld );
		float distLd	= length( Ld );
		float t			= ( RoL0 * RoLd - L0oLd ) / ( distLd * distLd - RoLd * RoLd );

		vec3 closestPoint	= L0 + Ld * clamp( t, 0.0, 1.0 );
		vec3 centerToRay	= dot( closestPoint, viewReflection ) * viewReflection - closestPoint;
		closestPoint = closestPoint + centerToRay * clamp( lightRadius / length( centerToRay ), 0.0, 1.0 );
		vec3 l = normalize( closestPoint );

		float distLight	= length( closestPoint );
		float alpha		= roughness * roughness;
		float alphaPrime	= clamp( lightRadius / ( distLight * 2.0 ) + alpha, 0.0, 1.0 );

		IncidentLight light;
		light.direction = l;
		vec3 brdfValue = BRDF_Specular_GGX( light, geometry, material.specularColor, roughness ) * material.specularStrength;
		brdfValue *= alphaPrime * alphaPrime;

		reflectedLight.directSpecular += lightColor * matSpecColor * brdfValue * NdotL;
		reflectedLight.directDiffuse  += lightColor * matDiffColor * NdotL/PI;
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
#define RE_Direct_Sphere			RE_Direct_Sphere_BlinnPhong
#define RE_Direct_Tube				RE_Direct_Tube_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong

#define Material_LightProbeLOD( material )	(0)
