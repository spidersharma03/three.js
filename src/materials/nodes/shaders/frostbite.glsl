Source: http://www.frostbite.com/wp-content/uploads/2014/11/course_notes_moving_frostbite_to_pbr.pdf

Spot and Point Lights

float smoothDistanceAtt ( float squaredDistance , float invSqrAttRadius )
2 {
3 float factor = squaredDistance * invSqrAttRadius ;
4 float smoothFactor = saturate (1.0 f - factor * factor );
5 return smoothFactor * smoothFactor ;
6 }
7
8 float getDistanceAtt ( float3 unormalizedLightVector , float invSqrAttRadius )
9 {
10 float sqrDist = dot ( unormalizedLightVector , unormalizedLightVector );
11 float attenuation = 1.0 / (max ( sqrDist , 0.01*0.01) );
12 attenuation *= smoothDistanceAtt ( sqrDist , invSqrAttRadius );
13
14 return attenuation ;
15 }
16
17 float getAngleAtt ( float3 normalizedLightVector , float3 lightDir ,
18 float lightAngleScale , float lightAngleOffset )
19 {
20 // On the CPU
21 // float lightAngleScale = 1.0 f / max (0.001f, ( cosInner - cosOuter ));
22 // float lightAngleOffset = -cosOuter * angleScale ;
23
24 float cd = dot ( lightDir , normalizedLightVector );
25 float attenuation = saturate ( cd * lightAngleScale + lightAngleOffset ) ;
26 // smooth the transition
27 attenuation *= attenuation ;
28
29 return attenuation ;
30 }
31
32 // Process punctual light
33 float3 unnormalizedLightVector = lightPos - worldPos ;
34 float3 L = normalize ( unnormalizedLightVector ) ;
35
36 float att = 1;
37 att *= getDistanceAtt ( unormalizedLightVector , lightInvSqrAttRadius );
38 att *= getAngleAtt (L , lightForward , lightAngleScale , lightAngleOffset );
39
40 float3 luminance = BSDF (...) * saturate ( dot (N , L)) * lightColor * att ;


IES Profile Light

float getIESProfileAttenuation ( float3 L , ShadowLightInfo light )
2 {
3 // Sample direction into light space
4 float3 iesSampleDirection = mul ( light . worldToLight , -L);
5
6 // Cartesian to spherical
7 // Texture encoded with cos( phi ), scale from -1 - >1 to 0 - >1
8 float phiCoord = ( iesSampleDirection .z * 0.5 f) + 0.5 f;
9 float theta = atan2 ( iesSampleDirection .y , iesSampleDirection .x);
10 float thetaCoord = theta * FB_INV_TWO_PI ;
11 float3 texCoord = float3 ( thetaCoord , phiCoord , light . lightIndex );
12 float iesProfileScale = iesTexture . SampleLevel ( sampler , texCoord , 0) .r;
13
14 return iesProfileScale ;
15 }
16
17 ...
18
19 att *= getAngleAtt (L , lightForward , lightAngleScale , lightAngleOffset );
20 att *= getIESProfileAttenuation (L , light );
21 float3 luminance = BSDF (...) * saturate ( dot (N , L)) * lightColor * att ;



Sun Light (Directional Light)

1 float3 D = sunDirection ;
2 float r = sin( sunAngularRadius ); // Disk radius
3 float d = cos( sunAngularRadius ); // Distance to disk
4
5 // Closest point to a disk ( since the radius is small , this is
6 // a good approximation
7 float DdotR = dot (D , R );
8 float3 S = R - DdotR * D;
9 float3 L = DdotR < d ? normalize (d * D + normalize (S) * r) : R;
10
11 // Diffuse and specular evaluation
12 float illuminance = sunIlluminanceInLux * saturate ( dot (N , D));
13
14 // D: Diffuse direction use for diffuse lighting
15 // L: Specular direction use with specular lighting
16 luminance = BSDF (V , D , L , data ) * illuminance ;



Sphere Area Light Diffuse

1 float3 Lunormalized = lightPos - worldPos ;
2 float3 L = normalize ( Lunormalized );
3 float sqrDist = dot ( Lunormalized , Lunormalized );

4 #if WITHOUT_CORRECT_HORIZON // Analytical solution above horizon
6
7 // Patch to Sphere frontal equation ( Quilez version )
8 float sqrLightRadius = light . radius * light . radius ;
9 // Do not allow object to penetrate the light ( max )
10 float illuminance = FB_PI *
11 ( sqrLightRadius / ( max( sqrLightRadius , sqrDist ))) * saturate ( dot ( worldNormal , L) );
12
13 # else // Analytical solution with horizon
14
15 // Tilted patch to sphere equation
16 float Beta = acos ( dot ( worldNormal , L ));
17 float H = sqrt ( sqrDist );
18 float h = H / radius ;
19 float x = sqrt (h * h - 1) ;
20 float y = -x * (1 / tan ( Beta ));
21
22 float illuminance = 0;
23 if (h * cos ( Beta ) > 1)
24 illuminance = cos ( Beta ) / (h * h) ;
25 else
26 {
27 illuminance = (1 / ( FB_PI * h * h)) *
28 ( cos ( Beta ) * acos ( y) - x * sin( Beta ) * sqrt (1 - y * y)) +
29 (1 / FB_PI ) * atan ( sin ( Beta ) * sqrt (1 - y * y) / x );
30 }
31
32 illuminance *= FB_PI ;
33
34 # endif

Disk Area Light Diffuse

float cot ( float x) { return cos (x ) / sin (x); }
2 float acot ( float x) { return atan (1 / x); }
3
4 #if WITHOUT_CORRECT_HORIZON // Analytical solution above horizon
5
6 float illuminance = FB_PI * saturate ( dot ( planeNormal , -L) ) *
7 saturate ( dot( worldNormal , L)) /
8 ( sqrDist / ( radius * radius ) + 1) ;
9
10 # else // Analytical solution with horizon
11
12 // Nearly exact solution with horizon
13 float h = length ( lightPos - worldPos );
14 float r = lightRadius ;
15 float theta = acos ( dot ( worldNormal , L));
16 float H = h / r;
17 float H2 = H * H ;
18 float X = pow ((1 - H2 * cot ( theta ) * cot ( theta )) , 0.5) ;
19
20 float illuminance = 0;
21 if ( theta < acot (1 / H ))
22 {
23 illuminance = (1 / (1 + H2 )) * cos( theta );
24 }
25 else
26 {
27 illuminance = -H * X * sin ( theta ) / ( FB_PI * (1 + H2 ) ) +
28 (1 / FB_PI ) * atan ( X * sin ( theta ) / H ) +
29 cos ( theta ) * ( FB_PI - acos (H * cot ( theta ))) / ( FB_PI * (1 + H2 ) );
30 }
31
32 // Multiply by saturate ( dot ( planeNormal , -L)) to better match ground
33 // truth . Matches perfectly with the first part of the equation but there
34 // is a discrepency with the second part . Still an improvement and it is
35 // good enough .
36 illuminance *= FB_PI * saturate (dot( planeNormal , -L)) ;
37
38 # endif

Combined Disk and Sphere Area Light Diffuse

1
2 // A right disk is a disk oriented to always face the lit surface .
3 // Solid angle of a sphere or a right disk is 2 PI (1 - cos( subtended angle )).
4 // Subtended angle sigma = arcsin (r / d) for a sphere
5 // and sigma = atan (r / d) for a right disk
6 // sinSigmaSqr = sin( subtended angle )^2 , it is (r^2 / d^2) for a sphere
7 // and (r^2 / ( r^2 + d ^2) ) for a disk
8 // cosTheta is not clamped
9 float illuminanceSphereOrDisk ( float cosTheta , float sinSigmaSqr )
10 {
11 float sinTheta = sqrt (1.0 f - cosTheta * cosTheta );
12
13 float illuminance = 0.0 f ;
14 // Note : Following test is equivalent to the original formula .
15 // There is 3 phase in the curve : cosTheta > sqrt ( sinSigmaSqr ),
16 // cosTheta > -sqrt ( sinSigmaSqr ) and else it is 0
17 // The two outer case can be merge into a cosTheta * cosTheta > sinSigmaSqr
18 // and using saturate ( cosTheta ) instead .
19 if ( cosTheta * cosTheta > sinSigmaSqr )
20 {
21 illuminance = FB_PI * sinSigmaSqr * saturate ( cosTheta );
22 }
23 else
24 {
25 float x = sqrt (1.0 f / sinSigmaSqr - 1.0 f) ; // For a disk this simplify to x = d / r
26 float y = -x * ( cosTheta / sinTheta );
27 float sinThetaSqrtY = sinTheta * sqrt (1.0 f - y * y);
28 illuminance = ( cosTheta * acos ( y) - x * sinThetaSqrtY ) * sinSigmaSqr + atan (
sinThetaSqrtY / x);
29 }
30
31 return max ( illuminance , 0.0 f);
32 }
33
34 // Sphere evaluation
35 float cosTheta = clamp ( dot ( worldNormal , L ) , -0.999 , 0.999) ; // Clamp to avoid edge case
36 // We need to prevent the object penetrating into the surface
37 // and we must avoid divide by 0, thus the 0.9999 f
38 float sqrLightRadius = lightRadius * lightRadius ;
39 float sinSigmaSqr = min( sqrLightRadius / sqrDist , 0.9999 f );
40 float illuminance = illuminanceSphereOrDisk ( cosTheta , sinSigmaSqr );
41
42
43 // Disk evaluation
44 float cosTheta = dot ( worldNormal , L) ;
45 float sqrLightRadius = lightRadius * lightRadius ;
46 // Do not let the surface penetrate the light
47 float sinSigmaSqr = sqrLightRadius / ( sqrLightRadius + max ( sqrLightRadius , sqrDist ));
48 // Multiply by saturate ( dot ( planeNormal , -L)) to better match ground truth .
49 float illuminance = illuminanceSphereOrDisk ( cosTheta , sinS

Rectangular Area Light Diffuse

1 float rightPyramidSolidAngle ( float dist , float halfWidth , float halfHeight )
2 {
3 float a = halfWidth ;
4 float b = halfHeight ;
5 float h = dist ;
6
7 return 4 * asin (a * b / sqrt (( a * a + h * h) * (b * b + h * h) ));
8 }
9
10
11 float rectangleSolidAngle ( float3 worldPos ,
12 float3 p0 , float3 p1 ,
13 float3 p2 , float3 p3 )
14 {
15 float3 v0 = p0 - worldPos ;
16 float3 v1 = p1 - worldPos ;
17 float3 v2 = p2 - worldPos ;
18 float3 v3 = p3 - worldPos ;
19
20 float3 n0 = normalize ( cross (v0 , v1 ));
21 float3 n1 = normalize ( cross (v1 , v2 ));
22 float3 n2 = normalize ( cross (v2 , v3 ));
23 float3 n3 = normalize ( cross (v3 , v0 ));
48
24
25 float g0 = acos ( dot (-n0 , n1 ));
26 float g1 = acos ( dot (-n1 , n2 ));
27 float g2 = acos ( dot (-n2 , n3 ));
28 float g3 = acos ( dot (-n3 , n0 ));
29
29
30 return g0 + g1 + g2 + g3 - 2 * FB_PI ;
31 }


 if ( dot ( worldPos - lightPos , lightPlaneNormal ) > 0)
2 {
3 float halfWidth = lightWidth * 0.5;
4 float halfHeight = lightHeight * 0.5;
5 float3 p0 = lightPos + lightLeft * - halfWidth + lightUp * halfHeight ;
6 float3 p1 = lightPos + lightLeft * - halfWidth + lightUp * - halfHeight ;
33For instance, the solid angle of a hemisphere is 2π, the average height of the upper hemisphere of a unit sphere is 1
2
.
The average height is the average cosine between the normal of the hemisphere and the directions. Thus R
Ω+hn · li dl =
2π
1
2 = π.
49
7 float3 p2 = lightPos + lightLeft * halfWidth + lightUp * - halfHeight ;
8 float3 p3 = lightPos + lightLeft * halfWidth + lightUp * halfHeight ;
9 float solidAngle = rectangleSolidAngle ( worldPos , p0 , p1 , p2 , p3 );
10
11 float illuminance = solidAngle * 0.2 * (
12 saturate ( dot( normalize ( p0 - worldPos ) , worldNormal ) +
13 saturate ( dot( normalize ( p1 - worldPos ) , worldNormal ) )+
14 saturate ( dot( normalize ( p2 - worldPos ) , worldNormal ) )+
15 saturate ( dot( normalize ( p3 - worldPos ) , worldNormal ) )+
16 saturate ( dot( normalize ( lightPos - worldPos ) , worldNormal )));
17 }

Capsule / Tube Area Lights Diffuse

1 // Return the closest point on the line ( without limit )
2 float3 closestPointOnLine ( float3 a , float3 b , float3 c)
3 {
4 float3 ab = b - a;
5 float t = dot( c - a , ab ) / dot( ab , ab );
6 return a + t * ab ;
7 }
8
9 // Return the closest point on the segment ( with limit )
10 float3 closestPointOnSegment ( float3 a , float3 b , float3 c)
11 {
12 float3 ab = b - a;
13 float t = dot( c - a , ab ) / dot( ab , ab );
14 return a + saturate (t) * ab ;
15 }
16
17 // The sphere is placed at the nearest point on the segment .
18 // The rectangular plane is define by the following orthonormal frame :
19 float3 forward = normalize ( closestPointOnLine (P0 , P1 , worldPos ) - worldPos );
20 float3 left = lightLeft ;
21 float3 up = cross ( lightLeft , forward );
22
23 float3 p0 = lightPos - left * (0.5 * lightWidth ) + lightRadius * up ;
24 float3 p1 = lightPos - left * (0.5 * lightWidth ) - lightRadius * up ;
25 float3 p2 = lightPos + left * (0.5 * lightWidth ) - lightRadius * up ;
26 float3 p3 = lightPos + left * (0.5 * lightWidth ) + lightRadius * up ;
51
27
28 float solidAngle = rectangleSolidAngle ( worldPos , p0 , p1 , p2 , p3 );
29
30 float illuminance = solidAngle * 0.2 * (
31 saturate ( dot ( normalize ( p0 - worldPos ) , worldNormal )) +
32 saturate ( dot ( normalize ( p1 - worldPos ) , worldNormal )) +
33 saturate ( dot ( normalize ( p2 - worldPos ) , worldNormal )) +
34 saturate ( dot ( normalize ( p3 - worldPos ) , worldNormal )) +
35 saturate ( dot ( normalize ( lightPos - worldPos ) , worldNormal )));
36
37 // We then add the contribution of the sphere
38 float3 spherePosition = closestPointOnSegment (P0 , P1 , worldPos );
39 float3 sphereUnormL = spherePosition - worldPos ;
40 float3 sphereL = normalize ( sphereUnormL );
41 float sqrSphereDistance = dot ( sphereUnormL , sphereUnormL );
42
43 float illuminanceSphere = FB_PI * saturate ( dot ( sphereL , data . worldNormal )) *
44 (( lightRadius * lightRadius ) / sqrSphereDistance );
45
46 illuminance += illuminanceSphere ;

5 Times Rule

1 float3 unnormalizedLightVector = P - worldPos ;
2 float sqrDist = dot ( unnormalizedLightVector , unnormalizedLightVector ) ;
3 float3 L = normalize ( unnormalizedLightVector ) ;
4
5 // Example of sphere five time rules .
6 // In Frostbite is is still required to compensate for the light unit
7 // when using this rule in order to retrieve a punctual light .
8 // Thus in the case of the sphere , the " optimization " is useless .
9 float irradiance = FB_PI * sqrlightRadius * saturate ( cosTheta ) / sqrDist ;
10
11 if ( sqrDist < 100.0 f * sqrlightRadius )
12 {
13 irradiance = irradianceSphereOrDisk ( cosTheta , sinSigmaSqr );
14 }
15
16 // Example of disk five time rules .
17 // We need to take into account the orientation of the disk
18 // and like for sphere we need to compensate for the light unit .
19 // Note that this time we save a few of ALU but this still a useless optimization
20 float irradiance = FB_PI * sqrLightRadius * saturate ( cosTheta ) * saturate ( dot ( planeNormal , -L ))
21 / sqrDist ;
22
23 if ( sqrDist < 100.0 f * sqrLightRadius )
24 {
25 irradiance = irradianceSphereOrDisk ( cosTheta , sinSigmaSqr ) * saturate ( dot ( planeNormal , -L) );
26 }


Get Diffuse Dominant Direction (Not used just light direction is used for Area Lights)

float3 getDiffuseDominantDir ( float N , float NdotV , float roughness )
2 {
3 float a = 1.02341 f * roughness - 1.51174 f;
4 float b = -0.511705 f * roughness + 0.755868 f;
5 lerpFactor = saturate (( NdotV * a + b) * roughness ) ;
6
7 return normalize ( lerp (N , V , lerpFactor )) ;
8 }

