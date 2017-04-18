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

	//#define DIFFUSE_DROBOT_RECT
	#define DIFFUSE_DROBOT_TUBE
	//#define DIFFUSE_DROBOT_DISK


	void RE_Direct_RectArea_BlinnPhong( const in RectAreaLight rectAreaLight, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {

		vec3 matDiffColor = material.diffuseColor;
		vec3 matSpecColor = material.specularColor;
		vec3 lightColor   = rectAreaLight.color;

		float roughness = BlinnExponentToGGXRoughness( material.specularShininess * material.specularStrength);

		// Evaluate Lighting Equation
		vec3 spec = Rect_Area_Light_Specular_Reflectance(
				geometry,
				rectAreaLight.position, rectAreaLight.halfWidth, rectAreaLight.halfHeight,
				roughness * roughness,
				ltcMat, ltcMag, rectAreaTexture[0] );

		#ifdef DIFFUSE_DROBOT_RECT
			vec3 diff = vec3(0.0);
			vec3 lightHalfWidth = rectAreaLight.halfWidth;
			vec3 lightHalfHeight = rectAreaLight.halfHeight;
			vec3 lightNormal = normalize( cross(lightHalfWidth, lightHalfHeight));
			vec3 normal = geometry.normal;
			vec3 vertexPosition = geometry.position;
			vec3 lightPos = rectAreaLight.position;

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

				vec3 unormLightVector = nearestPointInside - vertexPosition ;
				float d = length(unormLightVector);
		 		vec3 L = unormLightVector/d;

			  float illuminance = w * h * clamp( dot(-lightNormal, L), 0.0, 1.0 ) * clamp ( dot(normal, L), 0.0, 1.0)/(d*d);
				diff = vec3(illuminance);
			}
		#else
			vec3 diff = Rect_Area_Light_Diffuse_Reflectance(
					geometry,
					rectAreaLight.position, rectAreaLight.halfWidth, rectAreaLight.halfHeight, rectAreaTexture[0] );
		#endif

		// TODO (abelnation): note why division by 2PI is necessary
		reflectedLight.directSpecular += lightColor * matSpecColor * spec;
		reflectedLight.directDiffuse  += lightColor * matDiffColor * diff;

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

		vec3 viewReflection = reflect( geometry.viewDir, geometry.normal );
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

	float illuminanceSphereOrDisk(float cosTheta, float sinSigmaSqr)
	{
		float sinTheta = sqrt(1.0 - cosTheta * cosTheta);

		float illuminance = 0.0;
		// Note: Following test is equivalent to the original formula.
		// There is 3 phase in the curve: cosTheta > sqrt(sinSigmaSqr),
		// cosTheta > -sqrt(sinSigmaSqr) and else it is 0
		// The two outer case can be merge into a cosTheta * cosTheta > sinSigmaSqr
		// and using saturate(cosTheta) instead.
		if (cosTheta * cosTheta > sinSigmaSqr)
		{
			illuminance = PI * sinSigmaSqr * saturate(cosTheta);
		}
		else
		{
			float x = sqrt(1.0 / sinSigmaSqr - 1.0); // For a disk this simplify to x = d / r
			float y = -x * (cosTheta / sinTheta);
			float sinThetaSqrtY = sinTheta * sqrt(1.0 - y * y);
			illuminance = (cosTheta * acos(y) - x * sinThetaSqrtY) * sinSigmaSqr + atan(sinThetaSqrtY / x);
		}

		return max(illuminance, 0.0);
	}

	vec3 getSpecularDominantDirArea(vec3 N, vec3 R, float roughness)
	{
		// Simple linear approximation
		float lerpFactor = (1.0 - roughness);

		return normalize(mix(N, R, lerpFactor));
	}

	void RE_Direct_Disk_BlinnPhong( const in RectAreaLight rectAreaLight, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {

		vec3 matDiffColor = material.diffuseColor;
		vec3 matSpecColor = material.specularColor;
		vec3 lightColor   = rectAreaLight.color;
		float shininess = material.specularShininess;

		float roughness = BlinnExponentToGGXRoughness( material.specularShininess * material.specularStrength );
		vec3 vertexPosition = geometry.position;
		vec3 normal = geometry.normal;
		vec3 viewDirection = geometry.viewDir;
		vec3 lightPos = rectAreaLight.position;
		float lightRadius = length(rectAreaLight.halfHeight);
		vec3 viewReflection = reflect( viewDirection, normal );
		//viewReflection = getSpecularDominantDirArea(normal, viewReflection, 0.03);
		vec3 lightNormal = normalize( cross(rectAreaLight.halfWidth, rectAreaLight.halfHeight));
		float fLight = 0.0;
		vec3 Lunormalized = lightPos - vertexPosition;

		#ifndef DIFFUSE_DROBOT_DISK

			float dist = length(Lunormalized);
			vec3 L = Lunormalized / dist;


			float sqrDist = dot(Lunormalized, Lunormalized);

			float cosTheta = clamp(dot(normal, L), -0.999, 0.999); // Clamp to avoid edge case
																	// We need to prevent the object penetrating into the surface
																	// and we must avoid divide by 0, thus the 0.9999f
			float sqrLightRadius = lightRadius * lightRadius;
			float sinSigmaSqr = sqrLightRadius / (sqrLightRadius + max(sqrLightRadius, sqrDist));
		  fLight = illuminanceSphereOrDisk(cosTheta, sinSigmaSqr) * saturate ( dot( -lightNormal , L));

		#endif

		#ifdef DIFFUSE_DROBOT_DISK

			float dotProd = dot ( lightPos - vertexPosition , -lightNormal );
			vec3 L;

			if ( dotProd > 0.0 )
			{
		 		float clampCosAngle = 0.001 + clamp ( dot ( normal , lightNormal ), 0.0, 1.0 );
		 		// clamp d0 to the positive hemisphere of surface normal
		 		vec3 d0 = normalize ( -lightNormal + normal * clampCosAngle );
		 		// clamp d1 to the negative hemisphere of light plane normal
		 		vec3 d1 = normalize ( normal - lightNormal * clampCosAngle );
		 		vec3 dh = normalize ( d1 + d0 );
				vec3 proj = rayPlaneIntersect( vertexPosition, dh, lightPos, -lightNormal );
				float d = length(proj - lightPos);
				vec3 pointOnDisk = normalize(proj - lightPos) * lightRadius * saturate(d/lightRadius);

				vec3 unormLightVector = lightPos + pointOnDisk - vertexPosition ;
			  d = length(unormLightVector);
		 	  L = unormLightVector/d;

			  fLight = PI * lightRadius * lightRadius * clamp( dot(-lightNormal, L), 0.0, 1.0 ) * clamp ( dot(normal, L), 0.0, 1.0)/(d*d);
			}

		#endif

		// Evaluate Lighting Equation.
		L = lightPos - vertexPosition;
		float distL = length(L);
		vec3 r = normalize(-viewReflection);
		float clampCosAngle = 0.001 + clamp ( dot ( lightNormal , r ), 0.0, 1.0 );
		vec3 reflDirClamped = r - lightNormal * clampCosAngle;
		vec3 p = rayPlaneIntersect(vertexPosition, normalize(reflDirClamped), lightPos, lightNormal);
		vec3 centerToRay = p - lightPos;
		vec3 closestPoint = Lunormalized + centerToRay * saturate(lightRadius / length(centerToRay));
		L = normalize(closestPoint);
		float alpha		= roughness * roughness;
		float alphaPrime	= clamp( lightRadius / ( distL * 2.0 ) + alpha, 0.0, 1.0 );

		IncidentLight light;
		light.direction = L;
		vec3 brdfValue = BRDF_Specular_GGX( light, geometry, material.specularColor, roughness ) * material.specularStrength;
		brdfValue *= alphaPrime * alphaPrime;

		reflectedLight.directSpecular += lightColor * matSpecColor * brdfValue * fLight;
		reflectedLight.directDiffuse  += lightColor * matDiffColor * fLight/PI;
	}

	void RE_Direct_Sphere_BlinnPhong( const in RectAreaLight rectAreaLight, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {

		vec3 matDiffColor = material.diffuseColor;
		vec3 matSpecColor = material.specularColor;
		vec3 lightColor   = rectAreaLight.color;
		float shininess = material.specularShininess;

		float roughness = BlinnExponentToGGXRoughness( material.specularShininess * material.specularStrength );
		vec3 vertexPosition = geometry.position;
		vec3 normal = geometry.normal;
		vec3 viewDirection = geometry.viewDir;
		vec3 lightPos = rectAreaLight.position;
		float lightRadius = length(rectAreaLight.halfHeight);
		vec3 viewReflection = reflect( viewDirection, normal );

		vec3 Lunormalized = lightPos - vertexPosition;
		float dist = length(Lunormalized);
		vec3 L = Lunormalized / dist;

		float sqrDist = dot(Lunormalized, Lunormalized);

		float cosTheta = clamp(dot(normal, L), -0.999, 0.999); // Clamp to avoid edge case
																// We need to prevent the object penetrating into the surface
																// and we must avoid divide by 0, thus the 0.9999f
		float sqrLightRadius = lightRadius * lightRadius;
		float sinSigmaSqr = min(sqrLightRadius / sqrDist, 0.9999);
		float fLight = illuminanceSphereOrDisk(cosTheta, sinSigmaSqr);

		// Evaluate Lighting Equation.
	  L = lightPos - vertexPosition;
		vec3 centerToRay	= dot( L, viewReflection ) * viewReflection - L;
		vec3 closestPoint	= L + centerToRay * clamp( lightRadius / length( centerToRay ), 0.0, 1.0 );
		vec3 l	= normalize( closestPoint );
		vec3 d = closestPoint - vertexPosition;
		float NdotL	= clamp( dot( normal, l ), 0.0, 1.0 )/( dot(d, d) + 1.0);
		float distL		= length( L );
		float alpha		= roughness * roughness;
		float alphaPrime	= clamp( lightRadius / ( distL * 2.0 ) + alpha, 0.0, 1.0 );

		IncidentLight light;
		light.direction = l;
		vec3 brdfValue = BRDF_Specular_GGX( light, geometry, material.specularColor, roughness ) * material.specularStrength;
		brdfValue *= alphaPrime * alphaPrime;
		//brdfValue = vec3(pow( dot(l, viewReflection), shininess));

		reflectedLight.directSpecular += lightColor * matSpecColor * brdfValue * fLight;
		reflectedLight.directDiffuse  += lightColor * matDiffColor * fLight/PI;
	}

	void RE_Direct_Tube_BlinnPhong( const in RectAreaLight rectAreaLight, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {

		vec3 matDiffColor = material.diffuseColor;
		vec3 matSpecColor = material.specularColor;
		vec3 lightColor   = rectAreaLight.color;
		float shininess = material.specularShininess;

		float roughness = BlinnExponentToGGXRoughness( material.specularShininess * material.specularStrength );
		vec3 vertexPosition = geometry.position;
		vec3 normal = geometry.normal;
		vec3 viewDirection = geometry.viewDir;
		vec3 lightPos = rectAreaLight.position;
		float lightRadius = length(rectAreaLight.halfHeight);

		vec3 viewReflection = reflect( viewDirection, normal );

		vec3 P0 = lightPos - rectAreaLight.halfWidth;
		vec3 P1 = lightPos + rectAreaLight.halfWidth;

		// The sphere is placed at the nearest point on the segment.
		// The rectangular plane is define by the following orthonormal frame:
		vec3 forward = normalize(ClosestPointOnLine(P0, P1, vertexPosition) - vertexPosition);
		vec3 up = normalize(cross(rectAreaLight.halfWidth, forward));

		vec3 areaDiffuseTerm = vec3(0.0);
		float fLight = 0.0;

		#ifdef DIFFUSE_DROBOT_TUBE

			float dotProd = dot ( lightPos - vertexPosition , forward );

			if ( dotProd > 0.0 )
			{
		 		float clampCosAngle = 0.001 + clamp ( dot ( normal , -forward ), 0.0, 1.0 );
		 		// clamp d0 to the positive hemisphere of surface normal
		 		vec3 d0 = normalize ( forward + normal * clampCosAngle );
		 		// clamp d1 to the negative hemisphere of light plane normal
		 		vec3 d1 = normalize ( normal + forward * clampCosAngle );
		 		vec3 dh = normalize ( d1 + d0 );
				vec3 proj = rayPlaneIntersect( vertexPosition, dh, lightPos, forward );
				vec3 dir = proj - lightPos;
				float w = length(rectAreaLight.halfWidth);
				float h = lightRadius;
				vec3 areaLightRight = rectAreaLight.halfWidth/w;
				vec3 areaLightUp = up;
				vec2 diagonal = vec2( dot( dir, areaLightRight ), dot( dir, areaLightUp ) );
				vec2 nearest2D = vec2( clamp( diagonal.x, -w, w ), clamp( diagonal.y, -h, h ) );
				vec3 nearestPointInside = lightPos + ( areaLightRight * nearest2D.x + areaLightUp * nearest2D.y );

				vec3 unormLightVector = nearestPointInside - vertexPosition ;
				float d = length(unormLightVector);
		 		vec3 L = unormLightVector/d;

			  fLight = w * h * clamp( dot(forward, L), 0.0, 1.0 ) * clamp ( dot(normal, L), 0.0, 1.0)/(d*d);
			}

		#endif

		#ifndef DIFFUSE_DROBOT_TUBE

			vec3 p0 = lightPos - rectAreaLight.halfWidth + lightRadius * up;
			vec3 p1 = lightPos - rectAreaLight.halfWidth - lightRadius * up;
			vec3 p2 = lightPos + rectAreaLight.halfWidth - lightRadius * up;
			vec3 p3 = lightPos + rectAreaLight.halfWidth + lightRadius * up;

			float solidAngle = rectangleSolidAngle(vertexPosition, p0, p1, p2, p3);

		  fLight = solidAngle * 0.2 * (
				saturate(dot(normalize(p0 - vertexPosition), normal)) +
				saturate(dot(normalize(p1 - vertexPosition), normal)) +
				saturate(dot(normalize(p2 - vertexPosition), normal)) +
				saturate(dot(normalize(p3 - vertexPosition), normal)) +
				saturate(dot(normalize(lightPos - vertexPosition), normal)));

		#endif

		// We then add the contribution of the sphere
		vec3 spherePosition = ClosestPointOnSegment(P0, P1, vertexPosition);
		vec3 sphereUnormL = spherePosition - vertexPosition;
		vec3 sphereL = normalize(sphereUnormL);
		float sqrSphereDistance = dot(sphereUnormL, sphereUnormL);

		float fLightSphere = PI * saturate(dot(sphereL, normal)) * lightRadius * lightRadius / sqrSphereDistance;

	 	fLight += fLightSphere;

		fLight = max(0.0, fLight);
		vec3 L0 = P0 - vertexPosition;
		vec3 L1 = P1 - vertexPosition;

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
		//brdfValue = vec3(pow( dot(l, viewReflection), shininess));

		reflectedLight.directSpecular += lightColor * matSpecColor * brdfValue * fLight;
		reflectedLight.directDiffuse  += lightColor * matDiffColor * fLight/PI;
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

#define RE_Direct							RE_Direct_BlinnPhong
#define RE_Direct_RectArea		RE_Direct_RectArea_BlinnPhong
#define RE_Direct_Sphere			RE_Direct_Sphere_BlinnPhong
#define RE_Direct_Disk			  RE_Direct_Disk_BlinnPhong
#define RE_Direct_Tube				RE_Direct_Tube_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong

#define Material_LightProbeLOD( material )	(0)
